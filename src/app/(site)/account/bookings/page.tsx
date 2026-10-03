import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { BookingStatusBadge } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { VehicleImage } from "@/components/common/vehicle-image";
import { requireUser } from "@/lib/auth";
import { STATUS_META, TERMINAL_STATUSES } from "@/lib/bookings/status";
import { formatPHP, formatRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookingsPage() {
  const user = await requireUser("/account/bookings");
  const supabase = await createClient();
  const { data } = await supabase.from("bookings")
    .select("id, reference, status, pickup_at, return_at, total_amount, vehicles(make, model, year, vehicle_images(storage_path, position)), businesses(name, slug)")
    .eq("renter_id", user.id).order("pickup_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  const current = rows.filter((b) => !TERMINAL_STATUSES.includes(b.status));
  const past = rows.filter((b) => TERMINAL_STATUSES.includes(b.status));

  const Card = ({ b }: { b: (typeof rows)[number] }) => {
    const img = [...(b.vehicles?.vehicle_images ?? [])].sort((x, y) => x.position - y.position)[0];
    const needsAction = ["CONTRACT_SENT", "AWAITING_SIGNATURE", "BOOKING_REQUESTED"].includes(b.status);
    return (
      <Link href={`/account/bookings/${b.id}`} className="flex gap-4 rounded-3xl bg-white p-3 ring-1 ring-black/5 transition hover:ring-electric/40">
        <VehicleImage path={img?.storage_path} alt="" className="h-24 w-32 shrink-0 rounded-2xl" sizes="128px" />
        <div className="min-w-0 flex-1 py-1">
          <div className="flex flex-wrap items-center gap-2"><BookingStatusBadge status={b.status} /><span className="font-mono text-[11px] text-muted-foreground">{b.reference}</span></div>
          <p className="mt-1 truncate font-semibold text-navy-900">{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</p>
          <p className="truncate text-sm text-muted-foreground">{b.businesses?.name} · {formatRange(b.pickup_at, b.return_at)}</p>
          {needsAction ? <p className="mt-1 text-xs font-semibold text-electric">{STATUS_META[b.status].renterHint}</p> : <p className="mt-1 text-sm font-semibold">{formatPHP(b.total_amount)}</p>}
        </div>
      </Link>
    );
  };

  return (
    <>
      <PageHeader title="My bookings" />
      {rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No bookings yet" description="Find a car from a verified Cebu rental business." action={{ label: "Find a car", href: "/explore" }} />
      ) : (
        <div className="grid gap-8">
          {current.length > 0 && <section><h2 className="mb-3 text-sm font-semibold text-muted-foreground">Current & upcoming</h2><div className="grid gap-3 lg:grid-cols-2">{current.map((b) => <Card key={b.id} b={b} />)}</div></section>}
          {past.length > 0 && <section><h2 className="mb-3 text-sm font-semibold text-muted-foreground">Rental history</h2><div className="grid gap-3 lg:grid-cols-2">{past.map((b) => <Card key={b.id} b={b} />)}</div></section>}
        </div>
      )}
    </>
  );
}
