import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, FileSignature, MapPin, MessageSquare, Phone, Wallet } from "lucide-react";
import { AcceptProposal, PaymentsPanel, ReviewForm, TransitionActions } from "@/components/booking/booking-actions";
import { BookingProgress, StatusHistory } from "@/components/booking/booking-timeline";
import { BookingStatusBadge, Stars } from "@/components/common/badges";
import { BusinessLogo, VehicleImage } from "@/components/common/vehicle-image";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { STATUS_META } from "@/lib/bookings/status";
import { formatDateTime, formatPHP, labelize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Booking" };

export default async function RenterBookingPage({ params, searchParams }: PageProps<"/account/bookings/[id]">) {
  const { id } = await params;
  const { requested } = (await searchParams) as { requested?: string };
  const user = await requireUser(`/account/bookings/${id}`);
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings")
    .select("*, vehicles(make, model, year, slug, vehicle_images(storage_path, position)), businesses(id, name, slug, phone, email, address, city, logo_path), booking_status_history(to_status, note, created_at), payments(id, amount, method, reference, paid_at), contracts(id, status, current_version, contract_versions(id, version, status, signed_at)), reviews(id, rating, comment)")
    .eq("id", id).eq("renter_id", user.id).order("created_at", { referencedTable: "booking_status_history" }).maybeSingle();
  if (!b) notFound();
  const { data: methods } = await supabase.from("payment_methods").select("method, account_name, account_number, instructions").eq("business_id", b.business_id).eq("is_enabled", true);
  const payInfo = methods?.find((m) => m.method === b.payment_method);
  const img = [...(b.vehicles?.vehicle_images ?? [])].sort((x, y) => x.position - y.position)[0];
  const versions = b.contracts?.contract_versions ?? [];
  const current = versions.find((v) => v.version === b.contracts?.current_version);
  const signedVersions = versions.filter((v) => v.status === "SIGNED").sort((x, y) => y.version - x.version);
  const toSign = current?.status === "SENT";

  return (
    <div className="grid gap-6">
      {requested && <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="size-5" /> Request sent to {b.businesses?.name}. You&apos;ll be notified when they respond.</p>}

      <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
        <div className="grid gap-4 p-5 sm:grid-cols-[180px_1fr] sm:p-6">
          <VehicleImage path={img?.storage_path} alt="" className="aspect-[4/3] rounded-2xl" sizes="180px" />
          <div>
            <div className="flex flex-wrap items-center gap-2"><BookingStatusBadge status={b.status} /><span className="font-mono text-xs text-muted-foreground">{b.reference}</span></div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy-900">{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</h1>
            <p className="text-sm text-muted-foreground">from <Link href={`/${b.businesses?.slug}`} className="font-semibold text-navy-900 hover:underline">{b.businesses?.name}</Link></p>
            <p className="mt-3 text-sm text-navy-800">{STATUS_META[b.status].renterHint}</p>
          </div>
        </div>
        <div className="border-t px-5 py-4 sm:px-6"><BookingProgress status={b.status} /></div>
      </section>

      {toSign && current && (
        <Link href={`/account/bookings/${b.id}/contract`} className="flex items-center gap-4 rounded-3xl bg-electric p-5 text-white shadow-lg shadow-electric/30 transition hover:brightness-110">
          <FileSignature className="size-8 shrink-0" />
          <span className="flex-1"><span className="block font-bold">Your rental agreement is ready</span><span className="text-sm text-white/80">Review and sign it to confirm your booking.</span></span>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-electric">Review & sign</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          {b.status === "BOOKING_REQUESTED" && methods && <AcceptProposal bookingId={b.id} methods={methods.map((m) => m.method)} />}

          <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
            <h2 className="mb-4 font-semibold text-navy-900">Trip</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Pickup</dt><dd className="font-medium">{formatDateTime(b.pickup_at)}</dd><dd className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" />{b.pickup_location}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Return</dt><dd className="font-medium">{formatDateTime(b.return_at)}</dd><dd className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" />{b.return_location}</dd></div>
            </dl>
            <dl className="mt-4 grid gap-1.5 rounded-2xl bg-canvas p-4 text-sm">
              <div className="flex justify-between"><dt>{b.rental_days} day(s)</dt><dd>{formatPHP(b.base_amount)}</dd></div>
              {Number(b.driver_fee) > 0 && <div className="flex justify-between"><dt>Driver</dt><dd>{formatPHP(b.driver_fee)}</dd></div>}
              {Number(b.delivery_fee) > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatPHP(b.delivery_fee)}</dd></div>}
              {Number(b.other_fees) > 0 && <div className="flex justify-between"><dt>Other fees</dt><dd>{formatPHP(b.other_fees)}</dd></div>}
              {Number(b.discount) > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {formatPHP(b.discount)}</dd></div>}
              <div className="flex justify-between border-t border-black/10 pt-1.5 font-bold"><dt>Total</dt><dd>{formatPHP(b.total_amount)}</dd></div>
              <div className="flex justify-between text-muted-foreground"><dt>Refundable deposit</dt><dd>{formatPHP(b.security_deposit)}</dd></div>
            </dl>
          </section>

          <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy-900"><Wallet className="size-5 text-electric" /> Payment · {labelize(b.payment_method)}</h2>
            {payInfo && (payInfo.account_number || payInfo.instructions) && !["CANCELLED", "REJECTED", "EXPIRED"].includes(b.status) && (
              <div className="mb-4 rounded-2xl bg-canvas p-4 text-sm">
                <p className="font-semibold">Pay {b.businesses?.name} directly</p>
                {payInfo.account_name && <p>Account name: {payInfo.account_name}</p>}
                {payInfo.account_number && <p>Number: <span className="font-mono">{payInfo.account_number}</span></p>}
                {payInfo.instructions && <p className="mt-1 text-muted-foreground">{payInfo.instructions}</p>}
                <p className="mt-2 text-xs text-muted-foreground">Only pay after your booking is confirmed. 13C never asks you to pay 13C for a rental.</p>
              </div>
            )}
            <PaymentsPanel bookingId={b.id} total={Number(b.total_amount)} status={b.payment_status} method={b.payment_method} payments={b.payments} canEdit={false} />
          </section>

          {signedVersions.length > 0 && (
            <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
              <h2 className="mb-3 font-semibold text-navy-900">Signed rental agreement</h2>
              <div className="flex flex-wrap gap-2">
                {signedVersions.map((v) => (
                  <a key={v.id} href={`/api/contracts/${v.id}/pdf`} target="_blank" className={buttonVariants({ variant: v.id === signedVersions[0]!.id ? "default" : "outline" })}><Download /> Version {v.version} (PDF)</a>
                ))}
                <Link href={`/account/bookings/${b.id}/contract`} className={buttonVariants({ variant: "ghost" })}>View online</Link>
              </div>
            </section>
          )}

          {b.status === "COMPLETED" && (
            <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
              <h2 className="mb-3 font-semibold text-navy-900">{b.reviews ? "Your review" : "Review your rental"}</h2>
              {b.reviews ? <div><Stars value={b.reviews.rating} /><p className="mt-2 text-sm">{b.reviews.comment}</p></div> : <ReviewForm bookingId={b.id} />}
            </section>
          )}

          <TransitionActions bookingId={b.id} status={b.status} actor="RENTER" />
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <BusinessLogo path={b.businesses?.logo_path} name={b.businesses?.name ?? ""} className="size-11" />
              <div><p className="font-semibold">{b.businesses?.name}</p><p className="text-xs text-muted-foreground">Rental Provider</p></div>
            </div>
            <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
              {b.businesses?.phone && <a href={`tel:${b.businesses.phone}`} className="flex items-center gap-2 hover:text-navy-900"><Phone className="size-4" />{b.businesses.phone}</a>}
              {b.businesses?.address && <span>{b.businesses.address}, {b.businesses.city}</span>}
            </div>
            {b.conversation_id && <Link href={`/account/messages/${b.conversation_id}`} className={buttonVariants({ variant: "outline", className: "mt-4 w-full" })}><MessageSquare /> Message business</Link>}
          </section>
          <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
            <h2 className="mb-4 font-semibold text-navy-900">History</h2>
            <StatusHistory rows={b.booking_status_history} />
          </section>
        </aside>
      </div>
    </div>
  );
}
