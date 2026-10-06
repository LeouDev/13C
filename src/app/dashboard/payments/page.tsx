import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { signInAgain } from "@/app/actions/auth";
import { PaymentMethodsEditor } from "@/components/business/payment-methods-editor";
import { PageHeader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { FRESH_SIGN_IN_MS, hasRole, requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment Settings" };

export default async function PaymentSettingsPage() {
  const { user, business, role } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.from("payment_methods").select("*").eq("business_id", business.id);
  const canEdit = hasRole(role, "OWNER");
  // Changes on a verified business need a sign-in from the last 15 minutes (savePaymentMethods checks the same).
  // eslint-disable-next-line react-hooks/purity -- a request-time check, rendered once on the server
  const stale = canEdit && business.status === "VERIFIED" && Date.now() - user.signedInAt > FRESH_SIGN_IN_MS;
  return (
    <>
      <PageHeader eyebrow="Payments" title="Payment settings" description="Choose how customers pay you. 13C never processes or holds your money. Payment details are shown only to renters with a booking, and owners get an email whenever they change." />
      {!canEdit && <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Only the business owner can change payment methods.</p>}
      {stale && (
        <form action={signInAgain} className="mb-4 flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <input type="hidden" name="next" value="/dashboard/payments" />
          <p>To change payment details, sign in again first. It keeps someone using a device you left signed in from redirecting your payments.</p>
          <Button type="submit" variant="outline" className="shrink-0">Sign in again</Button>
        </form>
      )}
      {canEdit && !user.twoStep && (
        <p className="mb-4 flex gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-electric" />
          <span>Protect these details: <Link href="/account#two-step" className="font-semibold text-electric hover:underline">turn on two-step sign-in</Link>, so a stolen password isn&apos;t enough to change them.</span>
        </p>
      )}
      <PaymentMethodsEditor businessId={business.id} existing={data ?? []} canEdit={canEdit} />
    </>
  );
}
