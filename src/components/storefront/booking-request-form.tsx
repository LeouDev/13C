"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { requestBooking } from "@/app/actions/bookings";
import { RenterFields, useRenterForm } from "@/components/account/renter-form";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { formatPHP, labelize, manilaToISO, todayManila } from "@/lib/format";
import type { RenterInput } from "@/lib/validation";
import type { Enums } from "@/types/database";

type Quote = { rental_days: number; base_amount: number; driver_fee: number; delivery_fee: number; total_amount: number; security_deposit: number };

export function BookingRequestForm({
  vehicle, businessName, methods, pickupDefault, renter, profileComplete, docsReady, documents, initial, downPayment,
}: {
  vehicle: { id: string; name: string; self_drive: boolean; with_driver: boolean; delivery_available: boolean };
  businessName: string;
  methods: Enums<"payment_method_type">[];
  pickupDefault: string;
  renter: RenterInput;
  profileComplete: boolean;
  /** License (front/back) and government ID uploaded — required before requesting */
  docsReady: boolean;
  documents: React.ReactNode;
  initial: { from?: string; to?: string; ft?: string; tt?: string; driver?: boolean; delivery?: boolean };
  /** The business's down payment, asked after approval (percent 0 = none) */
  downPayment: { percent: number; hours: number };
}) {
  const router = useRouter();
  const renterForm = useRenterForm(renter);
  const [editRenter, setEditRenter] = useState(!profileComplete);
  const [f, setF] = useState({
    from: initial.from ?? todayManila(1), fromTime: initial.ft ?? "10:00", to: initial.to ?? todayManila(2), toTime: initial.tt ?? "10:00",
    pickupLocation: pickupDefault, returnLocation: pickupDefault, paymentMethod: methods[0] ?? ("CASH" as Enums<"payment_method_type">),
    withDriver: !!initial.driver || (!vehicle.self_drive && vehicle.with_driver), delivery: !!initial.delivery, driversCount: 1, notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data, error } = await createClient().rpc("quote_booking", {
        p_vehicle_id: vehicle.id, p_pickup_at: manilaToISO(f.from, f.fromTime), p_return_at: manilaToISO(f.to, f.toTime),
        p_with_driver: f.withDriver, p_delivery: f.delivery,
      });
      setQuote(error ? null : (data as unknown as Quote));
      setQuoteError(error ? friendlyError(error) : null);
    }, 250);
    return () => clearTimeout(t);
  }, [vehicle.id, f.from, f.fromTime, f.to, f.toTime, f.withDriver, f.delivery]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      if (editRenter && !(await renterForm.save(true))) return;
      const r = await requestBooking({ vehicleId: vehicle.id, ...f });
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      toast.success(r.message);
      router.push(`/account/bookings/${r.data!.id}?requested=1`);
    });
  }

  const card = "rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6";
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]" noValidate>
      <div className="grid content-start gap-5">
        <section className={card}>
          <h2 className="font-bold text-navy-900">Trip details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Pickup date" htmlFor="from" error={errors.from}><Input id="from" type="date" min={todayManila()} value={f.from} onChange={(e) => set("from", e.target.value)} /></Field>
              <Field label="Time" htmlFor="ft"><Input id="ft" type="time" value={f.fromTime} onChange={(e) => set("fromTime", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Return date" htmlFor="to" error={errors.to}><Input id="to" type="date" min={f.from} value={f.to} onChange={(e) => set("to", e.target.value)} /></Field>
              <Field label="Time" htmlFor="tt"><Input id="tt" type="time" value={f.toTime} onChange={(e) => set("toTime", e.target.value)} /></Field>
            </div>
            <Field label="Pickup location" htmlFor="pl" error={errors.pickupLocation}><Input id="pl" value={f.pickupLocation} onChange={(e) => set("pickupLocation", e.target.value)} /></Field>
            <Field label="Return location" htmlFor="rl" error={errors.returnLocation}><Input id="rl" value={f.returnLocation} onChange={(e) => set("returnLocation", e.target.value)} /></Field>
            {vehicle.with_driver && vehicle.self_drive && <label className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 text-sm">With a driver <Switch checked={f.withDriver} onCheckedChange={(c) => set("withDriver", c)} /></label>}
            {vehicle.delivery_available && <label className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 text-sm">Deliver to my pickup location <Switch checked={f.delivery} onCheckedChange={(c) => set("delivery", c)} /></label>}
            {!f.withDriver && (
              <Field label="Number of drivers" htmlFor="dc"><Input id="dc" type="number" min={1} max={5} value={f.driversCount} onChange={(e) => set("driversCount", Number(e.target.value))} /></Field>
            )}
            <Field label="Notes for the business" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" maxLength={2000} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Flight number, child seat, special requests…" /></Field>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-navy-900">Your details</h2>
            {profileComplete && <button type="button" className="text-sm font-semibold text-[var(--store-accent)]" onClick={() => setEditRenter((x) => !x)}>{editRenter ? "Done" : "Edit"}</button>}
          </div>
          {editRenter ? <div className="mt-4"><RenterFields form={renterForm} /></div> : (
            <p className="mt-2 text-sm text-muted-foreground">{renter.full_name} · {renter.phone} · License {renter.license_number}<br />{renter.address}</p>
          )}
          <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-emerald-600" /> Shared only with {businessName} to prepare your rental agreement.</p>
        </section>

        <section className={card}>
          <h2 className="font-bold text-navy-900">Driver&apos;s license & ID</h2>
          {docsReady ? (
            <p className="mt-2 flex gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-emerald-600" /> Uploaded. {businessName} can view them while reviewing your request.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Upload your driver&apos;s license (front and back) and a government-issued ID. Only {businessName} can view them, to review your request. Never public.</p>
              <div className="mt-4">{documents}</div>
            </>
          )}
        </section>

        <section className={card}>
          <h2 className="font-bold text-navy-900">How will you pay?</h2>
          <p className="mt-1 text-sm text-muted-foreground">You pay {businessName} directly. 13C never handles your money — choosing a method doesn&apos;t charge you.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Payment method">
            {methods.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={f.paymentMethod === m} onClick={() => set("paymentMethod", m)}
                className={cn("rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition", f.paymentMethod === m ? "border-[var(--store-accent)] bg-[var(--store-accent)]/5" : "border-transparent bg-canvas")}>
                {labelize(m)}
              </button>
            ))}
          </div>
          {errors.paymentMethod && <p className="mt-2 text-xs text-destructive">{errors.paymentMethod}</p>}
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className={card}>
          <p className="text-sm text-muted-foreground">Booking</p>
          <p className="font-bold text-navy-900">{vehicle.name}</p>
          <p className="text-sm text-muted-foreground">from {businessName}</p>
          <div className="mt-4 rounded-2xl bg-canvas p-3 text-sm" aria-live="polite">
            {quote ? (
              <dl className="grid gap-1.5">
                <div className="flex justify-between"><dt>{quote.rental_days} day{quote.rental_days > 1 ? "s" : ""}</dt><dd>{formatPHP(quote.base_amount)}</dd></div>
                {quote.driver_fee > 0 && <div className="flex justify-between"><dt>Driver</dt><dd>{formatPHP(quote.driver_fee)}</dd></div>}
                {quote.delivery_fee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatPHP(quote.delivery_fee)}</dd></div>}
                <div className="flex justify-between border-t border-black/10 pt-1.5 text-base font-bold"><dt>Total</dt><dd>{formatPHP(quote.total_amount)}</dd></div>
                {quote.security_deposit > 0 && <div className="flex justify-between text-xs text-muted-foreground"><dt>+ refundable deposit</dt><dd>{formatPHP(quote.security_deposit)}</dd></div>}
                {downPayment.percent > 0 && (
                  <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <dt>Down payment after approval ({downPayment.percent}%, within {downPayment.hours}h)</dt><dd>{formatPHP(Math.round(quote.total_amount * downPayment.percent / 100))}</dd>
                  </div>
                )}
              </dl>
            ) : <p className="text-destructive">{quoteError ?? "Calculating…"}</p>}
          </div>
          {!docsReady && <p className="mt-3 text-center text-xs text-muted-foreground">Upload your license and ID to send your request.</p>}
          <button type="submit" disabled={pending || !quote || !docsReady}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--store-accent)" }}>
            {pending && <Loader2 className="size-4 animate-spin" />} Request Booking
          </button>
          <ol className="mt-4 grid gap-1.5 text-xs text-muted-foreground">
            <li>1. {businessName} reviews your request</li>
            {downPayment.percent > 0 ? <>
              <li>2. You send the {downPayment.percent}% down payment to hold the car</li>
              <li>3. You review & e-sign the rental agreement</li>
              <li>4. Booking confirmed — pay the rest as agreed and pick up</li>
            </> : <>
              <li>2. You review & e-sign the rental agreement</li>
              <li>3. Booking confirmed — pay as agreed and pick up</li>
            </>}
          </ol>
        </div>
      </aside>
    </form>
  );
}
