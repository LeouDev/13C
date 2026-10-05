"use server";

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

export async function signIn(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ ...parsed.data, options: { captchaToken: captchaToken(form) } });
  if (error?.code === "email_not_confirmed") {
    const next = safeNext(form.get("next"));
    // The password was right but the bot-check token is spent, so resend with the server key (exempt from it).
    await createAdminClient().auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` } });
    return { ok: false, error: "Please confirm your email first — we just sent you a new confirmation link." };
  }
  if (error) return fail(error);
  redirect(safeNext(form.get("next")));
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
