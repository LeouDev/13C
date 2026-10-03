import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverDocuments } from "@/components/account/account-panels";
import { BookingRequestForm } from "@/components/storefront/booking-request-form";
import { requireUser } from "@/lib/auth";
import { getStorefront, getVehicleBySlug } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Request booking", robots: { index: false } };

export default async function BookPage({ params, searchParams }: PageProps<"/[business]/[vehicle]/book">) {
  const { business: slug, vehicle: vehicleSlug } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const user = await requireUser(`/${slug}/${vehicleSlug}/book${qs ? `?${qs}` : ""}`);
  const sf = await getStorefront(slug);
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
        />
      )}
    </div>
  );
}
