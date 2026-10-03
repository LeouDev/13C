"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { SITE_URL } from "@/lib/constants";

const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/");

const signInSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

export async function signIn(_: unknown, form: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(error);
  redirect(safeNext(form.get("next")));
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  phone: z.string().trim().max(30).optional(),
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
    },
  });
  if (error) return fail(error);
  if (data.session) redirect(next);
  return ok({ needsConfirmation: true }, "Check your email to confirm your account.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: unknown, form: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { ok: false, error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${SITE_URL}/auth/callback?next=/account/security` });
  if (error) return fail(error);
  return ok(undefined, "If an account exists, we've sent a reset link.");
}

export async function updatePassword(_: unknown, form: FormData): Promise<ActionResult> {
  const password = z.string().min(8, "Use at least 8 characters").max(72).safeParse(form.get("password"));
  if (!password.success) return invalid(password.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return fail(error);
  return ok(undefined, "Password updated.");
}
