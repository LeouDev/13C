import { shareCard } from "@/lib/og";
import { getStorefront } from "@/lib/queries";
import { storeCardInput } from "@/lib/share-card";

/** A store's share card (PNG); pages link to it as JPEG through the image optimizer (see shareCardImage). */
export async function GET(_request: Request, { params }: RouteContext<"/api/share-card/[business]">) {
  const sf = await getStorefront((await params).business);
  return sf ? shareCard(storeCardInput(sf)) : new Response("Not found", { status: 404 });
}
