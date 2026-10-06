import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/site/auth-shell";
import { TwoStepForm } from "@/components/site/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false } };

/** The code step of sign-in (two-step sign-in is on and this session hasn't passed it yet). */
export default async function TwoStepPage({ searchParams }: PageProps<"/login/verify">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.twoStepPassed) redirect(nextPath);
  return (
    <AuthShell title="Enter your code" subtitle={`Two-step sign-in is on for ${user.email}. Open your authenticator app and enter the 6-digit code for 13C.`}>
      <TwoStepForm next={nextPath} />
    </AuthShell>
  );
}
