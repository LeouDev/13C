import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { ListFilters } from "@/components/admin/list-filters";
import { ReportControl } from "@/components/admin/report-control";
import { Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { formatDateTime, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Reports" };

const VIEWS: { key: string; label: string; statuses?: Enums<"report_status">[] }[] = [
  { key: "open", label: "Open", statuses: ["OPEN", "REVIEWING"] },
  { key: "resolved", label: "Resolved", statuses: ["RESOLVED"] },
  { key: "dismissed", label: "Dismissed", statuses: ["DISMISSED"] },
  { key: "all", label: "All" },
];
const TONE: Record<Enums<"report_status">, "danger" | "info" | "success" | "neutral"> = {
  OPEN: "danger", REVIEWING: "info", RESOLVED: "success", DISMISSED: "neutral",
};

/** Admin page for the reported entity, when one exists (bookings: the bookings list searched by reference). */
function entityHref(type: string, id: string, refs: Map<string, string>) {
  if (type === "BUSINESS") return `/admin/businesses/${id}`;
  if (type === "USER") return `/admin/users/${id}`;
  if (type === "BOOKING" && refs.has(id)) return `/admin/bookings?q=${refs.get(id)}`;
  return null;
}

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const { status = "open" } = (await searchParams) as { status?: string };
  const view = VIEWS.find((v) => v.key === status) ?? VIEWS[0]!;
  const supabase = await createClient();
  let query = supabase.from("reports")
    .select("id, entity_type, entity_id, reason, details, status, created_at, resolution_note, resolved_at, reporter:profiles!reports_reporter_id_fkey(id, full_name, email)")
    .order("created_at", { ascending: view.key === "open" }).limit(200);
  if (view.statuses) query = query.in("status", view.statuses);
  const [{ data: rows }, { count: openCount }] = await Promise.all([
    query,
    supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["OPEN", "REVIEWING"]),
  ]);
  const bookingIds = (rows ?? []).filter((r) => r.entity_type === "BOOKING").map((r) => r.entity_id);
  const { data: bookings } = bookingIds.length ? await supabase.from("bookings").select("id, reference").in("id", bookingIds) : { data: [] };
  const refs = new Map((bookings ?? []).map((b) => [b.id, b.reference]));

  return (
    <>
      <PageHeader title="Reports" description="Flags raised by users about businesses, vehicles, bookings, reviews and accounts, plus down payment disputes." />
      <ListFilters basePath="/admin/reports" options={VIEWS.map((v) => (v.key === "open" ? { ...v, count: openCount } : v))} active={view.key} />
      {!rows?.length ? (
        <EmptyState icon={Flag} title={view.key === "open" ? "No open reports" : "No reports here"} description={view.key === "open" ? "All caught up." : undefined} />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const href = entityHref(r.entity_type, r.entity_id, refs);
            return (
              <li key={r.id} className="rounded-2xl border bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={TONE[r.status]}>{labelize(r.status)}</Pill>
                  <Pill>{labelize(r.entity_type)}</Pill>
                  {href ? (
                    <Link href={href} className="text-sm font-medium text-electric hover:underline">
                      {refs.has(r.entity_id) ? `Booking ${refs.get(r.entity_id)}` : `Open ${labelize(r.entity_type).toLowerCase()}`}
                    </Link>
                  ) : (
                    <code className="max-w-full truncate rounded bg-canvas px-1.5 py-0.5 text-xs" title={r.entity_id}>{r.entity_id}</code>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                </div>
                <p className="mt-3 font-semibold text-navy-900">{r.reason}</p>
                {r.details && <p className="mt-1 text-sm whitespace-pre-line">{r.details}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  Reported by{" "}
                  {r.reporter ? <Link href={`/admin/users/${r.reporter.id}`} className="font-medium hover:text-electric">{r.reporter.email ?? r.reporter.full_name}</Link> : "—"}
                  {r.resolved_at && <> · closed {formatDateTime(r.resolved_at)}</>}
                </p>
                <div className="mt-4 border-t pt-4">
                  <ReportControl reportId={r.id} status={r.status} note={r.resolution_note} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
