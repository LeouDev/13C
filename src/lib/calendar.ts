import { formatDate, formatDateTime, formatTime, isoToManilaDate, isoToManilaTime, manilaToISO } from "@/lib/format";

/** Calendar cell styles shared by server (fleet calendar) and client (month calendar) components. */
export const KIND_STYLE: Record<string, { cell: string; dot: string; label: string }> = {
  BOOKED: { cell: "bg-navy-900 text-white", dot: "bg-navy-900", label: "Booked" },
  CONFIRMED: { cell: "bg-navy-900 text-white", dot: "bg-navy-900", label: "Booked" },
  PENDING: { cell: "bg-amber-100 text-amber-900", dot: "bg-amber-400", label: "Pending request" },
  BLOCKED: { cell: "bg-slate-200 text-slate-500 line-through", dot: "bg-slate-400", label: "Blocked" },
  MAINTENANCE: { cell: "bg-orange-100 text-orange-800", dot: "bg-orange-400", label: "Maintenance" },
  SELECTED: { cell: "bg-electric text-white", dot: "bg-electric", label: "Your dates" },
};

const DAY = 86_400_000;
const dayStart = (day: string) => new Date(`${day}T00:00:00+08:00`).getTime(); // Manila has no daylight saving
// When ranges of several kinds touch one day, the day shows the first of these.
const PRIORITY = ["SELECTED", "BOOKED", "CONFIRMED", "PENDING", "MAINTENANCE", "BLOCKED"];
const rank = (kind: string) => (PRIORITY.includes(kind) ? PRIORITY.indexOf(kind) : PRIORITY.length);

export type DayCover = { kind: string; partial: boolean; hours: string };

/**
 * How ranges ([start, end) instants) cover each Manila day they touch, by "YYYY-MM-DD". A day is `partial` while some
 * of it is still free; `hours` says which part is taken: "from 2:00 PM", "until 10:00 AM", "1:00 PM–5:00 PM" or "all day".
 */
export function coverDays(ranges: { start: string; end: string; kind: string }[]) {
  const days = new Map<string, { kind: string; spans: [number, number][] }>();
  for (const r of ranges) {
    const start = new Date(r.start).getTime();
    const end = new Date(r.end).getTime();
    let day = isoToManilaDate(new Date(start));
    for (let guard = 0; guard < 400 && dayStart(day) < end; guard++) {
      const t0 = dayStart(day);
      const d = days.get(day) ?? { kind: r.kind, spans: [] };
      if (rank(r.kind) < rank(d.kind)) d.kind = r.kind;
      d.spans.push([Math.max(start, t0), Math.min(end, t0 + DAY)]);
      days.set(day, d);
      day = isoToManilaDate(new Date(t0 + DAY));
    }
  }
  const covers = new Map<string, DayCover>();
  for (const [day, { kind, spans }] of days) {
    const t0 = dayStart(day);
    const merged: [number, number][] = [];
    for (const [a, b] of spans.sort((x, y) => x[0] - y[0])) {
      const last = merged.at(-1);
      if (last && a <= last[1]) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    }
    const taken = merged.reduce((sum, [a, b]) => sum + b - a, 0);
    const at = (t: number) => formatTime(new Date(t));
    const hours = merged.map(([a, b]) => (a === t0 ? `until ${at(b)}` : b === t0 + DAY ? `from ${at(a)}` : `${at(a)}–${at(b)}`)).join(", ");
    // The renter's own dates always show as whole days.
    covers.set(day, taken < DAY && kind !== "SELECTED" ? { kind, partial: true, hours } : { kind, partial: false, hours: "all day" });
  }
  return covers;
}

/** A block's [start, end): whole Manila days (`to` included), or from `fromTime` on `from` to `toTime` on `to`. */
export function blockWindow({ from, to, fromTime, toTime }: { from: string; to: string; fromTime?: string; toTime?: string }) {
  const starts_at = manilaToISO(from, fromTime ?? "00:00");
  const ends_at = toTime ? manilaToISO(to, toTime) : new Date(dayStart(to) + DAY).toISOString();
  return { starts_at, ends_at };
}

/** "Oct 12, 2026", "Oct 12, 2026 – Oct 14, 2026", "Oct 12, 2026, 1:00 PM–5:00 PM" or "Oct 12, 2026, 6:00 PM – Oct 14, 2026, 8:00 AM". */
export function formatSpan(start: string, end: string) {
  const last = new Date(new Date(end).getTime() - 1);
  if (isoToManilaTime(start) === "00:00" && isoToManilaTime(end) === "00:00") {
    return isoToManilaDate(start) === isoToManilaDate(last) ? formatDate(start) : `${formatDate(start)} – ${formatDate(last)}`;
  }
  return isoToManilaDate(start) === isoToManilaDate(last) ? `${formatDate(start)}, ${formatTime(start)}–${formatTime(end)}` : `${formatDateTime(start)} – ${formatDateTime(end)}`;
}
