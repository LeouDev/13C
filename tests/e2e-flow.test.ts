/**
 * The MVP success criteria (spec §62): all 35 steps, end to end, against the real project.
 * Uses the same RPCs, storage paths and PDF pipeline as the app's server actions.
 */
import { describe, expect, it } from "vitest";
import { anon, makeUser, must, service, type TestUser } from "./helpers";
import { finalizeSignedPdf } from "@/lib/contracts/service";

// 1×1 PNG — stands in for real photos.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const png = () => new Blob([PNG], { type: "image/png" });
// Oct 10–11 (Manila) — next year if this year's dates have passed.
const year = new Date() < new Date(`${new Date().getFullYear()}-10-09T00:00:00+08:00`) ? new Date().getFullYear() : new Date().getFullYear() + 1;
const PICKUP = new Date(`${year}-10-10T10:00:00+08:00`).toISOString();
const RETURN = new Date(`${year}-10-11T10:00:00+08:00`).toISOString();

describe("MVP workflow (35 steps)", () => {
  let owner: TestUser, admin: TestUser, customer: TestUser;
  let businessId: string, slug: string, vehicleId: string, vehicleSlug: string, conversationId: string, bookingId: string, contractId: string, versionId: string;

  it("Business 1–11: register, verify, brand, add Toyota Vios with photos/price/availability, publish", async () => {
    [owner, admin, customer] = await Promise.all(["e2e-owner", "e2e-admin", "e2e-customer"].map(makeUser));
    must(await service.from("profiles").update({ is_admin: true }).eq("id", admin.id));
    slug = `zztest-cebu-xyz-${crypto.randomUUID().slice(0, 6)}`;

    // 1. Register business
    businessId = must(await owner.client.rpc("register_business", {
      p_name: "ZZ Test Cebu XYZ Car Rental", p_slug: slug, p_city: "Cebu City", p_address: "88 Gorordo Ave, Lahug",
      p_phone: "+63 917 123 4567", p_email: "hello@cebuxyz.test", p_representative_name: "Maria Santos",
      p_representative_title: "Owner", p_registration_type: "DTI", p_registration_number: "DTI-1234567",
      p_description: "Self-drive cars in Cebu City & Mactan",
    }));
    // 2. Submit verification (private documents)
    const doc = `${businessId}/dti.pdf`;
    must(await owner.client.storage.from("business-docs").upload(doc, new Blob(["%PDF-1.4"], { type: "application/pdf" }), { contentType: "application/pdf" }));
    must(await owner.client.rpc("submit_business_verification", { p_business_id: businessId, p_documents: [{ type: "REGISTRATION", path: doc, name: "dti.pdf" }] }));
    // 3. Admin approves
    must(await admin.client.rpc("admin_review_business", { p_business_id: businessId, p_decision: "VERIFIED" }));
    // 4–6. Storefront, logo, cover
    const logo = `b/${businessId}/logo.png`, cover = `b/${businessId}/cover.png`;
    must(await owner.client.storage.from("media").upload(logo, png(), { contentType: "image/png" }));
    must(await owner.client.storage.from("media").upload(cover, png(), { contentType: "image/png" }));
    must(await owner.client.from("businesses").update({ logo_path: logo }).eq("id", businessId));
    must(await owner.client.from("business_storefronts").update({
      cover_path: cover, tagline: "Self-drive vehicles across Cebu.", accent_color: "#E0312B",
      policies: { fuel: "Full-to-full.", cancellation: "Free cancellation up to 48 hours before pickup." },
      faqs: [{ q: "Do you deliver to the airport?", a: "Yes, Mactan-Cebu International Airport for ₱300." }],
    }).eq("business_id", businessId));
    must(await owner.client.from("payment_methods").insert([{ business_id: businessId, method: "GCASH", account_name: "Maria Santos", account_number: "0917 123 4567" }, { business_id: businessId, method: "CASH" }]));
    // 7 + 9. Toyota Vios at ₱1,500/day
    vehicleId = must(await owner.client.rpc("save_vehicle", {
      p_business_id: businessId, p_vehicle_id: null as never,
      p_vehicle: { make: "Toyota", model: "Vios", variant: "1.3 XLE", year: 2023, category_slug: "sedan", transmission: "AUTOMATIC", fuel_type: "GASOLINE",
        seats: 5, color: "White", plate_number: "GAA 1234", city: "Cebu City", self_drive: true, delivery_available: true },
      p_pricing: { daily_rate: 1500, security_deposit: 3000, delivery_fee: 300 },
    }));
    // 8. Photos (main + gallery)
    for (const [i, name] of ["front", "side"].entries()) {
      const path = `b/${businessId}/v/${vehicleId}/${name}.png`;
      must(await owner.client.storage.from("media").upload(path, png(), { contentType: "image/png" }));
      must(await owner.client.from("vehicle_images").insert({ vehicle_id: vehicleId, business_id: businessId, storage_path: path, position: i, width: 1, height: 1 }));
    }
    // 10. Availability: block a maintenance day later in the month
    must(await owner.client.from("vehicle_blocked_dates").insert({ vehicle_id: vehicleId, starts_at: new Date(`${year}-10-20T00:00:00+08:00`).toISOString(), ends_at: new Date(`${year}-10-21T00:00:00+08:00`).toISOString(), reason: "MAINTENANCE" } as never));
    // 11. Publish
    must(await owner.client.rpc("set_storefront_published", { p_business_id: businessId, p_publish: true }));
  });

  it("Customer 12–19: search Cebu, open vehicle & storefront, message, get a reply, request Oct 10–11", async () => {
    // 12–14. Search Cebu → Toyota Vios
    const results = must(await anon().rpc("search_vehicles", { p_cities: ["Cebu City"], p_start: PICKUP, p_end: RETURN, p_q: "vios" }));
    const hit = results.find((r) => r.id === vehicleId);
    expect(hit?.business_slug).toBe(slug);
    expect(Number(hit?.daily_rate)).toBe(1500);
    vehicleSlug = hit!.slug;
    // 15. Vehicle page (public)
    const v = must(await anon().from("vehicles").select("make, model, vehicle_pricing(daily_rate), vehicle_images(storage_path)").eq("business_id", businessId).eq("slug", vehicleSlug).single());
    expect(v.vehicle_images).toHaveLength(2);
    // 16. Storefront (public)
    const store = must(await anon().from("businesses").select("name, status, business_storefronts(tagline, is_published)").eq("slug", slug).single());
    expect(store.status).toBe("VERIFIED");
    expect(store.business_storefronts?.is_published).toBe(true);
    // 17. Message the business
    conversationId = must(await customer.client.rpc("start_conversation", { p_business_id: businessId, p_vehicle_id: vehicleId, p_body: "Hi, is this car available October 10–11? Can you deliver to Mactan Airport?" }));
    // 18. Business replies
    must(await owner.client.from("messages").insert({ conversation_id: conversationId, body: "Yes! Delivery to the airport is ₱300." }));
    const thread = must(await customer.client.from("messages").select("sender_role").eq("conversation_id", conversationId).order("created_at"));
    expect(thread.map((m) => m.sender_role)).toEqual(["CUSTOMER", "BUSINESS"]);
    // 19. Request Oct 10–11
    must(await customer.client.from("profiles").update({ full_name: "Juan Dela Cruz", phone: "+63 918 765 4321" }).eq("id", customer.id));
    must(await customer.client.from("renters").update({ legal_name: "Juan Dela Cruz", address: "12 Mango Ave, Cebu City", license_number: "N01-23-456789" }).eq("user_id", customer.id));
    // License (front/back) and government ID, uploaded privately like the booking page does
    for (const doc_type of ["DRIVERS_LICENSE_FRONT", "DRIVERS_LICENSE_BACK", "GOVERNMENT_ID"] as const) {
      const path = `${customer.id}/${doc_type.toLowerCase()}.png`;
      must(await customer.client.storage.from("kyc").upload(path, png(), { contentType: "image/png" }));
      must(await customer.client.from("driver_documents").insert({ user_id: customer.id, doc_type, storage_path: path }).select("id"));
    }
    bookingId = must(await customer.client.rpc("request_booking", {
      p_vehicle_id: vehicleId, p_pickup_at: PICKUP, p_return_at: RETURN, p_pickup_location: "Mactan-Cebu International Airport",
      p_return_location: "Mactan-Cebu International Airport", p_payment_method: "GCASH", p_delivery: true,
    }));
  });

  it("Business 20–25: receive, review and approve; contract auto-generated, reviewed and sent", async () => {
    // 20. Receives request (notification)
    const notes = must(await owner.client.from("notifications").select("type").eq("business_id", businessId).eq("type", "booking_request"));
    expect(notes.length).toBe(1);
    // 21. Reviews request
    const b = must(await owner.client.from("bookings").select("status, total_amount, payment_method, renter:profiles!bookings_renter_id_fkey(full_name)").eq("id", bookingId).single());
    expect(b.status).toBe("PENDING_OWNER_APPROVAL");
    expect(Number(b.total_amount)).toBe(1800); // 1 day + ₱300 delivery
    expect(b.renter?.full_name).toBe("Juan Dela Cruz");
    // 22–23. Approve → contract generated automatically
    expect(must(await owner.client.rpc("transition_booking", { p_booking_id: bookingId, p_to: "APPROVED" }))).toBe("CONTRACT_DRAFT");
    // 24. Business reviews the auto-filled contract
    const c = must(await owner.client.from("contracts").select("id, contract_versions(sections)").eq("booking_id", bookingId).single());
    contractId = c.id;
    const text = JSON.stringify(c.contract_versions[0]!.sections);
    for (const needle of ["ZZ Test Cebu XYZ Car Rental", "Juan Dela Cruz", "Toyota Vios", "GAA 1234", "₱1,500.00", "₱1,800.00", "GCash", "Full-to-full.", "Maria Santos", "not a party to this rental"]) {
      expect(text, needle).toContain(needle);
    }
    // 25. Sent to customer (provider signature captured server-side)
    must(await service.rpc("send_contract", {
      p_actor_id: owner.id, p_contract_id: contractId, p_signer_name: "Maria Santos", p_signature_type: "TYPED",
      p_signature_data: `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`, p_ip: "203.177.1.10", p_user_agent: "e2e",
    }));
  });

  it("Customer 26–29: open, review, sign, submit", async () => {
    // 26. Opens contract
    const v = must(await customer.client.from("contract_versions").select("id, content_hash, status").eq("booking_id", bookingId).single());
    versionId = v.id;
    must(await service.rpc("record_contract_view", { p_actor_id: customer.id, p_contract_id: contractId, p_ip: "112.198.5.20", p_user_agent: "e2e" }));
    // 27. Reviews (sees the business's signature, sections)
    expect(v.status).toBe("SENT");
    // 28–29. Signs electronically (drawn) and submits
    const drawn = `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`;
    must(await service.rpc("sign_contract", {
      p_actor_id: customer.id, p_version_id: versionId, p_signature_type: "DRAWN", p_signer_name: "Juan Dela Cruz",
      p_signature_data: drawn, p_content_hash: v.content_hash, p_agreed: true, p_ip: "112.198.5.20", p_user_agent: "e2e",
    }));
  });

  it("System 30–35: SIGNED, PDF generated & stored privately, business notified, CONFIRMED, both download", async () => {
    // 31–32. Signed PDF generated and stored (same code path as the signContract server action)
    const path = await finalizeSignedPdf(versionId);
    expect(path).toBe(`${businessId}/${bookingId}/${versionId}.pdf`);
    // 30. Contract SIGNED (and immutable)
    const v = must(await owner.client.from("contract_versions").select("status, pdf_path, pdf_sha256").eq("id", versionId).single());
    expect(v.status).toBe("SIGNED");
    expect(v.pdf_sha256).toMatch(/^[0-9a-f]{64}$/);
    // 33. Business notified
    const notes = must(await owner.client.from("notifications").select("type").eq("business_id", businessId).eq("type", "contract_signed"));
    expect(notes.length).toBe(1);
    // 34. Booking CONFIRMED
    const b = must(await customer.client.from("bookings").select("status").eq("id", bookingId).single());
    expect(b.status).toBe("CONFIRMED");
    // 35. Both parties can download; the public cannot
    for (const party of [owner, customer]) {
      const url = must(await party.client.storage.from("contracts").createSignedUrl(path!, 60)).signedUrl;
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(new TextDecoder().decode((await res.arrayBuffer()).slice(0, 5))).toBe("%PDF-");
    }
    expect((await anon().storage.from("contracts").createSignedUrl(path!, 60)).error).toBeTruthy();
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/contracts/${path}`;
    expect((await fetch(publicUrl)).status).toBeGreaterThanOrEqual(400);
  });
});
