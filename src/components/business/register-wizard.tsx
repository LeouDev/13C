"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { patchStorefront, registerBusiness, savePaymentMethods, setBusinessLogo, setStoreCover, submitVerification } from "@/app/actions/business";
import { BusinessForm } from "@/components/business/business-form";
import { Field } from "@/components/common/field";
import { DocumentUpload, ImageUpload, type UploadedDoc } from "@/components/common/uploads";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Enums } from "@/types/database";

const STEPS = ["Business details", "Branding", "Verification & payments"];
export const DOC_TYPES = [
  { value: "REGISTRATION", label: "DTI / SEC / CDA registration" },
  { value: "MAYORS_PERMIT", label: "Mayor's / business permit" },
  { value: "BIR", label: "BIR certificate (2303)" },
  { value: "REPRESENTATIVE_ID", label: "Representative's government ID" },
  { value: "INSURANCE", label: "Fleet insurance" },
  { value: "BUSINESS_PHOTO", label: "Business photo (office / garage)" },
  { value: "OTHER", label: "Other" },
];

type Resume = { id: string; logo_path: string | null; cover_path: string | null; tagline: string | null } | null;

export function RegisterWizard({ resume }: { resume: Resume }) {
  const router = useRouter();
  const [step, setStep] = useState(resume ? 1 : 0);
  const [biz, setBiz] = useState(resume);
  const [tagline, setTagline] = useState(resume?.tagline ?? "");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [methods, setMethods] = useState<Record<string, { on: boolean; account_name: string; account_number: string }>>(
    Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, { on: m.value === "CASH", account_name: "", account_number: "" }])),
  );
  const [socials, setSocials] = useState({ facebook: "", instagram: "", tiktok: "", website: "" });
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function finish() {
    if (!biz) return;
    if (docs.length === 0) return toast.error("Upload at least one registration document.");
    start(async () => {
      const pm = await savePaymentMethods(biz.id, PAYMENT_METHODS.map((m) => ({
        method: m.value as Enums<"payment_method_type">, is_enabled: methods[m.value]!.on,
        account_name: methods[m.value]!.account_name, account_number: methods[m.value]!.account_number,
      })));
      if (!pm.ok) return void toast.error(pm.fieldErrors ? Object.values(pm.fieldErrors)[0] : pm.error);
      const s = await patchStorefront(biz.id, { social_links: socials });
      if (!s.ok) return void toast.error(s.fieldErrors ? `Social links: ${Object.values(s.fieldErrors)[0]}` : s.error);
      const v = await submitVerification(biz.id, docs, note);
      if (!v.ok) return void toast.error(v.error);
      toast.success("Submitted! We'll review your business shortly.");
      router.push("/dashboard?welcome=1");
    });
  }

  return (
    <div>
      <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="grid gap-2">
            <span className={cn("h-1.5 rounded-full", i <= step ? "bg-electric" : "bg-border")} />
            <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-navy-900" : "text-muted-foreground")}>
              {i < step && <Check className="mr-1 inline size-3.5 text-electric" />}{i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <BusinessForm submitLabel="Continue" onSubmit={async (data) => {
          const res = await registerBusiness(data);
          if (res.ok && res.data) {
            setBiz({ id: res.data.id, logo_path: null, cover_path: null, tagline: null });
            setStep(1);
            router.refresh();
          } else if (!res.ok) toast.error(res.error);
          return res;
        }} />
      )}

      {step === 1 && biz && (
        <div className="grid gap-6">
          <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
            <Field label="Logo" hint="Square, at least 400×400.">
              <ImageUpload prefix={`b/${biz.id}`} value={biz.logo_path} maxPx={600} png label="Upload logo"
                onChange={async (path) => {
                  const r = await setBusinessLogo(biz.id, path);
                  if (r.ok) setBiz({ ...biz, logo_path: path }); else toast.error(r.error);
                }} />
            </Field>
            <Field label="Cover photo" hint="Wide photo of your fleet or shop. 1600×900 or larger.">
              <ImageUpload prefix={`b/${biz.id}`} value={biz.cover_path} aspect="aspect-[16/9]" maxPx={2400} label="Upload cover"
                onChange={async (path) => {
                  const r = await setStoreCover(biz.id, path);
                  if (r.ok) setBiz({ ...biz, cover_path: path }); else toast.error(r.error);
                }} />
            </Field>
          </div>
          <Field label="Tagline" htmlFor="tagline" hint="One line under your business name on your store.">
            <Input id="tagline" value={tagline} maxLength={140} onChange={(e) => setTagline(e.target.value)} placeholder="Self-drive cars across Cebu City & Mactan" />
          </Field>
          <div className="flex justify-between gap-3">
            <p className="self-center text-xs text-muted-foreground">You can change all of this later in My Store.</p>
            <Button size="xl" disabled={pending} onClick={() => start(async () => {
              const r = await patchStorefront(biz.id, { tagline });
              if (!r.ok) return void toast.error(r.error);
              setStep(2);
            })}>{pending && <Loader2 className="animate-spin" />} Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && biz && (
        <div className="grid gap-8">
          <section className="grid gap-3">
            <h2 className="font-semibold text-navy-900">Registration documents</h2>
            <p className="text-sm text-muted-foreground">Upload your business registration and permits, plus a photo of your office or garage. 13C reviews every business before it can go live — your store shows <span className="font-semibold text-electric">Verified Business</span> only after approval.</p>
            <DocumentUpload bucket="business-docs" prefix={biz.id} value={docs} onChange={setDocs} types={DOC_TYPES} />
          </section>

          <section className="grid gap-3">
            <h2 className="font-semibold text-navy-900">Accepted payment methods</h2>
            <p className="text-sm text-muted-foreground">13C doesn&apos;t process payments — customers pay you directly. Account details are only shown to renters with a booking.</p>
            <div className="grid gap-2">
              {PAYMENT_METHODS.map((m) => {
                const st = methods[m.value]!;
                const needsAccount = ["GCASH", "MAYA", "BANK_TRANSFER"].includes(m.value);
                return (
                  <div key={m.value} className={cn("rounded-xl border p-3", st.on && "border-electric/40 bg-electric/5")}>
                    <label className="flex items-center gap-3 text-sm font-medium">
                      <Checkbox checked={st.on} onCheckedChange={(on) => setMethods((x) => ({ ...x, [m.value]: { ...st, on: !!on } }))} />
                      {m.label}
                    </label>
                    {st.on && needsAccount && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Input aria-label={`${m.label} account name`} placeholder="Account name" value={st.account_name} onChange={(e) => setMethods((x) => ({ ...x, [m.value]: { ...st, account_name: e.target.value } }))} />
                        <Input aria-label={`${m.label} number`} placeholder={m.value === "BANK_TRANSFER" ? "Bank · account number" : "Mobile number"} value={st.account_number} onChange={(e) => setMethods((x) => ({ ...x, [m.value]: { ...st, account_number: e.target.value } }))} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="font-semibold text-navy-900">Social media <span className="font-normal text-muted-foreground">(optional)</span></h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["facebook", "instagram", "tiktok", "website"] as const).map((k) => (
                <Input key={k} aria-label={k} placeholder={k === "website" ? "yourwebsite.ph" : `${k}.com/yourpage`} value={socials[k]} onChange={(e) => setSocials((s) => ({ ...s, [k]: e.target.value }))} />
              ))}
            </div>
          </section>

          <Field label="Note to the 13C review team (optional)" htmlFor="note">
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Anything that helps us verify your business faster." />
          </Field>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button size="xl" variant="electric" disabled={pending} onClick={finish}>
              {pending && <Loader2 className="animate-spin" />} Submit for verification
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
