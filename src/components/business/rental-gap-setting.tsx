"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveRentalGap } from "@/app/actions/business";

const OPTIONS = [0, 1, 2, 3, 4, 6, 8, 12, 24];
const label = (h: number) => (h === 0 ? "No gap (back to back)" : `${h} hour${h === 1 ? "" : "s"}`);

/** Gap between rentals: saved as soon as it's changed. */
export function RentalGapSetting({ businessId, initial, canEdit }: { businessId: string; initial: number; canEdit: boolean }) {
  const [hours, setHours] = useState(initial);
  const [pending, start] = useTransition();
  if (!canEdit) return <p className="mt-3 text-sm font-medium text-navy-900">{label(initial)}</p>;
  return (
    <label className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-navy-900">
      Gap between rentals
      <select value={hours} disabled={pending} className="h-10 rounded-xl border border-input bg-white px-3 text-sm"
        onChange={(e) => {
          const next = Number(e.target.value), before = hours;
          setHours(next);
          start(async () => {
            const r = await saveRentalGap(businessId, next);
            if (r.ok) toast.success(r.message); else { setHours(before); toast.error(r.error); }
          });
        }}>
        {/* A value set some other way (up to 48 hours) stays selectable. */}
        {[...new Set([...OPTIONS, initial])].sort((a, b) => a - b).map((h) => <option key={h} value={h}>{label(h)}</option>)}
      </select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </label>
  );
}
