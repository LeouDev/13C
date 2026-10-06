/** Fast unit tests for pure logic (no network). */
import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses, STATUS_META, TRANSITIONS } from "@/lib/bookings/status";
import { createHmac } from "node:crypto";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { paidPayment, parseWebhookEvent, verifyWebhookSignature } from "@/lib/billing";
import { templateFor } from "@/lib/notification-email";
import { EMAILS } from "@/emails";
import { missingVerificationDocs, PLAN_PRICE_CENTAVOS, PLANS } from "@/lib/constants";
import { renderContractPdf, toWinAnsi, type ContractPdfInput } from "@/lib/contracts/pdf";
import { answerText, faqAnswer } from "@/lib/assistant";
import { cleanText, parseFaqs } from "@/lib/store-writer";
import { blockWindow, coverDays, formatSpan } from "@/lib/calendar";
import { friendlyError } from "@/lib/errors";
import { browserLabel, formatPHP, isoToManilaDate, labelize, manilaToISO, plural } from "@/lib/format";
import { subscriptionState } from "@/lib/plans";
import { storeSections, type Storefront } from "@/lib/queries";
import { dueKm, dueOn } from "@/lib/fleet";
import { toCsv } from "@/lib/csv";
import { groupFingerprint, isValidSignatureImage } from "@/lib/signature";
import { businessSchema, localPhone, phoneSchema, slugSchema, toPhilippinePhone, vehicleSchema } from "@/lib/validation";

describe("booking state machine (UI mirror)", () => {
  it("only businesses approve/reject requests; renters accept proposals", () => {
    expect(canTransition("PENDING_OWNER_APPROVAL", "APPROVED", "BUSINESS")).toBe(true);
    expect(canTransition("PENDING_OWNER_APPROVAL", "APPROVED", "RENTER")).toBe(false);
    expect(canTransition("BOOKING_REQUESTED", "APPROVED", "RENTER")).toBe(true);
    expect(nextStatuses("ACTIVE", "RENTER")).toEqual([]);
    expect(nextStatuses("ACTIVE", "BUSINESS")).toEqual(["RETURNED"]);
  });
  it("signing and sending are system-only", () => {
    for (const actor of ["RENTER", "BUSINESS"] as const) {
      expect(canTransition("CONTRACT_DRAFT", "CONTRACT_SENT", actor)).toBe(false);
      expect(canTransition("AWAITING_SIGNATURE", "SIGNED", actor)).toBe(false);
    }
  });
  it("terminal states have no exits and every status has UI copy", () => {
    for (const s of ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"] as const) expect(TRANSITIONS.some(([f]) => f === s)).toBe(false);
    for (const [, to] of TRANSITIONS) expect(STATUS_META[to].label).toBeTruthy();
  });
});

describe("business verification documents", () => {
  it("need the representative's ID, one business document and a dated car photo (extras don't count)", () => {
    expect(missingVerificationDocs([])).toHaveLength(3);
    expect(missingVerificationDocs(["REPRESENTATIVE_ID", "BIR", "CAR_PHOTO"])).toEqual([]);
    expect(missingVerificationDocs(["REPRESENTATIVE_ID", "INSURANCE", "BUSINESS_PHOTO", "CAR_PHOTO"])).toEqual(["One business document"]);
  });
});

describe("friendly errors", () => {
  it("maps RPC codes and constraint names, never leaks raw SQL", () => {
    expect(friendlyError({ message: "VEHICLE_UNAVAILABLE" })).toMatch(/already booked/);
    expect(friendlyError({ message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"', code: "23P01" })).toMatch(/already booked/);
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "businesses_slug_key"', code: "23505" })).toMatch(/store link is already taken/);
    expect(friendlyError({ message: "new row violates row-level security policy", code: "42501" })).toMatch(/permission/);
    expect(friendlyError({ message: "syntax error at or near select", code: "42601" })).toBe("Something went wrong. Please try again.");
    expect(friendlyError({ message: "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, 0123456789", code: "weak_password" })).toMatch(/letters and numbers/);
    expect(friendlyError({ message: "New password should be different from the old password.", code: "same_password" })).toMatch(/current password/);
  });
});

describe("formatting (Asia/Manila)", () => {
  it("round-trips Manila wall-clock dates", () => {
    const iso = manilaToISO("2026-10-10", "00:30");
    expect(iso).toBe("2026-10-09T16:30:00.000Z");
    expect(isoToManilaDate(iso)).toBe("2026-10-10");
  });
  it("formats pesos and labels", () => {
    expect(formatPHP(1500)).toBe("₱1,500");
    expect(labelize("GCASH")).toBe("GCash");
    expect(labelize("sedan")).toBe("Sedan");
    expect(labelize("PAYMENT_ON_PICKUP")).toBe("Payment on pickup");
    expect(plural(1, "vehicle")).toBe("1 vehicle");
    expect(plural(12, "vehicle")).toBe("12 vehicles");
  });
});

describe("subscription state", () => {
  const now = Date.parse("2026-10-03T00:00:00Z");
  it("free trial counts down, then ends", () => {
    expect(subscriptionState({ plan: "FREE", status: "TRIALING", current_period_end: null }, now)).toMatchObject({ active: true, started: false });
    expect(subscriptionState({ plan: "FREE", status: "TRIALING", current_period_end: "2026-10-28T00:00:00Z" }, now)).toMatchObject({ active: true, daysLeft: 25 });
    expect(subscriptionState({ plan: "FREE", status: "TRIALING", current_period_end: "2026-10-02T00:00:00Z" }, now)).toMatchObject({ active: false, ended: true });
  });
  it("paid plans stay active until cancelled", () => {
    expect(subscriptionState({ plan: "PRO", status: "ACTIVE", current_period_end: null }, now).active).toBe(true);
    expect(subscriptionState({ plan: "BUSINESS", status: "CANCELLED", current_period_end: null }, now).active).toBe(false);
  });
});

describe("paid plan periods", () => {
  it("paid plans run until the end of the paid month", () => {
    const now = new Date("2026-10-03T00:00:00Z").getTime();
    expect(subscriptionState({ plan: "PRO", status: "ACTIVE", current_period_end: "2026-11-03T00:00:00Z" }, now)).toMatchObject({ active: true, trial: false, daysLeft: 31 });
    expect(subscriptionState({ plan: "BUSINESS", status: "ACTIVE", current_period_end: "2026-10-01T00:00:00Z" }, now)).toMatchObject({ active: false, ended: true, trial: false });
  });
  it("advertised prices match the charged amounts", () => {
    for (const p of PLANS) expect(formatPHP(PLAN_PRICE_CENTAVOS[p.id] / 100)).toBe(p.price);
  });
});

describe("PayMongo webhooks", () => {
  const secret = "whsk_test_unit";
  const body = JSON.stringify({ data: { id: "evt_1", type: "event", attributes: { type: "checkout_session.payment.paid", livemode: false,
    data: { id: "cs_1", attributes: { payment_method_used: "gcash", payments: [{ id: "pay_1", attributes: { amount: 49900, status: "paid" } }] } } } } });
  const sign = (t: string, b = body, key = secret) => createHmac("sha256", key).update(`${t}.${b}`).digest("hex");

  it("accepts the test or live signature and rejects anything altered", () => {
    expect(verifyWebhookSignature(`t=1700000000,te=${sign("1700000000")},li=`, body, secret)).toBe(true);
    expect(verifyWebhookSignature(`t=1700000000,te=,li=${sign("1700000000")}`, body, secret)).toBe(true);
    expect(verifyWebhookSignature(`t=1700000000,te=${sign("1700000000")},li=`, `${body} `, secret)).toBe(false);
    expect(verifyWebhookSignature(`t=1700000001,te=${sign("1700000000")},li=`, body, secret)).toBe(false);
    expect(verifyWebhookSignature(`t=1700000000,te=${sign("1700000000", body, "other")},li=`, body, secret)).toBe(false);
    expect(verifyWebhookSignature(null, body, secret)).toBe(false);
  });

  it("reads both documented payload shapes and picks the paid payment", () => {
    const classic = parseWebhookEvent(JSON.parse(body));
    const v2 = parseWebhookEvent({ event_type: "send.webhook", data: { type: "checkout_session.payment.paid", livemode: true, data: { id: "cs_2", attributes: { livemode: true,
      payments: [{ id: "pay_failed", attributes: { amount: 150000, status: "failed" } }, { id: "pay_2", attributes: { amount: 150000, status: "paid", source: { type: "card" } } }] } } } });
    expect([classic.type, classic.resource?.id, v2.type, v2.resource?.id]).toEqual(["checkout_session.payment.paid", "cs_1", "checkout_session.payment.paid", "cs_2"]);
    expect(paidPayment(classic.resource!)).toEqual({ id: "pay_1", amount: 49900, method: "gcash", livemode: false });
    expect(paidPayment(v2.resource!)).toEqual({ id: "pay_2", amount: 150000, method: "card", livemode: true });
    expect(paidPayment({ id: "cs_3", attributes: {} })).toBeNull();
    // A "paid" entry without an amount can't settle anything
    expect(paidPayment({ id: "cs_4", attributes: { payments: [{ id: "pay_x", attributes: { status: "paid" } as never }] } })).toBeNull();
  });
});

describe("notification → email template", () => {
  it("picks the template for the recipient's side", () => {
    expect(templateFor("booking_cancelled", "/account/bookings/x")).toBe("booking_cancelled_by_business");
    expect(templateFor("booking_cancelled", "/dashboard/bookings/x")).toBe("booking_cancelled_by_renter");
    expect(templateFor("message", "/account/messages/x")).toBe("message_to_customer");
    expect(templateFor("message", "/dashboard/messages/x")).toBe("inquiry");
    expect(templateFor("rental_starting", "/dashboard/bookings/x")).toBe("pickup_soon");
    expect(templateFor("verification_submitted", "/admin/businesses/x")).toBe("admin_verification_submitted");
    expect(templateFor("nothing_like_this", "/account")).toBeNull();
  });
  it("every template is reachable from a notification", () => {
    for (const [key, t] of Object.entries(EMAILS)) {
      const nt = (t as { notificationType?: string }).notificationType;
      expect(nt, key).toBeTruthy();
      const link = t.audience === "Admin" ? "/admin/x" : t.audience === "Business" ? "/dashboard/x" : "/account/x";
      expect(templateFor(nt!, link), key).toBe(key);
    }
  });
});

describe("fleet due dates", () => {
  it("flags overdue, today and within 30 days; leaves the rest neutral", () => {
    expect(dueOn("2026-10-01", "2026-10-04")).toMatchObject({ tone: "danger", label: "Overdue by 3 days", urgent: true });
    expect(dueOn("2026-10-04", "2026-10-04")).toMatchObject({ tone: "danger", label: "Due today" });
    expect(dueOn("2026-10-05", "2026-10-04")).toMatchObject({ tone: "warning", label: "Due in 1 day" });
    expect(dueOn("2026-11-03", "2026-10-04")).toMatchObject({ tone: "warning", label: "Due in 30 days" });
    expect(dueOn("2026-11-04", "2026-10-04")).toMatchObject({ tone: "neutral", urgent: false });
    expect(dueOn(null)).toBeNull();
  });
  it("flags service by distance within 1,000 km", () => {
    expect(dueKm(50_000, 50_400)).toMatchObject({ tone: "danger", label: "Overdue by 400 km" });
    expect(dueKm(50_000, 49_200)).toMatchObject({ tone: "warning", label: "Due in 800 km" });
    expect(dueKm(50_000, 40_000)).toMatchObject({ tone: "neutral", urgent: false });
    expect(dueKm(50_000, null)).toBeNull();
  });
});

describe("CSV export", () => {
  it("quotes, escapes and neutralises spreadsheet formulas", () => {
    const csv = toCsv([["Name", "Note", "Total"], ['Juan "JD" Cruz', "=HYPERLINK(\"x\")", 1800], ["Maria, Jr.", "-1+2", null]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Juan ""JD"" Cruz"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Maria, Jr.",\'-1+2,\r\n');
    expect(csv.split("\r\n")[1]).toMatch(/,1800$/);
  });
});

describe("browser labels (signature certificate)", () => {
  it("summarises recorded user agents without inventing detail", () => {
    expect(browserLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")).toBe("Chrome 129 on Windows");
    expect(browserLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone (iOS 18)");
    expect(browserLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.98 Mobile/15E148 Safari/604.1")).toBe("Chrome 128 on iPhone (iOS 17)");
    expect(browserLabel("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36")).toBe("Samsung Internet 25 on Android 14");
    expect(browserLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0")).toBe("Edge 129 on macOS");
    expect(browserLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Firefox 131 on macOS");
    expect(browserLabel("vitest")).toBe("vitest");
    expect(browserLabel(null)).toBeNull();
  });
});

describe("storefront sections (page + tabs)", () => {
  const sf = (store: Partial<Storefront["store"]>, paymentMethods: string[] = []) =>
    ({ store: { about: null, pickup_locations: [], delivery_areas: [], policies: {}, faqs: [], hidden_sections: [], ...store }, paymentMethods }) as unknown as Storefront;

  it("lists only sections that have content and aren't hidden", () => {
    expect(storeSections(sf({}))).toEqual(new Set(["reviews"]));
    expect(storeSections(sf({ about: "  ", policies: { fuel: " " } }))).toEqual(new Set(["reviews"]));
    expect(storeSections(sf({ about: "Since 2019", policies: { fuel: "Full to full" }, hidden_sections: ["reviews"] }))).toEqual(new Set(["about", "policies"]));
    expect(storeSections(sf({ faqs: [{ q: "Pets?", a: "No" }], pickup_locations: ["IT Park"] }, ["CASH"]))).toEqual(new Set(["locations", "policies", "reviews", "faq"]));
  });
});

describe("Philippine phone numbers", () => {
  it("stores every common way of typing a number as +63…", () => {
    for (const typed of ["9399029892", "09399029892", "639399029892", "+63 939 902 9892", "+63-939-902-9892", "0939 902 9892"]) {
      expect(toPhilippinePhone(typed), typed).toBe("+639399029892");
    }
    expect(phoneSchema.parse(" 939 902 9892 ")).toBe("+639399029892");
    expect(phoneSchema.parse("32 234 5678")).toBe("+63322345678"); // Cebu landline
  });
  it("rejects numbers that are too short or long, and shows only the part after +63", () => {
    for (const bad of ["", "0917", "12345", "9399029892123"]) expect(phoneSchema.safeParse(bad).success, bad).toBe(false);
    expect(localPhone("+639399029892")).toBe("9399029892");
    expect(localPhone("+63 939 902 9892")).toBe("939 902 9892");
    expect(localPhone(null)).toBe("");
  });
});

describe("validation", () => {
  it("rejects reserved and malformed store links", () => {
    expect(slugSchema.safeParse("cebu-xyz-rental").success).toBe(true);
    expect(slugSchema.safeParse("admin").success).toBe(false);
    expect(slugSchema.safeParse("-bad").success).toBe(false);
    expect(slugSchema.safeParse("Cebu XYZ").success).toBe(false);
  });
  it("requires self-drive or with-driver", () => {
    const base = { make: "Toyota", model: "Vios", year: 2023, category_slug: "sedan", transmission: "AUTOMATIC", fuel_type: "GASOLINE", seats: 5, status: "ACTIVE", city: "Cebu City", min_rental_days: 1, delivery_available: false };
    expect(vehicleSchema.safeParse({ ...base, self_drive: false, with_driver: false }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, self_drive: true, with_driver: false }).success).toBe(true);
  });
  it("business registration needs legal details", () => {
    const r = businessSchema.safeParse({ name: "X Rental", slug: "x-rental", city: "Cebu City", address: "1 St", phone: "0917", email: "nope" });
    expect(r.success).toBe(false);
  });
});

describe("contract PDF", () => {
  it("normalises text to WinAnsi", () => {
    expect(toWinAnsi("₱1,500 – “ok” → 😀")).toBe('PHP 1,500 - "ok" -> ??');
  });
  const SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const now = new Date().toISOString();
  const doc = (status: ContractPdfInput["status"]): ContractPdfInput => ({
    documentId: crypto.randomUUID(), title: "VEHICLE RENTAL AGREEMENT", version: 2, reference: "13C-TEST01", status, contentHash: "a".repeat(64),
    providerName: "Cebu XYZ Car Rental", renterName: "Juan Dela Cruz",
    sentAt: now, sentTo: "juan@example.com", viewedAt: now, viewedIp: "112.198.5.20", viewedUserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
    sections: Array.from({ length: 19 }, (_, i) => ({ key: `s${i}`, title: `${i + 1}. Section`, body: "Lorem ipsum ₱1,500 ".repeat(40) })),
    signatures: [
      { signer_role: "PROVIDER", signer_name: "Maria Santos", signer_email: "maria@example.com", signature_type: "TYPED", signature_data: SIG, signed_at: now, ip_address: "1.2.3.4", user_agent: "Chrome", content_hash: "a" },
      ...(status === "SIGNED" ? [{ signer_role: "RENTER" as const, signer_name: "Juan Dela Cruz", signature_type: "DRAWN" as const, signature_data: SIG, signed_at: now, ip_address: null, content_hash: "a" }] : []),
    ],
  });

  it("puts the business logo in the letterhead, and still renders when the logo is unusable", async () => {
    const logo = { bytes: Buffer.from(SIG.split(",")[1]!, "base64"), kind: "png" as const };
    const images = async (b: Uint8Array) => (await PDFDocument.load(b)).context.enumerateIndirectObjects()
      .filter(([, o]) => (o as { dict?: PDFDict }).dict?.get(PDFName.of("Subtype")) === PDFName.of("Image")).length;
    // A PNG with transparency adds an image plus its soft mask.
    expect(await images(await renderContractPdf({ ...doc("SENT"), providerLogo: logo }))).toBeGreaterThan(await images(await renderContractPdf(doc("SENT"))));
    const broken = await renderContractPdf({ ...doc("SENT"), providerLogo: { bytes: new Uint8Array([1, 2, 3]), kind: "png" } });
    expect((await PDFDocument.load(broken)).getPageCount()).toBeGreaterThan(0);
  });

  it("embeds a font with the peso sign for body text", async () => {
    const bytes = await renderContractPdf({ ...doc("SENT"), sections: [{ key: "fees", title: "4. Fees", body: "Daily rate ₱1,500.00 · deposit ₱3,000.00 — “cash” ★" }] });
    const loaded = await PDFDocument.load(bytes);
    const fonts = loaded.context.enumerateIndirectObjects()
      .map(([, o]) => (o instanceof PDFDict && o.get(PDFName.of("Type")) === PDFName.of("Font") ? String(o.get(PDFName.of("BaseFont"))) : null))
      .filter(Boolean);
    expect(fonts.some((f) => f!.startsWith("/Geist-Regular")), fonts.join(", ")).toBe(true);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("renders a signed agreement with both signatures and a certificate page", async () => {
    const signed = await renderContractPdf(doc("SIGNED"));
    expect(new TextDecoder().decode(signed.slice(0, 5))).toBe("%PDF-");
    const sent = await renderContractPdf(doc("SENT"));
    const pages = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();
    expect(await pages(signed)).toBe((await pages(sent)) + 1); // the signature certificate
  });

  it("only accepts PNG data URLs as signatures", () => {
    expect(isValidSignatureImage(SIG)).toBe(true);
    for (const bad of [null, "", "data:image/png;base64,", "data:image/png;base64,abc def", "data:image/svg+xml;base64,PHN2Zz4=", "javascript:alert(1)", `data:image/png;base64,${"A".repeat(400_000)}`]) {
      expect(isValidSignatureImage(bad), String(bad).slice(0, 40)).toBe(false);
    }
  });

  it("groups the fingerprint for reading", () => {
    const hex = "0123456789abcdef".repeat(4);
    expect(groupFingerprint(hex)).toBe("01234567 89abcdef ".repeat(4).trim());
    expect(groupFingerprint(hex).replace(/ /g, "")).toBe(hex);
  });
});

describe("assistant", () => {
  it("answers common questions without the AI, on the right topic", () => {
    expect(faqAnswer("Can I see a sample store?")).toContain("13c.online/demo");
    expect(faqAnswer("Ano ang itsura ng website ko?")).toContain("13c.online/demo");
    expect(faqAnswer("Can I try a sample contract?")).toContain("Try a sample contract");
    expect(faqAnswer("What does the contract look like?")).toContain("Try a sample contract");
    expect(faqAnswer("Magkano ang Pro plan?")).toContain("₱499");
    expect(faqAnswer("What's the weather today?")).toContain("I can't answer that right now");
  });

  it("reads the answer's words from the AI's event stream, even when lines and characters arrive split", async () => {
    const event = (delta: object) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
    const raw = event({ role: "assistant" }) + event({ content: "From" }) + event({ content: " ₱499/month" }) + "data: [DONE]\n\n" + event({ content: "ignored" });
    const bytes = new TextEncoder().encode(raw);
    const body = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close(); } });
    const words: string[] = [];
    for await (const w of answerText(body)) words.push(w);
    expect(words).toEqual(["From", " ₱499/month"]);
  });
});

describe("Write with AI (store editor)", () => {
  it("cleans a draft for its field", () => {
    expect(cleanText('"Self-drive cars across Cebu"', 140, true)).toBe("Self-drive cars across Cebu");
    expect(cleanText("**Fast** cars\nSecond line", 140, true)).toBe("Fast cars");
    expect(cleanText('We rent "clean" cars.', 140)).toBe('We rent "clean" cars.');
    expect(cleanText("Late fee ₱___ per hour.\n\n\n\nGrace: ___ hour.", 1500)).toBe("Late fee ₱___ per hour.\n\nGrace: ___ hour.");
    expect(cleanText("one two three", 9)).toBe("one two"); // cut at a word
  });

  it("reads FAQs from the reply", () => {
    const reply = `Here you go:

**Q: Do you deliver to the airport?**
A: Yes, delivery is ₱500.

2. Question: How do I pay?
Answer: GCash, Maya or cash.
We confirm when you pick up.

Q: Hi
A: too short a question

Q: No answer here?`;
    expect(parseFaqs(reply)).toEqual([
      { q: "Do you deliver to the airport?", a: "Yes, delivery is ₱500." },
      { q: "How do I pay?", a: "GCash, Maya or cash. We confirm when you pick up." },
    ]);
    expect(parseFaqs("A valid license is required.")).toEqual([]);
  });
});

describe("calendar: blocks and partly taken days (Asia/Manila)", () => {
  const at = (day: string, time: string) => new Date(`${day}T${time}:00+08:00`).toISOString();

  it("blocks whole days or set hours", () => {
    expect(blockWindow({ from: "2026-10-12", to: "2026-10-13" })).toEqual({ starts_at: at("2026-10-12", "00:00"), ends_at: at("2026-10-14", "00:00") });
    expect(blockWindow({ from: "2026-10-12", to: "2026-10-12", fromTime: "13:00", toTime: "17:00" })).toEqual({ starts_at: at("2026-10-12", "13:00"), ends_at: at("2026-10-12", "17:00") });
  });

  it("marks days a range only partly takes", () => {
    const days = coverDays([{ start: at("2026-10-10", "10:00"), end: at("2026-10-12", "10:00"), kind: "BOOKED" }]);
    expect([...days.keys()]).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(days.get("2026-10-10")).toEqual({ kind: "BOOKED", partial: true, hours: "from 10:00 AM" });
    expect(days.get("2026-10-11")).toEqual({ kind: "BOOKED", partial: false, hours: "all day" });
    expect(days.get("2026-10-12")).toEqual({ kind: "BOOKED", partial: true, hours: "until 10:00 AM" });
  });

  it("joins ranges on the same day, and the busier kind shows", () => {
    const days = coverDays([
      { start: at("2026-10-12", "13:00"), end: at("2026-10-12", "17:00"), kind: "BLOCKED" },
      { start: at("2026-10-12", "08:00"), end: at("2026-10-12", "10:00"), kind: "BOOKED" },
      { start: at("2026-10-13", "00:00"), end: at("2026-10-13", "12:00"), kind: "MAINTENANCE" },
      { start: at("2026-10-13", "12:00"), end: at("2026-10-14", "00:00"), kind: "BLOCKED" },
    ]);
    expect(days.get("2026-10-12")).toEqual({ kind: "BOOKED", partial: true, hours: "8:00 AM–10:00 AM, 1:00 PM–5:00 PM" });
    expect(days.get("2026-10-13")).toEqual({ kind: "MAINTENANCE", partial: false, hours: "all day" });
    expect(days.has("2026-10-14")).toBe(false); // ends at midnight
  });

  it("describes a block", () => {
    expect(formatSpan(at("2026-10-12", "00:00"), at("2026-10-13", "00:00"))).toBe("Oct 12, 2026");
    expect(formatSpan(at("2026-10-12", "00:00"), at("2026-10-15", "00:00"))).toBe("Oct 12, 2026 – Oct 14, 2026");
    expect(formatSpan(at("2026-10-12", "13:00"), at("2026-10-12", "17:00"))).toBe("Oct 12, 2026, 1:00 PM–5:00 PM");
    expect(formatSpan(at("2026-10-12", "18:00"), at("2026-10-14", "08:00"))).toBe("Oct 12, 2026, 6:00 PM – Oct 14, 2026, 8:00 AM");
  });
});
