"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { signIn, signUp, requestPasswordReset } from "@/app/actions/auth";
import { Field } from "@/components/common/field";
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
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <FormError state={state} />
      <Field label="Email" htmlFor="email" error={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={fe?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="xl" disabled={pending} className="mt-1 w-full">
        {pending && <Loader2 className="animate-spin" />} Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to 13C?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-electric hover:underline">Create an account</Link>
      </p>
    </form>
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
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+63 9XX XXX XXXX" />
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

export function ResetForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="grid gap-3">
      {state?.ok ? <p className="text-sm text-emerald-700">{state.message}</p> : <FormError state={state} />}
      <Field label="Email" htmlFor="reset-email">
        <Input id="reset-email" name="email" type="email" required />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Send reset link</Button>
    </form>
  );
}
