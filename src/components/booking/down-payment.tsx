"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { recordPayment, rejectDownPayment, reportDownPayment, waiveDownPayment } from "@/app/actions/bookings";
import { NoteDialog } from "@/components/booking/booking-actions";
import { PayToDetails, type PayTo } from "@/components/booking/pay-to";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatPHP, labelize } from "@/lib/format";
import type { Enums } from "@/types/database";

// While an approved booking still owes its down payment (supabase/migrations/20261006000038_down_payment.sql):
// the renter pays the business directly and taps "I've paid"; the business records it (or waives it), which prepares the agreement,
// or answers "Not received", which cancels it and flags it to 13C (20261006000040_trust_and_safety.sql).

type Due = { bookingId: string; amount: number; percent: number; dueAt: string; reportedAt: string | null; reference: string | null };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, done?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(r.message); done?.(); router.refresh(); } else toast.error(r.error);
  });
  return { pending, run };
}

/** Renter: what to send, by when and to whom, then "I've paid" with the reference. */
export function DownPaymentBox({ due, total, businessName, method, payTo, bookedAt }: {
  due: Due;
  total: number;
  businessName: string;
  method: Enums<"payment_method_type">;
  payTo: PayTo | null;
  bookedAt: string;
}) {
  const { pending, run } = useRun();
  const [reference, setReference] = useState(due.reference ?? "");
  return (
    <section className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-amber-950"><HandCoins className="size-5" /> Send a {formatPHP(due.amount)} down payment to hold the car</h2>
      <p className="mt-1 text-sm text-amber-950/80">
        {businessName} asks for {due.percent}% of the {formatPHP(total)} total by <strong>{formatDateTime(due.dueAt)}</strong>.
        If you haven&apos;t paid and tapped &ldquo;I&apos;ve paid&rdquo; by then, the booking is cancelled. After they confirm it, you&apos;ll get the rental agreement to sign.
      </p>
      <div className="mt-4 rounded-2xl bg-white p-4 text-sm">
        <PayToDetails payTo={payTo} method={method} businessName={businessName} bookedAt={bookedAt} />
      </div>
      {due.reportedAt && (
        <p className="mt-3 text-sm font-medium text-amber-950">
          You told them you paid on {formatDateTime(due.reportedAt)}{due.reference ? ` (reference ${due.reference})` : ""}. They&apos;ll check and confirm it,
          and the booking isn&apos;t cancelled while they do.
        </p>
      )}
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); run(() => reportDownPayment(due.bookingId, reference)); }}>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Reference no. from your receipt (optional)"
          aria-label="Payment reference number" className="bg-white" />
        <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />} {due.reportedAt ? "Send again" : "I've paid"}</Button>
      </form>
      <p className="mt-3 text-xs text-amber-950/70">Pay only to the account shown here, never one sent in chat. 13C never asks you to pay 13C for a rental.</p>
    </section>
  );
}

/** Business: waiting for the down payment; record it when it's in (the agreement is prepared then), or waive it. */
export function DownPaymentPanel({ due, paid, method, canWaive }: { due: Due; paid: number; method: Enums<"payment_method_type">; canWaive: boolean }) {
  const { pending, run } = useRun();
  const owed = Math.max(0, due.amount - paid);
  return (
    <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
      <p className="font-semibold">Waiting for the {formatPHP(due.amount)} down payment ({due.percent}%){paid > 0 ? `, ${formatPHP(owed)} still owed` : ""}</p>
      <p className="mt-0.5 text-amber-950/80">
        Due by {formatDateTime(due.dueAt)}. If the renter hasn&apos;t paid by then, the booking is cancelled and the dates open again.
      </p>
      {due.reportedAt && (
        <p className="mt-2 font-medium">
          The renter says they sent it on {formatDateTime(due.reportedAt)}{due.reference ? ` · reference ${due.reference}` : ""}. Check your {labelize(method)},
          then mark it received, or tap Not received if it never arrived. Until you answer, the booking is held (up to pickup).
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => run(() => recordPayment(due.bookingId, { amount: owed, method, reference: due.reference ?? undefined, note: "Down payment" }))}>
          {pending && <Loader2 className="animate-spin" />} Mark {formatPHP(owed)} received
        </Button>
        {canWaive && (
          <Button variant="outline" disabled={pending}
            onClick={() => confirm("Skip the down payment for this booking? The rental agreement is prepared right away.") && run(() => waiveDownPayment(due.bookingId))}>
            Waive
          </Button>
        )}
        {canWaive && due.reportedAt && (
          <NoteDialog size="default" destructive pending={pending} confirm="Not received" title="The down payment never arrived?"
            description="This cancels the booking and frees the dates. The renter is told, and 13C follows up with you both in case it was sent somewhere else."
            onConfirm={(note) => run(() => rejectDownPayment(due.bookingId, note))} />
        )}
      </div>
    </div>
  );
}
