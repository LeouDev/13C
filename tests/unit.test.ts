/** Fast unit tests for pure logic (no network). */
import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses, STATUS_META, TRANSITIONS } from "@/lib/bookings/status";
import { PDFDocument } from "pdf-lib";
import { renderContractPdf, toWinAnsi, type ContractPdfInput } from "@/lib/contracts/pdf";
import { friendlyError } from "@/lib/errors";
import { formatPHP, isoToManilaDate, labelize, manilaToISO, plural } from "@/lib/format";
import { subscriptionState } from "@/lib/plans";
import { groupFingerprint, isValidSignatureImage } from "@/lib/signature";
import { businessSchema, slugSchema, vehicleSchema } from "@/lib/validation";

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

describe("friendly errors", () => {
  it("maps RPC codes and constraint names, never leaks raw SQL", () => {
    expect(friendlyError({ message: "VEHICLE_UNAVAILABLE" })).toMatch(/already booked/);
    expect(friendlyError({ message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"', code: "23P01" })).toMatch(/already booked/);
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "businesses_slug_key"', code: "23505" })).toMatch(/store link is already taken/);
    expect(friendlyError({ message: "new row violates row-level security policy", code: "42501" })).toMatch(/permission/);
    expect(friendlyError({ message: "syntax error at or near select", code: "42601" })).toBe("Something went wrong. Please try again.");
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
