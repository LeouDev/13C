import type { Metadata } from "next";
import { PaymentMethodsEditor } from "@/components/business/payment-methods-editor";
import { PageHeader } from "@/components/common/states";
import { hasRole, requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment Settings" };

export default async function PaymentSettingsPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.from("payment_methods").select("*").eq("business_id", business.id);
  return (
    <>
      <PageHeader eyebrow="Payments" title="Payment settings" description="Choose how customers pay you. 13C never processes or holds your money — payment details are shown only to renters with a booking." />
      {!hasRole(role, "OWNER") && <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Only the business owner can change payment methods.</p>}
      <PaymentMethodsEditor businessId={business.id} existing={data ?? []} canEdit={hasRole(role, "OWNER")} />
    </>
  );
}
