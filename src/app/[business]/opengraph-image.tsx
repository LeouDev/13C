import { plural } from "@/lib/format";
import { OG_SIZE, OG_TYPE, shareCard } from "@/lib/og";
import { getStorefront } from "@/lib/queries";
import { mediaUrl } from "@/lib/storage";

export const alt = "A car rental store on 13C";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ business: string }> }) {
  const sf = await getStorefront((await params).business);
  if (!sf) return shareCard({ title: "Car rentals from local Cebu businesses", address: "www.13c.online" });
  const { business, stats } = sf;
  return shareCard({
    title: business.name,
    lines: [
      `Car rental in ${business.city}`,
      [stats?.vehicle_count ? plural(stats.vehicle_count, "vehicle") : null, stats?.review_count ? `Rated ${stats.rating.toFixed(1)}` : null].filter(Boolean).join(" · "),
    ].filter(Boolean),
    address: `13c.online/${business.slug}`,
    logo: mediaUrl(business.logo_path),
  });
}
