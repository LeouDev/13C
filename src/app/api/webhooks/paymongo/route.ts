import { NextResponse } from "next/server";
import { parseWebhookEvent, settleCheckoutSession, verifyWebhookSignature } from "@/lib/billing";

/** PayMongo webhook. Subscribe the endpoint to `checkout_session.payment.paid`. */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !verifyWebhookSignature(request.headers.get("paymongo-signature"), raw, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let event: ReturnType<typeof parseWebhookEvent>;
  try {
    event = parseWebhookEvent(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (event.type !== "checkout_session.payment.paid" || !event.resource?.id) return NextResponse.json({ received: true });

  try {
    await settleCheckoutSession(event.resource);
  } catch (e) {
    // Sessions created outside 13C (e.g. payment links on the same account) aren't ours to settle.
    if (JSON.stringify(e).includes("UNKNOWN_CHECKOUT")) return NextResponse.json({ received: true, ignored: true });
    console.error("[paymongo] webhook settle failed", e);
    return NextResponse.json({ error: "Not processed" }, { status: 500 }); // PayMongo retries
  }
  return NextResponse.json({ received: true });
}
