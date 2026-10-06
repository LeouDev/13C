"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { phoneSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { SITE_URL } from "@/lib/constants";

const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/");
/** The Turnstile token the form's widget added (components/common/turnstile.tsx); Supabase Auth verifies it. */
const captchaToken = (form: FormData) => String(form.get("cf-turnstile-response") ?? "") || undefined;

const signInSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

/** Password sign-in. With two-step sign-in on, the session can't do anything until the code step (/login/verify). */
export async function signIn(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ ...parsed.data, options: { captchaToken: captchaToken(form) } });
  if (error?.code === "email_not_confirmed") {
    const next = safeNext(form.get("next"));
    // The password was right but the bot-check token is spent, so resend with the server key (exempt from it).
    await createAdminClient().auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` } });
    return { ok: false, error: "Please confirm your email first — we just sent you a new confirmation link." };
  }
  if (error) return fail(error);
  const next = safeNext(form.get("next"));
  if (data.user.factors?.some((f) => f.status === "verified")) redirect(`/login/verify?next=${encodeURIComponent(next)}`);
  redirect(next);
}

const code = z.string().transform((v) => v.replace(/\s/g, "")).pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."));

/** The code step of sign-in: a code from the authenticator app finishes signing in this session (aal2). */
export async function verifyTwoStep(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = code.safeParse(String(form.get("code") ?? ""));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const next = safeNext(form.get("next"));
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return fail(listError);
  const factor = factors.totp[0];
  if (!factor) redirect(next);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data });
  if (error) return fail(error);
  redirect(next);
}

/** Starts turning on two-step sign-in: a QR code (and the secret, to type in) for the authenticator app. */
export async function startTwoStep(): Promise<ActionResult<{ factorId: string; qr: string; secret: string }>> {
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return fail(listError);
  // A setup that was started but never confirmed would block a new one.
  for (const f of factors.all.filter((f) => f.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "13C", friendlyName: "Authenticator app" });
  if (error) return fail(error);
  return ok({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
}

/** Finishes turning it on with the first code from the app (this session passes the code step; other devices are signed out). */
export async function confirmTwoStep(factorId: string, input: string): Promise<ActionResult> {
  const parsed = z.object({ factorId: z.uuid(), code }).safeParse({ factorId, code: input });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return ok(undefined, "Two-step sign-in is on. You'll enter a code from the app each time you sign in.");
}

/** Turns it off (only from a session that passed the code step; Supabase Auth checks). */
export async function turnOffTwoStep(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return fail(listError);
  for (const f of factors.all) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return fail(error);
  }
  revalidatePath("/", "layout");
  return ok(undefined, "Two-step sign-in is off.");
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  phone: z.union([z.literal(""), phoneSchema]).optional(),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  terms: z.literal("on", { error: "Please accept the Terms and Privacy Policy" }),
  marketing: z.string().optional(),
});

export async function signUp(_: unknown, form: FormData): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const { email, password, full_name, phone, marketing } = parsed.data;
  const next = safeNext(form.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name, phone: phone || null, terms_accepted: "true", marketing_opt_in: marketing === "on" ? "true" : "false" },
      captchaToken: captchaToken(form),
    },
  });
  if (error) return fail(error);
  if (data.session) redirect(next);
  return ok({ needsConfirmation: true }, "Check your email to confirm your account.");
}

/** Signs out; with a `next` path (e.g. a booking opened on the wrong account) it goes to sign-in for that page. */
export async function signOut(form?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const next = String(form?.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? `/login?next=${encodeURIComponent(next)}` : "/");
}

/** "Sign in again" before a sensitive change: ends this session only (other devices stay signed in), then back to `next`. */
export async function signInAgain(form: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/login?next=${encodeURIComponent(safeNext(form.get("next")))}&again=1`);
}

export async function requestPasswordReset(_: unknown, form: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { ok: false, error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${SITE_URL}/auth/callback?next=/account/security`, captchaToken: captchaToken(form) });
  if (error) return fail(error);
  return ok(undefined, "If an account exists, we've sent a reset link.");
}

/** Sets a new password (account page, or after a reset link) and signs out every other device, in case someone else had the old one. */
export async function updatePassword(_: unknown, form: FormData): Promise<ActionResult> {
  const password = z.string().min(8, "Use at least 8 characters").max(72).safeParse(form.get("password"));
  if (!password.success) return invalid(password.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return fail(error);
  const { error: others } = await supabase.auth.signOut({ scope: "others" });
  if (others) console.error("[auth] couldn't sign out other devices", others);
  return ok(undefined, others ? "Password updated." : "Password updated. You've been signed out on your other devices.");
}
