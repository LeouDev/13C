"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Bell, CircleCheck, FileCheck2, RotateCcw, Store, UserRound } from "lucide-react";
import { cn } from "cn";
import { useConfirm } from "@/components/booking/booking-actions";
import { ContractDocument } from "@/components/contract/contract-document";
import { SignStep } from "@/components/site/sample-contract-demo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContractSection, ContractSignature } from "@/lib/contracts/pdf";
import { formatPHP } from "@/lib/format";

const STEPS = ["Request", "Approve", "Down payment", "Agreement", "Confirmed"];
const RENTER = "Juan Dela Cruz";

export type PracticeTrip = {
  car: string; carHref: string; pickup: string; dropoff: string; place: string;
  lines: [string, number][]; total: number; deposit: number; method: string;
  down: { percent: number; amount: number; dueBy: string; askedByStore: boolean };
};

/**
 * The demo store's practice booking, start to finish, playing both sides: the renter and the rental business. It all
 * happens in the browser; nothing is sent or saved.
 */
export function PracticeBooking({ store, trip, contract }: {
  store: { name: string; storeHref: string };
  trip: PracticeTrip;
  contract: { title: string; sections: ContractSection[]; contentHash: string };
}) {
  const [step, setStep] = useState(0);
  const [reported, setReported] = useState(false);
  const [reference, setReference] = useState("GC-0012345");
  const [signatures, setSignatures] = useState<ContractSignature[]>([]);
  const { ask, dialog } = useConfirm();
  const top = useRef<HTMLOListElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, reported]);
  const restart = () => { setStep(0); setReported(false); setSignatures([]); };
  const signed = signatures.length === 2;

  return (
    <div className="bg-[#f6f7f9]">
      {dialog}
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:py-12">
        <Link href={trip.carHref} className="text-sm text-muted-foreground hover:text-navy-900">← Back to the {trip.car}</Link>
        <header>
          <p className="eyebrow text-electric">Practice booking</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Try a booking, start to finish</h1>
          <p className="mt-2 text-muted-foreground">You play both sides: the renter who books, and you, the rental business. Nothing is sent or saved.</p>
        </header>

        <ol ref={top} className="grid scroll-mt-24 grid-cols-5 gap-1.5" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined}
              className={cn("flex items-center justify-center rounded-2xl px-1 py-2.5 text-center text-[11px] leading-tight font-semibold sm:text-sm",
                i < step ? "bg-emerald-50 text-emerald-700" : i === step ? "bg-electric text-white" : "bg-white text-muted-foreground")}>
              {i < step && <BadgeCheck className="mr-1 hidden size-4 shrink-0 sm:block" />}{label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Card who="renter" title="Request your booking" lead="This is what your renter sees after choosing dates on your store.">
            <Summary trip={trip} />
            <dl className="grid gap-2 rounded-2xl bg-canvas p-4 text-sm">
              <Row k="Renter" v={RENTER} />
              <Row k="Driver's license and ID" v={<span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CircleCheck className="size-4" /> Uploaded</span>} />
              <Row k="Payment" v={trip.method} />
            </dl>
            <p className="text-xs text-muted-foreground">Renters upload their license and ID once, to their account. You see them before you approve.</p>
            <Button size="xl" style={{ background: "var(--store-accent)" }} className="text-white hover:brightness-110" onClick={() => setStep(1)}>Send booking request</Button>
          </Card>
        )}

        {step === 1 && (
          <Card who="business" title="A new booking request" lead="You get this by email and in your 13C dashboard.">
            <p className="flex items-center gap-2 rounded-2xl bg-electric/10 px-4 py-3 text-sm font-medium text-navy-900"><Bell className="size-4 shrink-0 text-electric" /> New request from {RENTER}</p>
            <Summary trip={trip} />
            <p className="text-sm text-muted-foreground">Approving holds the car for these dates and declines any other requests that overlap. You could also decline with a reason, or propose other dates in the chat.</p>
            <Button size="xl" variant="electric" onClick={() => setStep(2)}>Approve request</Button>
          </Card>
        )}

        {step === 2 && !reported && (
          <Card who="renter" title={`Send the ${formatPHP(trip.down.amount)} down payment`}
            lead={trip.down.askedByStore ? `This store asks for ${trip.down.percent}% to hold the car.` : `Down payments are optional: you choose whether to ask for one, and how much, in Settings. This example uses ${trip.down.percent}%.`}>
            <div className="grid gap-1 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
              <p className="font-semibold">Pay by {trip.down.dueBy}, or the booking is cancelled and the dates open again.</p>
              <p>{trip.method} · {store.name} · 0917 000 0000 <span className="text-amber-950/60">(sample)</span></p>
              <p className="text-xs text-amber-950/70">Pay only to the account shown here, never one sent in chat. 13C never asks you to pay 13C for a rental.</p>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">Payment reference
              <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={40} />
            </label>
            <Button size="xl" style={{ background: "var(--store-accent)" }} className="text-white hover:brightness-110" onClick={() => setReported(true)}>I&apos;ve paid</Button>
          </Card>
        )}

        {step === 2 && reported && (
          <Card who="business" title="Check your account, then confirm" lead={`The renter says they sent ${formatPHP(trip.down.amount)}${reference.trim() ? ` · reference ${reference.trim()}` : ""}.`}>
            <p className="text-sm text-muted-foreground">Until you answer, the car stays held. If the money never arrived, tap &ldquo;Not received&rdquo; instead: the booking is cancelled and 13C follows up.</p>
            <Button size="xl" variant="electric" onClick={() => ask({
              title: `Mark ${formatPHP(trip.down.amount)} as received?`, confirm: "Yes, I received it",
              description: "Only confirm once you've checked that the money actually arrived. The renter is told it was received and the rental agreement is prepared, so this can't be taken back.",
              onConfirm: () => setStep(3),
            })}>Mark {formatPHP(trip.down.amount)} received</Button>
          </Card>
        )}

        {step === 3 && (
          <>
            <Card who={signatures.length === 0 ? "business" : "renter"} title="The rental agreement"
              lead="13C wrote it from this booking and your store's policies. You sign and send it, then the renter signs on their phone." />
            <ContractDocument title={contract.title} version={1} reference="13C-PRACTICE" sections={contract.sections} signatures={signatures}
              contentHash={contract.contentHash} providerName={store.name} renterName={RENTER} collapsible />
            {!signed && (
              <SignStep key={signatures.length} role={signatures.length === 0 ? "PROVIDER" : "RENTER"} contentHash={contract.contentHash}
                previous={signatures[0]} onSign={(sig) => {
                  setSignatures((s) => [...s, sig]);
                  if (sig.signer_role === "RENTER") setStep(4);
                }} />
            )}
          </>
        )}

        {step === 4 && (
          <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-navy-900"><FileCheck2 className="size-6 text-emerald-600" /> Booking confirmed</h2>
            <p className="mt-1 text-sm text-muted-foreground">{trip.car} · {trip.pickup} → {trip.dropoff}</p>
            <p className="mt-4 text-sm font-medium text-navy-900">In a real booking, from here:</p>
            <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-navy-800">
              <li>You and the renter both get the signed agreement (PDF) by email.</li>
              <li>13C reminds you both before pickup and before the return.</li>
              <li>In your dashboard you mark it picked up, then returned, and record the rest of the payment.</li>
              <li>The renter is asked to leave a review on your store.</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/register/business" className={buttonVariants({ variant: "electric", size: "lg" })}>Create Your Rental Business <ArrowRight /></Link>
              <Button variant="outline" size="lg" onClick={restart}><RotateCcw /> Try again</Button>
              <Link href={store.storeHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>Back to the store</Link>
            </div>
          </section>
        )}
        <p className="text-center text-xs text-muted-foreground">Practice only: no booking is made, nothing is sent or saved.</p>
      </div>
    </div>
  );
}

function Card({ who, title, lead, children }: { who: "renter" | "business"; title: string; lead: string; children?: React.ReactNode }) {
  const Icon = who === "renter" ? UserRound : Store;
  return (
    <section className="grid gap-4 rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
      <div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", who === "renter" ? "bg-canvas text-navy-800" : "bg-electric/10 text-electric")}>
          <Icon className="size-3.5" /> {who === "renter" ? "The renter's view" : "Your view (the business)"}
        </span>
        <h2 className="mt-2 font-display text-xl font-bold text-navy-900">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Summary({ trip }: { trip: PracticeTrip }) {
  return (
    <dl className="grid gap-2 rounded-2xl bg-canvas p-4 text-sm">
      <Row k="Car" v={trip.car} />
      <Row k="Pickup" v={`${trip.pickup} · ${trip.place}`} />
      <Row k="Return" v={trip.dropoff} />
      {trip.lines.map(([k, v]) => <Row key={k} k={k} v={formatPHP(v)} />)}
      <Row k="Total" v={<span className="font-bold text-navy-900">{formatPHP(trip.total)}</span>} />
      {trip.deposit > 0 && <Row k="Refundable deposit (paid to the business)" v={formatPHP(trip.deposit)} />}
    </dl>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>;
}
