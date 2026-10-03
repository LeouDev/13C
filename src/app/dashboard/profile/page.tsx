import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { BUSINESS_STATUS_TONE, Pill, VerifiedBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { ProfileEditor, ResubmitVerification } from "@/components/business/profile-editor";
import { requireBusiness, hasRole } from "@/lib/auth";
import { formatDateTime, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Business Profile" };

export default async function ProfilePage() {
  const { business, role } = await requireBusiness("MANAGER");
  const supabase = await createClient();
  const { data: verifications } = hasRole(role, "OWNER")
    ? await supabase.from("business_verifications").select("*").eq("business_id", business.id).order("created_at", { ascending: false })
    : { data: [] };
  const canResubmit = hasRole(role, "OWNER") && ["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(business.status);

  return (
    <>
      <PageHeader eyebrow="Business" title="Business Profile" description="Your legal and contact details. These appear on your store and in every rental agreement." />
      <section className="rounded-3xl border bg-white p-5 sm:p-6">
        <ProfileEditor business={business} />
      </section>

      <section id="verification" className="mt-6 rounded-3xl border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-bold text-navy-900">Verification</h2>
          <Pill tone={BUSINESS_STATUS_TONE[business.status]}>{labelize(business.status)}</Pill>
          {business.status === "VERIFIED" && <VerifiedBadge />}
        </div>
        {business.status_note && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><span className="font-semibold">Reviewer note:</span> {business.status_note}</p>}
        {verifications && verifications.length > 0 && (
          <ul className="mt-4 divide-y rounded-2xl border">
            {verifications.map((v) => (
              <li key={v.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2"><FileText className="size-4 text-electric" /> Submitted {formatDateTime(v.created_at)} · {(v.documents as unknown[]).length} document(s)</span>
                <span className="text-muted-foreground">{v.decision ? `${labelize(v.decision)} · ${formatDateTime(v.reviewed_at!)}` : "Awaiting review"}</span>
              </li>
            ))}
          </ul>
        )}
        {canResubmit && (
          <div className="mt-6">
            <h3 className="mb-3 font-semibold text-navy-900">{business.status === "DRAFT" ? "Submit your documents" : "Resubmit for verification"}</h3>
            <ResubmitVerification businessId={business.id} />
          </div>
        )}
      </section>
    </>
  );
}
