import type { Tables } from "@/types/database";

type Sub = Pick<Tables<"subscriptions">, "plan" | "status" | "current_period_end"> | null | undefined;

/** Mirrors public.subscription_is_active(): paid plans run until cancelled; Free is a trial that expires. */
export function subscriptionState(sub: Sub, now = Date.now()) {
  if (!sub || sub.status === "CANCELLED") return { active: false, trial: false, started: false, ended: true, daysLeft: 0, endsAt: null };
  if (sub.plan !== "FREE") return { active: true, trial: false, started: true, ended: false, daysLeft: null, endsAt: null };
  if (!sub.current_period_end) return { active: true, trial: true, started: false, ended: false, daysLeft: null, endsAt: null };
  const ms = new Date(sub.current_period_end).getTime() - now;
  return { active: ms > 0, trial: true, started: true, ended: ms <= 0, daysLeft: Math.max(0, Math.ceil(ms / 86400000)), endsAt: sub.current_period_end };
}
