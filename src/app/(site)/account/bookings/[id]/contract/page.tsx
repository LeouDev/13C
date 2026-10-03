import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download } from "lucide-react";
import { ContractDocument } from "@/components/contract/contract-document";
import { MarkViewed, SignPanel } from "@/components/contract/sign-panel";
import { EmptyState } from "@/components/common/states";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ContractSection, ContractSignature } from "@/lib/contracts/pdf";

export const metadata: Metadata = { title: "Rental agreement" };

export default async function ContractPage({ params }: PageProps<"/account/bookings/[id]/contract">) {
  const { id } = await params;
  const user = await requireUser(`/account/bookings/${id}/contract`);
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings")
    .select("id, reference, status, renter_id, contracts(id, current_version, contract_versions(id, version, status, title, sections, content_hash, data, signed_at, contract_signatures(signer_role, signer_name, signature_type, signature_data, signed_at, ip_address, content_hash)))")
    .eq("id", id).eq("renter_id", user.id).maybeSingle();
  if (!b) notFound();
  const versions = [...(b.contracts?.contract_versions ?? [])].sort((x, y) => y.version - x.version);
  const current = versions.find((v) => v.version === b.contracts?.current_version) ?? versions.find((v) => v.status === "SIGNED");
  if (!current) {
    return <EmptyState title="Your agreement isn't ready yet" description="The rental business is preparing it. We'll notify you." action={{ label: "Back to booking", href: `/account/bookings/${id}` }} />;
  }
  const vars = current.data as Record<string, string>;
  const signed = current.status === "SIGNED";

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {b.status === "CONTRACT_SENT" && b.contracts && <MarkViewed contractId={b.contracts.id} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/account/bookings/${id}`} className="text-sm text-muted-foreground hover:text-navy-900">← Booking {b.reference}</Link>
        <a href={`/api/contracts/${current.id}/pdf`} target="_blank" className={buttonVariants({ variant: "outline" })}><Download /> {signed ? "Download signed PDF" : "Download PDF"}</a>
      </div>
      {signed && <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="size-5" /> Signed — your booking is confirmed. Both you and the business can download this agreement anytime.</p>}
      {!signed && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Please read the full agreement. {vars.provider_name} is your Rental Provider; 13C is only the technology platform.</p>}
      <ContractDocument title={current.title} version={current.version} reference={b.reference} sections={current.sections as ContractSection[]}
        signatures={current.contract_signatures as ContractSignature[]} contentHash={current.content_hash}
        providerName={vars.provider_name} renterName={vars.renter_name} />
      {current.status === "SENT" && <SignPanel versionId={current.id} contentHash={current.content_hash} defaultName={vars.renter_name ?? user.full_name} />}
    </div>
  );
}
