import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { BusinessDecision, DocumentLink } from "@/components/admin/business-review";
import { BUSINESS_STATUS_TONE, Pill } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { formatDateTime, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Business review" };

export default async function AdminBusinessPage({ params }: PageProps<"/admin/businesses/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: b } = await supabase.from("businesses")
    .select("*, business_storefronts(*), subscriptions(*), owner:profiles!businesses_owner_id_fkey(full_name, email, phone), business_verifications(*), vehicles(id, make, model, year, status, plate_number, deleted_at)")
    .eq("id", id).order("created_at", { referencedTable: "business_verifications", ascending: false }).maybeSingle();
  if (!b) notFound();
  const { data: audit } = await supabase.from("audit_logs").select("action, created_at, metadata").eq("business_id", id).order("created_at", { ascending: false }).limit(15);

  const info: [string, React.ReactNode][] = [
    ["Store link", <Link key="l" href={`/${b.slug}`} target="_blank" className="inline-flex items-center gap-1 text-electric hover:underline">/{b.slug} <ExternalLink className="size-3" /></Link>],
    ["Address", [b.address, b.city, b.province].filter(Boolean).join(", ")],
    ["Phone / email", `${b.phone ?? "—"} · ${b.email ?? "—"}`],
    ["Representative", [b.representative_name, b.representative_title].filter(Boolean).join(", ") || "—"],
    ["Registration", [b.registration_type && labelize(b.registration_type), b.registration_number].filter(Boolean).join(" · ") || "—"],
    ["Owner account", `${b.owner?.full_name ?? ""} · ${b.owner?.email ?? ""}`],
    ["Plan", b.subscriptions?.plan ?? "FREE"],
    ["Published", b.business_storefronts?.is_published ? "Yes" : "No"],
  ];

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3"><BusinessLogo path={b.logo_path} name={b.name} className="size-10 rounded-xl" />{b.name}</span>}
        description={`Registered ${formatDateTime(b.created_at)}`}
        actions={<Pill tone={BUSINESS_STATUS_TONE[b.status]}>{labelize(b.status)}</Pill>}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Business information</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
            {info.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium text-navy-900">{v}</dd></div>))}
          </dl>
          {b.description && <p className="mt-4 rounded-xl bg-canvas p-3 text-sm">{b.description}</p>}
          <h3 className="mt-6 mb-2 font-semibold">Vehicles ({b.vehicles.filter((v) => !v.deleted_at).length})</h3>
          <ul className="grid gap-1 text-sm">
            {b.vehicles.filter((v) => !v.deleted_at).map((v) => <li key={v.id}>{v.year} {v.make} {v.model} · {v.plate_number ?? "no plate"} · {labelize(v.status)}</li>)}
          </ul>
        </section>
        <div className="grid content-start gap-6">
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Decision</h2>
            {b.status_note && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Last note: {b.status_note}</p>}
            <BusinessDecision businessId={b.id} status={b.status} />
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Submissions</h2>
            {b.business_verifications.length === 0 ? <p className="text-sm text-muted-foreground">No documents submitted yet.</p> : b.business_verifications.map((v) => (
              <div key={v.id} className="mb-4 last:mb-0">
                <p className="mb-2 text-xs text-muted-foreground">{formatDateTime(v.created_at)} · {v.decision ? labelize(v.decision) : "Pending"}</p>
                {v.submitter_note && <p className="mb-2 text-sm italic">“{v.submitter_note}”</p>}
                <div className="grid gap-2">
                  {(v.documents as { type: string; path: string; name: string }[]).map((d) => <DocumentLink key={d.path} path={d.path} name={`${labelize(d.type)} — ${d.name}`} />)}
                </div>
              </div>
            ))}
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Audit trail</h2>
            <ul className="grid gap-2 text-sm">
              {(audit ?? []).map((a, i) => <li key={i} className="flex justify-between gap-2"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span></li>)}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
