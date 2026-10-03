import { Check } from "lucide-react";
import { cn } from "cn";
import { STATUS_META, TIMELINE, timelineIndex, type BookingStatus } from "@/lib/bookings/status";
import { formatDateTime } from "@/lib/format";

/** Progress bar along the happy path + the full status history. */
export function BookingProgress({ status }: { status: BookingStatus }) {
  const idx = timelineIndex(status);
  const ended = ["CANCELLED", "REJECTED", "EXPIRED"].includes(status);
  const labels = ["Requested", "Approved", "Contract sent", "Signed", "Confirmed", "On rent", "Completed"];
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Booking progress">
      {TIMELINE.map((s, i) => (
        <li key={s} className="grid gap-1.5">
          <span className={cn("h-1.5 rounded-full", ended ? "bg-red-200" : i <= idx ? "bg-electric" : "bg-border")} />
          <span className={cn("hidden text-[11px] font-medium sm:block", i <= idx && !ended ? "text-navy-900" : "text-muted-foreground")}>{labels[i]}</span>
        </li>
      ))}
    </ol>
  );
}

export function StatusHistory({ rows }: { rows: { to_status: BookingStatus; note: string | null; created_at: string }[] }) {
  return (
    <ol className="relative grid gap-4 border-l border-border pl-5">
      {rows.map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute top-0.5 -left-[27px] grid size-3.5 place-items-center rounded-full bg-electric text-white"><Check className="size-2.5" /></span>
          <p className="text-sm font-semibold text-navy-900">{STATUS_META[h.to_status].label}</p>
          {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
          <p className="text-[11px] text-muted-foreground">{formatDateTime(h.created_at)}</p>
        </li>
      ))}
    </ol>
  );
}
