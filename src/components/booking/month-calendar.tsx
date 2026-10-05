"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { coverDays, KIND_STYLE } from "@/lib/calendar";
import { formatDate, todayManila } from "@/lib/format";

export type CalRange = { start: string; end: string; kind: string };


const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Month grid in Manila dates. A day a range takes completely is filled in; a day it takes only part of keeps a thin bar,
 * since the free hours can still be booked. Tapping a marked day says which hours are taken.
 */
export function MonthCalendar({ ranges, months = 1, legend = true, className }: { ranges: CalRange[]; months?: 1 | 2; legend?: boolean; className?: string }) {
  const today = todayManila();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const covers = useMemo(() => coverDays(ranges), [ranges]);
  const describe = (day: string) => {
    const c = covers.get(day)!;
    return `${KIND_STYLE[c.kind]?.label ?? "Taken"} ${c.hours}${c.partial ? ". The rest of the day is free." : "."}`;
  };
  const shown = picked && covers.get(picked);

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
                  const c = covers.get(key);
                  const style = c && KIND_STYLE[c.kind];
                  const cell = cn("relative grid aspect-square place-items-center rounded-lg text-sm", style && !c.partial ? style.cell : "bg-white text-navy-900",
                    key < today && "opacity-35", key === today && "ring-2 ring-electric ring-inset", picked === key && "outline-2 outline-offset-1 outline-navy-900");
                  if (!c) return <span key={key} className={cell}>{k + 1}</span>;
                  return (
                    <button key={key} type="button" title={describe(key)} aria-label={`${formatDate(`${key}T12:00:00+08:00`, { month: "long", day: "numeric" })}: ${describe(key)}`}
                      onClick={() => setPicked(picked === key ? null : key)} className={cell}>
                      {k + 1}
                      {c.partial && <span className={cn("absolute inset-x-1.5 bottom-1 h-1 rounded-full", style?.dot ?? "bg-slate-400")} />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {shown && (
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-sm text-navy-900" aria-live="polite">
          <span className="font-semibold">{formatDate(`${picked}T12:00:00+08:00`, { weekday: "short", month: "short", day: "numeric" })}:</span> {describe(picked)}
        </p>
      )}
      {legend && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border bg-white" /> Available</span>
          {[...covers.values()].some((c) => c.partial) && (
            <span className="flex items-center gap-1.5"><span className="relative size-2.5 overflow-hidden rounded-sm border bg-white"><span className="absolute inset-x-0 bottom-0 h-[3px] bg-slate-400" /></span> Partly available</span>
          )}
          {[...new Set(ranges.map((r) => KIND_STYLE[r.kind]?.label))].filter(Boolean).map((label) => {
            const style = Object.values(KIND_STYLE).find((s) => s.label === label)!;
            return <span key={label} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-sm", style.dot)} /> {label}</span>;
          })}
        </div>
      )}
    </div>
  );
}
