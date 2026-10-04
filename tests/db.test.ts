/**
 * Integration tests for the database layer: RLS, business lifecycle, availability,
 * the booking state machine, contracts (generation, signing, immutability), messaging,
 * reviews and storage access. Runs against the linked Supabase project.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { TRANSITIONS } from "@/lib/bookings/status";
import { createHmac } from "node:crypto";
import { POST as emailDispatch } from "@/app/api/email/dispatch/route";
import { POST as paymongoWebhook } from "@/app/api/webhooks/paymongo/route";
import { prepareNotificationEmail, templateFor } from "@/lib/notification-email";
import { onRequestError } from "@/instrumentation";
import { PLAN_PRICE_CENTAVOS, PLAN_VEHICLE_LIMIT, RESERVED_SLUGS, TRIAL_DAYS } from "@/lib/constants";
import { anon, completeRenterProfile, day, makeUser, must, service, SIGNATURE, type TestUser } from "./helpers";

let owner: TestUser, admin: TestUser, renter: TestUser, renter2: TestUser, outsider: TestUser;
let businessId: string, vehicleId: string, slug: string;
let bookingId: string, booking2Id: string;

async function expectError(p: PromiseLike<{ error: unknown }>, match: RegExp | string) {
  const { error } = await p;
  expect(error, "expected an error").toBeTruthy();
  expect(JSON.stringify(error)).toMatch(match);
}

beforeAll(async () => {
  [owner, admin, renter, renter2, outsider] = await Promise.all(
    ["owner", "admin", "renter", "renter2", "outsider"].map(makeUser),
  );
  must(await service.from("profiles").update({ is_admin: true }).eq("id", admin.id));
  slug = `zztest-${crypto.randomUUID().slice(0, 8)}`;
});

describe("reference data", () => {
  it("TS state machine matches public.booking_transitions", async () => {
    const rows = must(await renter.client.from("booking_transitions").select("*"));
    const db = rows.map((r) => `${r.from_status}>${r.to_status}>${r.actor}`).sort();
    const ts = TRANSITIONS.map(([f, t, a]) => `${f}>${t}>${a}`).sort();
    expect(ts).toEqual(db);
  });

  it("plan limits and trial length match the database", async () => {
    for (const [plan, limit] of Object.entries(PLAN_VEHICLE_LIMIT)) {
      expect(await anon().rpc("plan_vehicle_limit", { p: plan as "FREE" }).then((r) => r.data), plan).toBe(limit);
    }
    expect(must(await anon().rpc("trial_days"))).toBe(TRIAL_DAYS);
  });

  it("reserved slugs match the database list", async () => {
    for (const s of RESERVED_SLUGS) {
      expect(must(await anon().rpc("is_reserved_slug", { p: s })), s).toBe(true);
    }
    expect(must(await anon().rpc("is_reserved_slug", { p: "cebu-xyz-rental" }))).toBe(false);
  });
});

describe("business lifecycle", () => {
  it("registers a DRAFT business with owner membership, storefront and FREE plan", async () => {
    businessId = must(await owner.client.rpc("register_business", {
      p_name: "ZZ Test Car Rental", p_slug: slug, p_city: "Cebu City", p_address: "1 Test St",
      p_phone: "+63 32 000 0000", p_email: "biz@13c.test", p_representative_name: "Owner Test",
      p_registration_type: "DTI", p_registration_number: "1234567",
    }));
    const biz = must(await owner.client.from("businesses").select("status, business_members(role), subscriptions(plan)").eq("id", businessId).single());
    expect(biz.status).toBe("DRAFT");
    expect(biz.business_members[0]!.role).toBe("OWNER");
    expect(biz.subscriptions?.plan).toBe("FREE");
  });

  it("rejects reserved and duplicate slugs", async () => {
    await expectError(owner.client.rpc("register_business", { p_name: "X", p_slug: "dashboard", p_city: "Cebu City" }), /businesses_slug_check|check/);
    await expectError(owner.client.rpc("register_business", { p_name: "Dup", p_slug: slug, p_city: "Cebu City" }), "SLUG_TAKEN");
  });

  it("owner cannot self-verify; draft business is invisible to the public", async () => {
    await expectError(owner.client.from("businesses").update({ status: "VERIFIED" } as never).eq("id", businessId), /permission denied/);
    const pub = must(await anon().from("businesses").select("id").eq("id", businessId));
    expect(pub).toHaveLength(0);
    await expectError(owner.client.rpc("set_storefront_published", { p_business_id: businessId, p_publish: true }), "BUSINESS_NOT_VERIFIED");
  });

  it("others cannot edit the business", async () => {
    const res = await outsider.client.from("businesses").update({ name: "Hijacked" }).eq("id", businessId).select();
    expect(res.data ?? []).toHaveLength(0);
  });

  it("verification: owner uploads private docs, admin approves", async () => {
    const path = `${businessId}/permit.pdf`;
    must(await owner.client.storage.from("business-docs").upload(path, new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), { contentType: "application/pdf" }));
    const peek = await outsider.client.storage.from("business-docs").download(path);
    expect(peek.error).toBeTruthy();

    must(await owner.client.rpc("submit_business_verification", {
      p_business_id: businessId, p_documents: [{ type: "DTI", path, name: "permit.pdf" }],
    }));
    await expectError(owner.client.rpc("admin_review_business", { p_business_id: businessId, p_decision: "VERIFIED" }), "NOT_AUTHORIZED");
    must(await admin.client.rpc("admin_review_business", { p_business_id: businessId, p_decision: "VERIFIED" }));
    const notes = must(await owner.client.from("notifications").select("type").eq("business_id", businessId));
    expect(notes.map((n) => n.type)).toContain("verification_verified");
  });

  it("payment methods + first vehicle, then publish", async () => {
    must(await owner.client.from("payment_methods").insert([
      { business_id: businessId, method: "GCASH", account_name: "Owner Test", account_number: "0917 000 0000" },
      { business_id: businessId, method: "CASH" },
    ]));
    await expectError(owner.client.rpc("set_storefront_published", { p_business_id: businessId, p_publish: true }), "STORE_NEEDS_VEHICLE");
    vehicleId = must(await owner.client.rpc("save_vehicle", {
      p_business_id: businessId, p_vehicle_id: null as never,
      p_vehicle: { make: "Toyota", model: "Vios", variant: "1.3 XLE", year: 2023, category_slug: "sedan", transmission: "AUTOMATIC",
        fuel_type: "GASOLINE", seats: 5, color: "White", plate_number: "ZZT 1234", city: "Cebu City", self_drive: true, delivery_available: true },
      p_pricing: { daily_rate: 1500, weekly_rate: 9000, security_deposit: 3000, delivery_fee: 300 },
    }));
    must(await owner.client.rpc("set_storefront_published", { p_business_id: businessId, p_publish: true }));
    const v = must(await anon().from("vehicles").select("slug, vehicle_pricing(daily_rate)").eq("id", vehicleId).single());
    expect(v.slug).toBe("toyota-vios-1-3-xle");
    expect(Number(v.vehicle_pricing?.daily_rate)).toBe(1500);
    const found = must(await anon().rpc("search_vehicles", { p_cities: ["Cebu City"], p_q: "vios" }));
    expect(found.map((r) => r.id)).toContain(vehicleId);
  });

  it("enforces the free-trial vehicle limit", async () => {
    const base = { make: "Honda", model: "City", year: 2022, category_slug: "sedan", transmission: "MANUAL", fuel_type: "GASOLINE", seats: 5, city: "Cebu City", status: "INACTIVE" };
    for (let i = 1; i < PLAN_VEHICLE_LIMIT.FREE!; i++) {
      must(await owner.client.rpc("save_vehicle", { p_business_id: businessId, p_vehicle_id: null as never, p_vehicle: base, p_pricing: { daily_rate: 1200 } }));
    }
    await expectError(owner.client.rpc("save_vehicle", { p_business_id: businessId, p_vehicle_id: null as never, p_vehicle: base, p_pricing: { daily_rate: 1200 } }), "PLAN_VEHICLE_LIMIT");
  });

  it("public payment methods expose only method names", async () => {
    const methods = must(await anon().rpc("get_public_payment_methods", { p_business_id: businessId }));
    expect([...methods].sort()).toEqual(["CASH", "GCASH"]);
    await expectError(anon().from("payment_methods").select("*"), /permission denied/);
  });
});

describe("bookings", () => {
  it("quotes with weekly rate applied", async () => {
    const q = must(await anon().rpc("quote_booking", { p_vehicle_id: vehicleId, p_pickup_at: day(10), p_return_at: day(17) })) as Record<string, number | string>;
    expect(q.rental_days).toBe(7);
    expect(Number(q.total_amount)).toBe(9000);
    const q2 = must(await anon().rpc("quote_booking", { p_vehicle_id: vehicleId, p_pickup_at: day(10), p_return_at: day(11), p_delivery: true })) as Record<string, number>;
    expect(Number(q2.total_amount)).toBe(1800);
  });

  it("requires a complete renter profile", async () => {
    await expectError(renter.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: day(10), p_return_at: day(11), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "GCASH",
    }), "RENTER_PROFILE_INCOMPLETE");
  });

  it("requires the driver's license (front and back) and a government ID before booking", async () => {
    await completeRenterProfile(renter, { documents: false });
    await expectError(renter.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: day(10), p_return_at: day(11), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "GCASH",
    }), "RENTER_DOCUMENTS_MISSING");
  });

  it("creates PENDING_OWNER_APPROVAL requests; pending requests don't block each other", async () => {
    await completeRenterProfile(renter);
    await completeRenterProfile(renter2);
    const args = { p_vehicle_id: vehicleId, p_pickup_at: day(10), p_return_at: day(11), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "GCASH" as const };
    bookingId = must(await renter.client.rpc("request_booking", args));
    booking2Id = must(await renter2.client.rpc("request_booking", { ...args, p_return_at: day(12) }));
    const b = must(await renter.client.from("bookings").select("status, total_amount, conversation_id").eq("id", bookingId).single());
    expect(b.status).toBe("PENDING_OWNER_APPROVAL");
    // The business can review the renter's license and ID while deciding; nobody else can.
    expect(must(await owner.client.from("driver_documents").select("doc_type").eq("user_id", renter.id))).toHaveLength(3);
    expect(must(await outsider.client.from("driver_documents").select("doc_type").eq("user_id", renter.id))).toHaveLength(0);
    expect(Number(b.total_amount)).toBe(1500);
    expect(b.conversation_id).toBeTruthy();
    await expectError(renter.client.rpc("request_booking", args), "DUPLICATE_REQUEST");
    await expectError(renter.client.rpc("request_booking", { ...args, p_payment_method: "CARD" }), "PAYMENT_METHOD_NOT_ACCEPTED");
    const notes = must(await owner.client.from("notifications").select("type").eq("type", "booking_request").eq("business_id", businessId));
    expect(notes.length).toBeGreaterThanOrEqual(2);
  });

  it("isolates bookings and renter details by party", async () => {
    const other = must(await renter2.client.from("bookings").select("id").eq("id", bookingId));
    expect(other).toHaveLength(0);
    const asOutsider = must(await outsider.client.from("renters").select("user_id").eq("user_id", renter.id));
    expect(asOutsider).toHaveLength(0);
    const asOwner = must(await owner.client.from("renters").select("license_number").eq("user_id", renter.id).single());
    expect(asOwner.license_number).toBe("G01-23-456789");
  });

  it("renter cannot approve their own request", async () => {
    await expectError(renter.client.rpc("transition_booking", { p_booking_id: bookingId, p_to: "APPROVED" }), "INVALID_TRANSITION");
    await expectError(renter.client.from("bookings").update({ status: "APPROVED" } as never).eq("id", bookingId), /permission denied/);
  });

  it("approval generates a contract draft and declines the other requests for those dates", async () => {
    const status = must(await owner.client.rpc("transition_booking", { p_booking_id: bookingId, p_to: "APPROVED" }));
    expect(status).toBe("CONTRACT_DRAFT");
    const c = must(await owner.client.from("contracts").select("status, current_version, contract_versions(version, status, sections)").eq("booking_id", bookingId).single());
    expect(c.current_version).toBe(1);
    const sections = c.contract_versions[0]!.sections as { title: string; body: string }[];
    expect(sections).toHaveLength(19);
    expect(sections[0]!.body).toContain("ZZ Test Car Rental");
    expect(sections[0]!.body).toContain("Juan Dela Cruz");
    expect(sections[0]!.body).not.toMatch(/\{\{/);
    expect(sections[3]!.body).toContain("₱1,500.00");

    // The other renter's overlapping request was declined automatically, and they were told why.
    const other = must(await owner.client.from("bookings").select("status, cancel_reason").eq("id", booking2Id).single());
    expect(other).toEqual({ status: "REJECTED", cancel_reason: expect.stringContaining("just booked by another renter") });
    const told = must(await renter2.client.from("notifications").select("body").eq("user_id", renter2.id).eq("type", "booking_rejected"));
    expect(told[0]?.body).toContain("just booked by another renter");
    await expectError(owner.client.rpc("transition_booking", { p_booking_id: booking2Id, p_to: "APPROVED" }), "INVALID_TRANSITION");
    const again = await renter.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: day(10, 15), p_return_at: day(11, 15), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "CASH",
    });
    expect(JSON.stringify(again.error)).toMatch(/VEHICLE_UNAVAILABLE|DUPLICATE_REQUEST/);
  });

  it("keeps the business's gap between rentals, and declines requests inside it on approval", async () => {
    must(await owner.client.from("businesses").update({ turnaround_hours: 2 }).eq("id", businessId).select("id"));
    const args = { p_vehicle_id: vehicleId, p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "GCASH" as const };
    // Two pending requests, the second starting 1 hour after the first ends.
    const first = must(await renter.client.rpc("request_booking", { ...args, p_pickup_at: day(40), p_return_at: day(41) }));
    const tooClose = must(await renter2.client.rpc("request_booking", { ...args, p_pickup_at: day(41, 11), p_return_at: day(42) }));
    must(await owner.client.rpc("transition_booking", { p_booking_id: first, p_to: "APPROVED" }));
    expect(must(await owner.client.from("bookings").select("status").eq("id", tooClose).single()).status).toBe("REJECTED");

    // Inside the gap is refused, exactly 2 hours after is fine, and renters' calendars show the gap as booked.
    await expectError(renter2.client.rpc("request_booking", { ...args, p_pickup_at: day(41, 11), p_return_at: day(42) }), "VEHICLE_UNAVAILABLE");
    const after = must(await renter2.client.rpc("request_booking", { ...args, p_pickup_at: day(41, 12), p_return_at: day(42) }));
    const ranges = must(await anon().rpc("vehicle_unavailable_ranges", { p_vehicle_id: vehicleId, p_from: day(39), p_to: day(43) }));
    expect(ranges.map((r) => [r.kind, Date.parse(r.starts_at), Date.parse(r.ends_at)])).toContainEqual(["BOOKED", Date.parse(day(40, 8)), Date.parse(day(41, 12))]);
    must(await owner.client.rpc("transition_booking", { p_booking_id: after, p_to: "APPROVED" }));

    // Free the calendar for later tests.
    for (const id of [first, after]) must(await owner.client.rpc("transition_booking", { p_booking_id: id, p_to: "CANCELLED", p_note: "Test cleanup" }));
    must(await owner.client.from("businesses").update({ turnaround_hours: 0 }).eq("id", businessId).select("id"));
  });

  it("a sample store shows its cars only on its own page, and can't be booked or messaged", async () => {
    must(await service.from("businesses").update({ is_demo: true }).eq("id", businessId).select("id"));
    try {
      expect(must(await anon().rpc("search_vehicles", {})).some((v) => v.business_id === businessId)).toBe(false);
      expect(must(await anon().rpc("search_vehicles", { p_business_id: businessId })).length).toBeGreaterThan(0);
      await expectError(renter.client.rpc("request_booking", {
        p_vehicle_id: vehicleId, p_pickup_at: day(50), p_return_at: day(51), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "GCASH",
      }), "DEMO_STORE");
      await expectError(outsider.client.rpc("start_conversation", { p_business_id: businessId, p_vehicle_id: vehicleId, p_body: "Hi" }), "DEMO_STORE");
      // Only the server can mark a store as a sample.
      await expectError(owner.client.from("businesses").update({ is_demo: false } as never).eq("id", businessId), /permission denied/);
    } finally {
      must(await service.from("businesses").update({ is_demo: false }).eq("id", businessId).select("id"));
    }
  });

  it("calendar blocks cannot overlap confirmed-path bookings", async () => {
    await expectError(owner.client.from("vehicle_blocked_dates").insert({ vehicle_id: vehicleId, starts_at: day(10), ends_at: day(12), reason: "MAINTENANCE" } as never), "BOOKING_CONFLICT");
    must(await owner.client.from("vehicle_blocked_dates").insert({ vehicle_id: vehicleId, starts_at: day(20), ends_at: day(22), reason: "MAINTENANCE" } as never));
    const ranges = must(await anon().rpc("vehicle_unavailable_ranges", { p_vehicle_id: vehicleId, p_from: day(0), p_to: day(30) }));
    expect(ranges.map((r) => r.kind).sort()).toEqual(["BOOKED", "MAINTENANCE"]);
  });

  it("renter does not see the contract until it is sent", async () => {
    const versions = must(await renter.client.from("contract_versions").select("id").eq("booking_id", bookingId));
    expect(versions).toHaveLength(0);
  });
});

describe("contract signing", () => {
  let contractId: string, versionId: string, hash: string;

  it("only the server can send (provider signature captured)", async () => {
    const c = must(await owner.client.from("contracts").select("id").eq("booking_id", bookingId).single());
    contractId = c.id;
    const send = { p_contract_id: contractId, p_signature_type: "DRAWN" as const, p_signature_data: SIGNATURE, p_ip: "1.2.3.4", p_user_agent: "vitest" };
    await expectError(owner.client.rpc("send_contract", { ...send, p_actor_id: owner.id, p_signer_name: "Owner Test" }), /permission denied|42501/);
    await expectError(service.rpc("send_contract", { ...send, p_actor_id: renter.id, p_signer_name: "Nope" }), "NOT_AUTHORIZED");
    await expectError(service.rpc("send_contract", { ...send, p_actor_id: owner.id, p_signer_name: "Owner Test", p_signature_data: "data:image/svg+xml;base64,PHN2Zz4=" }), "contract_signatures_signature_png");
    must(await service.rpc("send_contract", { ...send, p_actor_id: owner.id, p_signer_name: "Owner Test" }));
    const v = must(await renter.client.from("contract_versions").select("id, content_hash, status, sent_to_email").eq("booking_id", bookingId).single());
    expect(v.status).toBe("SENT");
    expect(v.sent_to_email).toBe(renter.email);
    versionId = v.id;
    hash = v.content_hash;
  });

  it("opening is recorded by the server, once, and moves the booking to AWAITING_SIGNATURE", async () => {
    await expectError(renter.client.rpc("mark_contract_viewed", { p_contract_id: contractId }), /permission denied|42501/);
    await expectError(renter.client.rpc("record_contract_view", { p_actor_id: renter.id, p_contract_id: contractId, p_ip: "9.9.9.9", p_user_agent: "forged" }), /permission denied|42501/);
    must(await service.rpc("record_contract_view", { p_actor_id: outsider.id, p_contract_id: contractId, p_ip: "6.6.6.6", p_user_agent: "outsider" }));
    must(await service.rpc("record_contract_view", { p_actor_id: renter.id, p_contract_id: contractId, p_ip: "5.6.7.8", p_user_agent: "vitest-first" }));
    must(await service.rpc("record_contract_view", { p_actor_id: renter.id, p_contract_id: contractId, p_ip: "7.7.7.7", p_user_agent: "vitest-again" }));
    const v = must(await owner.client.from("contract_versions").select("viewed_at, viewed_ip, viewed_user_agent").eq("id", versionId).single());
    expect(v.viewed_at).toBeTruthy();
    expect([v.viewed_ip, v.viewed_user_agent]).toEqual(["5.6.7.8", "vitest-first"]);
    const b = must(await renter.client.from("bookings").select("status").eq("id", bookingId).single());
    expect(b.status).toBe("AWAITING_SIGNATURE");
  });

  it("signature must be a PNG, cover the exact content and come from the renter", async () => {
    const base = { p_version_id: versionId, p_signature_type: "TYPED" as const, p_signer_name: "Juan Dela Cruz", p_signature_data: SIGNATURE, p_agreed: true, p_ip: "5.6.7.8", p_user_agent: "vitest" };
    await expectError(service.rpc("sign_contract", { ...base, p_actor_id: renter.id, p_content_hash: "tampered" }), "CONTRACT_CHANGED");
    await expectError(service.rpc("sign_contract", { ...base, p_actor_id: renter.id, p_content_hash: hash, p_agreed: false }), "AGREEMENT_REQUIRED");
    await expectError(service.rpc("sign_contract", { ...base, p_actor_id: renter2.id, p_content_hash: hash }), "NOT_AUTHORIZED");
    for (const bad of [null, "", "data:image/png;base64,not base64!", "data:image/jpeg;base64,AAAA", `data:image/png;base64,${"A".repeat(400_000)}`]) {
      await expectError(service.rpc("sign_contract", { ...base, p_actor_id: renter.id, p_content_hash: hash, p_signature_data: bad as string }), /contract_signatures_signature_png|23514/);
    }
    // Double submit (two tabs / double click): the row lock lets exactly one through.
    const results = await Promise.all([1, 2, 3].map(() => service.rpc("sign_contract", { ...base, p_actor_id: renter.id, p_content_hash: hash })));
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    for (const r of results.filter((r) => r.error)) expect(JSON.stringify(r.error)).toMatch("CONTRACT_NOT_SIGNABLE");
    const b = must(await owner.client.from("bookings").select("status").eq("id", bookingId).single());
    expect(b.status).toBe("CONFIRMED");
    const sigs = must(await renter.client.from("contract_signatures").select("signer_role, signer_email, signature_data, ip_address").eq("contract_version_id", versionId));
    expect(sigs.map((s) => `${s.signer_role}:${s.signer_email}`).sort()).toEqual([`PROVIDER:${owner.email}`, `RENTER:${renter.email}`]);
    expect(sigs.every((s) => s.signature_data === SIGNATURE)).toBe(true);
    const hist = must(await renter.client.from("booking_status_history").select("to_status").eq("booking_id", bookingId).order("id"));
    expect(hist.map((h) => h.to_status)).toEqual(["PENDING_OWNER_APPROVAL", "APPROVED", "CONTRACT_DRAFT", "CONTRACT_SENT", "AWAITING_SIGNATURE", "SIGNED", "CONFIRMED"]);
  });

  it("signed versions are immutable (even for the secret key)", async () => {
    await expectError(service.from("contract_versions").update({ sections: [] }).eq("id", versionId), "CONTRACT_IMMUTABLE");
    await expectError(service.from("contract_versions").delete().eq("id", versionId), "CONTRACT_IMMUTABLE");
    await expectError(service.from("contract_signatures").delete().eq("contract_version_id", versionId), "CONTRACT_IMMUTABLE");
    must(await service.rpc("attach_contract_pdf", { p_version_id: versionId, p_path: `${businessId}/${bookingId}/${versionId}.pdf`, p_sha256: "abc" }));
    must(await service.rpc("attach_contract_pdf", { p_version_id: versionId, p_path: "overwrite.pdf", p_sha256: "def" }));
    const v = must(await service.from("contract_versions").select("pdf_path").eq("id", versionId).single());
    expect(v.pdf_path).toBe(`${businessId}/${bookingId}/${versionId}.pdf`);
  });

  it("signed PDFs are private to the parties", async () => {
    const path = `${businessId}/${bookingId}/${versionId}.pdf`;
    must(await service.storage.from("contracts").upload(path, new Blob(["%PDF-1.4"], { type: "application/pdf" }), { contentType: "application/pdf" }));
    expect((await renter.client.storage.from("contracts").createSignedUrl(path, 60)).error).toBeNull();
    expect((await owner.client.storage.from("contracts").createSignedUrl(path, 60)).error).toBeNull();
    expect((await outsider.client.storage.from("contracts").createSignedUrl(path, 60)).error).toBeTruthy();
    expect((await renter.client.storage.from("contracts").upload(`${businessId}/${bookingId}/forged.pdf`, new Blob(["x"], { type: "application/pdf" }))).error).toBeTruthy();
  });

  it("amendments create v2 and keep the signed v1", async () => {
    const newVersion = must(await owner.client.rpc("regenerate_contract", { p_booking_id: bookingId }));
    expect(newVersion).toBeTruthy();
    const versions = must(await owner.client.from("contract_versions").select("version, status").eq("booking_id", bookingId).order("version"));
    expect(versions.map((v) => `${v.version}:${v.status}`)).toEqual(["1:SIGNED", "2:DRAFT"]);
    const b = must(await owner.client.from("bookings").select("status").eq("id", bookingId).single());
    expect(b.status).toBe("CONTRACT_DRAFT");
  });
});

describe("messaging", () => {
  it("derives sender role server-side and isolates conversations", async () => {
    const convId = must(await outsider.client.rpc("start_conversation", { p_business_id: businessId, p_vehicle_id: vehicleId, p_body: "Hi, is this available Oct 10–12?" }));
    await expectError(outsider.client.from("messages").insert({ conversation_id: convId, body: "spoof", sender_role: "BUSINESS" } as never), /permission denied/);
    must(await owner.client.from("messages").insert({ conversation_id: convId, body: "Yes it is!" }));
    const msgs = must(await outsider.client.from("messages").select("sender_role, body").eq("conversation_id", convId).order("created_at"));
    expect(msgs.map((m) => m.sender_role)).toEqual(["CUSTOMER", "BUSINESS"]);
    const peek = must(await renter2.client.from("messages").select("id").eq("conversation_id", convId));
    expect(peek).toHaveLength(0);
    await expectError(owner.client.rpc("start_conversation", { p_business_id: businessId, p_vehicle_id: vehicleId, p_body: "self" }), "OWN_BUSINESS");
  });
});

describe("booking proposals in chat", () => {
  it("the proposal is a system message with the booking attached, not the business's own message", async () => {
    const convId = must(await renter2.client.rpc("start_conversation", { p_business_id: businessId, p_vehicle_id: vehicleId, p_body: "Can I book it for a day?" }));
    const before = must(await renter2.client.from("notifications").select("id").eq("user_id", renter2.id).eq("type", "message")).length;
    const bookingId = must(await owner.client.rpc("propose_booking", {
      p_conversation_id: convId, p_vehicle_id: vehicleId, p_pickup_at: day(60), p_return_at: day(61), p_pickup_location: "Cebu City", p_return_location: "Cebu City",
    }));
    const msgs = must(await renter2.client.from("messages").select("sender_role, sender_id, booking_id, body").eq("conversation_id", convId).order("created_at"));
    const proposal = msgs.find((m) => m.booking_id === bookingId)!;
    expect(proposal).toMatchObject({ sender_role: "SYSTEM", sender_id: null });
    expect(proposal.body).toMatch(/^Booking proposal /);
    // The renter hears about it once (booking_proposal), not again as a chat message.
    expect(must(await renter2.client.from("notifications").select("id").eq("user_id", renter2.id).eq("type", "message")).length).toBe(before);
    must(await owner.client.rpc("transition_booking", { p_booking_id: bookingId, p_to: "CANCELLED" }));
  });
});

describe("rental completion & reviews", () => {
  it("only completed rentals can be reviewed, once", async () => {
    // fresh booking through the full path
    const id = must(await renter2.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: day(25), p_return_at: day(26), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "CASH",
    }));
    must(await owner.client.rpc("transition_booking", { p_booking_id: id, p_to: "APPROVED" }));
    const c = must(await owner.client.from("contracts").select("id").eq("booking_id", id).single());
    must(await service.rpc("send_contract", { p_actor_id: owner.id, p_contract_id: c.id, p_signer_name: "Owner Test", p_signature_type: "TYPED", p_signature_data: SIGNATURE, p_ip: "1.1.1.1", p_user_agent: "t" }));
    const v = must(await renter2.client.from("contract_versions").select("id, content_hash").eq("booking_id", id).single());
    must(await service.rpc("sign_contract", { p_actor_id: renter2.id, p_version_id: v.id, p_signature_type: "TYPED", p_signer_name: "Test Renter", p_signature_data: SIGNATURE, p_content_hash: v.content_hash, p_agreed: true, p_ip: "1.1.1.1", p_user_agent: "t" }));
    await expectError(renter2.client.rpc("create_review", { p_booking_id: id, p_rating: 5, p_vehicle_rating: 5, p_business_rating: 5, p_comment: "early" }), "REVIEW_NOT_ALLOWED");
    // Not on rent before the pickup day; once it arrives, the rental can run its course.
    await expectError(owner.client.rpc("transition_booking", { p_booking_id: id, p_to: "ACTIVE" }), "PICKUP_NOT_YET");
    must(await service.from("bookings").update({ pickup_at: new Date(Date.now() - 3_600_000).toISOString(), return_at: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", id));
    for (const to of ["ACTIVE", "RETURNED", "COMPLETED"] as const) {
      must(await owner.client.rpc("transition_booking", { p_booking_id: id, p_to: to }));
    }
    must(await owner.client.from("payments").insert({ booking_id: id, amount: 1500, method: "CASH" } as never));
    const paid = must(await owner.client.from("bookings").select("payment_status").eq("id", id).single());
    expect(paid.payment_status).toBe("PAID");
    await expectError(renter.client.rpc("create_review", { p_booking_id: id, p_rating: 1, p_vehicle_rating: 1, p_business_rating: 1, p_comment: "not mine" }), "NOT_AUTHORIZED");
    must(await renter2.client.rpc("create_review", { p_booking_id: id, p_rating: 5, p_vehicle_rating: 5, p_business_rating: 5, p_comment: "Great car!" }));
    await expectError(renter2.client.rpc("create_review", { p_booking_id: id, p_rating: 4, p_vehicle_rating: 4, p_business_rating: 4, p_comment: "again" }), /reviews_booking_id_key|duplicate/);
    const pub = must(await anon().rpc("public_reviews", { p_business_id: businessId }));
    expect(pub[0]!.reviewer_name).toBe("Juan D.");
    const stats = must(await anon().rpc("business_public_stats", { p_ids: [businessId] }));
    expect(Number(stats[0]!.rating)).toBe(5);
  });
});

describe("free trial", () => {
  it("starts on verification and lasts TRIAL_DAYS", async () => {
    const s = must(await owner.client.from("subscriptions").select("plan, status, current_period_end").eq("business_id", businessId).single());
    expect(s.plan).toBe("FREE");
    expect(s.status).toBe("TRIALING");
    const days = (new Date(s.current_period_end!).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 1);
    expect(days).toBeLessThanOrEqual(TRIAL_DAYS);
  });

  it("an expired trial hides the store and blocks publishing and new vehicles; upgrading restores it", async () => {
    must(await service.from("subscriptions").update({ current_period_end: new Date(Date.now() - 60_000).toISOString() }).eq("business_id", businessId));
    expect(must(await anon().from("businesses").select("id").eq("id", businessId))).toHaveLength(0);
    expect(must(await anon().rpc("search_vehicles", { p_business_id: businessId }))).toHaveLength(0);
    await expectError(owner.client.rpc("set_storefront_published", { p_business_id: businessId, p_publish: true }), "TRIAL_ENDED");
    await expectError(owner.client.rpc("save_vehicle", { p_business_id: businessId, p_vehicle_id: null as never,
      p_vehicle: { make: "Kia", model: "Picanto", year: 2022, category_slug: "hatchback", transmission: "MANUAL", fuel_type: "GASOLINE", seats: 4, city: "Cebu City" },
      p_pricing: { daily_rate: 1000 } }), "TRIAL_ENDED");
    // Renters with bookings still see the business
    expect(must(await renter2.client.from("businesses").select("id").eq("id", businessId))).toHaveLength(1);
    must(await admin.client.rpc("admin_set_plan", { p_business_id: businessId, p_plan: "PRO", p_status: "ACTIVE" }));
    expect(must(await anon().from("businesses").select("id").eq("id", businessId))).toHaveLength(1);
  });
});

describe("subscription payments (PayMongo)", () => {
  const newSession = () => `cs_vitest_${crypto.randomUUID().replaceAll("-", "")}`;
  const checkout = async (plan: "PRO" | "BUSINESS") => {
    const id = must(await service.rpc("create_subscription_checkout", { p_actor_id: owner.id, p_business_id: businessId, p_plan: plan }));
    const session = newSession();
    must(await service.from("subscription_payments").update({ checkout_session_id: session }).eq("id", id));
    return { id, session };
  };
  const pay = (session: string, amount: number, paymentId = `pay_vitest_${crypto.randomUUID().slice(0, 8)}`) =>
    service.rpc("apply_subscription_payment", { p_checkout_session_id: session, p_payment_id: paymentId, p_amount: amount, p_method: "gcash", p_livemode: false });
  const sub = async () => must(await service.from("subscriptions").select("plan, status, current_period_end").eq("business_id", businessId).single());
  const end = async () => new Date((await sub()).current_period_end!).getTime();
  const plusMonth = (t: number) => { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + 1); return d.getTime(); };
  const near = (a: number, b: number, ms = 60_000) => expect(Math.abs(a - b), `${new Date(a).toISOString()} vs ${new Date(b).toISOString()}`).toBeLessThan(ms);

  it("prices in the database match the app", async () => {
    for (const plan of ["FREE", "PRO", "BUSINESS"] as const) {
      expect(must(await service.rpc("plan_price_centavos", { p: plan }))).toBe(PLAN_PRICE_CENTAVOS[plan]);
    }
  });

  it("only the server starts checkouts, for owners of verified businesses, at the plan's price", async () => {
    await expectError(owner.client.rpc("create_subscription_checkout", { p_actor_id: owner.id, p_business_id: businessId, p_plan: "PRO" }), /permission denied|42501/);
    await expectError(service.rpc("create_subscription_checkout", { p_actor_id: outsider.id, p_business_id: businessId, p_plan: "PRO" }), "NOT_AUTHORIZED");
    await expectError(service.rpc("create_subscription_checkout", { p_actor_id: owner.id, p_business_id: businessId, p_plan: "FREE" }), "INVALID_PLAN");
    const { id } = await checkout("BUSINESS");
    const row = must(await owner.client.from("subscription_payments").select("amount_centavos, status, created_by").eq("id", id).single());
    expect(row).toEqual({ amount_centavos: 150000, status: "PENDING", created_by: owner.id });
    expect(must(await outsider.client.from("subscription_payments").select("id").eq("id", id))).toHaveLength(0);
    await expectError(owner.client.from("subscription_payments").update({ status: "PAID" }).eq("id", id), /permission denied/);
    await expectError(owner.client.from("subscription_payments").insert({ business_id: businessId, plan: "PRO", amount_centavos: 1 }), /permission denied/);
    await expectError(owner.client.rpc("apply_subscription_payment", { p_checkout_session_id: "x", p_payment_id: "x", p_amount: 1, p_method: "x", p_livemode: false }), /permission denied|42501/);
  });

  it("paying during the trial adds a month after it ends, exactly once", async () => {
    const trialEnd = Date.now() + 5 * 86400000;
    must(await service.from("subscriptions").update({ plan: "FREE", status: "TRIALING", current_period_end: new Date(trialEnd).toISOString() }).eq("business_id", businessId));
    const { id, session } = await checkout("PRO");
    await expectError(pay(session, 100), "AMOUNT_MISMATCH");
    await expectError(pay(newSession(), 49900), "UNKNOWN_CHECKOUT");
    // Webhook and the success page racing on the same payment
    const results = await Promise.all([pay(session, 49900, "pay_vitest_race"), pay(session, 49900, "pay_vitest_race")]);
    expect(results.map((r) => r.error)).toEqual([null, null]);
    expect(results[0]!.data).toBe(results[1]!.data);
    near(await end(), plusMonth(trialEnd), 5_000);
    expect(await sub()).toMatchObject({ plan: "PRO", status: "ACTIVE" });
    const row = must(await owner.client.from("subscription_payments").select("status, payment_id, period_start").eq("id", id).single());
    expect(row.status).toBe("PAID");
    near(new Date(row.period_start!).getTime(), trialEnd, 5_000);
    const notes = must(await owner.client.from("notifications").select("type").eq("business_id", businessId).eq("type", "subscription_paid"));
    expect(notes).toHaveLength(1);
  });

  it("renewing stacks; switching plans converts unused time at the price ratio", async () => {
    const before = await end();
    await pay((await checkout("PRO")).session, 49900);
    near(await end(), plusMonth(before), 5_000);
    const proEnd = await end();
    await pay((await checkout("BUSINESS")).session, 150000);
    near(await end(), plusMonth(Date.now() + (proEnd - Date.now()) * (49900 / 150000)));
    expect((await sub()).plan).toBe("BUSINESS");
  });

  it("a lapsed plan hides the store and sends one reminder; paying again restores it from now", async () => {
    must(await service.from("subscriptions").update({ current_period_end: new Date(Date.now() - 60_000).toISOString() }).eq("business_id", businessId));
    expect(must(await anon().from("businesses").select("id").eq("id", businessId))).toHaveLength(0);
    must(await service.rpc("send_trial_reminders"));
    must(await service.rpc("send_trial_reminders"));
    expect(must(await owner.client.from("notifications").select("id").eq("business_id", businessId).eq("type", "subscription_ended"))).toHaveLength(1);
    await pay((await checkout("PRO")).session, 49900);
    near(await end(), plusMonth(Date.now()));
    expect(must(await anon().from("businesses").select("id").eq("id", businessId))).toHaveLength(1);
  });

  it("webhook: signature required, settles once, ignores other sessions and events", async () => {
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_vitest_secret";
    const { id, session } = await checkout("PRO");
    const event = (cs: string, type = "checkout_session.payment.paid") => JSON.stringify({ data: { id: "evt_vitest", type: "event", attributes: { type, livemode: false,
      data: { id: cs, type: "checkout_session", attributes: { livemode: false, payment_method_used: "gcash", payments: [{ id: `pay_${cs}`, attributes: { amount: 49900, status: "paid" } }] } } } } });
    const post = (body: string, secret = "whsk_vitest_secret") => {
      const t = String(Math.floor(Date.now() / 1000));
      const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
      return paymongoWebhook(new Request("http://localhost/api/webhooks/paymongo", { method: "POST", body, headers: { "paymongo-signature": `t=${t},te=${sig},li=` } }));
    };
    expect((await paymongoWebhook(new Request("http://localhost/api/webhooks/paymongo", { method: "POST", body: event(session) }))).status).toBe(401);
    expect((await post(event(session), "whsk_wrong")).status).toBe(401);
    const before = await end();
    expect((await post(event(session))).status).toBe(200);
    expect((await post(event(session))).status).toBe(200); // PayMongo retry
    near(await end(), plusMonth(before), 5_000);
    const row = must(await owner.client.from("subscription_payments").select("status, payment_method").eq("id", id).single());
    expect(row).toEqual({ status: "PAID", payment_method: "gcash" });
    expect(await (await post(event(newSession()))).json()).toMatchObject({ ignored: true });
    // PayMongo's dashboard test event: someone else's session, and a payload without the payment amount
    const sample = JSON.stringify({ data: { id: "evt_sample", type: "event", attributes: { type: "checkout_session.payment.paid", livemode: false,
      data: { id: newSession(), type: "checkout_session", attributes: { payments: [{ id: "pay_sample", attributes: { status: "paid" } }] } } } } });
    const sampleRes = await post(sample);
    expect(sampleRes.status).toBe(200);
    expect(await sampleRes.json()).toMatchObject({ ignored: true });
    expect((await post(event(session, "payment.paid"))).status).toBe(200);
  });
});

describe("admin", () => {
  it("admin overview is admin-only", async () => {
    await expectError(owner.client.rpc("admin_overview"), "NOT_AUTHORIZED");
    const o = must(await admin.client.rpc("admin_overview")) as Record<string, unknown>;
    expect(o).toHaveProperty("gmv");
  });

  it("suspension unpublishes the store", async () => {
    must(await admin.client.rpc("admin_review_business", { p_business_id: businessId, p_decision: "SUSPENDED", p_note: "Test suspension" }));
    const pub = must(await anon().from("businesses").select("id").eq("id", businessId));
    expect(pub).toHaveLength(0);
  });
});

describe("notification emails", () => {
  it("only real inboxes are ever emailed", async () => {
    for (const [email, ok] of [["juan@gmail.com", true], ["owner@air-rally.com", true], ["x@13c.test", false], ["a@example", false], ["a@b.example", false], ["nope", false]] as const) {
      expect(must(await service.rpc("is_deliverable_email", { p: email })), email).toBe(ok);
    }
  });

  it("confirming an email creates the welcome notification", async () => {
    const email = `welcome-${crypto.randomUUID().slice(0, 8)}@13c.test`;
    const { data } = await service.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: false, user_metadata: { full_name: "Test welcome" } });
    expect((await service.auth.admin.updateUserById(data.user!.id, { email_confirm: true })).error).toBeNull();
    const n = must(await service.from("notifications").select("type, link").eq("user_id", data.user!.id));
    expect(n).toEqual([{ type: "welcome", link: "/explore" }]);
  });

  it("every notification the suite created renders a complete email", async () => {
    const ids = [owner, admin, renter, renter2, outsider].map((u) => u.id);
    const rows = must(await service.from("notifications").select("id, user_id, business_id, type, title, body, link").in("user_id", ids));
    const one = new Map(rows.map((r) => [`${r.type}|${templateFor(r.type, r.link)}`, r]));
    expect([...one.keys()].map((k) => k.split("|")[0])).toEqual(expect.arrayContaining(["business_submitted", "plan_changed", "booking_request", "booking_request_sent", "contract_sent", "booking_confirmed", "contract_signed", "message", "review_received", "verification_verified", "subscription_paid"]));
    for (const r of one.values()) {
      const mail = await prepareNotificationEmail({ ...r, email: "someone@13c.test", full_name: "Test Person", attempts: 1 });
      expect(mail, r.type).not.toBeNull();
      expect(`${mail!.subject}\n${mail!.text}`, `${r.type} → ${mail!.key}`).not.toMatch(/undefined|NaN|\bnull\b/);
    }
  });

  it("chat messages email only people who are away (5 minutes unread); other notifications go right away", async () => {
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    const rows = must(await service.from("notifications").insert([
      { user_id: renter.id, type: "message", title: "t", body: "just now", link: "/account/messages/x", created_at: minutesAgo(0) },
      { user_id: renter.id, type: "message", title: "t", body: "unread 10 min", link: "/account/messages/x", created_at: minutesAgo(10) },
      { user_id: renter.id, type: "message", title: "t", body: "read in app", link: "/account/messages/x", created_at: minutesAgo(10), read_at: minutesAgo(8) },
      { user_id: renter.id, type: "booking_confirmed", title: "t", body: "now", link: "/account/bookings/x", created_at: minutesAgo(0) },
    ]).select("id, body"));
    const due: Record<string, boolean> = {};
    for (const r of rows) due[r.body!] = must(await service.rpc("notification_email_due", { p_id: r.id })) as boolean;
    expect(due).toEqual({ "just now": false, "unread 10 min": true, "read in app": false, now: true });
    must(await service.from("notifications").delete().in("id", rows.map((r) => r.id)));
  });

  it("the dispatch endpoint needs the shared secret", async () => {
    const call = (auth?: string) => emailDispatch(new Request("http://localhost/api/email/dispatch", { method: "POST", headers: auth ? { authorization: auth } : {} }));
    process.env.EMAIL_DISPATCH_SECRET = "vitest-dispatch-secret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    delete process.env.RESEND_API_KEY; // never send from tests
    expect((await call("Bearer vitest-dispatch-secret")).status).toBe(503);
  });
});

describe("Business plan features (analytics, fleet, contract terms)", () => {
  const setPlan = async (p_plan: "PRO" | "BUSINESS") => must(await admin.client.rpc("admin_set_plan", { p_business_id: businessId, p_plan, p_status: "ACTIVE" }));
  const terms = [{ title: "Travel outside Cebu", body: "Needs the Rental Provider's written approval." }, { title: "Pets", body: "Not allowed." }];

  it("are locked on other plans, in the database and not only the UI", async () => {
    await setPlan("PRO");
    await expectError(owner.client.rpc("save_contract_terms", { p_business_id: businessId, p_terms: terms }), "PLAN_BUSINESS_REQUIRED");
    await expectError(owner.client.rpc("business_analytics_advanced", { p_business_id: businessId, p_days: 30 }), "PLAN_BUSINESS_REQUIRED");
    await expectError(owner.client.from("vehicle_fleet").insert({ vehicle_id: vehicleId, business_id: businessId, odometer_km: 1 }), /row-level security|42501/);
  });

  it("fleet records: managers write, the business is taken from the car, outsiders see nothing", async () => {
    await setPlan("BUSINESS");
    must(await owner.client.from("vehicle_fleet").upsert({ vehicle_id: vehicleId, business_id: crypto.randomUUID(), odometer_km: 48_500, next_service_km: 50_000, insurance_expires_on: "2027-01-31" }).select("vehicle_id"));
    const row = must(await owner.client.from("vehicle_fleet").select("business_id, odometer_km").eq("vehicle_id", vehicleId).single());
    expect(row).toEqual({ business_id: businessId, odometer_km: 48_500 });
    const log = must(await owner.client.from("vehicle_service_logs").insert({ vehicle_id: vehicleId, business_id: businessId, serviced_on: "2026-09-30", kind: "Oil change", cost: 2500 }).select("id").single());
    expect(must(await outsider.client.from("vehicle_fleet").select("vehicle_id").eq("vehicle_id", vehicleId))).toHaveLength(0);
    expect(must(await renter.client.from("vehicle_service_logs").select("id").eq("id", log.id))).toHaveLength(0);
    await expectError(outsider.client.from("vehicle_service_logs").insert({ vehicle_id: vehicleId, business_id: businessId, serviced_on: "2026-09-30", kind: "Fake" }), /row-level security|42501/);
    expect(must(await owner.client.from("vehicle_service_logs").delete().eq("id", log.id).select("id"))).toHaveLength(1);
  });

  it("custom terms are validated and become the last section of new agreements", async () => {
    await expectError(outsider.client.rpc("save_contract_terms", { p_business_id: businessId, p_terms: terms }), "NOT_AUTHORIZED");
    await expectError(owner.client.rpc("save_contract_terms", { p_business_id: businessId, p_terms: [{ title: "x", body: "too short title" }] }), "INVALID_INPUT");
    must(await owner.client.rpc("save_contract_terms", { p_business_id: businessId, p_terms: terms }));

    // The admin tests above suspend the business; make it bookable again.
    must(await admin.client.rpc("admin_review_business", { p_business_id: businessId, p_decision: "VERIFIED" }));
    must(await owner.client.rpc("set_storefront_published", { p_business_id: businessId, p_publish: true }));
    const id = must(await renter2.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: day(250), p_return_at: day(251), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "GCASH",
    }));
    must(await owner.client.rpc("transition_booking", { p_booking_id: id, p_to: "APPROVED" }));
    const v = must(await owner.client.from("contract_versions").select("sections").eq("booking_id", id).single());
    const sections = v.sections as { key: string; title: string; body: string }[];
    const last = sections.at(-1)!;
    expect(last.key).toBe("provider_terms");
    expect(last.title).toBe(`${sections.length}. Additional Terms of the Rental Provider`);
    expect(last.body).toContain("(a) Travel outside Cebu: Needs the Rental Provider's written approval.");
    expect(last.body).toContain("(b) Pets: Not allowed.");
    expect(last.body).toContain(`Sections 1 to ${sections.length - 1}, those Sections prevail`);
    must(await owner.client.rpc("transition_booking", { p_booking_id: id, p_to: "CANCELLED" }));
  });

  it("advanced analytics report each car, 12 months, customers and outcomes", async () => {
    const a = must(await owner.client.rpc("business_analytics_advanced", { p_business_id: businessId, p_days: 90 })) as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual(["customers", "monthly", "outcomes", "period_days", "repeat_rate", "top_customers", "vehicles"]);
    expect((a.monthly as unknown[]).length).toBe(12);
    expect((a.vehicles as { id: string }[]).map((v) => v.id)).toContain(vehicleId);
    expect(a.period_days).toBe(90);
    await expectError(outsider.client.rpc("business_analytics_advanced", { p_business_id: businessId, p_days: 30 }), "NOT_AUTHORIZED");
  });

  // A paid month that ran out without renewal: still BUSINESS, but the period has ended.
  const lapse = async (lapsed: boolean) => must(await service.from("subscriptions")
    .update({ current_period_end: lapsed ? new Date(Date.now() - 86_400_000).toISOString() : null }).eq("business_id", businessId).select("business_id"));

  it("team members can only be added while the Business plan is paid up", async () => {
    const add = () => owner.client.rpc("add_business_member", { p_business_id: businessId, p_email: outsider.email, p_role: "STAFF" });
    await setPlan("PRO");
    await expectError(add(), "PLAN_STAFF_LIMIT");
    await setPlan("BUSINESS");
    must(await add());
    must(await owner.client.rpc("remove_business_member", { p_business_id: businessId, p_user_id: outsider.id }));
    await lapse(true);
    await expectError(add(), "PLAN_STAFF_LIMIT");
    await lapse(false);
  });

  it("fleet reminders reach owners and managers once when an item comes due soon, and once more when it's due", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const inDays = (n: number) => new Date(Date.parse(today) + n * 86_400_000).toISOString().slice(0, 10);
    // Scoped to the test business: the suite runs against the live project.
    const run = async () => must(await service.rpc("send_fleet_reminders", { p_business_id: businessId }));
    const reminders = async (userId: string) => must(await service.from("notifications")
      .select("id, user_id, business_id, type, title, body, link").eq("user_id", userId).eq("type", "fleet_due").order("created_at"));
    must(await owner.client.rpc("add_business_member", { p_business_id: businessId, p_email: outsider.email, p_role: "STAFF" }));
    must(await owner.client.from("vehicle_fleet").upsert({
      vehicle_id: vehicleId, business_id: businessId, registration_expires_on: inDays(12), insurance_expires_on: inDays(200),
      next_service_on: null, odometer_km: 49_600, next_service_km: 50_000,
    }).select("vehicle_id"));

    expect(await run()).toBe(1); // the owner; staff aren't told
    const due = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(inDays(12)));
    let rows = await reminders(owner.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "2 fleet items need attention", link: "/dashboard/fleet" });
    expect(rows[0]!.body).toContain(`(due ${due})`);
    expect(rows[0]!.body).toContain("(due at 50,000 km)");
    expect(await reminders(outsider.id)).toHaveLength(0);
    expect(await run()).toBe(0); // nothing new, nothing repeated

    // Past the service mileage: the same item, now due.
    must(await owner.client.from("vehicle_fleet").update({ odometer_km: 50_100 }).eq("vehicle_id", vehicleId).select("vehicle_id"));
    expect(await run()).toBe(1);
    rows = await reminders(owner.id);
    expect(rows.at(-1)!.title).toBe("1 fleet item needs attention");
    expect(rows.at(-1)!.body).toMatch(/^Service · .+ \(overdue\)$/);

    // The email lists everything due now, overdue first, in the Fleet page's words.
    const mail = await prepareNotificationEmail({ ...rows.at(-1)!, email: "someone@13c.test", full_name: "Test Owner", attempts: 1 });
    expect(mail?.key).toBe("fleet_due");
    expect(mail!.text).toContain("Due in 12 days");
    expect(mail!.text.indexOf("Overdue by 100 km")).toBeGreaterThan(-1);
    expect(mail!.text.indexOf("Overdue by 100 km")).toBeLessThan(mail!.text.indexOf("Due in 12 days"));

    // Nothing once the Business plan has lapsed.
    must(await owner.client.from("vehicle_fleet").update({ insurance_expires_on: inDays(5) }).eq("vehicle_id", vehicleId).select("vehicle_id"));
    await lapse(true);
    expect(await run()).toBe(0);
    await lapse(false);
    must(await owner.client.rpc("remove_business_member", { p_business_id: businessId, p_user_id: outsider.id }));
  });
});

describe("For Business assistant", () => {
  it("counts messages per visitor per day, and only the server can count them", async () => {
    const key = `test-${crypto.randomUUID()}`;
    const allow = async () => must(await service.rpc("assistant_allow", { p_key: key, p_limit: 2 }));
    expect([await allow(), await allow(), await allow()]).toEqual([true, true, false]);
    expect((await anon().rpc("assistant_allow", { p_key: key, p_limit: 1000 })).error).not.toBeNull();
    expect((await anon().from("assistant_usage").select("key")).data).toEqual([]);
    must(await service.from("assistant_usage").delete().eq("key", key).select("key"));
  });
});

describe("site error alerts", () => {
  it("records server errors without the query string and sums them up in one admin email", async () => {
    const admin = await makeUser("erroradmin");
    const tag = `test error ${crypto.randomUUID()}`;
    const context = { routerKind: "App Router", routePath: "/__test__/page", routeType: "render", revalidateReason: undefined } as const;
    // What Next.js calls for every server error.
    await onRequestError(new Error(tag), { path: "/__test__/page?email=someone@example.com", method: "GET", headers: {} }, context);
    await onRequestError(new Error(tag), { path: "/__test__/page", method: "GET", headers: {} }, context);
    const rows = must(await service.from("app_errors").select("path, route, notified_at").eq("message", tag));
    expect(rows).toEqual([1, 2].map(() => ({ path: "/__test__/page", route: "render /__test__/page", notified_at: null })));

    // Sent to one test user (never emailed) and left unmarked; the hourly run tells the admins and marks the errors.
    expect(must(await service.rpc("send_error_summary", { p_user_id: admin.id }))).toBeGreaterThanOrEqual(2);
    const [n] = must(await service.from("notifications").select("id, user_id, business_id, type, title, body, link").eq("user_id", admin.id).eq("type", "site_errors"));
    expect(n!.title).toMatch(/^\d+ server errors? on 13C$/);
    expect(n!.body).toContain(`2× /__test__/page · ${tag}`);
    expect(must(await service.from("app_errors").select("notified_at").eq("message", tag)).every((r) => r.notified_at === null)).toBe(true);
    const mail = await prepareNotificationEmail({ ...n!, email: admin.email, full_name: "Test Admin", attempts: 1 });
    expect(mail?.key).toBe("admin_site_errors");
    expect(mail!.text).toContain(tag);

    // Server only.
    expect((await anon().rpc("send_error_summary", {})).error).not.toBeNull();
    expect((await admin.client.from("app_errors").select("id")).data).toEqual([]);
    must(await service.from("app_errors").delete().eq("message", tag).select("id"));
  });
});
