"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setReviewHidden } from "@/app/actions/admin";
import { Switch } from "@/components/ui/switch";

/** Admin toggle: hidden reviews disappear from storefronts and ratings but are kept for the record. */
export function ReviewVisibility({ reviewId, hidden }: { reviewId: string; hidden: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-navy-900">
      <Switch
        checked={!hidden}
        disabled={pending}
        aria-label={hidden ? "Review hidden. Show on storefront" : "Review visible. Hide from storefront"}
        onCheckedChange={(visible) => start(async () => {
          const r = await setReviewHidden(reviewId, !visible);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        })}
      />
      {pending ? <Loader2 className="size-4 animate-spin text-electric" /> : hidden ? "Hidden" : "Visible"}
    </label>
  );
}
