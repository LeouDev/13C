import type { Tables } from "@/types/database";

type Sub = Pick<Tables<"subscriptions">, "plan" | "status" | "current_period_end"> | null | undefined;

/**
 * Mirrors public.subscription_is_active(): active until current_period_end (the trial's end, or the end of the
 * last paid month). No end date = trial not started yet, or a paid plan granted by an admin.
 */
export function subscriptionState(sub: Sub, now = Date.now()) {
  if (!sub || sub.status === "CANCELLED") return { active: false, trial: false, started: false, ended: true, daysLeft: 0, endsAt: null };
  const trial = sub.plan === "FREE";
  if (!sub.current_period_end) return { active: true, trial, started: !trial, ended: false, daysLeft: null, endsAt: null };
  const ms = new Date(sub.current_period_end).getTime() - now;
  return { active: ms > 0, trial, started: true, ended: ms <= 0, daysLeft: Math.max(0, Math.ceil(ms / 86400000)), endsAt: sub.current_period_end };
}

/** Mirrors public.business_plan_active(): Business features need an active Business subscription. */
export const businessPlanActive = (sub: Sub, now = Date.now()) => sub?.plan === "BUSINESS" && subscriptionState(sub, now).active;
