"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, PenLine, Type } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { markContractViewed, sendContract, signContract } from "@/app/actions/contracts";
import { SignaturePad, type SignaturePadHandle } from "@/components/contract/signature-pad";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function MarkViewed({ contractId }: { contractId: string }) {
  const router = useRouter();
  useEffect(() => { markContractViewed(contractId).then(() => router.refresh()); }, [contractId, router]);
  return null;
}

export function SignPanel({ versionId, contentHash, defaultName }: { versionId: string; contentHash: string; defaultName: string }) {
  const router = useRouter();
  const pad = useRef<SignaturePadHandle>(null);
  const [mode, setMode] = useState<"TYPED" | "DRAWN">("TYPED");
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [pending, start] = useTransition();
  const ready = agreed && name.trim().length >= 2 && (mode === "TYPED" || drawn);

  return (
    <section className="rounded-3xl bg-white p-5 ring-2 ring-electric/30 sm:p-6" aria-labelledby="sign-title">
      <h2 id="sign-title" className="font-display text-xl font-bold text-navy-900">Sign the agreement</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your electronic signature is legally binding under RA 8792. We record your name, time, IP address and a fingerprint of this exact version.</p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">Full legal name
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <div className="flex w-fit rounded-full bg-canvas p-1" role="tablist" aria-label="Signature method">
          {([["TYPED", "Type", Type], ["DRAWN", "Draw", PenLine]] as const).map(([m, label, Icon]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold", mode === m ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {mode === "TYPED" ? (
          <div className="grid h-28 place-items-center rounded-2xl border-2 border-dashed bg-white px-4">
            <span className="truncate font-serif text-4xl text-navy-900 italic">{name || "Your name"}</span>
          </div>
        ) : (
          <SignaturePad ref={pad} onChange={(empty) => setDrawn(!empty)} />
        )}
        <label className="flex items-start gap-3 rounded-2xl bg-canvas p-4 text-sm font-medium text-navy-900">
          <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
          I have read and agree to the Rental Agreement.
        </label>
        <Button size="xl" variant="electric" disabled={!ready || pending} onClick={() => start(async () => {
          const drawing = mode === "DRAWN" ? pad.current?.toDataURL() ?? null : null;
          const r = await signContract({ versionId, type: mode, name, drawing, contentHash, agreed: true });
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        })}>
          {pending && <Loader2 className="animate-spin" />} Sign & Submit
        </Button>
      </div>
    </section>
  );
}

export function SendContractDialog({ contractId, defaultName }: { contractId: string; defaultName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" variant="electric" />}>Sign & send to renter</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign as Rental Provider</DialogTitle>
          <DialogDescription>Your typed signature is applied for the business, then the renter is asked to sign.</DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Your full name" />
        <div className="grid h-20 place-items-center rounded-2xl border-2 border-dashed"><span className="font-serif text-3xl italic">{name}</span></div>
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" /> I&apos;m authorized to sign for this business and I agree to this Rental Agreement.</label>
        <Button size="xl" disabled={!agreed || name.trim().length < 2 || pending} onClick={() => start(async () => {
          const r = await sendContract(contractId, name);
          if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error);
        })}>
          {pending && <Loader2 className="animate-spin" />} Sign & send
        </Button>
      </DialogContent>
    </Dialog>
  );
}
