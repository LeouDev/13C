"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { acceptProposal, deletePayment, recordPayment, setPaymentStatus, transitionBooking, updateBookingTerms } from "@/app/actions/bookings";
import { regenerateContract } from "@/app/actions/contracts";
import { createReview, respondToReview } from "@/app/actions/reviews";
import { Field, NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { nextStatuses, type Actor, type BookingStatus } from "@/lib/bookings/status";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { formatPHP, isoToManilaDate, isoToManilaTime, labelize } from "@/lib/format";
import type { ActionResult } from "@/lib/actions";
import type { Enums } from "@/types/database";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(r.message ?? "Done"); after?.(); router.refresh(); } else toast.error(r.error);
  });
  return { pending, run };
}

const LABELS: Partial<Record<BookingStatus, string>> = {
  APPROVED: "Approve request", REJECTED: "Decline", CANCELLED: "Cancel booking", ACTIVE: "Mark as picked up",
  RETURNED: "Mark as returned", COMPLETED: "Complete rental",
};

export function NoteDialog({ title, description, confirm, required, destructive, onConfirm, pending, size = "lg" }: {
  title: string; description: string; confirm: string; required?: boolean; destructive?: boolean; pending: boolean; onConfirm: (note: string) => void;
  size?: "default" | "lg";
}) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={size} variant={destructive ? "destructive" : "outline"} />}>{confirm}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={required ? "Reason (required)" : "Reason (optional)"} maxLength={500} aria-label="Reason" />
        <Button size="lg" variant={destructive ? "destructive" : "default"} disabled={pending || (required && note.trim().length < 3)} onClick={() => { onConfirm(note); setOpen(false); }}>
          {pending && <Loader2 className="animate-spin" />} {confirm}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Buttons for every transition the state machine allows this actor (SYSTEM steps are triggered elsewhere). */
/** `pickupFrom`: set (e.g. "Oct 31, 2026") while it's before the pickup day, which disables "picked up". */
/** `approveWaiting`: why Approve can't be used yet (the renter's license and ID aren't uploaded). */
export function TransitionActions({ bookingId, status, actor, pickupFrom, approveWaiting }: {
  bookingId: string; status: BookingStatus; actor: Exclude<Actor, "SYSTEM">; pickupFrom?: string | null; approveWaiting?: string | null;
}) {
  const { pending, run } = useRun();
  const next = nextStatuses(status, actor).filter((s) => !(actor === "RENTER" && s === "APPROVED"));
  if (next.length === 0) return null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {next.map((to) => {
          if (to === "REJECTED") return <NoteDialog key={to} title="Decline this request?" description="The renter will be notified with your reason." confirm="Decline" required destructive pending={pending} onConfirm={(n) => run(() => transitionBooking(bookingId, to, n))} />;
          if (to === "CANCELLED") return <NoteDialog key={to} title="Cancel this booking?" description="The other party is notified. Your cancellation policy applies to any payments." confirm="Cancel booking" destructive pending={pending} onConfirm={(n) => run(() => transitionBooking(bookingId, to, n))} />;
          if ((to === "ACTIVE" && pickupFrom) || (to === "APPROVED" && approveWaiting)) {
            return (
              <div key={to} className="grid gap-1">
                <Button size="lg" variant={to === "APPROVED" ? "electric" : "default"} disabled>{LABELS[to] ?? labelize(to)}</Button>
                <span className="text-xs text-muted-foreground">{to === "APPROVED" ? approveWaiting : `Available from ${pickupFrom}`}</span>
              </div>
            );
          }
          return (
            <Button key={to} size="lg" variant={to === "APPROVED" ? "electric" : "default"} disabled={pending} onClick={() => run(() => transitionBooking(bookingId, to))}>
              {pending && <Loader2 className="animate-spin" />} {LABELS[to] ?? labelize(to)}
            </Button>
          );
        })}
      </div>
      {actor === "BUSINESS" && next.includes("APPROVED") && (
        <p className="text-xs text-muted-foreground">Approving declines any other requests for this car on overlapping dates.</p>
      )}
    </div>
  );
}

export function RegenerateButton({ bookingId, signed }: { bookingId: string; signed: boolean }) {
  const { pending, run } = useRun();
  return (
    <Button variant="outline" size="lg" disabled={pending} onClick={() => {
      if (!signed || confirm("This creates a new version (v+1) that the renter must sign again. The signed version stays on record. Continue?")) run(() => regenerateContract(bookingId));
    }}>
      {pending && <Loader2 className="animate-spin" />} {signed ? "Amend (new version)" : "Regenerate from booking"}
    </Button>
  );
}

export function AcceptProposal({ bookingId, methods }: { bookingId: string; methods: Enums<"payment_method_type">[] }) {
  const { pending, run } = useRun();
  const [method, setMethod] = useState(methods[0]);
  return (
    <div className="grid gap-3 rounded-2xl bg-electric/5 p-4">
      <p className="text-sm font-semibold text-navy-900">Accept this proposal</p>
      <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as typeof method)} aria-label="Payment method">
        {methods.map((m) => <option key={m} value={m}>Pay with {labelize(m)}</option>)}
      </NativeSelect>
      <Button size="lg" variant="electric" disabled={pending || !method} onClick={() => run(() => acceptProposal(bookingId, method!))}>
        {pending && <Loader2 className="animate-spin" />} Accept proposal
      </Button>
    </div>
  );
}

export function TermsEditor({ booking }: { booking: { id: string; pickup_at: string; return_at: string; pickup_location: string; return_location: string; other_fees: number; discount: number; security_deposit: number } }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    from: isoToManilaDate(booking.pickup_at), fromTime: isoToManilaTime(booking.pickup_at), to: isoToManilaDate(booking.return_at), toTime: isoToManilaTime(booking.return_at),
    pickupLocation: booking.pickup_location, returnLocation: booking.return_location,
    otherFees: String(booking.other_fees), discount: String(booking.discount), securityDeposit: String(booking.security_deposit),
  });
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>Edit terms</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit booking terms</DialogTitle><DialogDescription>Prices are re-quoted. If an agreement exists, a new version is generated for signing.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pickup date"><Input type="date" {...bind("from")} /></Field>
          <Field label="Time"><Input type="time" {...bind("fromTime")} /></Field>
          <Field label="Return date"><Input type="date" {...bind("to")} /></Field>
          <Field label="Time"><Input type="time" {...bind("toTime")} /></Field>
          <Field label="Pickup location" className="col-span-2"><Input {...bind("pickupLocation")} /></Field>
          <Field label="Return location" className="col-span-2"><Input {...bind("returnLocation")} /></Field>
          <Field label="Other fees (₱)"><Input type="number" min={0} {...bind("otherFees")} /></Field>
          <Field label="Discount (₱)"><Input type="number" min={0} {...bind("discount")} /></Field>
          <Field label="Security deposit (₱)"><Input type="number" min={0} {...bind("securityDeposit")} /></Field>
        </div>
        <Button size="lg" disabled={pending} onClick={() => run(() => updateBookingTerms(booking.id, f), () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />} Save terms</Button>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentsPanel({ bookingId, total, status, method, payments, canEdit }: {
  bookingId: string; total: number; status: Enums<"payment_status">; method: Enums<"payment_method_type">;
  payments: { id: string; amount: number; method: Enums<"payment_method_type">; reference: string | null; paid_at: string }[]; canEdit: boolean;
}) {
  const { pending, run } = useRun();
  const [f, setF] = useState({ amount: "", method: method as string, reference: "" });
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Paid {formatPHP(paid)} of {formatPHP(total)} · via {labelize(method)}</p>
          <p className="text-xs text-muted-foreground">13C doesn&apos;t process payments.{canEdit ? " Record what the renter paid you." : " The business records what you've paid."}</p>
        </div>
        {canEdit ? (
          <NativeSelect className="w-48" value={status} disabled={pending} aria-label="Payment status" onChange={(e) => run(() => setPaymentStatus(bookingId, e.target.value as Enums<"payment_status">))}>
            {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </NativeSelect>
        ) : <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold">{labelize(status)}</span>}
      </div>
      {payments.length > 0 && (
        <ul className="divide-y rounded-2xl border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>{formatPHP(p.amount, true)} · {labelize(p.method)}{p.reference ? ` · ${p.reference}` : ""}</span>
              {canEdit && <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => run(() => deletePayment(p.id))}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); run(() => recordPayment(bookingId, { amount: f.amount, method: f.method as never, reference: f.reference }), () => setF({ ...f, amount: "", reference: "" })); }}>
          <Input type="number" min={1} step="0.01" placeholder="Amount ₱" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} aria-label="Amount" />
          <NativeSelect value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} aria-label="Method">{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</NativeSelect>
          <Input placeholder="Reference no." value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} aria-label="Reference" />
          <Button type="submit" disabled={pending || !f.amount}>Record</Button>
        </form>
      )}
    </div>
  );
}

function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <span className="flex" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)} className="p-0.5">
            <Star className={cn("size-6", n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
          </button>
        ))}
      </span>
    </div>
  );
}

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const { pending, run } = useRun();
  const [r, setR] = useState({ rating: 5, vehicle: 5, business: 5, comment: "" });
  return (
    <div className="grid gap-3">
      <StarInput label="Overall experience" value={r.rating} onChange={(n) => setR({ ...r, rating: n })} />
      <StarInput label="Vehicle" value={r.vehicle} onChange={(n) => setR({ ...r, vehicle: n })} />
      <StarInput label="Rental business" value={r.business} onChange={(n) => setR({ ...r, business: n })} />
      <Textarea placeholder="Tell other renters about your trip (optional)" maxLength={2000} value={r.comment} onChange={(e) => setR({ ...r, comment: e.target.value })} />
      <Button size="lg" disabled={pending} onClick={() => run(() => createReview(bookingId, r))}>{pending && <Loader2 className="animate-spin" />} Post review</Button>
    </div>
  );
}

export function ReviewResponse({ reviewId, initial }: { reviewId: string; initial: string | null }) {
  const { pending, run } = useRun();
  const [text, setText] = useState(initial ?? "");
  return (
    <div className="grid gap-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a public response" maxLength={2000} aria-label="Response" />
      <Button size="sm" variant="outline" className="justify-self-start" disabled={pending || !text.trim()} onClick={() => run(() => respondToReview(reviewId, text))}>{initial ? "Update response" : "Respond"}</Button>
    </div>
  );
}
