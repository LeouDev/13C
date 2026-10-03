import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Car, ClipboardList, Flag, MessageSquare, ShieldCheck, Users, Wallet } from "lucide-react";
import { PageHeader, StatCard } from "@/components/common/states";
import { formatPHP, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { absolute: "Overview · 13C Admin" } };

type Overview = {
  businesses: Record<string, number> | null; published_stores: number; vehicles: number; users: number;
  bookings: Record<string, number> | null; gmv: number; conversations: number; open_reports: number; pending_verifications: number;
  top_locations: { city: string; bookings: number }[]; top_businesses: { id: string; name: string; slug: string; bookings: number; gmv: number }[];
};

export default async function AdminOverview() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_overview");
  const o = (data ?? {}) as unknown as Overview;
  const sum = (r: Record<string, number> | null) => Object.values(r ?? {}).reduce((a, b) => a + b, 0);
  const confirmed = ["CONFIRMED", "ACTIVE", "RETURNED", "COMPLETED"].reduce((a, k) => a + (o.bookings?.[k] ?? 0), 0);
  const totalBookings = sum(o.bookings);

  return (
    <>
      <PageHeader title="Platform overview" description="Marketplace health across Cebu." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/businesses?status=queue"><StatCard tone="brand" label="Awaiting verification" value={o.pending_verifications ?? 0} icon={ShieldCheck} /></Link>
        <StatCard label="Businesses" value={sum(o.businesses)} hint={`${o.published_stores ?? 0} published stores`} icon={Building2} />
        <StatCard label="Vehicles" value={o.vehicles ?? 0} icon={Car} />
        <StatCard label="Users" value={o.users ?? 0} icon={Users} />
        <StatCard label="Bookings" value={totalBookings} hint={`${confirmed} confirmed or completed`} icon={ClipboardList} />
        <StatCard label="GMV" value={formatPHP(o.gmv ?? 0)} hint="Confirmed → completed rentals" icon={Wallet} />
        <StatCard label="Conversion" value={`${totalBookings ? Math.round((confirmed * 100) / totalBookings) : 0}%`} icon={ClipboardList} />
        <Link href="/admin/reports"><StatCard label="Open reports" value={o.open_reports ?? 0} icon={Flag} /></Link>
        <StatCard label="Conversations" value={o.conversations ?? 0} icon={MessageSquare} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Bookings by status</h2>
          <ul className="grid gap-1.5 text-sm">{Object.entries(o.bookings ?? {}).map(([k, v]) => <li key={k} className="flex justify-between"><span>{labelize(k)}</span><span className="font-semibold">{v}</span></li>)}</ul>
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Top locations</h2>
          <ul className="grid gap-1.5 text-sm">{(o.top_locations ?? []).map((l) => <li key={l.city} className="flex justify-between"><span>{l.city}</span><span className="font-semibold">{l.bookings}</span></li>)}</ul>
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Top businesses</h2>
          <ul className="grid gap-1.5 text-sm">{(o.top_businesses ?? []).map((b) => <li key={b.id} className="flex justify-between gap-2"><Link href={`/admin/businesses/${b.id}`} className="truncate hover:text-electric">{b.name}</Link><span className="shrink-0 font-semibold">{b.bookings} · {formatPHP(b.gmv)}</span></li>)}</ul>
        </section>
      </div>
    </>
  );
}
