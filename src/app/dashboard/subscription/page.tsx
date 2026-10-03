import type { Metadata } from "next";
import { Check, CheckCircle2, Clock, Info } from "lucide-react";
import { cn } from "cn";
import { Pill } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { PayButton } from "@/components/dashboard/pay-button";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasRole, requireBusiness } from "@/lib/auth";
import { getCheckoutSession, paymongoMode, settleCheckoutSession } from "@/lib/billing";
import { BILLED_BY, PLAN_PRICE_CENTAVOS, PLAN_VEHICLE_LIMIT, PLANS, TRIAL_DAYS } from "@/lib/constants";
import { formatDate, formatPHP, labelize } from "@/lib/format";
import { subscriptionState } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Subscription" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function SubscriptionPage({ searchParams }: PageProps<"/dashboard/subscription">) {
  const { payment, cancelled } = (await searchParams) as { payment?: string; cancelled?: string };
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  // Back from PayMongo: settle now if the webhook hasn't yet (idempotent; RLS limits this to the business's own payments).
  let returned = payment && UUID.test(payment)
    ? (await supabase.from("subscription_payments").select("status, plan, period_end, checkout_session_id").eq("id", payment).eq("business_id", business.id).maybeSingle()).data
    : null;
  if (returned?.status === "PENDING" && returned.checkout_session_id && paymongoMode()) {
    try {
      const periodEnd = await settleCheckoutSession(await getCheckoutSession(returned.checkout_session_id));
      if (periodEnd) returned = { ...returned, status: "PAID", period_end: periodEnd };
    } catch (e) {
      console.error("[billing] return sync failed", e);
    }
  }

  const [{ data: sub }, { count }, { data: payments }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("business_id", business.id).single(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("business_id", business.id).is("deleted_at", null),
    supabase.from("subscription_payments").select("id, plan, amount_paid_centavos, payment_method, period_start, period_end, paid_at")
      .eq("business_id", business.id).eq("status", "PAID").order("paid_at", { ascending: false }).limit(24),
  ]);
  const plan = sub?.plan ?? "FREE";
  const limit = PLAN_VEHICLE_LIMIT[plan];
  const state = subscriptionState(sub);
  const isOwner = hasRole(role, "OWNER");
  const canPay = isOwner && business.status === "VERIFIED" && !!paymongoMode();
  const granted = !state.trial && !state.endsAt && state.active; // set by 13C, nothing to pay

  return (
    <>
      <PageHeader eyebrow="Billing" title="Subscription"
        description={`Every business starts with a ${TRIAL_DAYS}-day free trial. Plans are prepaid monthly with GCash, Maya, cards or QR Ph through PayMongo.`} />

      {returned && (
        returned.status === "PAID" ? (
          <p className="mb-6 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" /> Payment received. {labelize(returned.plan)} is active until {formatDate(returned.period_end!)}.
          </p>
        ) : cancelled ? (
          <p className="mb-6 flex items-center gap-2 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700"><Info className="size-5 shrink-0" /> Payment cancelled. You haven&apos;t been charged.</p>
        ) : (
          <p className="mb-6 flex items-center gap-2 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
            <Clock className="size-5 shrink-0" /> We&apos;re confirming your payment with PayMongo. This usually takes under a minute. Refresh this page to check.
          </p>
        )
      )}

      <section className="mb-6 rounded-3xl bg-navy-900 p-6 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow text-cyan">Current plan</p>
          <Pill className={state.ended ? "bg-brand-red text-white" : "bg-white/10 text-white"}>{state.ended ? (state.trial ? "Trial ended" : "Ended") : labelize(sub?.status ?? "ACTIVE")}</Pill>
          {paymongoMode() === "test" && <Pill className="bg-amber-400 text-navy-900">PayMongo test mode</Pill>}
        </div>
        <p className="mt-2 font-display-italic text-4xl">{state.trial ? "Free trial" : labelize(plan)}</p>
        <p className="mt-1 text-sm text-white/80">
          {state.trial && !state.started ? `Your ${TRIAL_DAYS}-day trial starts when 13C verifies your business.`
            : granted ? "Active. Set up by the 13C team."
            : state.ended ? `Ended ${formatDate(state.endsAt!)}. Your store is hidden from customers until you ${state.trial ? "choose a plan" : "pay for another month"}.`
            : `${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left · ${state.trial ? "trial ends" : "paid until"} ${formatDate(state.endsAt!)}`}
        </p>
        <div className="mt-4 max-w-sm">
          <div className="flex justify-between text-sm text-white/80"><span>Vehicles</span><span>{count ?? 0}{limit ? ` / ${limit}` : " · unlimited"}</span></div>
          {limit && <Progress value={Math.min(100, ((count ?? 0) / limit) * 100)} className="mt-2" />}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const current = p.id === plan;
          return (
            <section key={p.id} className={cn("flex flex-col rounded-3xl border bg-white p-6", current && "ring-2 ring-electric")}>
              <p className="font-semibold text-navy-900">{p.name}</p>
              <p className="mt-2"><span className="font-display text-3xl font-bold">{p.price}</span><span className="text-sm text-muted-foreground">{p.period}</span></p>
              <p className="mt-1 text-sm font-medium text-electric">{p.vehicles}</p>
              <ul className="mt-4 grid gap-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-emerald-600" />{f}</li>)}</ul>
              <div className="mt-auto grid gap-2 pt-6">
                {p.id === "FREE" || (current && granted) ? (
                  <span className={buttonVariants({ variant: "secondary", className: "w-full" })}>{current ? "Your plan" : "One-time trial"}</span>
                ) : canPay ? (
                  <>
                    <PayButton plan={p.id} variant={p.id === "PRO" ? "electric" : "outline"}>
                      {current ? (state.active ? "Add 1 month" : "Pay to reactivate") : plan === "FREE" ? `Choose ${p.name}` : `Switch to ${p.name}`} · {formatPHP(PLAN_PRICE_CENTAVOS[p.id] / 100)}
                    </PayButton>
                    <p className="text-center text-xs text-muted-foreground">
                      {current && state.active ? "Adds a month after your current period."
                        : plan === "FREE" && state.active ? "Starts when your trial ends. No auto-renewal."
                        : plan !== "FREE" && state.active ? "Starts now. Unused days carry over at the plan's price."
                        : "Starts now. No auto-renewal."}
                    </p>
                  </>
                ) : (
                  <span className={buttonVariants({ variant: "secondary", className: "w-full" })}>
                    {!isOwner ? "Only the owner can pay" : business.status !== "VERIFIED" ? "Available once verified" : "Online payments coming soon"}
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {canPay && <p className="mt-3 text-xs text-muted-foreground">Payments are processed by PayMongo and billed by {BILLED_BY}, the registered business behind 13C. That&apos;s the name on your checkout page and receipt.</p>}

      {!!payments?.length && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-navy-900">Payment history</h2>
          <div className="w-0 min-w-full overflow-hidden rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Paid</TableHead><TableHead>Plan</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Covers</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>{formatDate(x.paid_at!)}</TableCell>
                    <TableCell>{labelize(x.plan)}</TableCell>
                    <TableCell>{formatPHP((x.amount_paid_centavos ?? 0) / 100, true)}</TableCell>
                    <TableCell>{x.payment_method ? labelize(x.payment_method) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(x.period_start!)} – {formatDate(x.period_end!)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">PayMongo emails a receipt for every payment.</p>
        </section>
      )}
    </>
  );
}
