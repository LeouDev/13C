"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { requireBusiness } from "@/lib/auth";
import { createCheckoutSession, paymongoMode } from "@/lib/billing";
import { PLAN_PRICE_CENTAVOS, PLANS, SITE_URL } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/** Owner pays for one month of Pro or Business on PayMongo's hosted checkout. Returns the checkout URL. */
export async function startCheckout(plan: "PRO" | "BUSINESS"): Promise<ActionResult<{ url: string }>> {
  const parsed = z.enum(["PRO", "BUSINESS"]).safeParse(plan);
  if (!parsed.success) return { ok: false, error: "Choose Pro or Business." };
  if (!paymongoMode()) return { ok: false, error: "Online payments aren't available yet. Email support@air-rally.com to upgrade." };
  const { user, business } = await requireBusiness("OWNER");

  const admin = createAdminClient();
  const { data: paymentId, error } = await admin.rpc("create_subscription_checkout", { p_actor_id: user.id, p_business_id: business.id, p_plan: parsed.data });
  if (error) return fail(error);

  const p = PLANS.find((x) => x.id === parsed.data)!;
  const back = `${SITE_URL}/dashboard/subscription?payment=${paymentId}`;
  try {
    const cs = await createCheckoutSession({
      name: `13C ${p.name} plan · 1 month`,
      description: `${business.name} · ${p.vehicles}`,
      amount: PLAN_PRICE_CENTAVOS[parsed.data],
      reference: paymentId,
      successUrl: back,
      cancelUrl: `${back}&cancelled=1`,
      metadata: { subscription_payment_id: paymentId, business_id: business.id, plan: parsed.data },
    });
    const { error: attachError } = await admin.from("subscription_payments").update({ checkout_session_id: cs.id }).eq("id", paymentId);
    if (attachError) throw attachError;
    return ok({ url: cs.url });
  } catch (e) {
    await admin.from("subscription_payments").delete().eq("id", paymentId).eq("status", "PENDING");
    return fail(e, "We couldn't start the payment. Please try again in a moment.");
  }
}
