import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/auth-shell";
import { SignInForm } from "@/components/site/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, confirmed } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  if (await getCurrentUser()) redirect(nextPath ?? "/");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your bookings, messages and rental agreements.">
      {confirmed && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">If you just confirmed your email, you&apos;re all set — sign in to continue.</p>}
      {error === "link" && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">That link has expired or was already used. If you already confirmed your email, just sign in. If not, sign in anyway and we&apos;ll email you a fresh confirmation link.</p>}
      <SignInForm next={nextPath} />
    </AuthShell>
  );
}
