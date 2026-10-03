import { createHash } from "node:crypto";
import { SITE_URL, storeDisplayUrl } from "@/lib/constants";
import { formatPHP, labelize, plural } from "@/lib/format";
import type { getVehicleBySlug, Storefront } from "@/lib/queries";
import { mediaUrl } from "@/lib/storage";

/** What a share card shows. Built once here for both the image route and the page's metadata. */
export type CardInput = { title: string; lines: string[]; address: string; photo: string | null; logo: string | null };
type Vehicle = NonNullable<Awaited<ReturnType<typeof getVehicleBySlug>>>;

export function storeCardInput({ business, store, stats }: Storefront): CardInput {
  const facts = [stats?.vehicle_count ? plural(stats.vehicle_count, "vehicle") : null, stats?.review_count ? `Rated ${stats.rating.toFixed(1)}` : null];
  return {
    title: business.name,
    lines: [`Car rental in ${business.city}`, facts.filter(Boolean).join(" · ")].filter(Boolean),
    address: storeDisplayUrl(business.slug),
    photo: mediaUrl(store.cover_path),
    logo: mediaUrl(business.logo_path),
  };
}

export function carCardInput({ business }: Storefront, v: Vehicle): CardInput {
  return {
    title: `${v.year} ${v.make} ${v.model}`,
    lines: [`${formatPHP(v.vehicle_pricing?.daily_rate)}/day · ${labelize(v.transmission)} · ${plural(v.seats, "seat")}`, `${business.name} · ${v.city}`],
    address: `${storeDisplayUrl(business.slug)}/${v.slug}`,
    photo: mediaUrl(v.vehicle_images[0]?.storage_path),
    logo: mediaUrl(business.logo_path),
  };
}

/**
 * og:image for a share card: the card served as JPEG by the image optimizer. As PNG a photo card is ~1 MB, and
 * WhatsApp drops preview images over ~300 KB. `v` follows the card's content, so no cache serves an old card.
 */
export function shareCardImage(path: string, input: CardInput) {
  const v = createHash("sha1").update(JSON.stringify(input)).digest("hex").slice(0, 12);
  const src = `${SITE_URL}/api/share-card/${path}?v=${v}`;
  return { url: `/_next/image?url=${encodeURIComponent(src)}&w=1200&q=75`, width: 1200, height: 630, alt: input.title };
}
