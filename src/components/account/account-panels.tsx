"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Eye, Heart, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { requestAccountDeletion, saveDriverDocument, toggleFavorite, viewMyDocument } from "@/app/actions/account";
import { confirmTwoStep, startTwoStep, turnOffTwoStep, updatePassword } from "@/app/actions/auth";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DOC_TYPES, uploadIdDocument, validateFile } from "@/lib/upload";
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
      const path = await uploadIdDocument(userId, file);
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

export function PasswordForm({ autoFocus }: { autoFocus?: boolean }) {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <Input name="password" type="password" minLength={8} required placeholder="New password (8+ characters)" autoComplete="new-password" aria-label="New password" autoFocus={autoFocus} />
      <Button type="submit" variant="outline" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Update password</Button>
      {state && <p className={cn("text-sm sm:self-center", state.ok ? "text-emerald-700" : "text-destructive")}>{state.ok ? state.message : state.error}</p>}
    </form>
  );
}

/** Two-step sign-in: a code from an authenticator app at every sign-in. Setup shows a QR code, confirmed with the first code. */
export function TwoStepPanel({ on }: { on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(r.message); setSetup(null); setCode(""); router.refresh(); } else toast.error(r.error);
  });
  if (on) return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex gap-2 text-sm text-emerald-800"><ShieldCheck className="size-5 shrink-0" /> On. Each sign-in asks for a code from your authenticator app.</p>
      <Button variant="outline" disabled={pending} onClick={() => confirm("Turn off two-step sign-in? Your password alone will be enough to sign in.") && run(turnOffTwoStep)}>
        {pending && <Loader2 className="animate-spin" />} Turn off
      </Button>
    </div>
  );
  if (!setup) return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Each sign-in also asks for a 6-digit code from an app on your phone (Google Authenticator, Microsoft Authenticator or similar), so a stolen password
        isn&apos;t enough to get in. Recommended for business owners: it guards your payment details.
      </p>
      <Button variant="outline" className="justify-self-start" disabled={pending} onClick={() => start(async () => {
        const r = await startTwoStep();
        if (r.ok && r.data) setSetup(r.data); else if (!r.ok) toast.error(r.error);
      })}>{pending && <Loader2 className="animate-spin" />} Turn on two-step sign-in</Button>
    </div>
  );
  return (
    <form className="grid gap-4 sm:grid-cols-[auto_1fr]" onSubmit={(e) => { e.preventDefault(); run(() => confirmTwoStep(setup.factorId, code)); }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL from Supabase Auth */}
      <img src={setup.qr} alt="QR code to add 13C to your authenticator app" width={176} height={176} className="size-44 rounded-xl border bg-white p-2" />
      <div className="grid content-start gap-3 text-sm">
        <p><span className="font-semibold text-navy-900">1.</span> In your authenticator app, add an account and scan this code.</p>
        <p className="text-muted-foreground">Can&apos;t scan? Enter this key instead: <span className="font-mono break-all text-navy-900 select-all">{setup.secret}</span></p>
        <p><span className="font-semibold text-navy-900">2.</span> Enter the 6-digit code the app shows for 13C.</p>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123 456" aria-label="6-digit code" className="max-w-40 font-mono tracking-widest" />
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Turn on</Button>
        </div>
        <p className="text-xs text-muted-foreground">Your other devices will be signed out. If you lose your phone, email support@13c.online from your account&apos;s email.</p>
      </div>
    </form>
  );
}

/** The page a password-reset link opens: one field, then on to `done` (the dashboard or the account page). */
export function NewPasswordForm({ done }: { done: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePassword, null);
  useEffect(() => {
    if (state?.ok) { toast.success(state.message); router.replace(done); }
  }, [state, done, router]);
  const error = state && !state.ok ? Object.values(state.fieldErrors ?? {})[0] ?? state.error : undefined;
  return (
    <form action={action} className="grid gap-4">
      <Field label="New password" htmlFor="new-password" error={error} hint="At least 8 characters, with letters and numbers.">
        <Input id="new-password" name="password" type="password" minLength={8} maxLength={72} required autoComplete="new-password" autoFocus className="h-11 sm:h-10" />
      </Field>
      <Button type="submit" size="xl" disabled={pending || state?.ok}>{pending && <Loader2 className="animate-spin" />} Save new password</Button>
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

