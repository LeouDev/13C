import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS_STATUS_TONE, Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "cn";
import type { Enums } from "@/types/database";

export async function generateMetadata({ searchParams }: PageProps<"/admin/businesses">): Promise<Metadata> {
  return { title: (await searchParams).status === "queue" ? "Verification" : "Businesses" };
}

const FILTERS: { key: string; label: string; statuses?: Enums<"business_status">[] }[] = [
  { key: "all", label: "All" },
  { key: "queue", label: "Needs review", statuses: ["PENDING", "UNDER_REVIEW"] },
  { key: "verified", label: "Verified", statuses: ["VERIFIED"] },
  { key: "changes", label: "Changes requested", statuses: ["CHANGES_REQUESTED"] },
  { key: "draft", label: "Draft", statuses: ["DRAFT"] },
  { key: "blocked", label: "Rejected / suspended", statuses: ["REJECTED", "SUSPENDED"] },
];

export default async function AdminBusinessesPage({ searchParams }: PageProps<"/admin/businesses">) {
  const { status = "all", q } = (await searchParams) as { status?: string; q?: string };
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0]!;
  const supabase = await createClient();
  let query = supabase.from("businesses")
    .select("id, name, slug, city, status, created_at, logo_path, business_storefronts(is_published), subscriptions(plan), owner:profiles!businesses_owner_id_fkey(full_name, email)")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: rows } = await query;

  return (
    <>
      {filter.key === "queue"
        ? <PageHeader title="Verification" description="Businesses waiting for review. Open one to check its documents, then approve, request changes or reject." />
        : <PageHeader title="Businesses" description="Review verification, monitor stores, and take action." />}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/businesses?status=${f.key}`} className={cn("rounded-full px-3 py-1.5 text-sm font-medium", f.key === filter.key ? "bg-navy-900 text-white" : "bg-white hover:bg-white/70")}>{f.label}</Link>
        ))}
        <form className="ml-auto"><input name="q" defaultValue={q} placeholder="Search name…" className="h-9 rounded-full border bg-white px-4 text-sm" /><input type="hidden" name="status" value={filter.key} /></form>
      </div>
      {!rows?.length ? <EmptyState title={filter.key === "queue" ? "Nothing waiting for review" : "No businesses here"} /> : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Store</TableHead><TableHead>Plan</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/businesses/${b.id}`} className="flex items-center gap-2 font-semibold text-navy-900 hover:text-electric">
                      <BusinessLogo path={b.logo_path} name={b.name} className="size-8 rounded-lg text-xs" />{b.name}
                    </Link>
                    <span className="ml-10 text-xs text-muted-foreground">{b.city}</span>
                  </TableCell>
                  <TableCell className="text-sm">{b.owner?.full_name}<br /><span className="text-xs text-muted-foreground">{b.owner?.email}</span></TableCell>
                  <TableCell><Pill tone={BUSINESS_STATUS_TONE[b.status]}>{labelize(b.status)}</Pill></TableCell>
                  <TableCell>{b.business_storefronts?.is_published ? <Pill tone="success">Published</Pill> : <Pill>Draft</Pill>}</TableCell>
                  <TableCell className="text-sm">{b.subscriptions?.plan}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(b.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
