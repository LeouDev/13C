import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "cn";
import { DailyBars } from "@/components/dashboard/daily-bars";
import { PageHeader, StatCard } from "@/components/common/states";
import { BusinessUpsell } from "@/components/dashboard/business-upsell";
import { buttonVariants } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { BUSINESS_FEATURES } from "@/lib/constants";
import { formatDate, formatPHP } from "@/lib/format";
import { businessPlanActive } from "@/lib/plans";
import { getSubscription } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analytics" };

type A = {
  store_views: number; vehicle_views: number; inquiries: number; booking_requests: number; confirmed_bookings: number;
  completed_bookings: number; conversion_rate: number; revenue: number;
  daily: { day: string; views: number; requests: number }[];
  top_vehicles: { id: string; name: string; views: number; requests: number }[];
  top_dates: { day: string; requests: number }[];
};

/** business_analytics_advanced() — Business plan. */
type Advanced = {
  period_days: number;
  vehicles: { id: string; name: string; plate: string | null; views: number; requests: number; bookings: number; booked_days: number; revenue: number }[];
  monthly: { month: string; bookings: number; revenue: number }[];
  customers: { renters: number; returning: number; avg_rental_days: number; avg_lead_days: number; avg_booking_value: number };
  repeat_rate: number;
  top_customers: { name: string; bookings: number; revenue: number }[];
  outcomes: { requests: number; confirmed: number; cancelled: number; declined: number; expired: number; open: number };
};
const pct = (n: number, of: number) => (of ? `${Math.round((n * 100) / of)}%` : "0%");
const dayCount = (n: number) => `${n} ${Number(n) === 1 ? "day" : "days"}`;

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const { business } = await requireBusiness();
  const { days = "30" } = (await searchParams) as { days?: string };
  const range = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const supabase = await createClient();
  const [{ data }, sub] = await Promise.all([
    supabase.rpc("business_analytics", { p_business_id: business.id, p_days: range }),
    getSubscription(business.id),
  ]);
  const a = data as unknown as A;
  const adv = businessPlanActive(sub)
    ? ((await supabase.rpc("business_analytics_advanced", { p_business_id: business.id, p_days: range })).data as unknown as Advanced | null)
    : null;

  return (
    <>
      <PageHeader eyebrow="Insights" title="Analytics" description="How customers find and book your cars."
        actions={<div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-border">
          {[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", range === d ? "bg-navy-900 text-white" : "text-navy-800")}>{d} days</Link>)}
        </div>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Store views" value={a.store_views} />
        <StatCard label="Vehicle views" value={a.vehicle_views} />
        <StatCard label="Inquiries" value={a.inquiries} />
        <StatCard label="Booking requests" value={a.booking_requests} />
        <StatCard label="Confirmed bookings" value={a.confirmed_bookings} />
        <StatCard label="Completed rentals" value={a.completed_bookings} />
        <StatCard label="Conversion rate" value={`${a.conversion_rate}%`} hint="Confirmed ÷ requests" />
        <StatCard tone="brand" label="Revenue" value={formatPHP(a.revenue)} hint="Confirmed → completed" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DailyBars title="Daily views" unit="views" data={a.daily.map((d) => ({ day: d.day, value: d.views }))} />
        <DailyBars title="Daily booking requests" unit="requests" data={a.daily.map((d) => ({ day: d.day, value: d.requests }))} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-navy-900">Most viewed vehicles</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Vehicle</th><th className="pb-2 text-right font-medium">Views</th><th className="pb-2 text-right font-medium">Requests</th></tr></thead>
            <tbody>{a.top_vehicles.map((v) => <tr key={v.id} className="border-t"><td className="py-2">{v.name}</td><td className="py-2 text-right tabular-nums">{v.views}</td><td className="py-2 text-right tabular-nums">{v.requests}</td></tr>)}</tbody>
          </table>
          {a.top_vehicles.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        </section>
        <section className="rounded-3xl border bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-navy-900">Most requested pickup dates</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Pickup date</th><th className="pb-2 text-right font-medium">Requests</th></tr></thead>
            <tbody>{a.top_dates.map((d) => <tr key={d.day} className="border-t"><td className="py-2">{formatDate(d.day)}</td><td className="py-2 text-right tabular-nums">{d.requests}</td></tr>)}</tbody>
          </table>
          {a.top_dates.length === 0 && <p className="text-sm text-muted-foreground">No requests in this period.</p>}
        </section>
      </div>

      <section className="mt-10" aria-labelledby="advanced">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-electric">Business</p>
            <h2 id="advanced" className="font-display text-xl font-bold tracking-tight text-navy-900">Advanced analytics</h2>
            {adv && <p className="text-sm text-muted-foreground">Last {range} days, except the monthly charts and repeat renters.</p>}
          </div>
          {adv && <a href={`/dashboard/analytics/export?days=${range}`} className={buttonVariants({ variant: "outline" })}><Download /> Export bookings (CSV)</a>}
        </div>
        {!adv ? <BusinessUpsell title="Advanced analytics are on the Business plan" points={BUSINESS_FEATURES.analytics} /> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Renters" value={adv.customers.renters} hint={`${adv.customers.returning} returning`} />
              <StatCard label="Repeat renters" value={`${adv.repeat_rate}%`} hint="All time, 2 or more bookings" />
              <StatCard label="Average rental" value={dayCount(adv.customers.avg_rental_days)} />
              <StatCard label="Booked ahead" value={dayCount(adv.customers.avg_lead_days)} hint="Average time before pickup" />
              <StatCard label="Average booking" value={formatPHP(adv.customers.avg_booking_value)} />
              <StatCard label="Cancelled" value={pct(adv.outcomes.cancelled, adv.outcomes.requests)} hint={`${adv.outcomes.cancelled} of ${adv.outcomes.requests} requests`} />
              <StatCard label="Declined" value={pct(adv.outcomes.declined, adv.outcomes.requests)} hint={`${adv.outcomes.declined} requests`} />
              <StatCard label="Expired" value={pct(adv.outcomes.expired, adv.outcomes.requests)} hint="Not answered in time" />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <DailyBars title="Revenue by month" unit="" period="month" money data={adv.monthly.map((m) => ({ day: m.month, value: Number(m.revenue) }))} />
              <DailyBars title="Confirmed bookings by month" unit="bookings" period="month" data={adv.monthly.map((m) => ({ day: m.month, value: m.bookings }))} />
            </div>
            <section className="mt-4 overflow-x-auto rounded-3xl border bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-navy-900">Each car</h3>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Vehicle</th>
                    {["Views", "Requests", "Bookings", "Booked days", "Utilization", "Revenue"].map((h) => <th key={h} className="pb-2 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {adv.vehicles.map((v) => {
                    const used = Math.min(100, (Number(v.booked_days) * 100) / adv.period_days);
                    return (
                      <tr key={v.id} className="border-t">
                        <td className="py-2">{v.name}{v.plate && <span className="ml-1.5 font-mono text-xs text-muted-foreground">{v.plate}</span>}</td>
                        <td className="py-2 text-right tabular-nums">{v.views}</td>
                        <td className="py-2 text-right tabular-nums">{v.requests}</td>
                        <td className="py-2 text-right tabular-nums">{v.bookings}</td>
                        <td className="py-2 text-right tabular-nums">{Number(v.booked_days)}</td>
                        <td className="py-2 text-right">
                          <span className="inline-flex items-center gap-2 tabular-nums">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-canvas" aria-hidden><span className="block h-full rounded-full bg-electric" style={{ width: `${used}%` }} /></span>
                            {Math.round(used)}%
                          </span>
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">{formatPHP(v.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Utilization: share of the last {range} days each car was booked. Revenue: confirmed bookings made in the period.</p>
            </section>
            <section className="mt-4 rounded-3xl border bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-navy-900">Top customers</h3>
              {adv.top_customers.length === 0 ? <p className="text-sm text-muted-foreground">No confirmed bookings in this period.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Renter</th><th className="pb-2 text-right font-medium">Bookings</th><th className="pb-2 text-right font-medium">Revenue</th></tr></thead>
                  <tbody>{adv.top_customers.map((c, i) => <tr key={i} className="border-t"><td className="py-2">{c.name}</td><td className="py-2 text-right tabular-nums">{c.bookings}</td><td className="py-2 text-right tabular-nums">{formatPHP(c.revenue)}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </>
        )}
      </section>
    </>
  );
}
