import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { KIND_STYLE } from "@/lib/calendar";
import { EmptyState, PageHeader } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { BLOCKING_STATUSES } from "@/lib/bookings/status";
import { isoToManilaDate, todayManila } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Calendar" };

export default async function FleetCalendarPage({ searchParams }: PageProps<"/dashboard/calendar">) {
  const { business } = await requireBusiness();
  const { m } = (await searchParams) as { m?: string };
  const month = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : todayManila().slice(0, 7);
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const start = new Date(`${month}-01T00:00:00+08:00`).toISOString();
  const end = new Date(new Date(`${month}-${String(days).padStart(2, "0")}T00:00:00+08:00`).getTime() + 86400000).toISOString();
  const shift = (d: number) => { const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };

  const supabase = await createClient();
  const [{ data: vehicles }, { data: bookings }, { data: blocks }] = await Promise.all([
    supabase.from("vehicles").select("id, make, model, year, status").eq("business_id", business.id).is("deleted_at", null).order("created_at"),
    supabase.from("bookings").select("id, vehicle_id, pickup_at, return_at, status, reference").eq("business_id", business.id)
      .in("status", [...BLOCKING_STATUSES, "PENDING_OWNER_APPROVAL", "BOOKING_REQUESTED"]).lt("pickup_at", end).gt("return_at", start),
    supabase.from("vehicle_blocked_dates").select("vehicle_id, starts_at, ends_at, reason").eq("business_id", business.id).lt("starts_at", end).gt("ends_at", start),
  ]);
  const today = todayManila();
  const dayKey = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const covers = (s: string, e: string, d: number) => {
    const k = dayKey(d);
    return isoToManilaDate(s) <= k && isoToManilaDate(new Date(new Date(e).getTime() - 1)) >= k;
  };

  return (
    <>
      <PageHeader eyebrow="Availability" title="Fleet calendar" description="Confirmed bookings, pending requests, blocks and maintenance across all vehicles."
        actions={<div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-border">
          <Link href={`?m=${shift(-1)}`} className="grid size-8 place-items-center rounded-full hover:bg-canvas" aria-label="Previous month"><ChevronLeft className="size-4" /></Link>
          <span className="px-2 text-sm font-semibold">{new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
          <Link href={`?m=${shift(1)}`} className="grid size-8 place-items-center rounded-full hover:bg-canvas" aria-label="Next month"><ChevronRight className="size-4" /></Link>
        </div>} />
      {!vehicles?.length ? <EmptyState title="No vehicles yet" action={{ label: "Add vehicle", href: "/dashboard/vehicles/new" }} /> : (
        <div className="overflow-x-auto rounded-3xl border bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-40 bg-white p-3 text-left font-semibold">Vehicle</th>
                {Array.from({ length: days }, (_, i) => (
                  <th key={i} className={cn("min-w-8 p-1 text-center font-medium text-muted-foreground", dayKey(i + 1) === today && "text-electric")}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-white p-3">
                    <Link href={`/dashboard/vehicles/${v.id}?tab=availability`} className="font-semibold text-navy-900 hover:text-electric">{v.make} {v.model}</Link>
                    <span className="block text-[11px] text-muted-foreground">{v.year}{v.status !== "ACTIVE" ? ` · ${v.status.toLowerCase()}` : ""}</span>
                  </td>
                  {Array.from({ length: days }, (_, i) => {
                    const b = bookings?.find((x) => x.vehicle_id === v.id && covers(x.pickup_at, x.return_at, i + 1) && BLOCKING_STATUSES.includes(x.status))
                      ?? bookings?.find((x) => x.vehicle_id === v.id && covers(x.pickup_at, x.return_at, i + 1));
                    const blk = !b && blocks?.find((x) => x.vehicle_id === v.id && covers(x.starts_at, x.ends_at, i + 1));
                    const kind = b ? (BLOCKING_STATUSES.includes(b.status) ? "BOOKED" : "PENDING") : blk ? blk.reason : null;
                    const cell = <span className={cn("block h-8 rounded-md", kind ? KIND_STYLE[kind]?.cell : "bg-canvas/60")} />;
                    return (
                      <td key={i} className="p-0.5" title={b ? `${b.reference} · ${b.status}` : kind ?? undefined}>
                        {b ? <Link href={`/dashboard/bookings/${b.id}`} aria-label={`Booking ${b.reference}`}>{cell}</Link> : cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["BOOKED", "PENDING", "BLOCKED", "MAINTENANCE"] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm", KIND_STYLE[k]!.dot)} />{KIND_STYLE[k]!.label}</span>)}
      </div>
    </>
  );
}
