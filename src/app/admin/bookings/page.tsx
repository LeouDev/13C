import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { ListFilters } from "@/components/admin/list-filters";
import { BookingStatusBadge, Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BLOCKING_STATUSES, OPEN_REQUEST_STATUSES, type BookingStatus } from "@/lib/bookings/status";
import { formatDate, formatDateTime, formatPHP, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Bookings" };

const VIEWS: { key: string; label: string; statuses?: BookingStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "inquiries", label: "Inquiries", statuses: ["INQUIRY", "NEGOTIATING"] },
  { key: "requests", label: "Requests", statuses: OPEN_REQUEST_STATUSES },
  { key: "upcoming", label: "Upcoming", statuses: BLOCKING_STATUSES.filter((s) => s !== "ACTIVE") },
  { key: "active", label: "On rent", statuses: ["ACTIVE"] },
  { key: "past", label: "Past", statuses: ["RETURNED", "COMPLETED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED", "REJECTED", "EXPIRED"] },
];

const PAYMENT_TONE: Record<Enums<"payment_status">, "neutral" | "warning" | "success" | "info"> = {
  UNPAID: "neutral", PARTIALLY_PAID: "warning", PAID: "success", PAYMENT_ON_PICKUP: "info",
};

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const { status = "all", q } = (await searchParams) as { status?: string; q?: string };
  const view = VIEWS.find((v) => v.key === status) ?? VIEWS[0]!;
  const supabase = await createClient();
  let query = supabase.from("bookings")
    .select("id, reference, status, pickup_at, return_at, total_amount, payment_status, payment_method, created_at, businesses(id, name), vehicles(make, model, year), renter:profiles!bookings_renter_id_fkey(id, full_name)")
    .order("created_at", { ascending: false }).limit(200);
  if (view.statuses) query = query.in("status", view.statuses);
  if (q?.trim()) query = query.ilike("reference", `%${q.trim()}%`);
  const [{ data: rows }, counts] = await Promise.all([
    query,
    Promise.all(VIEWS.map((v) => {
      const c = supabase.from("bookings").select("id", { count: "exact", head: true });
      return v.statuses ? c.in("status", v.statuses) : c;
    })),
  ]);

  return (
    <>
      <PageHeader title="Bookings" description="Every inquiry, request and rental on the marketplace." />
      <ListFilters basePath="/admin/bookings" options={VIEWS.map((v, i) => ({ key: v.key, label: v.label, count: counts[i]?.count }))}
        active={view.key} q={q} searchPlaceholder="Search 13C-…" searchLabel="Search by booking reference" />
      {!rows?.length ? <EmptyState icon={ClipboardList} title="No bookings found" description={q ? "Check the reference and try again." : undefined} /> : (
        <div className="w-0 min-w-full overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead><TableHead>Business</TableHead><TableHead>Renter</TableHead><TableHead>Vehicle</TableHead>
                <TableHead>Dates</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <p className="font-mono text-xs font-semibold text-navy-900">{b.reference}</p>
                    <p className="text-xs text-muted-foreground">Created {formatDate(b.created_at)}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.businesses ? <Link href={`/admin/businesses/${b.businesses.id}`} className="font-medium hover:text-electric">{b.businesses.name}</Link> : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.renter ? <Link href={`/admin/users/${b.renter.id}`} className="hover:text-electric">{b.renter.full_name}</Link> : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(b.pickup_at)}<br /><span className="text-muted-foreground">→ {formatDateTime(b.return_at)}</span></TableCell>
                  <TableCell className="text-right text-sm font-semibold">{formatPHP(b.total_amount)}</TableCell>
                  <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                  <TableCell>
                    <Pill tone={PAYMENT_TONE[b.payment_status]}>{labelize(b.payment_status)}</Pill>
                    <p className="mt-0.5 text-xs text-muted-foreground">{labelize(b.payment_method)}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {rows?.length === 200 && <p className="mt-3 text-xs text-muted-foreground">Showing the 200 most recent bookings in this view.</p>}
    </>
  );
}
