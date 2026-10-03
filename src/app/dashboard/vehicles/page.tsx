import type { Metadata } from "next";
import Link from "next/link";
import { Car, Plus } from "lucide-react";
import { Pill, VEHICLE_STATUS_TONE } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { VehicleImage } from "@/components/common/vehicle-image";
import { VehicleRowActions } from "@/components/business/vehicle-row-actions";
import { buttonVariants } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { PLAN_VEHICLE_LIMIT } from "@/lib/constants";
import { formatPHP, labelize } from "@/lib/format";
import { subscriptionState } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vehicles" };

export default async function VehiclesPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const [{ data: vehicles }, { data: sub }] = await Promise.all([
    supabase.from("vehicles").select("id, slug, make, model, variant, year, status, seats, transmission, city, vehicle_pricing(daily_rate), vehicle_images(storage_path, position)")
      .eq("business_id", business.id).is("deleted_at", null).order("created_at").order("position", { referencedTable: "vehicle_images" }),
    supabase.from("subscriptions").select("plan, status, current_period_end").eq("business_id", business.id).single(),
  ]);
  const limit = PLAN_VEHICLE_LIMIT[sub?.plan ?? "FREE"];
  const count = vehicles?.length ?? 0;
  const atLimit = (limit !== null && count >= limit) || !subscriptionState(sub).active;

  return (
    <>
      <PageHeader eyebrow="Fleet" title="Vehicles"
        description={!subscriptionState(sub).active ? "Your free trial has ended — upgrade to add vehicles." : limit ? `${count} of ${limit} vehicles on the ${labelize(sub?.plan ?? "FREE")} plan.` : `${count} vehicles`}
        actions={atLimit
          ? <Link href="/dashboard/subscription" className={buttonVariants({ variant: "electric", size: "lg" })}>Upgrade to add more</Link>
          : <Link href="/dashboard/vehicles/new" className={buttonVariants({ size: "lg" })}><Plus /> Add vehicle</Link>} />
      {count === 0 ? (
        <EmptyState icon={Car} title="Add your first vehicle" description="Photos, pricing and availability — customers can book as soon as your store is published." action={{ label: "Add vehicle", href: "/dashboard/vehicles/new" }} />
      ) : (
        <ul className="grid gap-3">
          {vehicles!.map((v) => (
            <li key={v.id} className="flex items-center gap-4 rounded-2xl border bg-white p-3">
              <Link href={`/dashboard/vehicles/${v.id}`} className="shrink-0"><VehicleImage path={v.vehicle_images[0]?.storage_path} alt={`${v.make} ${v.model}`} className="h-16 w-24 rounded-xl sm:h-20 sm:w-32" sizes="128px" /></Link>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/vehicles/${v.id}`} className="font-semibold text-navy-900 hover:text-electric">{v.year} {v.make} {v.model} {v.variant}</Link>
                <p className="text-xs text-muted-foreground">{labelize(v.transmission)} · {v.seats} seats · {v.city} · {v.vehicle_images.length} photos</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Pill tone={VEHICLE_STATUS_TONE[v.status]}>{labelize(v.status)}</Pill>
                  {v.vehicle_images.length === 0 && <Pill tone="warning">No photos</Pill>}
                </div>
              </div>
              <p className="hidden text-right sm:block"><span className="font-display text-lg font-bold">{formatPHP(v.vehicle_pricing?.daily_rate)}</span><span className="block text-xs text-muted-foreground">per day</span></p>
              <VehicleRowActions id={v.id} status={v.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
