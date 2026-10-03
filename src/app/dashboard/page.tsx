import Link from "next/link";
import { ArrowRight, Car, CheckCircle2, Circle, ClipboardList, Eye, KeyRound, MessageSquare, TrendingUp, Undo2, Wallet } from "lucide-react";
import { BookingStatusBadge } from "@/components/common/badges";
import { EmptyState, PageHeader, StatCard } from "@/components/common/states";
import { VerificationBanner } from "@/components/dashboard/verification-banner";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireBusiness } from "@/lib/auth";
import { BLOCKING_STATUSES } from "@/lib/bookings/status";
import { getOnboarding } from "@/lib/dashboard";
import { formatDateTime, formatPHP, formatRange, todayManila } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardHome() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const today = todayManila();
  const dayStart = new Date(`${today}T00:00:00+08:00`).toISOString();
  const dayEnd = new Date(`${today}T23:59:59+08:00`).toISOString();

  const [onboarding, pickups, returns, pending, upcoming, active, activeVehicles, unread, analytics] = await Promise.all([
    getOnboarding(business),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).in("status", ["CONFIRMED", "SIGNED"]).gte("pickup_at", dayStart).lte("pickup_at", dayEnd),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "ACTIVE").gte("return_at", dayStart).lte("return_at", dayEnd),
    supabase.from("bookings").select("id, reference, status, pickup_at, return_at, total_amount, vehicles(make, model), renter:profiles!bookings_renter_id_fkey(full_name)").eq("business_id", business.id).eq("status", "PENDING_OWNER_APPROVAL").order("pickup_at").limit(5),
    supabase.from("bookings").select("id, reference, status, pickup_at, return_at, total_amount, vehicles(make, model), renter:profiles!bookings_renter_id_fkey(full_name)").eq("business_id", business.id).in("status", BLOCKING_STATUSES).gte("pickup_at", new Date().toISOString()).order("pickup_at").limit(6),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "ACTIVE"),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "ACTIVE").is("deleted_at", null),
    supabase.from("conversations").select("last_message_at, business_last_read_at").eq("business_id", business.id).eq("last_sender_role", "CUSTOMER").limit(200),
    supabase.rpc("business_analytics", { p_business_id: business.id, p_days: 30 }),
  ]);
  const a = (analytics.data ?? {}) as Record<string, number>;
  const unreadCount = (unread.data ?? []).filter((c) => !c.business_last_read_at || c.business_last_read_at < c.last_message_at).length;

  return (
    <>
      <VerificationBanner business={business} />
      <PageHeader eyebrow="Dashboard" title={`Good day, ${business.name}`} description="Here's what's happening with your rental business." />

      {!onboarding.published && (
        <section className="mb-6 rounded-3xl border bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-navy-900">Complete your 13C Store</h2>
              <p className="text-sm text-muted-foreground">Finish these steps to publish your storefront.</p>
            </div>
            <div className="flex items-center gap-3 sm:w-64">
              <Progress value={onboarding.percent} className="flex-1" />
              <span className="font-display text-lg font-bold text-navy-900">{onboarding.percent}%</span>
            </div>
          </div>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {onboarding.steps.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-canvas">
                  {s.done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-slate-300" />}
                  <span className={s.done ? "text-muted-foreground line-through decoration-slate-300" : "font-medium text-navy-900"}>{s.label}</span>
                  {s.optional && !s.done && <span className="text-xs text-muted-foreground">(optional)</span>}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={onboarding.steps.find((s) => !s.done && !s.optional)?.href ?? "/dashboard/store"} className={buttonVariants({ size: "lg", className: "mt-4" })}>
            Complete Store <ArrowRight />
          </Link>
        </section>
      )}

      <section className="mb-6 rounded-3xl bg-navy-900 p-5 text-white sm:p-6">
        <h2 className="eyebrow text-cyan">Today&apos;s activity</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Pickups", value: pickups.count ?? 0, icon: KeyRound, href: "/dashboard/calendar" },
            { label: "Returns", value: returns.count ?? 0, icon: Undo2, href: "/dashboard/calendar" },
            { label: "Pending requests", value: pending.data?.length ?? 0, icon: ClipboardList, href: "/dashboard/bookings?status=pending" },
            { label: "Unread messages", value: unreadCount, icon: MessageSquare, href: "/dashboard/messages" },
          ].map((x) => (
            <Link key={x.label} href={x.href} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition hover:bg-white/10">
              <x.icon className="size-5 text-cyan" />
              <p className="mt-3 font-display text-3xl font-bold">{x.value}</p>
              <p className="text-sm text-white/70">{x.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active vehicles" value={activeVehicles.count ?? 0} icon={Car} />
        <StatCard label="Active rentals" value={active.count ?? 0} icon={KeyRound} />
        <StatCard label="Revenue (30 days)" value={formatPHP(a.revenue ?? 0)} icon={Wallet} hint="Confirmed & completed bookings" />
        <StatCard label="Booking conversion" value={`${a.conversion_rate ?? 0}%`} icon={TrendingUp} hint={`${a.confirmed_bookings ?? 0} of ${a.booking_requests ?? 0} requests`} />
        <StatCard label="Store views (30d)" value={a.store_views ?? 0} icon={Eye} />
        <StatCard label="Vehicle views (30d)" value={a.vehicle_views ?? 0} icon={Eye} />
        <StatCard label="Upcoming bookings" value={upcoming.data?.length ?? 0} icon={ClipboardList} />
        <StatCard label="Inquiries (30d)" value={a.inquiries ?? 0} icon={MessageSquare} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <BookingList title="Pending requests" empty="No requests waiting for you." rows={pending.data ?? []} />
        <BookingList title="Upcoming bookings" empty="No upcoming bookings yet." rows={upcoming.data ?? []} />
      </div>
    </>
  );
}

type Row = { id: string; reference: string; status: Parameters<typeof BookingStatusBadge>[0]["status"]; pickup_at: string; return_at: string; total_amount: number; vehicles: { make: string; model: string } | null; renter: { full_name: string } | null };

function BookingList({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <section className="rounded-3xl border bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-navy-900">{title}</h2>
        <Link href="/dashboard/bookings" className="text-xs font-semibold text-electric hover:underline">View all</Link>
      </div>
      {rows.length === 0 ? <EmptyState title={empty} className="border-0 py-8" /> : (
        <ul className="divide-y">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/bookings/${b.id}`} className="flex items-center gap-3 py-3 hover:bg-canvas/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{b.vehicles?.make} {b.vehicles?.model} · {b.renter?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{formatRange(b.pickup_at, b.return_at)} · pickup {formatDateTime(b.pickup_at)}</p>
                </div>
                <div className="text-right">
                  <BookingStatusBadge status={b.status} />
                  <p className="mt-1 text-xs font-semibold">{formatPHP(b.total_amount)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
