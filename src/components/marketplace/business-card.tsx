import Image from "next/image";
import Link from "next/link";
import { Car, MapPin } from "lucide-react";
import { Rating, VerifiedBadge } from "@/components/common/badges";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { plural } from "@/lib/format";
import { mediaUrl } from "@/lib/storage";
import type { FeaturedBusiness } from "@/lib/queries";

export function BusinessCard({ b }: { b: FeaturedBusiness }) {
  const store = b.business_storefronts;
  const cover = mediaUrl(store?.cover_path);
  const accent = store?.accent_color ?? "#2F6BFF";
  return (
    <Link href={`/${b.slug}`} className="group block overflow-hidden rounded-3xl border border-black/5 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(18,31,59,0.35)]">
      <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}, #121f3b)` }}>
        {cover && <Image src={cover} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />}
      </div>
      <div className="relative px-4 pb-4">
        <BusinessLogo path={b.logo_path} name={b.name} accent={accent} className="-mt-7 size-14 border-4 border-white" />
        <div className="mt-2 flex items-center gap-2">
          <h3 className="truncate font-bold text-navy-900">{b.name}</h3>
          <VerifiedBadge compact />
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{store?.tagline || b.description || "Car rental in Cebu"}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <Rating value={b.stats?.rating} count={b.stats?.review_count} />
          <span className="flex items-center gap-1"><Car className="size-3.5" />{plural(Number(b.stats?.vehicle_count ?? 0), "vehicle")}</span>
          <span className="flex items-center gap-1"><MapPin className="size-3.5" />{b.city}</span>
        </div>
      </div>
    </Link>
  );
}
