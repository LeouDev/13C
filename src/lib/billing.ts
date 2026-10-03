import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** PayMongo Hosted Checkout for subscription payments (server only — uses the secret key). */
const API = "https://api.paymongo.com";

export const paymongoMode = () => {
  const key = process.env.PAYMONGO_SECRET_KEY;
  return !key ? null : key.startsWith("sk_live_") ? "live" : "test";
};

// Methods must be enabled on the PayMongo account; override with PAYMONGO_PAYMENT_METHODS="gcash,card,…".
const methods = () => (process.env.PAYMONGO_PAYMENT_METHODS ?? "gcash,paymaya,card,qrph").split(",").map((m) => m.trim()).filter(Boolean);

async function paymongo<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (json as { errors?: { detail?: string }[] } | null)?.errors?.map((e) => e.detail).join("; ");
    throw new Error(`PayMongo ${res.status} ${path}: ${detail ?? res.statusText}`);
  }
  return json as T;
}

export type CheckoutSession = {
  id: string;
  attributes: {
    livemode?: boolean;
    payment_method_used?: string | null;
    payments?: { id: string; attributes: { amount: number; status: string; source?: { type?: string } | null } }[];
  };
};

export async function createCheckoutSession(input: {
  name: string; description: string; amount: number; reference: string; successUrl: string; cancelUrl: string; metadata: Record<string, string>;
}) {
  const { data } = await paymongo<{ data: { id: string; attributes: { checkout_url: string } } }>("/v2/checkout_sessions", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{ name: input.name, description: input.description, amount: input.amount, currency: "PHP", quantity: 1 }],
          payment_method_types: methods(),
          description: input.description,
          reference_number: input.reference,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          send_email_receipt: true,
          metadata: input.metadata,
        },
      },
    }),
  });
  return { id: data.id, url: data.attributes.checkout_url };
}

export async function getCheckoutSession(id: string) {
  return (await paymongo<{ data: CheckoutSession }>(`/v1/checkout_sessions/${encodeURIComponent(id)}`)).data;
}

/** The successful payment on a checkout session, if there is one (with its amount in centavos). */
export function paidPayment(cs: CheckoutSession) {
  const p = cs.attributes.payments?.find((x) => x.attributes?.status === "paid" && typeof x.attributes.amount === "number");
  if (!p) return null;
  return { id: p.id, amount: p.attributes.amount, method: cs.attributes.payment_method_used ?? p.attributes.source?.type ?? null, livemode: !!cs.attributes.livemode };
}

/**
 * `Paymongo-Signature: t=<unix>,te=<test sig>,li=<live sig>`: HMAC-SHA256 of `<t>.<raw body>` with the webhook secret.
 * Either signature matching proves the request came from PayMongo. Replays are harmless: settling is idempotent.
 */
export function verifyWebhookSignature(header: string | null, rawBody: string, secret: string) {
  const parts = Object.fromEntries((header ?? "").split(",").map((kv) => kv.trim().split("=", 2)));
  if (!parts.t) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex"));
  return [parts.te, parts.li].some((sig) => !!sig && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), expected));
}

/** Event type + resource from either payload shape PayMongo documents (`data.attributes.{type,data}` or `data.{type,data}`). */
export function parseWebhookEvent(body: unknown) {
  const d = (body as { data?: { type?: string; data?: unknown; attributes?: { type?: string; data?: unknown } } } | null)?.data;
  return { type: d?.attributes?.type ?? d?.type, resource: (d?.attributes?.data ?? d?.data) as CheckoutSession | undefined };
}

/**
 * A signed checkout_session.payment.paid event. Sessions 13C didn't create (e.g. PayMongo's test events) are
 * ignored; for ours, the payload is used when it carries the paid payment, otherwise PayMongo is asked directly.
 */
export async function settleWebhookSession(resource: CheckoutSession) {
  const { data: ours } = await createAdminClient().from("subscription_payments").select("id").eq("checkout_session_id", resource.id).maybeSingle();
  if (!ours) return "ignored" as const;
  const periodEnd = await settleCheckoutSession(paidPayment(resource) ? resource : await getCheckoutSession(resource.id));
  if (!periodEnd) throw new Error(`Checkout ${resource.id} isn't paid yet`); // PayMongo retries
  return "settled" as const;
}

/** Settles a paid checkout session (idempotent). Returns the new period end, or null if nothing is paid yet. */
export async function settleCheckoutSession(cs: CheckoutSession) {
  const paid = paidPayment(cs);
  if (!paid) return null;
  const { data, error } = await createAdminClient().rpc("apply_subscription_payment", {
    p_checkout_session_id: cs.id, p_payment_id: paid.id, p_amount: paid.amount, p_method: paid.method as string, p_livemode: paid.livemode,
  });
  if (error) throw error;
  return data;
}
