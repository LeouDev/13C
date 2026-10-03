"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [inked, setInked] = useState(false);
  const [pending, start] = useTransition();
  const ready = agreed && inked && name.trim().length >= 2;

  return (
    <section className="rounded-3xl bg-white p-5 ring-2 ring-electric/30 sm:p-6" aria-labelledby="sign-title">
      <h2 id="sign-title" className="font-display text-xl font-bold text-navy-900">Sign the agreement</h2>
      <p className="mt-1 text-sm text-muted-foreground">Your electronic signature is legally binding under RA 8792. We record your name, email, time, IP address, browser and a fingerprint of this exact version.</p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">Full legal name
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
        </label>
        <SignaturePad ref={pad} name={name} onChange={setInked} />
        <label className="flex items-start gap-3 rounded-2xl bg-canvas p-4 text-sm font-medium text-navy-900">
          <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
          I have read and agree to the Rental Agreement.
        </label>
        <Button size="xl" variant="electric" disabled={!ready || pending} onClick={() => start(async () => {
          const image = pad.current?.toDataURL() ?? "";
          const r = await signContract({ versionId, type: pad.current?.mode ?? "TYPED", name, image, contentHash, agreed: true });
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
  const pad = useRef<SignaturePadHandle>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [inked, setInked] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" variant="electric" />}>Sign & send to renter</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sign as Rental Provider</DialogTitle>
          <DialogDescription>Draw or type your signature for the business, then the renter is asked to sign.</DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Your full name" autoComplete="name" maxLength={120} />
        <SignaturePad ref={pad} name={name} onChange={setInked} />
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" /> I&apos;m authorized to sign for this business and I agree to this Rental Agreement.</label>
        <Button size="xl" disabled={!agreed || !inked || name.trim().length < 2 || pending} onClick={() => start(async () => {
          const image = pad.current?.toDataURL() ?? "";
          const r = await sendContract({ contractId, type: pad.current?.mode ?? "TYPED", name, image, agreed: true });
          if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error);
        })}>
          {pending && <Loader2 className="animate-spin" />} Sign & send
        </Button>
      </DialogContent>
    </Dialog>
  );
}
