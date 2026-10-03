import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { SignatureCertificate } from "@/components/contract/signature-certificate";
import { requireBusiness } from "@/lib/auth";
import { loadVersion, pdfInput } from "@/lib/contracts/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Signature certificate" };

export default async function BusinessCertificatePage({ params }: PageProps<"/dashboard/bookings/[id]/certificate">) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("id, contracts(contract_versions(id, version, status))")
    .eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!b) notFound();
  const signed = (b.contracts?.contract_versions ?? []).filter((v) => v.status === "SIGNED").sort((x, y) => y.version - x.version)[0];
  const v = signed ? await loadVersion(supabase, signed.id) : null;
  if (!v) {
    return <EmptyState title="No signed agreement yet" description="The certificate appears once both parties sign." action={{ label: "Back to booking", href: `/dashboard/bookings/${id}` }} />;
  }
  return (
    <div className="mx-auto grid max-w-[760px] gap-3.5">
      <Link href={`/dashboard/bookings/${id}`} className="text-sm text-muted-foreground hover:text-navy-900">← Booking {v.bookings?.reference}</Link>
      <SignatureCertificate c={pdfInput(v)} />
    </div>
  );
}
