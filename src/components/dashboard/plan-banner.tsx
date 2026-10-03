import Link from "next/link";
import { Clock, ShieldAlert } from "lucide-react";
import { labelize } from "@/lib/format";
import { subscriptionState } from "@/lib/plans";
import type { Tables } from "@/types/database";

/** Shown across the dashboard in the last week of the trial or a paid month, and after it ends. */
export function PlanBanner({ sub }: { sub: Pick<Tables<"subscriptions">, "plan" | "status" | "current_period_end"> | null }) {
  const s = subscriptionState(sub);
  if (!s.endsAt || (!s.ended && (s.daysLeft ?? 99) > 7)) return null;
  const what = s.trial ? "Your free trial" : `Your ${labelize(sub!.plan)} plan`;
  return (
    <Link href="/dashboard/subscription"
      className={`mb-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${s.ended ? "bg-red-50 text-red-900 ring-1 ring-red-200" : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"}`}>
      {s.ended ? <ShieldAlert className="size-5 shrink-0" /> : <Clock className="size-5 shrink-0" />}
      <span className="flex-1">
        {s.ended ? `${what} has ended. Your store is hidden from customers.` : `${what} ends in ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"}.`}
      </span>
      <span className="shrink-0 font-semibold underline">{s.trial ? "Upgrade" : "Renew"}</span>
    </Link>
  );
}
