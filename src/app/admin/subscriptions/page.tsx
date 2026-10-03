import type { Metadata } from "next";
import { PLAN_VEHICLE_LIMIT, TRIAL_DAYS } from "@/lib/constants";
import Link from "next/link";
import { CreditCard, Info } from "lucide-react";
import { ListFilters } from "@/components/admin/list-filters";
import { PlanControl } from "@/components/admin/plan-control";
import { BUSINESS_STATUS_TONE, Pill } from "@/components/common/badges";
import { EmptyState, PageHeader, StatCard } from "@/components/common/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paymongoMode } from "@/lib/billing";
import { formatDate, formatPHP, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Subscriptions" };

type Plan = Enums<"subscription_plan">;
/** Mirrors public.plan_vehicle_limit(); null = unlimited. */
const VEHICLE_LIMIT = PLAN_VEHICLE_LIMIT;
const PLANS: Plan[] = ["FREE", "PRO", "BUSINESS"];

export default async function AdminSubscriptionsPage({ searchParams }: PageProps<"/admin/subscriptions">) {
  const { plan = "all", q } = (await searchParams) as { plan?: string; q?: string };
  const planFilter = PLANS.find((p) => p === plan);
  const supabase = await createClient();
  let query = supabase.from("businesses")
    .select("id, name, city, status, subscriptions(plan, status, current_period_end, updated_at), vehicles(id, deleted_at)")
    .is("deleted_at", null).order("name").limit(500);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const [{ data }, { data: payments }] = await Promise.all([
    query,
    supabase.from("subscription_payments").select("id, plan, amount_paid_centavos, payment_method, payment_id, livemode, paid_at, period_end, businesses(name)")
      .eq("status", "PAID").order("paid_at", { ascending: false }).limit(20),
  ]);
  const mode = paymongoMode();

  const all = (data ?? []).map((b) => {
    const p = b.subscriptions?.plan ?? "FREE";
    const vehicles = b.vehicles.filter((v) => !v.deleted_at).length;
    const limit = VEHICLE_LIMIT[p];
    return { ...b, plan: p, vehicles, limit, over: limit != null && vehicles > limit };
  });
  const rows = planFilter ? all.filter((b) => b.plan === planFilter) : all;
  const byPlan = (p: Plan) => all.filter((b) => b.plan === p).length;

  return (
    <>
      <PageHeader title="Subscriptions" description="Business plans, statuses and vehicle limits." />
      <div className="mb-5 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Owners pay online through PayMongo{mode ? ` (${mode} mode)` : " (not configured)"}.</strong> Each payment adds one month, with no auto-renewal.
          A paid plan you set here has no end date until you change it. Limits apply when vehicles are added: downgrading never removes existing vehicles,
          but a business over its limit can&apos;t add more.
        </p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Free trial" value={byPlan("FREE")} hint={`${TRIAL_DAYS} days · up to ${VEHICLE_LIMIT.FREE} vehicles`} />
        <StatCard label="Pro" value={byPlan("PRO")} hint={`₱499/mo · up to ${VEHICLE_LIMIT.PRO} vehicles`} />
        <StatCard label="Business" value={byPlan("BUSINESS")} hint="Unlimited vehicles" />
        <StatCard label="Over limit" value={all.filter((b) => b.over).length} hint="More vehicles than plan allows" />
      </div>
      <ListFilters basePath="/admin/subscriptions" param="plan" active={planFilter ?? "all"} q={q} searchPlaceholder="Search business…"
        options={[{ key: "all", label: "All", count: all.length }, ...PLANS.map((p) => ({ key: p, label: labelize(p), count: byPlan(p) }))]} />
      {!rows.length ? <EmptyState icon={CreditCard} title="No businesses found" /> : (
        <div className="w-0 min-w-full overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Business</TableHead><TableHead>Vehicles</TableHead><TableHead>Plan &amp; status</TableHead><TableHead>Updated</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/businesses/${b.id}`} className="font-semibold text-navy-900 hover:text-electric">{b.name}</Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {b.city} <Pill tone={BUSINESS_STATUS_TONE[b.status]} className="h-5 px-2 text-[11px]">{labelize(b.status)}</Pill>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-semibold">{b.vehicles}</span>
                    <span className="text-muted-foreground"> / {b.limit ?? "∞"}</span>
                    {b.over && <Pill tone="danger" className="ml-2">Over limit</Pill>}
                  </TableCell>
                  <TableCell>
                    {b.subscriptions ? (
                      <PlanControl businessId={b.id} businessName={b.name} plan={b.subscriptions.plan} status={b.subscriptions.status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">No subscription record</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {b.subscriptions ? formatDate(b.subscriptions.updated_at) : "—"}
                    {b.subscriptions?.current_period_end && <><br />Period ends {formatDate(b.subscriptions.current_period_end)}</>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!!payments?.length && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-navy-900">Recent payments</h2>
          <div className="w-0 min-w-full overflow-hidden rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Paid</TableHead><TableHead>Business</TableHead><TableHead>Plan</TableHead><TableHead>Amount</TableHead><TableHead>PayMongo payment</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="text-sm">{formatDate(x.paid_at!)}</TableCell>
                    <TableCell className="text-sm font-medium">{x.businesses?.name}</TableCell>
                    <TableCell className="text-sm">{labelize(x.plan)} <span className="text-xs text-muted-foreground">until {formatDate(x.period_end!)}</span></TableCell>
                    <TableCell className="text-sm">{formatPHP((x.amount_paid_centavos ?? 0) / 100, true)} <span className="text-xs text-muted-foreground">{x.payment_method ? labelize(x.payment_method) : ""}</span></TableCell>
                    <TableCell className="font-mono text-xs">{x.payment_id}{!x.livemode && <Pill tone="warning" className="ml-2">Test</Pill>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </>
  );
}
