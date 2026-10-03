"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Wrench, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addBlock, removeBlock } from "@/app/actions/vehicles";
import { MonthCalendar, type CalRange } from "@/components/booking/month-calendar";
import { Field, NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, todayManila } from "@/lib/format";

type Block = { id: string; starts_at: string; ends_at: string; reason: "BLOCKED" | "MAINTENANCE"; note: string | null };

export function AvailabilityManager({ vehicleId, blocks, bookings }: { vehicleId: string; blocks: Block[]; bookings: CalRange[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ from: todayManila(1), to: todayManila(1), reason: "BLOCKED" as Block["reason"], note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const ranges: CalRange[] = [...bookings, ...blocks.map((b) => ({ start: b.starts_at, end: b.ends_at, kind: b.reason }))];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-3xl border bg-white p-5">
        <MonthCalendar ranges={ranges} months={2} />
        <p className="mt-4 text-xs text-muted-foreground">Dates are open by default. Confirmed bookings and blocks can never overlap — 13C checks this in the database, so double bookings are impossible.</p>
      </div>
      <div className="grid content-start gap-4">
        <form className="grid gap-3 rounded-3xl border bg-white p-5" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addBlock(vehicleId, form);
            if (r.ok) { toast.success(r.message); setErrors({}); router.refresh(); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
          });
        }}>
          <h3 className="font-semibold text-navy-900">Block dates</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="b-from" error={errors.from}><Input id="b-from" type="date" min={todayManila()} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: e.target.value > form.to ? e.target.value : form.to })} /></Field>
            <Field label="To" htmlFor="b-to" error={errors.to}><Input id="b-to" type="date" min={form.from} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
          </div>
          <Field label="Reason" htmlFor="b-reason">
            <NativeSelect id="b-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as Block["reason"] })}>
              <option value="BLOCKED">Unavailable / personal use</option>
              <option value="MAINTENANCE">Maintenance</option>
            </NativeSelect>
          </Field>
          <Field label="Note (private)" htmlFor="b-note"><Input id="b-note" value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="PMS at Toyota Cebu" /></Field>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Block dates</Button>
        </form>
        <div className="rounded-3xl border bg-white p-5">
          <h3 className="mb-3 font-semibold text-navy-900">Upcoming blocks</h3>
          {blocks.length === 0 ? <p className="text-sm text-muted-foreground">No blocked dates.</p> : (
            <ul className="grid gap-2">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
                  {b.reason === "MAINTENANCE" ? <Wrench className="size-4 text-orange-500" /> : <Ban className="size-4 text-slate-500" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{formatDate(b.starts_at)} – {formatDate(new Date(new Date(b.ends_at).getTime() - 1))}</span>
                    {b.note && <span className="block truncate text-xs text-muted-foreground">{b.note}</span>}
                  </span>
                  <button className="text-muted-foreground hover:text-destructive" aria-label="Reopen these dates" disabled={pending}
                    onClick={() => start(async () => { const r = await removeBlock(b.id); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
