import { formatPHP, labelize, plural } from "@/lib/format";
import { OG_SIZE, OG_TYPE, shareCard } from "@/lib/og";
import { getStorefront, getVehicleBySlug } from "@/lib/queries";
import { mediaUrl } from "@/lib/storage";

export const alt = "A car for rent on 13C";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ business: string; vehicle: string }> }) {
  const { business: slug, vehicle: vehicleSlug } = await params;
  const sf = await getStorefront(slug);
  const v = sf ? await getVehicleBySlug(sf.business.id, vehicleSlug) : null;
  if (!sf || !v) return shareCard({ title: "Car rentals from local Cebu businesses", address: "www.13c.online" });
  return shareCard({
    title: `${v.year} ${v.make} ${v.model}`,
    lines: [
      `${formatPHP(v.vehicle_pricing?.daily_rate)}/day · ${labelize(v.transmission)} · ${plural(v.seats, "seat")}`,
      `${sf.business.name} · ${v.city}`,
    ],
    address: `13c.online/${sf.business.slug}/${v.slug}`,
    logo: mediaUrl(sf.business.logo_path),
  });
}
