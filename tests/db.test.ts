/**
 * Integration tests for the database layer: RLS, business lifecycle, availability,
 * the booking state machine, contracts (generation, signing, immutability), messaging,
 * reviews and storage access. Runs against the linked Supabase project.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { TRANSITIONS } from "@/lib/bookings/status";
import { PLAN_VEHICLE_LIMIT, RESERVED_SLUGS, TRIAL_DAYS } from "@/lib/constants";
import { anon, completeRenterProfile, day, makeUser, must, service, type TestUser } from "./helpers";

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

  it("creates PENDING_OWNER_APPROVAL requests; pending requests don't block each other", async () => {
    await completeRenterProfile(renter);
    await completeRenterProfile(renter2);
    const args = { p_vehicle_id: vehicleId, p_pickup_at: day(10), p_return_at: day(11), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "GCASH" as const };
    bookingId = must(await renter.client.rpc("request_booking", args));
    booking2Id = must(await renter2.client.rpc("request_booking", { ...args, p_return_at: day(12) }));
    const b = must(await renter.client.from("bookings").select("status, total_amount, conversation_id").eq("id", bookingId).single());
    expect(b.status).toBe("PENDING_OWNER_APPROVAL");
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

  it("approval generates a contract draft; the second overlapping approval is refused", async () => {
    const status = must(await owner.client.rpc("transition_booking", { p_booking_id: bookingId, p_to: "APPROVED" }));
    expect(status).toBe("CONTRACT_DRAFT");
    const c = must(await owner.client.from("contracts").select("status, current_version, contract_versions(version, status, sections)").eq("booking_id", bookingId).single());
    expect(c.current_version).toBe(1);
    const sections = c.contract_versions[0]!.sections as { title: string; body: string }[];
    expect(sections).toHaveLength(19);
    expect(sections[0]!.body).toContain("ZZ Test Car Rental");
    expect(sections[0]!.body).toContain("Juan Dela Cruz");
    expect(sections[0]!.body).not.toMatch(/\{\{/);
    expect(sections[3]!.body).toContain("PHP 1,500.00");

    await expectError(owner.client.rpc("transition_booking", { p_booking_id: booking2Id, p_to: "APPROVED" }), /bookings_no_overlap|VEHICLE_UNAVAILABLE/);
    const again = await renter.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: day(10, 15), p_return_at: day(11, 15), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "CASH",
    });
    expect(JSON.stringify(again.error)).toMatch(/VEHICLE_UNAVAILABLE|DUPLICATE_REQUEST/);
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
    await expectError(owner.client.rpc("send_contract", { p_actor_id: owner.id, p_contract_id: contractId, p_signer_name: "Owner Test", p_ip: "1.2.3.4", p_user_agent: "x" }), /permission denied|42501/);
    await expectError(service.rpc("send_contract", { p_actor_id: renter.id, p_contract_id: contractId, p_signer_name: "Nope", p_ip: "1.2.3.4", p_user_agent: "x" }), "NOT_AUTHORIZED");
    must(await service.rpc("send_contract", { p_actor_id: owner.id, p_contract_id: contractId, p_signer_name: "Owner Test", p_ip: "1.2.3.4", p_user_agent: "vitest" }));
    const v = must(await renter.client.from("contract_versions").select("id, content_hash, status").eq("booking_id", bookingId).single());
    expect(v.status).toBe("SENT");
    versionId = v.id;
    hash = v.content_hash;
  });

  it("viewing moves the booking to AWAITING_SIGNATURE", async () => {
    must(await renter.client.rpc("mark_contract_viewed", { p_contract_id: contractId }));
    const b = must(await renter.client.from("bookings").select("status").eq("id", bookingId).single());
    expect(b.status).toBe("AWAITING_SIGNATURE");
  });

  it("signature must cover the exact content and come from the renter", async () => {
    const base = { p_version_id: versionId, p_signature_type: "TYPED" as const, p_signer_name: "Juan Dela Cruz", p_signature_data: null as never, p_agreed: true, p_ip: "5.6.7.8", p_user_agent: "vitest" };
    await expectError(service.rpc("sign_contract", { ...base, p_actor_id: renter.id, p_content_hash: "tampered" }), "CONTRACT_CHANGED");
    await expectError(service.rpc("sign_contract", { ...base, p_actor_id: renter.id, p_content_hash: hash, p_agreed: false }), "AGREEMENT_REQUIRED");
    await expectError(service.rpc("sign_contract", { ...base, p_actor_id: renter2.id, p_content_hash: hash }), "NOT_AUTHORIZED");
    must(await service.rpc("sign_contract", { ...base, p_actor_id: renter.id, p_content_hash: hash }));
    const b = must(await owner.client.from("bookings").select("status").eq("id", bookingId).single());
    expect(b.status).toBe("CONFIRMED");
    const sigs = must(await renter.client.from("contract_signatures").select("signer_role, ip_address").eq("contract_version_id", versionId));
    expect(sigs.map((s) => s.signer_role).sort()).toEqual(["PROVIDER", "RENTER"]);
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

describe("rental completion & reviews", () => {
  it("only completed rentals can be reviewed, once", async () => {
    // fresh booking through the full path
    const id = must(await renter2.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: day(25), p_return_at: day(26), p_pickup_location: "Cebu City", p_return_location: "Cebu City", p_payment_method: "CASH",
    }));
    must(await owner.client.rpc("transition_booking", { p_booking_id: id, p_to: "APPROVED" }));
    const c = must(await owner.client.from("contracts").select("id").eq("booking_id", id).single());
    must(await service.rpc("send_contract", { p_actor_id: owner.id, p_contract_id: c.id, p_signer_name: "Owner Test", p_ip: "1.1.1.1", p_user_agent: "t" }));
    const v = must(await renter2.client.from("contract_versions").select("id, content_hash").eq("booking_id", id).single());
    must(await service.rpc("sign_contract", { p_actor_id: renter2.id, p_version_id: v.id, p_signature_type: "TYPED", p_signer_name: "Test Renter", p_signature_data: null as never, p_content_hash: v.content_hash, p_agreed: true, p_ip: "1.1.1.1", p_user_agent: "t" }));
    await expectError(renter2.client.rpc("create_review", { p_booking_id: id, p_rating: 5, p_vehicle_rating: 5, p_business_rating: 5, p_comment: "early" }), "REVIEW_NOT_ALLOWED");
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
