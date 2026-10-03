import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import { Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { formatDate, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.from("contracts")
    .select("id, status, current_version, updated_at, bookings(id, reference, renter:profiles!bookings_renter_id_fkey(full_name)), contract_versions(id, version, status, signed_at, sent_at)")
    .eq("business_id", business.id).order("updated_at", { ascending: false }).limit(200);
  const tone = { SIGNED: "success", SENT: "brand", DRAFT: "neutral", SUPERSEDED: "neutral", CANCELLED: "danger" } as const;
  return (
    <>
      <PageHeader eyebrow="Contracts" title="Rental agreements" description="Generated automatically when you approve a booking. Signed versions are locked and stored privately." />
      {!data?.length ? <EmptyState icon={FileSignature} title="No contracts yet" description="Approve a booking request to generate your first agreement." /> : (
        <ul className="grid gap-2">
          {data.map((c) => {
            const current = c.contract_versions.find((v) => v.version === c.current_version);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
                <FileSignature className="size-5 text-electric" />
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/bookings/${c.bookings?.id}`} className="font-semibold text-navy-900 hover:text-electric">{c.bookings?.reference} · {c.bookings?.renter?.full_name}</Link>
                  <p className="text-xs text-muted-foreground">Version {c.current_version}{current?.signed_at ? ` · signed ${formatDate(current.signed_at)}` : current?.sent_at ? ` · sent ${formatDate(current.sent_at)}` : ""} · {c.contract_versions.length} version(s)</p>
                </div>
                <Pill tone={tone[c.status]}>{labelize(c.status)}</Pill>
                {current && <a href={`/api/contracts/${current.id}/pdf`} target="_blank" className="text-sm font-semibold text-electric hover:underline">PDF</a>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
