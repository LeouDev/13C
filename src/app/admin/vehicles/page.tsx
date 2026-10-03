import type { Metadata } from "next";
import Link from "next/link";
import { Car } from "lucide-react";
import { ListFilters, searchTerms } from "@/components/admin/list-filters";
import { Pill, VEHICLE_STATUS_TONE } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VEHICLE_STATUSES } from "@/lib/constants";
import { formatDate, formatPHP, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vehicles" };

const FILTERS = [{ key: "all", label: "All" }, ...VEHICLE_STATUSES.map((s) => ({ key: s.value, label: s.label }))];

export default async function AdminVehiclesPage({ searchParams }: PageProps<"/admin/vehicles">) {
  const { status = "all", q } = (await searchParams) as { status?: string; q?: string };
  const statusFilter = VEHICLE_STATUSES.find((s) => s.value === status)?.value;
  const supabase = await createClient();
  let query = supabase.from("vehicles")
    .select("id, make, model, variant, year, city, status, plate_number, category_slug, created_at, businesses(id, name), vehicle_pricing(daily_rate)")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  if (statusFilter) query = query.eq("status", statusFilter);
  for (const t of searchTerms(q)) query = query.or(`make.ilike.%${t}%,model.ilike.%${t}%`);
  const { data: rows } = await query;

  return (
    <>
      <PageHeader title="Vehicles" description="Every listed vehicle across all rental businesses (archived vehicles excluded)." />
      <ListFilters basePath="/admin/vehicles" options={FILTERS} active={statusFilter ?? "all"} q={q} searchPlaceholder="Search make or model…" />
      {!rows?.length ? <EmptyState icon={Car} title="No vehicles found" description={q ? "Try a different search." : undefined} /> : (
        <div className="w-0 min-w-full overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Vehicle</TableHead><TableHead>Business</TableHead><TableHead>City</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Daily rate</TableHead><TableHead>Created</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <p className="font-semibold text-navy-900">{v.year} {v.make} {v.model}{v.variant ? ` ${v.variant}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{labelize(v.category_slug.toUpperCase())} · {v.plate_number ?? "No plate"}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.businesses ? <Link href={`/admin/businesses/${v.businesses.id}`} className="font-medium hover:text-electric">{v.businesses.name}</Link> : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{v.city}</TableCell>
                  <TableCell><Pill tone={VEHICLE_STATUS_TONE[v.status]}>{labelize(v.status)}</Pill></TableCell>
                  <TableCell className="text-right text-sm font-semibold">{v.vehicle_pricing ? formatPHP(v.vehicle_pricing.daily_rate) : <span className="font-normal text-muted-foreground">No pricing</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(v.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {rows?.length === 200 && <p className="mt-3 text-xs text-muted-foreground">Showing the 200 most recent vehicles. Narrow the list with a filter or search.</p>}
    </>
  );
}
