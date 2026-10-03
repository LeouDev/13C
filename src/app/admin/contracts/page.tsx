import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { ListFilters } from "@/components/admin/list-filters";
import { Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Contracts" };

const STATUSES: Enums<"contract_status">[] = ["DRAFT", "SENT", "SIGNED", "SUPERSEDED", "CANCELLED"];
const TONE: Record<Enums<"contract_status">, "neutral" | "brand" | "success" | "danger"> = {
  DRAFT: "neutral", SENT: "brand", SIGNED: "success", SUPERSEDED: "neutral", CANCELLED: "danger",
};
const FILTERS = [{ key: "all", label: "All" }, ...STATUSES.map((s) => ({ key: s, label: labelize(s) }))];

export default async function AdminContractsPage({ searchParams }: PageProps<"/admin/contracts">) {
  const { status = "all", q } = (await searchParams) as { status?: string; q?: string };
  const statusFilter = STATUSES.find((s) => s === status);
  const supabase = await createClient();
  let query = supabase.from("contract_versions")
    .select("id, version, title, status, sent_at, signed_at, pdf_path, created_at, bookings!inner(reference), contracts(current_version, businesses!contracts_business_id_fkey(id, name), profiles!contracts_renter_id_fkey(id, full_name))")
    .order("created_at", { ascending: false }).limit(200);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (q?.trim()) query = query.ilike("bookings.reference", `%${q.trim()}%`);
  const { data: rows } = await query;

  return (
    <>
      <PageHeader title="Contracts" description="Every rental agreement version. Signed versions are immutable; edits create a new version." />
      <ListFilters basePath="/admin/contracts" options={FILTERS} active={statusFilter ?? "all"} q={q} searchPlaceholder="Search 13C-…" searchLabel="Search by booking reference" />
      {!rows?.length ? <EmptyState icon={FileText} title="No contracts found" /> : (
        <div className="w-0 min-w-full overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead><TableHead>Business</TableHead><TableHead>Renter</TableHead><TableHead>Version</TableHead>
                <TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead>Signed</TableHead><TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const c = v.contracts;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold text-navy-900">{v.bookings.reference}</p>
                      <p className="max-w-56 truncate text-xs text-muted-foreground" title={v.title}>{v.title}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c?.businesses ? <Link href={`/admin/businesses/${c.businesses.id}`} className="font-medium hover:text-electric">{c.businesses.name}</Link> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c?.profiles ? <Link href={`/admin/users/${c.profiles.id}`} className="hover:text-electric">{c.profiles.full_name}</Link> : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      v{v.version}{c && v.version === c.current_version && <span className="ml-1 text-xs text-muted-foreground">(current)</span>}
                    </TableCell>
                    <TableCell><Pill tone={TONE[v.status]}>{labelize(v.status)}</Pill></TableCell>
                    <TableCell className="text-xs">{v.sent_at ? formatDateTime(v.sent_at) : "—"}</TableCell>
                    <TableCell className="text-xs">{v.signed_at ? formatDateTime(v.signed_at) : "—"}</TableCell>
                    <TableCell>
                      <a href={`/api/contracts/${v.id}/pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-electric hover:underline">
                        <FileText className="size-3.5" /> PDF
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {v.status === "SIGNED" ? (v.pdf_path ? "Signed copy stored" : "Signed · generated on open") : "Watermarked preview"}
                      </p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
