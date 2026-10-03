import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { cn } from "cn";
import { AvailabilityManager } from "@/components/business/availability-manager";
import { PhotoManager } from "@/components/business/photo-manager";
import { VehicleForm } from "@/components/business/vehicle-form";
import { Pill, VEHICLE_STATUS_TONE } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { BLOCKING_STATUSES } from "@/lib/bookings/status";
import { labelize } from "@/lib/format";
import { getCategories } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit vehicle" };

const TABS = [["details", "Details & pricing"], ["photos", "Photos"], ["availability", "Availability"]] as const;

export default async function VehiclePage({ params, searchParams }: PageProps<"/dashboard/vehicles/[id]">) {
  const { id } = await params;
  const { tab = "details", new: isNew } = (await searchParams) as { tab?: string; new?: string };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*, vehicle_pricing(*), vehicle_images(id, storage_path, position)")
    .eq("id", id).eq("business_id", business.id).is("deleted_at", null).order("position", { referencedTable: "vehicle_images" }).maybeSingle();
  if (!vehicle) notFound();

  return (
    <>
      <Link href="/dashboard/vehicles" className="mb-3 inline-block text-sm text-muted-foreground hover:text-navy-900">← Vehicles</Link>
      <PageHeader eyebrow="Fleet" title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        description={isNew ? "Vehicle added! Now add photos so customers can see it." : vehicle.variant ?? undefined}
        actions={<>
          <Pill tone={VEHICLE_STATUS_TONE[vehicle.status]}>{labelize(vehicle.status)}</Pill>
          <Link href={`/${business.slug}/${vehicle.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-electric hover:underline">View on store <ExternalLink className="size-3.5" /></Link>
        </>} />
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-border sm:w-fit" aria-label="Vehicle sections">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`?tab=${key}`} className={cn("rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap", tab === key ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-canvas")}>
            {label}{key === "photos" && ` (${vehicle.vehicle_images.length})`}
          </Link>
        ))}
      </nav>
      {tab === "photos" ? (
        <PhotoManager businessId={business.id} vehicleId={vehicle.id} images={vehicle.vehicle_images} />
      ) : tab === "availability" ? (
        <Availability vehicleId={vehicle.id} />
      ) : (
        <VehicleForm businessId={business.id} businessCity={business.city} categories={await getCategories()} vehicle={vehicle} />
      )}
    </>
  );
}

async function Availability({ vehicleId }: { vehicleId: string }) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: blocks }, { data: bookings }] = await Promise.all([
    supabase.from("vehicle_blocked_dates").select("id, starts_at, ends_at, reason, note").eq("vehicle_id", vehicleId).gte("ends_at", now).order("starts_at"),
    supabase.from("bookings").select("pickup_at, return_at, status").eq("vehicle_id", vehicleId).gte("return_at", now)
      .in("status", [...BLOCKING_STATUSES, "PENDING_OWNER_APPROVAL", "BOOKING_REQUESTED"]),
  ]);
  return (
    <AvailabilityManager vehicleId={vehicleId} blocks={blocks ?? []}
      bookings={(bookings ?? []).map((b) => ({ start: b.pickup_at, end: b.return_at, kind: BLOCKING_STATUSES.includes(b.status) ? "BOOKED" : "PENDING" }))} />
  );
}
