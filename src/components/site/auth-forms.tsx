"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { signIn, signUp, requestPasswordReset } from "@/app/actions/auth";
import { Field, PhoneInput } from "@/components/common/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions";

function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <Alert variant="destructive" className="rounded-xl">
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const email = useRef<HTMLInputElement>(null);
  const [reset, setReset] = useState<string | null>(null); // open → prefilled email
  return (
    // The reset block has its own <form>, so it sits between two sections; the Sign in button joins the
    // sign-in form through its `form` attribute (it's still the form's default button for Enter).
    <div className="grid gap-4">
      <form id="sign-in-form" action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <FormError state={state} />
        <Field label="Email" htmlFor="email" error={fe?.email}>
          <Input ref={email} id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe?.email} className="h-11 sm:h-10" />
        </Field>
        <Field label="Password" htmlFor="password" error={fe?.password}
          labelAside={
            <button type="button" onClick={() => setReset(reset === null ? email.current?.value ?? "" : null)}
              aria-expanded={reset !== null} aria-controls={reset !== null ? "reset-password" : undefined}
              className="text-[13px] font-semibold text-electric hover:underline">
              <span className="hidden sm:inline">Forgot your password?</span><span className="sm:hidden">Forgot?</span>
            </button>
          }>
          <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 sm:h-10" />
        </Field>
      </form>
      {reset !== null && (
        <div id="reset-password" className="grid gap-3 rounded-xl bg-secondary p-4">
          <p className="text-[13px] leading-[18px] text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
          <ResetForm defaultEmail={reset} />
        </div>
      )}
      <Button type="submit" form="sign-in-form" size="xl" disabled={pending} className="mt-1 w-full">
        {pending && <Loader2 className="animate-spin" />} Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to 13C?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-electric hover:underline">Create an account</Link>
      </p>
    </div>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <MailCheck className="size-10 text-electric" />
        <h2 className="text-lg font-semibold">Confirm your email</h2>
        <p className="text-sm text-muted-foreground">We sent you a confirmation link. Open it on this device to finish signing up.</p>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <FormError state={state} />
      <Field label="Full name" htmlFor="full_name" error={fe?.full_name} required>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={fe?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Mobile number" htmlFor="phone" error={fe?.phone} hint="Rental businesses use this to coordinate pickup.">
        <PhoneInput id="phone" name="phone" />
      </Field>
      <Field label="Password" htmlFor="password" error={fe?.password} hint="At least 8 characters." required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
        <Checkbox name="terms" value="on" className="mt-0.5" aria-invalid={!!fe?.terms} />
        <span>
          I agree to the <Link href="/terms" className="font-medium text-electric hover:underline" target="_blank">Terms of Service</Link> and consent to the processing of my personal data under the{" "}
          <Link href="/privacy" className="font-medium text-electric hover:underline" target="_blank">Privacy Policy</Link>.
        </span>
      </label>
      {fe?.terms && <p className="-mt-2 text-xs font-medium text-destructive">{fe.terms}</p>}
      <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
        <Checkbox name="marketing" value="on" className="mt-0.5" />
        <span>Send me occasional offers from 13C (optional).</span>
      </label>
      <Button type="submit" size="xl" disabled={pending} className="mt-1 w-full">
        {pending && <Loader2 className="animate-spin" />} Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-electric hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

/** Inline password reset (opened from the sign-in form). Focuses its email field when it appears. */
export function ResetForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="grid gap-3">
      {state?.ok ? <p className="text-sm text-emerald-700">{state.message}</p> : <FormError state={state} />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="reset-email" name="email" type="email" autoComplete="email" required defaultValue={defaultEmail} aria-label="Email for the reset link"
          autoFocus className="h-11 flex-1 bg-white sm:h-10" />
        <Button type="submit" variant="outline" disabled={pending} className="h-11 rounded-full px-4 sm:h-10">
          {pending && <Loader2 className="animate-spin" />} Send reset link
        </Button>
      </div>
    </form>
  );
}
