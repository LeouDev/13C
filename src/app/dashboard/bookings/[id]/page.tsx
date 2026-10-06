import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, Download, FileSignature, MessageSquare, Phone } from "lucide-react";
import { DocumentLink } from "@/components/admin/business-review";
import { PaymentsPanel, RegenerateButton, TermsEditor, TransitionActions } from "@/components/booking/booking-actions";
import { DownPaymentPanel } from "@/components/booking/down-payment";
import { BookingProgress, StatusHistory } from "@/components/booking/booking-timeline";
import { BookingStatusBadge, Pill } from "@/components/common/badges";
import { PageHeader } from "@/components/common/states";
import { ContractDocument, ContractSections } from "@/components/contract/contract-document";
import { BeforePickupCard, SignedAgreementSummary } from "@/components/contract/signed-agreement";
import { SendContractDialog } from "@/components/contract/sign-panel";
import { ReportButton } from "@/components/storefront/report-button";
import { buttonVariants } from "@/components/ui/button";
import { hasRole, requireBusiness } from "@/lib/auth";
import { STATUS_META } from "@/lib/bookings/status";
import type { ContractSection, ContractSignature } from "@/lib/contracts/pdf";
import { formatDate, formatDateTime, formatPHP, isoToManilaDate, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Booking" };

export default async function BusinessBookingPage({ params }: PageProps<"/dashboard/bookings/[id]">) {
  const { id } = await params;
  const { user, business, role } = await requireBusiness();
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings")
    .select("*, vehicles(id, make, model, year, plate_number, slug), renter:profiles!bookings_renter_id_fkey(id, full_name, email, phone), booking_status_history(to_status, note, created_at), payments(id, amount, method, reference, paid_at), contracts(id, status, current_version, contract_versions(id, version, status, title, sections, content_hash, sent_at, viewed_at, signed_at, pdf_path, data, contract_signatures(signer_role, signer_name, signature_type, signature_data, signed_at, ip_address, content_hash)))")
    .eq("id", id).eq("business_id", business.id)
    .order("created_at", { referencedTable: "booking_status_history" })
    .maybeSingle();
  if (!b) notFound();
  const [{ data: renter }, { data: docs }] = await Promise.all([
    supabase.from("renters").select("*").eq("user_id", b.renter_id).maybeSingle(),
    supabase.from("driver_documents").select("doc_type, storage_path").eq("user_id", b.renter_id),
  ]);

  const contract = b.contracts;
  const versions = [...(contract?.contract_versions ?? [])].sort((x, y) => y.version - x.version);
  const current = versions.find((v) => v.version === contract?.current_version);
  const canManage = hasRole(role, "MANAGER");
  const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const downOwed = b.status === "APPROVED" && Number(b.down_payment_amount) > paid; // the agreement waits for it
  // Renters can request before uploading their license and ID; approving needs them (assert_renter_ready).
  const docsMissing = b.status === "PENDING_OWNER_APPROVAL" && new Set(docs?.map((d) => d.doc_type)).size < 3;
  const editable = ["BOOKING_REQUESTED", "PENDING_OWNER_APPROVAL", "CONTRACT_DRAFT", "CONTRACT_SENT", "AWAITING_SIGNATURE", "SIGNED", "CONFIRMED"].includes(b.status);
  const vars = (current?.data ?? {}) as Record<string, string>;
  const signedNow = current?.status === "SIGNED";
  const history = versions.length > 1 && (
    <div className="rounded-2xl border bg-white p-4 text-sm">
      <p className="mb-2 font-semibold">Version history</p>
      <ul className="grid gap-1.5">{versions.map((v) => (
        <li key={v.id} className="flex justify-between gap-3"><span>v{v.version} · {labelize(v.status)}{v.signed_at ? ` · signed ${formatDate(v.signed_at)}` : ""}</span><a className="text-electric hover:underline" href={`/api/contracts/${v.id}/pdf`} target="_blank">PDF</a></li>
      ))}</ul>
    </div>
  );

  return (
    <>
      <Link href="/dashboard/bookings" className="mb-3 inline-block text-sm text-muted-foreground hover:text-navy-900">← Bookings</Link>
      <PageHeader eyebrow={b.reference} title={`${b.vehicles?.year} ${b.vehicles?.make} ${b.vehicles?.model}`}
        description={`${b.renter?.full_name} · ${formatDateTime(b.pickup_at)} → ${formatDateTime(b.return_at)}`}
        actions={<BookingStatusBadge status={b.status} className="h-8 px-3 text-sm" />} />

      <section className="mb-6 rounded-3xl border bg-white p-5">
        <BookingProgress status={b.status} />
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-navy-800">
            {downOwed ? "Approved. Waiting for the renter's down payment; the rental agreement is prepared as soon as you record it."
              : docsMissing ? "New request. The renter hasn't uploaded their driver's license and ID yet; you can approve once they do (we'll let you know), or message them."
              : nextStepCopy(b.status)}
          </p>
          <div className="flex flex-wrap gap-2">
            {b.status === "CONTRACT_DRAFT" && contract && canManage && <SendContractDialog contractId={contract.id} defaultName={business.representative_name ?? user.full_name} />}
            {canManage && contract && ["CONTRACT_DRAFT", "CONTRACT_SENT", "AWAITING_SIGNATURE", "SIGNED", "CONFIRMED"].includes(b.status) && <RegenerateButton bookingId={b.id} signed={["SIGNED", "CONFIRMED"].includes(b.status)} />}
            {canManage && editable && <TermsEditor booking={b} />}
            <TransitionActions bookingId={b.id} status={b.status} actor="BUSINESS" approveWaiting={docsMissing ? "Waiting for the renter's license and ID" : null}
              pickupFrom={isoToManilaDate(new Date()) < isoToManilaDate(b.pickup_at) ? formatDate(b.pickup_at) : null} />
          </div>
        </div>
        {downOwed && b.down_payment_due_at && (
          <DownPaymentPanel paid={paid} method={b.payment_method} canWaive={canManage}
            due={{ bookingId: b.id, amount: Number(b.down_payment_amount), percent: b.down_payment_percent, dueAt: b.down_payment_due_at, reportedAt: b.down_payment_reported_at, reference: b.down_payment_reference }} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          {current && signedNow && (
            <SignedAgreementSummary bookingId={b.id} version={{ ...current, signatures: current.contract_signatures as ContractSignature[] }}>
              {history && <div className="border-t p-5">{history}</div>}
              <details className="group border-t">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-medium text-navy-900 [&::-webkit-details-marker]:hidden">
                  Agreement text · {(current.sections as ContractSection[]).length} sections <ChevronDown className="size-4 transition group-open:rotate-180" />
                </summary>
                <ContractSections sections={current.sections as ContractSection[]} className="px-5 pb-6" />
              </details>
            </SignedAgreementSummary>
          )}

          <section className="rounded-3xl border bg-white p-5">
            <h2 className="mb-4 font-semibold text-navy-900">Rental details</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item k="Pickup" v={`${formatDateTime(b.pickup_at)} · ${b.pickup_location}`} />
              <Item k="Return" v={`${formatDateTime(b.return_at)} · ${b.return_location}`} />
              <Item k="Service" v={`${b.with_driver ? "With driver" : `Self-drive · ${b.drivers_count} driver(s)`}${b.delivery ? " · Delivery" : ""}`} />
              <Item k="Plate" v={b.vehicles?.plate_number ?? "—"} />
              {b.notes && <Item k="Renter notes" v={b.notes} wide />}
            </dl>
            <dl className="mt-5 grid gap-1.5 rounded-2xl bg-canvas p-4 text-sm">
              <Row k={`${b.rental_days} day(s) × ${formatPHP(b.daily_rate)}`} v={formatPHP(b.base_amount)} />
              {Number(b.driver_fee) > 0 && <Row k="Driver" v={formatPHP(b.driver_fee)} />}
              {Number(b.delivery_fee) > 0 && <Row k="Delivery" v={formatPHP(b.delivery_fee)} />}
              {Number(b.other_fees) > 0 && <Row k="Other fees" v={formatPHP(b.other_fees)} />}
              {Number(b.discount) > 0 && <Row k="Discount" v={`− ${formatPHP(b.discount)}`} />}
              <Row k="Total" v={formatPHP(b.total_amount)} strong />
              <Row k="Security deposit" v={formatPHP(b.security_deposit)} />
            </dl>
          </section>

          <section className="rounded-3xl border bg-white p-5">
            <h2 className="mb-4 font-semibold text-navy-900">Payment</h2>
            <PaymentsPanel bookingId={b.id} total={Number(b.total_amount)} status={b.payment_status} method={b.payment_method} payments={b.payments} canEdit />
          </section>

          {current && !signedNow ? (
            <section className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold text-navy-900"><FileSignature className="size-5 text-electric" /> Rental agreement v{current.version} <Pill tone={current.status === "SIGNED" ? "success" : current.status === "SENT" ? "brand" : "neutral"}>{labelize(current.status)}</Pill></h2>
                <a href={`/api/contracts/${current.id}/pdf`} target="_blank" className={buttonVariants({ variant: "outline" })}><Download /> {current.status === "SIGNED" ? "Download signed PDF" : "Preview PDF"}</a>
              </div>
              {b.status === "CONTRACT_DRAFT" && <p className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-900">Review the agreement below. It was filled automatically from this booking, your business profile and your store policies. Sign & send when it looks right.</p>}
              <ContractDocument title={current.title} version={current.version} reference={b.reference} sections={current.sections as ContractSection[]}
                signatures={current.contract_signatures as ContractSignature[]} contentHash={current.content_hash}
                providerName={vars.provider_name ?? business.name} renterName={vars.renter_name ?? b.renter?.full_name ?? ""} providerLogo={business.logo_path} />
              {history}
            </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-6">
          {(b.status === "SIGNED" || b.status === "CONFIRMED") && <BeforePickupCard booking={b} />}
          <section className="rounded-3xl border bg-white p-5">
            <h2 className="mb-3 font-semibold text-navy-900">Renter</h2>
            <p className="font-semibold">{renter?.legal_name || b.renter?.full_name}</p>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
              {b.renter?.phone && <a href={`tel:${b.renter.phone}`} className="flex items-center gap-2 hover:text-navy-900"><Phone className="size-4" />{b.renter.phone}</a>}
              <span>{b.renter?.email}</span>
              {renter?.address && <span>{renter.address}</span>}
              {renter?.license_number && <span>License {renter.license_number}{renter.license_expiry ? ` · exp. ${formatDate(renter.license_expiry)}` : ""}</span>}
              <span>ID verification: {labelize(renter?.kyc_status ?? "UNVERIFIED")}</span>
            </div>
            {docs && docs.length > 0 && (
              <div className="mt-3 grid gap-2">{docs.map((d) => <DocumentLink key={d.storage_path} bucket="kyc" path={d.storage_path} name={labelize(d.doc_type)} />)}</div>
            )}
            {b.conversation_id && <Link href={`/dashboard/messages/${b.conversation_id}`} className={buttonVariants({ variant: "outline", className: "mt-4 w-full" })}><MessageSquare /> Message renter</Link>}
            <div className="mt-3 text-center"><ReportButton entityType="BOOKING" entityId={b.id} signedIn side="business" /></div>
          </section>
          <section className="rounded-3xl border bg-white p-5">
            <h2 className="mb-4 font-semibold text-navy-900">History</h2>
            <StatusHistory rows={b.booking_status_history} />
          </section>
        </aside>
      </div>
    </>
  );
}

function Item({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : undefined}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium whitespace-pre-line text-navy-900">{v}</dd></div>;
}
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? "border-t border-black/10 pt-1.5 font-bold text-navy-900" : ""}`}><dt>{k}</dt><dd>{v}</dd></div>;
}
function nextStepCopy(s: keyof typeof STATUS_META) {
  return ({
    PENDING_OWNER_APPROVAL: "New request — review the renter and dates, then approve to generate the rental agreement automatically.",
    BOOKING_REQUESTED: "Waiting for the customer to accept your proposal.",
    CONTRACT_DRAFT: "Review the auto-generated agreement, then sign & send it to the renter.",
    CONTRACT_SENT: "Sent — waiting for the renter to open and sign.",
    AWAITING_SIGNATURE: "The renter opened the agreement and needs to sign it.",
    CONFIRMED: "Confirmed. Mark it picked up when the renter drives off.",
    ACTIVE: "On rent. Mark it returned when the car is back.",
    RETURNED: "Returned. Settle payments and deposit, then complete the rental.",
  } as Partial<Record<string, string>>)[s] ?? STATUS_META[s].renterHint;
}
