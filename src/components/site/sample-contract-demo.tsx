"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, BadgeCheck, CircleCheck, RotateCcw } from "lucide-react";
import { cn } from "cn";
import { ContractDocument } from "@/components/contract/contract-document";
import { SignaturePad, type SignaturePadHandle } from "@/components/contract/signature-pad";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ContractSection, ContractSignature } from "@/lib/contracts/pdf";

const PROVIDER = "Your Car Rental";
const RENTER = "Juan Dela Cruz";
const STEPS = ["Sign as the business", "Sign as the renter", "Signed"];

/** The For Business sample agreement: sign it as both parties. Everything stays in the browser; nothing is sent or saved. */
export function SampleContractDemo({ title, sections, contentHash }: { title: string; sections: ContractSection[]; contentHash: string }) {
  const [signatures, setSignatures] = useState<ContractSignature[]>([]);
  const step = signatures.length; // 0: business signs, 1: renter signs, 2: done
  const signedAt = signatures.find((s) => s.signer_role === "RENTER")?.signed_at;

  return (
    <div className="bg-[#f6f7f9]">
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:py-12">
        <Link href="/for-business" className="text-sm text-muted-foreground hover:text-navy-900">← 13C for rental businesses</Link>
        <header>
          <p className="eyebrow text-electric">Sample contract</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">See how signing works</h1>
          <p className="mt-2 text-muted-foreground">13C&apos;s standard rental agreement, filled in with sample details. Sign it as the business, then as the renter. Nothing is sent or saved.</p>
        </header>

        <ol className="grid grid-cols-3 gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined}
              className={cn("flex items-center justify-center rounded-2xl px-3 py-2.5 text-center text-xs font-semibold sm:text-sm", i < step ? "bg-emerald-50 text-emerald-700" : i === step ? "bg-electric text-white" : "bg-white text-muted-foreground")}>
              {i < step && <BadgeCheck className="mr-1 size-4 shrink-0" />}{label}
            </li>
          ))}
        </ol>

        <ContractDocument title={title} version={1} reference="13C-SAMPLE" sections={sections} signatures={signatures} contentHash={contentHash}
          providerName={PROVIDER} renterName={RENTER} signedAt={signedAt} collapsible />

        {step < 2 ? (
          <SignStep key={step} role={step === 0 ? "PROVIDER" : "RENTER"} contentHash={contentHash} previous={signatures[0]}
            onSign={(sig) => setSignatures((s) => [...s, sig])} />
        ) : (
          <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-navy-900"><CircleCheck className="size-6 text-emerald-600" /> Signed by both parties</h2>
            <p className="mt-1 text-sm text-muted-foreground">In a real booking, this is what happens next:</p>
            <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-navy-800">
              <li>The booking is confirmed automatically.</li>
              <li>You and the renter both get the signed PDF by email and can download it anytime.</li>
              <li>Its last page is a signature certificate: the SHA-256 fingerprint above, each signer&apos;s name, email, time, IP address and browser, and when it was sent and opened.</li>
              <li>A signed agreement can&apos;t be changed. Any change makes a new version that both sign again.</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/register/business" className={buttonVariants({ variant: "electric", size: "lg" })}>Create Your Rental Business <ArrowRight /></Link>
              <Button variant="outline" size="lg" onClick={() => setSignatures([])}><RotateCcw /> Try again</Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SignStep({ role, contentHash, previous, onSign }: {
  role: "PROVIDER" | "RENTER"; contentHash: string; previous?: ContractSignature; onSign: (sig: ContractSignature) => void;
}) {
  const provider = role === "PROVIDER";
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(provider ? "Maria Santos" : RENTER);
  const [agreed, setAgreed] = useState(false);
  const [inked, setInked] = useState(false);

  return (
    <section className="rounded-3xl bg-white p-5 ring-2 ring-electric/30 sm:p-6" aria-labelledby="sign-title">
      {previous && <p className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CircleCheck className="size-5 shrink-0" /> Signed for {PROVIDER} by {previous.signer_name}. The renter now gets it by email.</p>}
      <p className="eyebrow text-electric">Step {provider ? 1 : 2} of 2</p>
      <h2 id="sign-title" className="mt-1 font-display text-xl font-bold text-navy-900">{provider ? "Sign as the rental business" : "Now sign as the renter"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {provider
          ? "When you approve a booking, 13C writes this agreement. You review it, then sign and send it to the renter in one step."
          : "Your renter opens the agreement on their phone, reads it and signs like this. The booking is then confirmed."}
      </p>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">Full name
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>
        <SignaturePad ref={pad} name={name} onChange={setInked} />
        <label className="flex items-start gap-3 rounded-2xl bg-canvas p-4 text-sm font-medium text-navy-900">
          <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
          {provider ? "I'm authorized to sign for this business and I agree to this Rental Agreement." : "I have read and agree to the Rental Agreement."}
        </label>
        <Button size="xl" variant="electric" disabled={!agreed || !inked || name.trim().length < 2} onClick={() => onSign({
          signer_role: role, signer_name: name.trim(), signature_type: pad.current?.mode ?? "TYPED", signature_data: pad.current?.toDataURL() ?? null,
          signed_at: new Date().toISOString(), ip_address: null, content_hash: contentHash,
        })}>
          {provider ? "Sign & send to renter" : "Sign & Submit"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Sample only: nothing is sent or saved.</p>
      </div>
    </section>
  );
}
