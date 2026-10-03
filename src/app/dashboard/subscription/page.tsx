import type { Metadata } from "next";
import { Check } from "lucide-react";
import { cn } from "cn";
import { Pill } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireBusiness } from "@/lib/auth";
import { PLAN_VEHICLE_LIMIT, PLANS, TRIAL_DAYS } from "@/lib/constants";
import { formatDate, labelize } from "@/lib/format";
import { subscriptionState } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Subscription" };

export default async function SubscriptionPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const [{ data: sub }, { count }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("business_id", business.id).single(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("business_id", business.id).is("deleted_at", null),
  ]);
  const plan = sub?.plan ?? "FREE";
  const limit = PLAN_VEHICLE_LIMIT[plan];
  const state = subscriptionState(sub);
  return (
    <>
      <PageHeader eyebrow="Billing" title="Subscription" description={`Every business starts with a ${TRIAL_DAYS}-day free trial. Upgrade to keep your store live.`} />
      <section className="mb-6 rounded-3xl bg-navy-900 p-6 text-white">
        <div className="flex flex-wrap items-center gap-3"><p className="eyebrow text-cyan">Current plan</p><Pill className={state.ended ? "bg-brand-red text-white" : "bg-white/10 text-white"}>{state.ended ? "Trial ended" : labelize(sub?.status ?? "ACTIVE")}</Pill></div>
        <p className="mt-2 font-display-italic text-4xl">{state.trial ? "Free trial" : labelize(plan)}</p>
        {state.trial && (
          <p className="mt-1 text-sm text-white/80">
            {!state.started ? `Your ${TRIAL_DAYS}-day trial starts when 13C verifies your business.`
              : state.ended ? `Ended ${formatDate(state.endsAt!)}. Your store is hidden from customers until you upgrade.`
              : `${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left · ends ${formatDate(state.endsAt!)}`}
          </p>
        )}
        <div className="mt-4 max-w-sm">
          <div className="flex justify-between text-sm text-white/80"><span>Vehicles</span><span>{count ?? 0}{limit ? ` / ${limit}` : " · unlimited"}</span></div>
          {limit && <Progress value={Math.min(100, ((count ?? 0) / limit) * 100)} className="mt-2" />}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => (
          <section key={p.id} className={cn("flex flex-col rounded-3xl border bg-white p-6", p.id === plan && "ring-2 ring-electric")}>
            <p className="font-semibold text-navy-900">{p.name}</p>
            <p className="mt-2"><span className="font-display text-3xl font-bold">{p.price}</span><span className="text-sm text-muted-foreground">{p.period}</span></p>
            <p className="mt-1 text-sm font-medium text-electric">{p.vehicles}</p>
            <ul className="mt-4 grid gap-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-emerald-600" />{f}</li>)}</ul>
            <div className="mt-auto pt-6">
              {p.id === plan ? <span className={buttonVariants({ variant: "secondary", className: "w-full" })}>Your plan</span>
                : <a href={`mailto:sales@13c.online?subject=${encodeURIComponent(`Upgrade ${business.name} to ${p.name}`)}`} className={buttonVariants({ variant: p.id === "PRO" ? "electric" : "outline", className: "w-full" })}>Request {p.name}</a>}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Online billing is coming soon. For now, upgrade requests are handled by the 13C team and applied to your account the same day.</p>
    </>
  );
}
