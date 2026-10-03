"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { Eye, Heart, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { requestAccountDeletion, saveDriverDocument, toggleFavorite, viewMyDocument } from "@/app/actions/account";
import { updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DOC_TYPES, uploadDocument, validateFile } from "@/lib/upload";
import type { Enums } from "@/types/database";

type DocType = Enums<"driver_document_type">;
const SLOTS: { type: DocType; label: string }[] = [
  { type: "DRIVERS_LICENSE_FRONT", label: "Driver's license — front" },
  { type: "DRIVERS_LICENSE_BACK", label: "Driver's license — back" },
  { type: "GOVERNMENT_ID", label: "Government-issued ID" },
];

export function DriverDocuments({ userId, docs }: { userId: string; docs: { doc_type: DocType; storage_path: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<DocType | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(type: DocType, file?: File) {
    if (!file) return;
    const problem = validateFile(file, DOC_TYPES, 10);
    if (problem) return toast.error(problem);
    setBusy(type);
    try {
      const path = await uploadDocument("kyc", userId, file);
      const r = await saveDriverDocument({ doc_type: type, storage_path: path });
      if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SLOTS.map((s) => {
        const doc = docs.find((d) => d.doc_type === s.type);
        return (
          <div key={s.type} className={cn("rounded-2xl border p-4", doc ? "border-emerald-200 bg-emerald-50/50" : "border-dashed")}>
            <p className="text-sm font-semibold text-navy-900">{s.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{doc ? "Uploaded" : "Not uploaded"}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" disabled={busy === s.type} onClick={() => inputs.current[s.type]?.click()}>
                {busy === s.type ? <Loader2 className="animate-spin" /> : <Upload />} {doc ? "Replace" : "Upload"}
              </Button>
              {doc && (
                <Button size="sm" variant="ghost" onClick={async () => {
                  const r = await viewMyDocument(doc.storage_path);
                  if (r.ok && r.data) window.open(r.data, "_blank", "noopener"); else if (!r.ok) toast.error(r.error);
                }}><Eye /> View</Button>
              )}
            </div>
            <input ref={(el) => { inputs.current[s.type] = el; }} type="file" accept=".pdf,image/*" className="sr-only" tabIndex={-1} onChange={(e) => upload(s.type, e.target.files?.[0])} />
          </div>
        );
      })}
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <Input name="password" type="password" minLength={8} required placeholder="New password (8+ characters)" autoComplete="new-password" aria-label="New password" />
      <Button type="submit" variant="outline" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Update password</Button>
      {state && <p className={cn("text-sm sm:self-center", state.ok ? "text-emerald-700" : "text-destructive")}>{state.ok ? state.message : state.error}</p>}
    </form>
  );
}

export function DeletionRequest({ requestedAt }: { requestedAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (requestedAt) return <p className="text-sm text-amber-800">Deletion requested on {new Date(requestedAt).toLocaleDateString("en-PH")}. We&apos;ll email you when it&apos;s complete.</p>;
  return (
    <Button variant="destructive" disabled={pending} onClick={() => {
      if (!confirm("Request deletion of your 13C account and personal data? Booking and signed contract records are kept as required by law, with your personal details removed.")) return;
      start(async () => { const r = await requestAccountDeletion(); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); });
    }}>
      {pending && <Loader2 className="animate-spin" />} Request account deletion
    </Button>
  );
}

export function FavoriteButton({ vehicleId, initial, signedIn, className }: { vehicleId: string; initial: boolean; signedIn: boolean; className?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-pressed={on} aria-label={on ? "Remove from saved cars" : "Save this car"} disabled={pending}
      className={cn("grid size-11 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition hover:scale-105", className)}
      onClick={() => {
        if (!signedIn) { router.push(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
        const next = !on;
        setOn(next);
        start(async () => { const r = await toggleFavorite(vehicleId, next); if (!r.ok) { setOn(!next); toast.error(r.error); } else toast.success(r.message); });
      }}>
      <Heart className={cn("size-5", on ? "fill-brand-red text-brand-red" : "text-navy-900")} />
    </button>
  );
}

