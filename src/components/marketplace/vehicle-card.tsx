import Link from "next/link";
import { ArrowUpRight, Cog, Fuel, MapPin, Users } from "lucide-react";
import { Rating, VerifiedBadge } from "@/components/common/badges";
import { VehicleImage } from "@/components/common/vehicle-image";
import { formatPHP, labelize } from "@/lib/format";
import type { VehicleResult } from "@/lib/queries";

/** Marketplace vehicle card. `hideBusiness` on storefronts, where the business is implicit. */
export function VehicleCard({ v, hideBusiness, query, priority }: { v: VehicleResult; hideBusiness?: boolean; query?: string; priority?: boolean }) {
  const href = `/${v.business_slug}/${v.slug}${query ? `?${query}` : ""}`;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(18,31,59,0.35)]">
      <VehicleImage path={v.image_path} alt={`${v.make} ${v.model}`} className="aspect-[16/10]" priority={priority} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
      <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-navy-900 backdrop-blur">
        {labelize(v.category_slug)}
      </span>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-bold tracking-tight text-navy-900">
              <Link href={href} className="after:absolute after:inset-0">
                {v.make} <span style={{ color: v.accent_color ?? undefined }} className="text-electric">{v.model}</span>
              </Link>
            </h3>
            <p className="truncate text-xs text-muted-foreground">{v.year}{v.variant ? ` · ${v.variant}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl leading-none font-bold text-navy-900">{formatPHP(v.daily_rate)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">per day</p>
          </div>
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] font-medium text-navy-800">
          <li className="flex items-center gap-1 rounded-lg bg-canvas px-2 py-1.5"><Cog className="size-3.5 text-electric" />{v.transmission === "AUTOMATIC" ? "Auto" : "Manual"}</li>
          <li className="flex items-center gap-1 rounded-lg bg-canvas px-2 py-1.5"><Users className="size-3.5 text-electric" />{v.seats} seats</li>
          <li className="flex items-center gap-1 rounded-lg bg-canvas px-2 py-1.5"><Fuel className="size-3.5 text-electric" />{labelize(v.fuel_type)}</li>
        </ul>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-3.5" /> {v.city}
          {v.delivery_available && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Delivery</span>}
          {v.with_driver && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">{v.self_drive ? "Driver option" : "With driver"}</span>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed pt-3 mt-4">
          {hideBusiness ? (
            <Rating value={v.rating} count={v.review_count} />
          ) : (
            <Link href={`/${v.business_slug}`} className="relative z-10 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-navy-900 hover:underline">
              <span className="truncate">{v.business_name}</span>
              <VerifiedBadge compact />
            </Link>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition group-hover:bg-electric">
            View car <ArrowUpRight className="size-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
