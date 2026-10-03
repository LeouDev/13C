"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDocumentUrl, reviewBusiness } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Enums } from "@/types/database";

export function DocumentLink({ bucket = "business-docs", path, name }: { bucket?: "business-docs" | "kyc"; path: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2 text-left text-sm hover:bg-canvas"
      onClick={() => start(async () => {
        const r = await getDocumentUrl(bucket, path);
        if (r.ok && r.data) window.open(r.data, "_blank", "noopener"); else if (!r.ok) toast.error(r.error);
      })}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4 text-electric" />}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <ExternalLink className="size-3.5 text-muted-foreground" />
    </button>
  );
}

export function BusinessDecision({ businessId, status }: { businessId: string; status: Enums<"business_status"> }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const decide = (d: Enums<"business_status">) => start(async () => {
    const r = await reviewBusiness(businessId, d, note);
    if (r.ok) { toast.success(r.message); setNote(""); router.refresh(); } else toast.error(r.error);
  });

  return (
    <div className="grid gap-3">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the business (required for changes, rejection and suspension)" aria-label="Decision note" />
      <div className="flex flex-wrap gap-2">
        {pending && <Loader2 className="size-5 animate-spin self-center text-electric" />}
        {["PENDING"].includes(status) && <Button variant="outline" disabled={pending} onClick={() => decide("UNDER_REVIEW")}>Start review</Button>}
        {["PENDING", "UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED"].includes(status) && (
          <>
            <Button variant="electric" disabled={pending} onClick={() => decide("VERIFIED")}>Approve</Button>
            <Button variant="outline" disabled={pending} onClick={() => decide("CHANGES_REQUESTED")}>Request changes</Button>
            <Button variant="destructive" disabled={pending} onClick={() => decide("REJECTED")}>Reject</Button>
          </>
        )}
        {status === "VERIFIED" && <Button variant="destructive" disabled={pending} onClick={() => decide("SUSPENDED")}>Suspend</Button>}
        {status === "SUSPENDED" && <Button variant="electric" disabled={pending} onClick={() => decide("VERIFIED")}>Reinstate</Button>}
      </div>
    </div>
  );
}
