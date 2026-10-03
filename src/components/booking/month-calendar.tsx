"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { KIND_STYLE } from "@/lib/calendar";
import { isoToManilaDate, todayManila } from "@/lib/format";

export type CalRange = { start: string; end: string; kind: string };


const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Month grid in Manila dates. A day is covered by a range if the range overlaps any part of it. */
export function MonthCalendar({ ranges, months = 1, legend = true, className }: { ranges: CalRange[]; months?: 1 | 2; legend?: boolean; className?: string }) {
  const today = todayManila();
  const [offset, setOffset] = useState(0);
  const dayKinds = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of ranges) {
      // walk each Manila day the range touches ([start, end))
      let t = new Date(r.start).getTime();
      const end = new Date(r.end).getTime();
      const last = isoToManilaDate(new Date(end - 1));
      for (let guard = 0; guard < 400; guard++) {
        const day = isoToManilaDate(new Date(t));
        if (!map.has(day) || r.kind === "SELECTED") map.set(day, r.kind);
        if (day >= last) break;
        t += 86400000;
      }
    }
    return map;
  }, [ranges]);

  const startY = Number(today.slice(0, 4));
  const startM = Number(today.slice(5, 7)) - 1;

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} className="grid size-9 place-items-center rounded-full hover:bg-canvas disabled:opacity-30" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
        <button type="button" onClick={() => setOffset((o) => Math.min(23, o + 1))} className="grid size-9 place-items-center rounded-full hover:bg-canvas" aria-label="Next month"><ChevronRight className="size-4" /></button>
      </div>
      <div className={cn("grid gap-6", months === 2 && "md:grid-cols-2")}>
        {Array.from({ length: months }, (_, i) => {
          const d = new Date(Date.UTC(startY, startM + offset + i, 1));
          const y = d.getUTCFullYear(), m = d.getUTCMonth();
          const firstDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7; // Monday-first
          const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
          return (
            <div key={`${y}-${m}`}>
              <p className="mb-2 text-center text-sm font-semibold text-navy-900">{d.toLocaleString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }, (_, k) => <span key={`b${k}`} />)}
                {Array.from({ length: days }, (_, k) => {
                  const key = ymd(y, m, k + 1);
                  const kind = dayKinds.get(key);
                  const past = key < today;
                  return (
                    <span key={key} title={kind ? KIND_STYLE[kind]?.label : undefined}
                      className={cn("grid aspect-square place-items-center rounded-lg text-sm", kind ? KIND_STYLE[kind]?.cell : "bg-white text-navy-900", past && "opacity-35", key === today && "ring-2 ring-electric ring-inset")}>
                      {k + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {legend && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border bg-white" /> Available</span>
          {[...new Set(ranges.map((r) => KIND_STYLE[r.kind]?.label))].filter(Boolean).map((label) => {
            const style = Object.values(KIND_STYLE).find((s) => s.label === label)!;
            return <span key={label} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-sm", style.dot)} /> {label}</span>;
          })}
        </div>
      )}
    </div>
  );
}
