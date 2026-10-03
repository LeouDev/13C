import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { DailyBars } from "@/components/dashboard/daily-bars";
import { PageHeader, StatCard } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { formatDate, formatPHP } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analytics" };

type A = {
  store_views: number; vehicle_views: number; inquiries: number; booking_requests: number; confirmed_bookings: number;
  completed_bookings: number; conversion_rate: number; revenue: number;
  daily: { day: string; views: number; requests: number }[];
  top_vehicles: { id: string; name: string; views: number; requests: number }[];
  top_dates: { day: string; requests: number }[];
};

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const { business } = await requireBusiness();
  const { days = "30" } = (await searchParams) as { days?: string };
  const range = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const supabase = await createClient();
  const { data } = await supabase.rpc("business_analytics", { p_business_id: business.id, p_days: range });
  const a = data as unknown as A;

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
    </>
  );
}
