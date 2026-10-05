import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/account/account-panels";
import { AuthShell } from "@/components/site/auth-shell";
import { getMemberships, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

/** Where password-reset links land (the link signs the person in, via /auth/confirm): just the new-password form. */
export default async function NewPasswordPage() {
  const user = await requireUser("/account/security");
  const done = (await getMemberships()).length > 0 ? "/dashboard" : "/account";
  return (
    <AuthShell title="Choose a new password" subtitle={`For ${user.email}. Your reset link signed you in on this device. Set a new password to finish; any other devices will be signed out.`}>
      <NewPasswordForm done={done} />
    </AuthShell>
  );
}
