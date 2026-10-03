import type { Metadata } from "next";
import Link from "next/link";
import { BookingOnOtherAccount } from "@/components/booking/other-account";
import { EmptyState } from "@/components/common/states";
import { SignatureCertificate } from "@/components/contract/signature-certificate";
import { requireUser } from "@/lib/auth";
import { loadVersion, pdfInput } from "@/lib/contracts/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Signature certificate" };

export default async function RenterCertificatePage({ params }: PageProps<"/account/bookings/[id]/contract/certificate">) {
  const { id } = await params;
  const user = await requireUser(`/account/bookings/${id}/contract/certificate`);
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("id, contracts(current_version, contract_versions(id, version, status))")
    .eq("id", id).eq("renter_id", user.id).maybeSingle();
  if (!b) return <BookingOnOtherAccount bookingId={id} email={user.email} />;
  const signed = (b.contracts?.contract_versions ?? []).filter((v) => v.status === "SIGNED").sort((x, y) => y.version - x.version)[0];
  const v = signed ? await loadVersion(supabase, signed.id) : null;
  if (!v) {
    return <EmptyState title="No signed agreement yet" description="The certificate appears once both parties sign." action={{ label: "Back to agreement", href: `/account/bookings/${id}/contract` }} />;
  }
  return (
    <div className="mx-auto grid max-w-[760px] gap-3.5">
      <Link href={`/account/bookings/${id}/contract`} className="text-sm text-muted-foreground hover:text-navy-900">← Rental agreement</Link>
      <SignatureCertificate c={pdfInput(v)} />
    </div>
  );
}
