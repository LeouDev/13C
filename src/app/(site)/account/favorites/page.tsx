import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/states";
import { VehicleImage } from "@/components/common/vehicle-image";
import { requireUser } from "@/lib/auth";
import { formatPHP } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved cars" };

export default async function FavoritesPage() {
  const user = await requireUser("/account/favorites");
  const supabase = await createClient();
  const { data } = await supabase.from("favorites")
    .select("created_at, vehicles(id, slug, make, model, year, status, deleted_at, vehicle_pricing(daily_rate), vehicle_images(storage_path, position), businesses(name, slug))")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  const items = (data ?? []).map((f) => f.vehicles).filter((v) => v && !v.deleted_at);
  return (
    <>
      <PageHeader title="Saved cars" />
      {items.length === 0 ? <EmptyState icon={Heart} title="No saved cars" description="Tap the heart on any car to save it here." action={{ label: "Find a car", href: "/explore" }} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => v && (
            <Link key={v.id} href={`/${v.businesses?.slug}/${v.slug}`} className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 hover:ring-electric/40">
              <VehicleImage path={[...v.vehicle_images].sort((a, b) => a.position - b.position)[0]?.storage_path} alt="" className="aspect-[16/10]" />
              <div className="p-4">
                <p className="font-semibold text-navy-900">{v.year} {v.make} {v.model}</p>
                <p className="text-sm text-muted-foreground">{v.businesses?.name} · {formatPHP(v.vehicle_pricing?.daily_rate)}/day{v.status !== "ACTIVE" ? " · currently unavailable" : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
