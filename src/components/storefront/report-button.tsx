"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitReport } from "@/app/actions/messages";
import { NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const REASONS = {
  listing: ["Misleading listing or photos", "Suspected scam or fraud", "Vehicle not as described", "Inappropriate content", "Other"],
  // A booking, reported by its renter or by the business
  renter: ["Asked me to pay a different account", "Asked for fees that aren't in the booking", "The car didn't match the listing",
    "They didn't show up or cancelled last minute", "Unsafe or abusive behavior", "Suspected scam or fraud", "Other"],
  business: ["The renter didn't show up", "Fake or someone else's ID or license", "Damaged the car or broke the agreement",
    "Didn't return the car on time", "Payment problem", "Unsafe or abusive behavior", "Other"],
};

/** `side` (bookings only): who's reporting, which picks the reasons. */
export function ReportButton({ entityType, entityId, signedIn, side }: {
  entityType: "BUSINESS" | "VEHICLE" | "BOOKING"; entityId: string; signedIn: boolean; side?: "renter" | "business";
}) {
  const reasons = REASONS[side ?? "listing"];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]!);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  if (!signedIn) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
        <Flag className="size-3.5" /> {entityType === "BOOKING" ? "Report a problem" : `Report this ${entityType === "VEHICLE" ? "listing" : "business"}`}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report to 13C</DialogTitle>
          <DialogDescription>
            {entityType === "BOOKING" ? "Only 13C sees this; the other side isn't told. We review every report and may contact you." : "Our trust & safety team reviews every report."}
          </DialogDescription>
        </DialogHeader>
        <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">{reasons.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="What happened? (optional)" aria-label="Details" />
        <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
          const r = await submitReport({ entity_type: entityType, entity_id: entityId, reason, details });
          if (r.ok) { toast.success(r.message); setOpen(false); } else toast.error(r.error);
        })}>{pending && <Loader2 className="animate-spin" />} Submit report</Button>
      </DialogContent>
    </Dialog>
  );
}
