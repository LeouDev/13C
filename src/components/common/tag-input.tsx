"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function TagInput({ value, onChange, placeholder, suggestions = [], id }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: readonly string[]; id?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const v = t.trim();
    if (v.length >= 2 && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !value.includes(s));
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-navy-900 py-1 pr-1.5 pl-3 text-xs font-medium text-white">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Remove ${t}`}><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <Input id={id} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); } }}
        onBlur={() => draft && add(draft)} />
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-electric hover:text-electric">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
