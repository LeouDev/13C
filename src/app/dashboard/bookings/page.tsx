import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { cn } from "cn";
import { BookingStatusBadge, Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { BLOCKING_STATUSES, type BookingStatus } from "@/lib/bookings/status";
import { formatDateTime, formatPHP, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bookings" };

const VIEWS: { key: string; label: string; statuses: BookingStatus[] }[] = [
  { key: "pending", label: "Requests", statuses: ["PENDING_OWNER_APPROVAL", "BOOKING_REQUESTED"] },
  { key: "upcoming", label: "Upcoming", statuses: BLOCKING_STATUSES.filter((s) => s !== "ACTIVE") },
  { key: "active", label: "On rent", statuses: ["ACTIVE"] },
  { key: "past", label: "Past", statuses: ["RETURNED", "COMPLETED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED", "REJECTED", "EXPIRED"] },
];

export default async function BookingsPage({ searchParams }: PageProps<"/dashboard/bookings">) {
  const { business } = await requireBusiness();
  const { status = "pending", q } = (await searchParams) as { status?: string; q?: string };
  const view = VIEWS.find((v) => v.key === status) ?? VIEWS[0]!;
  const supabase = await createClient();
  let query = supabase.from("bookings")
    .select("id, reference, status, pickup_at, return_at, total_amount, payment_status, payment_method, vehicles(make, model, year), renter:profiles!bookings_renter_id_fkey(full_name)")
    .eq("business_id", business.id).in("status", view.statuses)
    .order("pickup_at", { ascending: view.key !== "past" && view.key !== "cancelled" }).limit(100);
  if (q) query = query.ilike("reference", `%${q.trim()}%`);
  const [{ data: rows }, counts] = await Promise.all([
    query,
    Promise.all(VIEWS.map((v) => supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).in("status", v.statuses))),
  ]);

  return (
    <>
      <PageHeader eyebrow="Bookings" title="Bookings" description="Requests, upcoming rentals and history." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v, i) => (
          <Link key={v.key} href={`?status=${v.key}`} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium", v.key === view.key ? "bg-navy-900 text-white" : "bg-white hover:bg-white/70")}>
            {v.label} <span className="opacity-60">{counts[i]?.count ?? 0}</span>
          </Link>
        ))}
        <form className="ml-auto"><input type="hidden" name="status" value={view.key} /><input name="q" defaultValue={q} placeholder="Search 13C-…" className="h-9 w-40 rounded-full border bg-white px-4 text-sm" aria-label="Search by reference" /></form>
      </div>
      {!rows?.length ? <EmptyState icon={ClipboardList} title={`No ${view.label.toLowerCase()} bookings`} /> : (
        <ul className="grid gap-2">
          {rows.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/bookings/${b.id}`} className="grid gap-2 rounded-2xl border bg-white p-4 transition hover:border-electric/40 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{b.reference}</span>
                    <BookingStatusBadge status={b.status} />
                    {b.payment_status !== "UNPAID" && <Pill tone={b.payment_status === "PAID" ? "success" : "warning"}>{labelize(b.payment_status)}</Pill>}
                  </div>
                  <p className="mt-1 truncate font-semibold text-navy-900">{b.renter?.full_name} · {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(b.pickup_at)} → {formatDateTime(b.return_at)}</p>
                </div>
                <div className="sm:text-right">
                  <p className="font-display text-lg font-bold">{formatPHP(b.total_amount)}</p>
                  <p className="text-xs text-muted-foreground">{labelize(b.payment_method)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
