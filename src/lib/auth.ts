import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database";

export type Role = Enums<"business_role">;
const RANK: Record<Role, number> = { OWNER: 3, MANAGER: 2, STAFF: 1 };
export const hasRole = (role: Role, min: Role) => RANK[role] >= RANK[min];

export const BUSINESS_COOKIE = "13c_business";

/**
 * Verified (auth server) user + profile, once per request, plus this session's sign-in: whether two-step sign-in is on
 * (checked against the auth server) and passed here (the session's aal), and when it last signed in (the token's amr).
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [{ data: profile }, { data: aal }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!profile) return null;
  const twoStep = !!data.user.factors?.some((f) => f.status === "verified");
  return {
    ...profile,
    twoStep,
    twoStepPassed: !twoStep || aal?.currentLevel === "aal2",
    /** ms; 0 if unknown */
    signedInAt: Math.max(0, ...(aal?.currentAuthenticationMethods ?? []).map((m) => (typeof m === "string" ? 0 : m.timestamp))) * 1000,
  };
});

/** Signed in, and past the code step when two-step sign-in is on. */
export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!user.twoStepPassed) redirect(`/login/verify?next=${encodeURIComponent(next)}`);
  return user;
}

/** How recently someone must have signed in to change payment details */
export const FRESH_SIGN_IN_MS = 15 * 60_000;

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!user.is_admin) notFound();
  return user;
}

export type Membership = { role: Role; business: Tables<"businesses"> };

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_members")
    .select("role, business:businesses(*)")
    .eq("user_id", user.id)
    .order("created_at");
  return (data ?? []).filter((m) => m.business && !m.business.deleted_at) as Membership[];
});

/** The business the dashboard is acting as (cookie-selected, else the first membership). */
export async function requireBusiness(min: Role = "STAFF") {
  const user = await requireUser("/dashboard");
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/register/business");
  const preferred = (await cookies()).get(BUSINESS_COOKIE)?.value;
  const current = memberships.find((m) => m.business.id === preferred) ?? memberships[0]!;
  if (!hasRole(current.role, min)) redirect("/dashboard?denied=1");
  return { user, business: current.business, role: current.role, memberships };
}
