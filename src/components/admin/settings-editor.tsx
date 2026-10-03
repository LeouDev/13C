"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveSetting } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/types/database";

export type PlatformSetting = { key: string; value: Json; updatedAt: string; updatedLabel: string };

function jsonError(text: string) {
  try { JSON.parse(text); return null; } catch (e) { return e instanceof Error ? e.message : "Invalid JSON"; }
}

function SettingRow({ setting }: { setting: PlatformSetting }) {
  const router = useRouter();
  const initial = JSON.stringify(setting.value, null, 2);
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  const error = jsonError(text);
  const id = `setting-${setting.key}`;
  return (
    <form
      className="grid gap-2 rounded-xl border bg-white p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSetting(setting.key, text);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-mono text-sm font-semibold text-navy-900">{setting.key}</label>
        <span className="text-xs text-muted-foreground">Updated {setting.updatedLabel}</span>
      </div>
      <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined} className="min-h-12 font-mono text-[13px]" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? <p id={`${id}-error`} className="text-xs font-medium text-destructive" role="alert">Invalid JSON: {error}</p> : <span className="text-xs text-muted-foreground">Valid JSON</span>}
        <div className="flex gap-2">
          {text !== initial && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setText(initial)}>Reset</Button>}
          <Button type="submit" size="sm" variant="electric" disabled={pending || !!error || text === initial}>{pending && <Loader2 className="animate-spin" />} Save</Button>
        </div>
      </div>
    </form>
  );
}

export function SettingsEditor({ settings }: { settings: PlatformSetting[] }) {
  return <div className="grid gap-3">{settings.map((s) => <SettingRow key={`${s.key}:${s.updatedAt}`} setting={s} />)}</div>;
}
