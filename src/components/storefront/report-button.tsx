"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitReport } from "@/app/actions/messages";
import { NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const REASONS = ["Misleading listing or photos", "Suspected scam or fraud", "Vehicle not as described", "Inappropriate content", "Other"];

export function ReportButton({ entityType, entityId, signedIn }: { entityType: "BUSINESS" | "VEHICLE"; entityId: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  if (!signedIn) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"><Flag className="size-3.5" /> Report this {entityType === "VEHICLE" ? "listing" : "business"}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Report to 13C</DialogTitle><DialogDescription>Our trust & safety team reviews every report.</DialogDescription></DialogHeader>
        <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">{REASONS.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="What happened? (optional)" aria-label="Details" />
        <Button variant="destructive" disabled={pending} onClick={() => start(async () => {
          const r = await submitReport({ entity_type: entityType, entity_id: entityId, reason, details });
          if (r.ok) { toast.success(r.message); setOpen(false); } else toast.error(r.error);
        })}>{pending && <Loader2 className="animate-spin" />} Submit report</Button>
      </DialogContent>
    </Dialog>
  );
}
