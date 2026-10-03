import { shareCard } from "@/lib/og";
import { getStorefront, getVehicleBySlug } from "@/lib/queries";
import { carCardInput } from "@/lib/share-card";

/** A car's share card (PNG); pages link to it as JPEG through the image optimizer (see shareCardImage). */
export async function GET(_request: Request, { params }: RouteContext<"/api/share-card/[business]/[vehicle]">) {
  const { business, vehicle } = await params;
  const sf = await getStorefront(business);
  const v = sf ? await getVehicleBySlug(sf.business.id, vehicle) : null;
  return sf && v ? shareCard(carCardInput(sf, v)) : new Response("Not found", { status: 404 });
}
