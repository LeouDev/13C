"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveContractTemplate } from "@/app/actions/admin";
import { CONTRACT_PLACEHOLDERS, unknownPlaceholders } from "@/components/admin/contract-placeholders";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type TemplateSection = { key: string; title: string; body: string };

const token = (key: string) => `{{${key}}}`;

function nextKey(items: TemplateSection[]) {
  let n = items.length + 1;
  while (items.some((s) => s.key === `section_${n}`)) n++;
  return `section_${n}`;
}

function validate(name: string, items: TemplateSection[]) {
  if (name.trim().length < 2) return "Give the template a name.";
  if (!items.length) return "Add at least one section.";
  if (items.length > 40) return "A template can have at most 40 sections.";
  const bad = items.findIndex((s) => s.title.trim().length < 2 || s.body.trim().length < 5);
  if (bad >= 0) return `Section ${bad + 1} needs a title and a body.`;
  return null;
}

export function TemplateEditor({ name, version, sections }: { name: string; version: number | null; sections: TemplateSection[] }) {
  const router = useRouter();
  const [templateName, setTemplateName] = useState(name);
  const [items, setItems] = useState(sections);
  const [pending, start] = useTransition();
  /** The body textarea placeholders are inserted into. */
  const lastBody = useRef<{ index: number; el: HTMLTextAreaElement } | null>(null);
  const dirty = templateName.trim() !== name || JSON.stringify(items) !== JSON.stringify(sections);

  const update = (i: number, patch: Partial<TemplateSection>) => setItems((xs) => xs.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    lastBody.current = null;
    setItems((xs) => { const ys = [...xs]; const [s] = ys.splice(i, 1); ys.splice(i + d, 0, s!); return ys; });
  };
  const remove = (i: number) => {
    if (!confirm(`Remove section ${i + 1}${items[i]?.title ? ` (“${items[i].title}”)` : ""}?`)) return;
    lastBody.current = null;
    setItems((xs) => xs.filter((_, j) => j !== i));
  };

  const insert = (key: string) => {
    const t = token(key);
    const target = lastBody.current;
    if (!target) {
      navigator.clipboard?.writeText(t).then(() => toast.success(`Copied ${t}`), () => toast.error("Couldn't copy. Click into a section body first."));
      return;
    }
    const { index, el } = target;
    const from = el.selectionStart ?? el.value.length;
    const to = el.selectionEnd ?? from;
    update(index, { body: el.value.slice(0, from) + t + el.value.slice(to) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(from + t.length, from + t.length); });
  };

  const publish = () => {
    const error = validate(templateName, items);
    if (error) { toast.error(error); return; }
    if (!confirm(`Publish “${templateName.trim()}” as a new active version?\n\nIt will be used for every contract generated from now on. Existing drafts and signed contracts are not changed.`)) return;
    start(async () => {
      const r = await saveContractTemplate(templateName.trim(), items.map((s) => ({ key: s.key, title: s.title.trim(), body: s.body.trim() })));
      if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="grid content-start gap-4">
        <Field label="Template name" htmlFor="template-name" hint={version ? `Active version: v${version}. Publishing creates v${version + 1} (or v1 under a new name).` : "No active template yet."}>
          <Input id="template-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} maxLength={120} />
        </Field>
        <ol className="grid gap-3">
          {items.map((s, i) => {
            const unknown = unknownPlaceholders(s.body);
            return (
              <li key={s.key} className="rounded-xl border bg-white p-3 sm:p-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <Input value={s.title} onChange={(e) => update(i, { title: e.target.value })} aria-label={`Section ${i + 1} title`}
                    placeholder="Section title" maxLength={120} className="h-9 font-semibold" />
                  <Button type="button" size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move section ${i + 1} up`}><ArrowUp /></Button>
                  <Button type="button" size="icon-sm" variant="ghost" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move section ${i + 1} down`}><ArrowDown /></Button>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={() => remove(i)} aria-label={`Remove section ${i + 1}`}><Trash2 /></Button>
                </div>
                <Textarea value={s.body} onChange={(e) => update(i, { body: e.target.value })} onFocus={(e) => { lastBody.current = { index: i, el: e.currentTarget }; }}
                  aria-label={`Section ${i + 1} body`} placeholder="Clause text. Use placeholders like {{renter_name}}." maxLength={8000} className="mt-2 min-h-32 leading-relaxed" />
                {unknown.length > 0 && (
                  <p className="mt-1.5 text-xs text-amber-800" role="alert">These won&apos;t be filled in and will print as “—” or literally: {unknown.join(", ")}</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">Key: <code>{s.key}</code></p>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setItems((xs) => [...xs, { key: nextKey(xs), title: "", body: "" }])}><Plus /> Add section</Button>
          <span className="flex-1" />
          {dirty && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setItems(sections); setTemplateName(name); lastBody.current = null; }}>Discard changes</Button>}
          <Button type="button" variant="electric" size="lg" disabled={pending || !dirty} onClick={publish}>
            {pending && <Loader2 className="animate-spin" />} Publish new version
          </Button>
        </div>
      </div>
      <aside className="h-fit rounded-xl bg-canvas p-4 lg:sticky lg:top-6" aria-labelledby="placeholders-heading">
        <h3 id="placeholders-heading" className="text-sm font-semibold">Placeholders</h3>
        <p className="mt-1 text-xs text-muted-foreground">Click to insert at the cursor in the last section body you edited (or copy it).</p>
        <div className="mt-3 grid gap-3">
          {CONTRACT_PLACEHOLDERS.map((g) => (
            <div key={g.group}>
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.group}</p>
              <div className="flex flex-wrap gap-1">
                {g.keys.map((k) => (
                  <button key={k} type="button" onClick={() => insert(k)} className="rounded-md border bg-white px-1.5 py-0.5 font-mono text-[11px] hover:border-electric hover:text-electric">
                    {k}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
