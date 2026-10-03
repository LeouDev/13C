import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/auth-shell";
import { SignUpForm } from "@/components/site/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  if (await getCurrentUser()) redirect(nextPath ?? "/");
  return (
    <AuthShell title="Create your account" subtitle="One account to rent cars — or to run your rental business on 13C.">
      <SignUpForm next={nextPath} />
    </AuthShell>
  );
}
