"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startCheckout } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

/** Starts a PayMongo checkout for one month of the plan and sends the owner there. */
export function PayButton({ plan, children, variant = "electric" }: { plan: "PRO" | "BUSINESS"; children: React.ReactNode; variant?: "electric" | "outline" }) {
  const [pending, start] = useTransition();
  return (
    <Button variant={variant} className="w-full" disabled={pending} onClick={() => start(async () => {
      const r = await startCheckout(plan);
      if (r.ok && r.data) window.location.assign(r.data.url);
      else if (!r.ok) toast.error(r.error);
    })}>
      {pending && <Loader2 className="animate-spin" />} {children}
    </Button>
  );
}
