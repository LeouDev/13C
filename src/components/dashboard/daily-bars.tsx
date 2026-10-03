"use client";

import { useState } from "react";
import { formatDate, formatPHP } from "@/lib/format";

/** Single-series bar chart by day (YYYY-MM-DD) or month (YYYY-MM): thin bars, 4px rounded tops, 2px gaps, hover tooltip. */
export function DailyBars({ title, data, unit, period = "day", money = false }: {
  title: string; data: { day: string; value: number }[]; unit: string; period?: "day" | "month"; money?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const label = (d: string) => (period === "month" ? formatDate(`${d}-01`, { month: "short", year: "numeric" }) : formatDate(d, { month: "short", day: "numeric" }));
  const value = (n: number) => (money ? formatPHP(n) : `${n} ${unit}`);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const h = hover != null ? data[hover] : null;
  return (
    <figure className="rounded-3xl border bg-white p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-navy-900">{title}</span>
        <span className="text-xs text-muted-foreground">{h ? `${label(h.day)}: ${value(h.value)}` : `${money ? formatPHP(total) : total} total`}</span>
      </figcaption>
      <div className="mt-4 flex h-36 items-end gap-[2px] border-b border-border" role="img" aria-label={`${title}: ${money ? formatPHP(total) : `${total} ${unit}`} over ${data.length} ${period}s`}>
        {data.map((d, i) => (
          <div key={d.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${label(d.day)}: ${value(d.value)}`}>
            <div className="w-full rounded-t-[4px] transition-colors" style={{ height: `${Math.max((d.value / max) * 100, d.value ? 3 : 0)}%`, background: hover === i ? "var(--navy-900)" : "var(--electric)" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0] && label(data[0].day)}</span>
        <span>{data.at(-1) && label(data.at(-1)!.day)}</span>
      </div>
    </figure>
  );
}
