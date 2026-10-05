import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { DeletionRequest, DriverDocuments, PasswordForm } from "@/components/account/account-panels";
import { RenterForm } from "@/components/account/renter-form";
import { Pill } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { requireUser } from "@/lib/auth";
import { labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile & documents" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const [{ data: renter }, { data: docs }] = await Promise.all([
    supabase.from("renters").select("*").eq("user_id", user.id).single(),
    supabase.from("driver_documents").select("doc_type, storage_path").eq("user_id", user.id),
  ]);
  const card = "rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6";
  return (
    <div className="grid gap-6">
      <PageHeader title="Profile & documents" description={user.email ?? undefined} />
      <section className={card}>
        <h2 className="mb-4 font-semibold text-navy-900">Renter details</h2>
        <RenterForm initial={{
          full_name: user.full_name, phone: user.phone ?? "", legal_name: renter?.legal_name ?? "", date_of_birth: renter?.date_of_birth ?? "",
          address: renter?.address ?? "", city: renter?.city ?? "", license_number: renter?.license_number ?? "", license_expiry: renter?.license_expiry ?? "",
        }} />
      </section>
      <section id="documents" className={card}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-navy-900">Driver&apos;s license & ID</h2>
          <Pill tone={renter?.kyc_status === "VERIFIED" ? "success" : renter?.kyc_status === "REJECTED" ? "danger" : "neutral"}>{labelize(renter?.kyc_status ?? "UNVERIFIED")}</Pill>
        </div>
        <p className="mb-4 flex gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-emerald-600" /> Stored privately. Only rental businesses you request a booking from can view them, while that booking is pending or in progress. Never public.</p>
        <DriverDocuments userId={user.id} docs={docs ?? []} />
      </section>
      <section id="security" className={card}>
        <h2 className="mb-1 font-semibold text-navy-900">Security</h2>
        <p className="mb-3 text-sm text-muted-foreground">Changing your password signs you out on your other devices.</p>
        <PasswordForm />
      </section>
      <section className={card}>
        <h2 className="mb-1 font-semibold text-navy-900">Privacy</h2>
        <p className="mb-4 text-sm text-muted-foreground">Under the Data Privacy Act of 2012 you can access, correct or request deletion of your personal data. Email privacy@13c.online for a copy of your data.</p>
        <DeletionRequest requestedAt={user.deletion_requested_at} />
      </section>
    </div>
  );
}
