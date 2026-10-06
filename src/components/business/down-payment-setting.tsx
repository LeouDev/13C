"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDownPayment } from "@/app/actions/business";

const PERCENTS = [0, 10, 15, 20, 25, 30, 40, 50, 100];
const HOURS = [1, 2, 3, 6, 12, 24, 48, 72];
const hoursLabel = (h: number) => `${h} hour${h === 1 ? "" : "s"}`;
const select = "h-10 rounded-xl border border-input bg-white px-3 text-sm";

/** Down payment asked after approval (% of the total, and how long renters get): saved as soon as it's changed. */
export function DownPaymentSetting({ businessId, initial, canEdit }: { businessId: string; initial: { percent: number; hours: number }; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  if (!canEdit) return <p className="mt-3 text-sm font-medium text-navy-900">{v.percent ? `${v.percent}% of the total, within ${hoursLabel(v.hours)} of approval` : "No down payment"}</p>;

  const save = (next: typeof v) => {
    const before = v;
    setV(next);
    start(async () => {
      const r = await saveDownPayment(businessId, next.percent, next.hours);
      if (r.ok) toast.success(r.message); else { setV(before); toast.error(r.error); }
    });
  };
  // A value set some other way stays selectable.
  const options = (list: number[], value: number) => [...new Set([...list, value])].sort((a, b) => a - b);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-navy-900">
      <label className="flex items-center gap-2">
        Down payment
        <select value={v.percent} disabled={pending} className={select} onChange={(e) => save({ ...v, percent: Number(e.target.value) })}>
          {options(PERCENTS, initial.percent).map((p) => <option key={p} value={p}>{p ? `${p}% of the total` : "None"}</option>)}
        </select>
      </label>
      {v.percent > 0 && (
        <label className="flex items-center gap-2">
          due within
          <select value={v.hours} disabled={pending} className={select} onChange={(e) => save({ ...v, hours: Number(e.target.value) })}>
            {options(HOURS, initial.hours).map((h) => <option key={h} value={h}>{hoursLabel(h)}</option>)}
          </select>
          of approval
        </label>
      )}
    </div>
  );
}
