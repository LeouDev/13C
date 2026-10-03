import type { Metadata } from "next";
import Link from "next/link";
import { BookingOnOtherAccount } from "@/components/booking/other-account";
import { Download } from "lucide-react";
import { ContractDocument } from "@/components/contract/contract-document";
import { SignedAgreement } from "@/components/contract/signed-agreement";
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
    .select("id, reference, status, renter_id, business_id, conversation_id, pickup_at, return_at, pickup_location, return_location, total_amount, security_deposit, payment_method, payment_status, businesses(logo_path), contracts(id, current_version, contract_versions(id, version, status, title, sections, content_hash, data, sent_at, signed_at, viewed_at, contract_signatures(signer_role, signer_name, signature_type, signature_data, signed_at, ip_address, content_hash)))")
    .eq("id", id).eq("renter_id", user.id).maybeSingle();
  if (!b) return <BookingOnOtherAccount bookingId={id} email={user.email} />;
  const versions = [...(b.contracts?.contract_versions ?? [])].sort((x, y) => y.version - x.version);
  const current = versions.find((v) => v.version === b.contracts?.current_version) ?? versions.find((v) => v.status === "SIGNED");
  if (!current) {
    return <EmptyState title="Your agreement isn't ready yet" description="The rental business is preparing it. We'll notify you." action={{ label: "Back to booking", href: `/account/bookings/${id}` }} />;
  }
  const vars = current.data as Record<string, string>;
  const renterName = vars.renter_name ?? user.full_name ?? "Renter";

  if (current.status === "SIGNED") {
    const { data: payTo } = await supabase.from("payment_methods").select("account_name, account_number")
      .eq("business_id", b.business_id).eq("method", b.payment_method).eq("is_enabled", true).maybeSingle();
    return (
      <SignedAgreement booking={b} providerName={vars.provider_name} providerLogo={b.businesses?.logo_path} renterName={renterName} payTo={payTo}
        version={{ ...current, sections: current.sections as ContractSection[], signatures: current.contract_signatures as ContractSignature[] }} />
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {current.status === "SENT" && !current.viewed_at && b.contracts && <MarkViewed contractId={b.contracts.id} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/account/bookings/${id}`} className="text-sm text-muted-foreground hover:text-navy-900">← Booking {b.reference}</Link>
        <a href={`/api/contracts/${current.id}/pdf`} target="_blank" className={buttonVariants({ variant: "outline" })}><Download /> Download PDF</a>
      </div>
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Please read the full agreement. {vars.provider_name} is your Rental Provider; 13C is only the technology platform.</p>
      <ContractDocument title={current.title} version={current.version} reference={b.reference} sections={current.sections as ContractSection[]}
        signatures={current.contract_signatures as ContractSignature[]} contentHash={current.content_hash}
        providerName={vars.provider_name} renterName={renterName} providerLogo={b.businesses?.logo_path} />
      {current.status === "SENT" && <SignPanel versionId={current.id} contentHash={current.content_hash} defaultName={vars.renter_name ?? user.full_name} />}
    </div>
  );
}
