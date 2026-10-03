import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Users } from "lucide-react";
import { ListFilters, searchTerms } from "@/components/admin/list-filters";
import { UserActions } from "@/components/admin/user-actions";
import { isAnonymized, KYC_TONE } from "@/components/admin/user-meta";
import { Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { formatDate, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "cn";

export const metadata: Metadata = { title: "Users" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "deletion", label: "Deletion requests" },
  { key: "kyc", label: "KYC pending" },
  { key: "suspended", label: "Suspended" },
  { key: "admins", label: "Admins" },
];

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireAdmin();
  const { status = "all", q } = (await searchParams) as { status?: string; q?: string };
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0]!;
  const supabase = await createClient();

  let query = supabase.from("profiles")
    .select("id, full_name, email, phone, created_at, is_admin, is_suspended, deletion_requested_at, renters(kyc_status)")
    .order("created_at", { ascending: false }).limit(200);
  if (filter.key === "deletion") query = query.not("deletion_requested_at", "is", null).neq("full_name", "Deleted user");
  if (filter.key === "suspended") query = query.eq("is_suspended", true);
  if (filter.key === "admins") query = query.eq("is_admin", true);
  if (filter.key === "kyc") {
    const { data: pending } = await supabase.from("renters").select("user_id").eq("kyc_status", "PENDING").limit(200);
    query = query.in("id", (pending ?? []).map((r) => r.user_id));
  }
  const term = searchTerms(q, 8).join("%");
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

  const [{ data: rows }, { count: deletionCount }] = await Promise.all([
    query,
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("deletion_requested_at", "is", null).neq("full_name", "Deleted user"),
  ]);

  return (
    <>
      <PageHeader title="Users" description="Accounts, renter KYC, suspensions and Data Privacy Act deletion requests." />
      {!!deletionCount && filter.key !== "deletion" && (
        <Link href="/admin/users?status=deletion" className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100">
          <AlertTriangle className="size-4 shrink-0" />
          <span><strong>{deletionCount}</strong> account deletion {deletionCount === 1 ? "request is" : "requests are"} waiting. Process within 30 days.</span>
        </Link>
      )}
      <ListFilters basePath="/admin/users" options={FILTERS.map((f) => (f.key === "deletion" ? { ...f, count: deletionCount } : f))} active={filter.key} q={q} searchPlaceholder="Search name or email…" />
      {!rows?.length ? <EmptyState icon={Users} title="No users found" /> : (
        <div className="w-0 min-w-full overflow-hidden rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow><TableHead>User</TableHead><TableHead>Joined</TableHead><TableHead>Flags</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const anonymized = isAnonymized(u);
                const deletionPending = !!u.deletion_requested_at && !anonymized;
                return (
                  <TableRow key={u.id} className={cn(deletionPending && "bg-amber-50/70 hover:bg-amber-50")}>
                    <TableCell>
                      <Link href={`/admin/users/${u.id}`} className="font-semibold text-navy-900 hover:text-electric">{u.full_name || "—"}</Link>
                      <p className="text-xs text-muted-foreground">{u.email ?? "no email"}{u.phone ? ` · ${u.phone}` : ""}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.is_admin && <Pill tone="brand">Admin</Pill>}
                        {u.renters && <Pill tone={KYC_TONE[u.renters.kyc_status]}>KYC {labelize(u.renters.kyc_status).toLowerCase()}</Pill>}
                        {u.is_suspended && !anonymized && <Pill tone="danger">Suspended</Pill>}
                        {deletionPending && <Pill tone="warning">Deletion requested {formatDate(u.deletion_requested_at!)}</Pill>}
                        {anonymized && <Pill>Anonymized</Pill>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <UserActions userId={u.id} name={u.full_name || "this user"} suspended={u.is_suspended} kycStatus={u.renters?.kyc_status ?? null}
                        anonymized={anonymized} isSelf={u.id === me.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Anonymizing erases personal data (name, contact details, KYC details and driver documents) and suspends the account.
        Booking, payment, contract and e-signature records are retained as required by law.
      </p>
    </>
  );
}
