"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";

/** Single-series daily bar chart: thin bars, 4px rounded tops, 2px gaps, hover tooltip. */
export function DailyBars({ title, data, unit }: { title: string; data: { day: string; value: number }[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const h = hover != null ? data[hover] : null;
  return (
    <figure className="rounded-3xl border bg-white p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-navy-900">{title}</span>
        <span className="text-xs text-muted-foreground">{h ? `${formatDate(h.day, { month: "short", day: "numeric" })}: ${h.value} ${unit}` : `${total} total`}</span>
      </figcaption>
      <div className="mt-4 flex h-36 items-end gap-[2px] border-b border-border" role="img" aria-label={`${title}: ${total} ${unit} over ${data.length} days`}>
        {data.map((d, i) => (
          <div key={d.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${formatDate(d.day)}: ${d.value} ${unit}`}>
            <div className="w-full rounded-t-[4px] transition-colors" style={{ height: `${Math.max((d.value / max) * 100, d.value ? 3 : 0)}%`, background: hover === i ? "var(--navy-900)" : "var(--electric)" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0] && formatDate(data[0].day, { month: "short", day: "numeric" })}</span>
        <span>{data.at(-1) && formatDate(data.at(-1)!.day, { month: "short", day: "numeric" })}</span>
      </div>
    </figure>
  );
}
