import type { Metadata } from "next";
import Link from "next/link";
import { ContractTermsEditor } from "@/components/business/contract-terms-editor";
import { DownPaymentSetting } from "@/components/business/down-payment-setting";
import { RentalGapSetting } from "@/components/business/rental-gap-setting";
import { TeamManager } from "@/components/business/team-manager";
import { PageHeader } from "@/components/common/states";
import { hasRole, requireBusiness } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { businessPlanActive } from "@/lib/plans";
import { getSubscription } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();
  const isOwner = hasRole(role, "OWNER");
  const [{ data: members }, sub, { data: audit }] = await Promise.all([
    supabase.from("business_members").select("user_id, role, profiles(full_name, email)").eq("business_id", business.id).order("created_at"),
    getSubscription(business.id),
    isOwner ? supabase.from("audit_logs").select("action, created_at, metadata").eq("business_id", business.id).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" />
      <div className="grid gap-6">
        <section className="rounded-3xl border bg-white p-5 sm:p-6">
          <h2 className="font-semibold text-navy-900">Team</h2>
          <p className="mb-4 text-sm text-muted-foreground">Staff handle bookings, messages, calendar and payments. Managers also edit vehicles, store and contracts. Only owners manage team, payments and publishing.</p>
          <TeamManager businessId={business.id} canManage={isOwner} planAllows={businessPlanActive(sub)}
            members={(members ?? []).map((m) => ({ user_id: m.user_id, role: m.role, name: m.profiles?.full_name ?? "", email: m.profiles?.email ?? null }))} />
        </section>
        <section className="rounded-3xl border bg-white p-5 sm:p-6">
          <h2 className="font-semibold text-navy-900">Bookings</h2>
          <p className="mt-1 text-sm text-muted-foreground">The time you need between one rental&apos;s return and the next pickup, for cleaning and inspection. Renters can&apos;t book a car inside this gap, and it shows as booked on your cars&apos; calendars. When you approve a request, other requests for the same car and dates (gap included) are declined automatically.</p>
          <RentalGapSetting businessId={business.id} initial={business.turnaround_hours} canEdit={hasRole(role, "MANAGER")} />
          <p className="mt-6 text-sm text-muted-foreground">A down payment protects you from no-shows. After you approve a booking, the renter sends part of the total to you directly, by the deadline you set. The rental agreement is prepared once you record it, and if it isn&apos;t recorded in time, the booking is cancelled and the dates open again. Say in your cancellation policy whether it&apos;s refundable.</p>
          <DownPaymentSetting businessId={business.id} initial={{ percent: business.down_payment_percent, hours: business.down_payment_hours }} canEdit={hasRole(role, "MANAGER")} />
        </section>
        <section className="rounded-3xl border bg-white p-5 sm:p-6">
          <h2 className="font-semibold text-navy-900">Contract settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your fuel, mileage, late-return, cancellation and deposit policies are inserted into every rental agreement automatically. Edit them in <Link href="/dashboard/store#customize" className="font-semibold text-electric hover:underline">My Store → Rental policies</Link>.</p>
          <h3 className="mt-5 text-sm font-semibold text-navy-900">Additional terms</h3>
          {businessPlanActive(sub) ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Your own clauses, added to every new agreement as its last section. If one conflicts with the standard agreement, the standard terms prevail. Agreements already sent keep the terms they had.</p>
              <ContractTermsEditor businessId={business.id} initial={(business.contract_terms as { title: string; body: string }[]) ?? []} canEdit={hasRole(role, "MANAGER")} />
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Add your own clauses to every agreement on the Business plan. <Link href="/dashboard/subscription" className="font-semibold text-electric hover:underline">See plans</Link></p>
          )}
        </section>
        <section className="rounded-3xl border bg-white p-5 sm:p-6">
          <h2 className="font-semibold text-navy-900">GPS tracking</h2>
          <p className="mt-1 text-sm text-muted-foreground">Coming soon: connect your existing GPS provider to see live location, trip history and rental-expiry alerts. No new hardware required.</p>
        </section>
        {isOwner && (
          <section className="rounded-3xl border bg-white p-5 sm:p-6">
            <h2 className="mb-3 font-semibold text-navy-900">Activity log</h2>
            <ul className="grid gap-2 text-sm">
              {(audit ?? []).map((a, i) => <li key={i} className="flex justify-between gap-3"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span></li>)}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
