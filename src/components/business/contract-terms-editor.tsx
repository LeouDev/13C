"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveContractTerms } from "@/app/actions/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Term = { title: string; body: string };

/** The business's own clauses (Business plan), added to every new agreement as its last section. */
export function ContractTermsEditor({ businessId, initial, canEdit }: { businessId: string; initial: Term[]; canEdit: boolean }) {
  const [terms, setTerms] = useState<Term[]>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Term>) => setTerms((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="mt-4 grid gap-3">
      {terms.length === 0 && <p className="rounded-2xl bg-canvas p-3 text-sm text-muted-foreground">No additional terms yet. Agreements use the standard terms and your store policies.</p>}
      {terms.map((t, i) => (
        <div key={i} className="grid gap-2 rounded-2xl border p-3">
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">({String.fromCharCode(97 + i)})</span>
            <Input value={t.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Title, e.g. Travel outside Cebu" maxLength={80}
              disabled={!canEdit} aria-label={`Term ${i + 1} title`} aria-invalid={!!errors[`${i}.title`]} />
            {canEdit && (
              <Button type="button" variant="ghost" size="icon-lg" aria-label={`Remove term ${i + 1}`} onClick={() => setTerms((ts) => ts.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            )}
          </div>
          <Textarea value={t.body} onChange={(e) => set(i, { body: e.target.value })} rows={3} maxLength={2000} disabled={!canEdit}
            placeholder="e.g. Taking the vehicle off Cebu island needs the Rental Provider's written approval."
            aria-label={`Term ${i + 1}`} aria-invalid={!!errors[`${i}.body`]} />
          {(errors[`${i}.title`] || errors[`${i}.body`]) && <p className="text-xs text-destructive">{errors[`${i}.title`] ?? errors[`${i}.body`]}</p>}
        </div>
      ))}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {terms.length < 10 && (
            <Button type="button" variant="outline" onClick={() => setTerms((ts) => [...ts, { title: "", body: "" }])}><Plus /> Add term</Button>
          )}
          <Button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await saveContractTerms(businessId, terms);
            if (r.ok) { setErrors({}); toast.success(r.message); } else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
          })}>
            {pending && <Loader2 className="animate-spin" />} Save terms
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only owners and managers can change these.</p>
      )}
    </div>
  );
}
