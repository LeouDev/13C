"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setPlan } from "@/app/actions/admin";
import { NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import type { Enums } from "@/types/database";

const PLANS: Enums<"subscription_plan">[] = ["FREE", "PRO", "BUSINESS"];
const STATUSES: { value: Enums<"subscription_status">; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "TRIALING", label: "Trialing" },
  { value: "PAST_DUE", label: "Past due" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function PlanControl({ businessId, businessName, plan, status }: {
  businessId: string;
  businessName: string;
  plan: Enums<"subscription_plan">;
  status: Enums<"subscription_status">;
}) {
  const router = useRouter();
  const [nextPlan, setNextPlan] = useState(plan);
  const [nextStatus, setNextStatus] = useState(status);
  const [pending, start] = useTransition();
  const dirty = nextPlan !== plan || nextStatus !== status;

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setPlan(businessId, nextPlan, nextStatus);
          if (r.ok) { toast.success(`${businessName}: ${r.message}`); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <NativeSelect value={nextPlan} onChange={(e) => setNextPlan(e.target.value as Enums<"subscription_plan">)} disabled={pending}
        aria-label={`Plan for ${businessName}`} className="h-8 w-28 rounded-lg text-sm">
        {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
      </NativeSelect>
      <NativeSelect value={nextStatus} onChange={(e) => setNextStatus(e.target.value as Enums<"subscription_status">)} disabled={pending}
        aria-label={`Subscription status for ${businessName}`} className="h-8 w-32 rounded-lg text-sm">
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </NativeSelect>
      <Button type="submit" size="sm" variant="electric" disabled={pending || !dirty}>
        {pending && <Loader2 className="animate-spin" />} Save
      </Button>
    </form>
  );
}
