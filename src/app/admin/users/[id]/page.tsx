import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocumentLink } from "@/components/admin/business-review";
import { UserActions } from "@/components/admin/user-actions";
import { isAnonymized, KYC_TONE } from "@/components/admin/user-meta";
import { BookingStatusBadge, BUSINESS_STATUS_TONE, Pill } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, formatPHP, labelize } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data: u } = await supabase.from("profiles")
    .select("*, renters(*), driver_documents(id, doc_type, storage_path, created_at)")
    .eq("id", id).maybeSingle();
  if (!u) notFound();
  const [{ data: bookings }, { data: businesses }, { data: audit }, { data: factors }] = await Promise.all([
    supabase.from("bookings").select("id, reference, status, pickup_at, total_amount, businesses(id, name)")
      .eq("renter_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("businesses").select("id, name, status").eq("owner_id", id).is("deleted_at", null),
    supabase.from("audit_logs").select("action, created_at").eq("entity_type", "user").eq("entity_id", id)
      .order("created_at", { ascending: false }).limit(10),
    createAdminClient().auth.admin.mfa.listFactors({ userId: id }), // requireAdmin above
  ]);
  const r = u.renters;
  const anonymized = isAnonymized(u);

  const info: [string, React.ReactNode][] = [
    ["Email", u.email ?? "—"],
    ["Phone", u.phone ?? "—"],
    ["Joined", formatDateTime(u.created_at)],
    ["Terms accepted", u.terms_accepted_at ? formatDateTime(u.terms_accepted_at) : "—"],
    ["Marketing opt-in", u.marketing_opt_in ? "Yes" : "No"],
  ];
  const kyc: [string, React.ReactNode][] = r ? [
    ["Legal name", r.legal_name ?? "—"],
    ["Date of birth", r.date_of_birth ? formatDate(r.date_of_birth) : "—"],
    ["Address", [r.address, r.city].filter(Boolean).join(", ") || "—"],
    ["License number", r.license_number ?? "—"],
    ["License expiry", r.license_expiry ? formatDate(r.license_expiry) : "—"],
  ] : [];

  return (
    <>
      <Link href="/admin/users" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy-900"><ArrowLeft className="size-4" /> All users</Link>
      <PageHeader
        title={u.full_name || "Unnamed user"}
        description={`User ID ${u.id}`}
        actions={
          <div className="flex flex-wrap gap-1">
            {u.is_admin && <Pill tone="brand">Admin</Pill>}
            {u.is_suspended && !anonymized && <Pill tone="danger">Suspended</Pill>}
            {anonymized && <Pill>Anonymized</Pill>}
          </div>
        }
      />
      {u.deletion_requested_at && !anonymized && (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Deletion requested on {formatDateTime(u.deletion_requested_at)}. Use <strong>Anonymize</strong> below to erase this user&apos;s personal data;
          booking, payment, contract and e-signature records are retained as required by law.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-6">
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Account</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-[150px_1fr]">
              {info.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium break-words text-navy-900">{v}</dd></div>))}
            </dl>
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Bookings as renter</h2>
            {!bookings?.length ? <p className="text-sm text-muted-foreground">No bookings yet.</p> : (
              <ul className="grid gap-2 text-sm">
                {bookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-mono text-xs text-muted-foreground">{b.reference}</span>{" "}
                      {b.businesses ? <Link href={`/admin/businesses/${b.businesses.id}`} className="font-medium hover:text-electric">{b.businesses.name}</Link> : null}
                      <span className="block text-xs text-muted-foreground">Pickup {formatDate(b.pickup_at)} · {formatPHP(b.total_amount)}</span>
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {!!businesses?.length && (
            <section className="rounded-2xl border bg-white p-5">
              <h2 className="mb-3 font-semibold">Businesses owned</h2>
              <ul className="grid gap-2 text-sm">
                {businesses.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/businesses/${b.id}`} className="font-medium hover:text-electric">{b.name}</Link>
                    <Pill tone={BUSINESS_STATUS_TONE[b.status]}>{labelize(b.status)}</Pill>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="grid content-start gap-6">
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Actions</h2>
            <UserActions userId={u.id} name={u.full_name || "this user"} suspended={u.is_suspended} kycStatus={r?.kyc_status ?? null}
              anonymized={anonymized} isSelf={u.id === me.id} twoStep={!!factors?.factors.some((f) => f.status === "verified")} />
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Renter verification</h2>
              {r && <Pill tone={KYC_TONE[r.kyc_status]}>{labelize(r.kyc_status)}</Pill>}
            </div>
            {!r ? <p className="text-sm text-muted-foreground">This user hasn&apos;t created a renter profile.</p> : (
              <>
                <dl className="grid gap-2 text-sm sm:grid-cols-[130px_1fr]">
                  {kyc.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium break-words text-navy-900">{v}</dd></div>))}
                </dl>
                {r.kyc_note && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm">Note: {r.kyc_note}</p>}
              </>
            )}
            <h3 className="mt-5 mb-2 text-sm font-semibold">Driver documents</h3>
            {!u.driver_documents.length ? <p className="text-sm text-muted-foreground">No documents uploaded.</p> : (
              <div className="grid gap-2">
                {u.driver_documents.map((d) => (
                  <DocumentLink key={d.id} bucket="kyc" path={d.storage_path} name={`${labelize(d.doc_type)} · ${formatDate(d.created_at)}`} />
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Links open a private copy that expires after 60 seconds.</p>
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Audit trail</h2>
            {!audit?.length ? <p className="text-sm text-muted-foreground">No admin actions recorded.</p> : (
              <ul className="grid gap-2 text-sm">
                {audit.map((a, i) => <li key={i} className="flex justify-between gap-2"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
