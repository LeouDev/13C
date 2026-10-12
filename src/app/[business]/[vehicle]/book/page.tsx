import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverDocuments } from "@/components/account/account-panels";
import { PracticeBooking } from "@/components/site/practice-booking";
import { BookingRequestForm } from "@/components/storefront/booking-request-form";
import { requireUser } from "@/lib/auth";
import { sampleAgreement } from "@/lib/contracts/sample";
import { formatDateTime, formatPHP, isoDaysFromNow, labelize, manilaToISO, todayManila } from "@/lib/format";
import { getStorefront, getVehicleBySlug, type Storefront } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Request booking", robots: { index: false } };

export default async function BookPage({ params, searchParams }: PageProps<"/[business]/[vehicle]/book">) {
  const { business: slug, vehicle: vehicleSlug } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const sf = await getStorefront(slug);
  if (sf?.business.is_demo) return <Practice sf={sf} vehicleSlug={vehicleSlug} sp={sp} />;
  const user = await requireUser(`/${slug}/${vehicleSlug}/book${qs ? `?${qs}` : ""}`);
  if (!sf) notFound();
  const v = await getVehicleBySlug(sf.business.id, vehicleSlug);
  if (!v || v.status !== "ACTIVE") notFound();

  const supabase = await createClient();
  const [{ data: renter }, { data: docs }] = await Promise.all([
    supabase.from("renters").select("*").eq("user_id", user.id).single(),
    supabase.from("driver_documents").select("doc_type, storage_path").eq("user_id", user.id),
  ]);
  const docsReady = new Set(docs?.map((d) => d.doc_type)).size >= 3;
  const renterInput = {
    full_name: user.full_name, phone: user.phone ?? "", legal_name: renter?.legal_name ?? "", date_of_birth: renter?.date_of_birth ?? "",
    address: renter?.address ?? "", city: renter?.city ?? "", license_number: renter?.license_number ?? "", license_expiry: renter?.license_expiry ?? "",
  };
  const complete = !!(user.full_name && user.phone && renter?.address && renter?.license_number);

  return (
    <div className="container-page py-8">
      <Link href={`/${slug}/${vehicleSlug}`} className="text-sm text-muted-foreground hover:text-navy-900">← Back to {v.make} {v.model}</Link>
      <h1 className="mt-3 mb-6 text-3xl font-extrabold tracking-tight text-navy-900">Request your booking</h1>
      {sf.paymentMethods.length === 0 ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{sf.business.name} hasn&apos;t set up payment methods yet. Message them to book.</p>
      ) : (
        <BookingRequestForm
          vehicle={{ id: v.id, name: `${v.year} ${v.make} ${v.model}`, self_drive: v.self_drive, with_driver: v.with_driver, delivery_available: v.delivery_available }}
          businessName={sf.business.name}
          methods={sf.paymentMethods}
          pickupDefault={v.pickup_location || sf.store.pickup_locations[0] || sf.business.city}
          renter={renterInput}
          profileComplete={complete}
          docsReady={docsReady}
          documents={<DriverDocuments userId={user.id} docs={docs ?? []} />}
          initial={{ from: sp.from, to: sp.to, ft: sp.ft, tt: sp.tt, driver: sp.driver === "1", delivery: sp.delivery === "1" }}
          downPayment={{ percent: sf.business.down_payment_percent, hours: sf.business.down_payment_hours }}
        />
      )}
    </div>
  );
}

/** The sample store: a practice booking with this car, these dates and the real price; no sign-in, nothing saved. */
async function Practice({ sf, vehicleSlug, sp }: { sf: Storefront; vehicleSlug: string; sp: Record<string, string | undefined> }) {
  const v = await getVehicleBySlug(sf.business.id, vehicleSlug);
  if (!v || v.status !== "ACTIVE") notFound();
  const day = (d: string | undefined, fallback: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallback);
  const time = (t: string | undefined) => (t && /^\d{2}:\d{2}$/.test(t) ? t : "10:00");
  const pickupAt = manilaToISO(day(sp.from, todayManila(1)), time(sp.ft));
  const returnAt = manilaToISO(day(sp.to, todayManila(2)), time(sp.tt));
  const withDriver = sp.driver === "1" && v.with_driver, delivery = sp.delivery === "1" && v.delivery_available;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_booking", { p_vehicle_id: v.id, p_pickup_at: pickupAt, p_return_at: returnAt, p_with_driver: withDriver, p_delivery: delivery });
  const carHref = `/${sf.business.slug}/${v.slug}`;
  if (error || !data) {
    return (
      <div className="container-page py-10 text-sm">
        <p>Those dates don&apos;t work for a booking. <Link href={carHref} className="font-semibold underline">Choose other dates</Link>.</p>
      </div>
    );
  }
  const q = data as { rental_days: number; daily_rate: number; base_amount: number; driver_fee: number; delivery_fee: number; total_amount: number; security_deposit: number };
  const b = sf.business, policies = sf.store.policies as Record<string, string | undefined>;
  const method = labelize(sf.paymentMethods.find((m) => m === "GCASH") ?? sf.paymentMethods[0] ?? "GCASH");
  const percent = b.down_payment_percent || 20;
  const dueAt = isoDaysFromNow(b.down_payment_hours / 24);
  const dueBy = formatDateTime(dueAt < pickupAt ? dueAt : pickupAt); // like a real approval: due in N hours, never after pickup
  const place = v.pickup_location || sf.store.pickup_locations[0] || b.city;
  const car = `${v.year} ${v.make} ${v.model}`;
  const money = (n: number) => formatPHP(n, true);
  const contract = await sampleAgreement({
    booking_reference: "13C-PRACTICE", provider_name: b.name, provider_city: b.city,
    provider_address: [b.address, b.city, b.province].filter(Boolean).join(", "),
    ...(b.representative_name ? { provider_representative: [b.representative_name, b.representative_title ?? "Owner"].join(", ") } : {}),
    ...(b.registration_number ? { provider_registration: `${b.registration_type ?? "DTI"} No. ${b.registration_number}` } : {}),
    vehicle_name: [car, v.variant].filter(Boolean).join(" "), vehicle_color: v.color ?? "—", vehicle_seats: String(v.seats),
    vehicle_transmission: labelize(v.transmission), vehicle_fuel: labelize(v.fuel_type), service_type: withDriver ? "With driver" : "Self-drive",
    pickup_at: formatDateTime(pickupAt), return_at: formatDateTime(returnAt), pickup_location: place, return_location: place,
    rental_days: String(q.rental_days), daily_rate: money(q.daily_rate), base_amount: money(q.base_amount), driver_fee: money(q.driver_fee),
    delivery_fee: money(q.delivery_fee), total_amount: money(q.total_amount), security_deposit: money(q.security_deposit),
    payment_method: method, payment_status: "Partially paid",
    ...Object.fromEntries(([["fuel", "fuel_policy"], ["late_return", "late_return_policy"], ["cancellation", "cancellation_policy"], ["deposit", "deposit_policy"],
      ["requirements", "requirements_policy"], ["prohibited", "prohibited_use_extra"], ["mileage", "mileage_policy"]] as const)
      .filter(([k]) => policies?.[k]).map(([k, key]) => [key, policies[k]!])),
  });
  const lines: [string, number][] = [[`${q.rental_days} day${q.rental_days === 1 ? "" : "s"} × ${formatPHP(q.daily_rate)}`, q.base_amount]];
  if (q.driver_fee > 0) lines.push(["Driver", q.driver_fee]);
  if (q.delivery_fee > 0) lines.push(["Delivery", q.delivery_fee]);
  return (
    <PracticeBooking store={{ name: b.name, storeHref: `/${b.slug}` }} contract={contract}
      trip={{ car, carHref, pickup: formatDateTime(pickupAt), dropoff: formatDateTime(returnAt), place, lines, total: q.total_amount, deposit: q.security_deposit,
        method, down: { percent, amount: Math.round((q.total_amount * percent) / 100), dueBy, askedByStore: b.down_payment_percent > 0 } }} />
  );
}
