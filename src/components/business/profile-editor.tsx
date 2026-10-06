"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setBusinessLogo, submitVerification, updateBusinessProfile } from "@/app/actions/business";
import { BusinessForm } from "@/components/business/business-form";
import { VerificationDocs } from "@/components/business/verification-docs";
import { ImageUpload, type UploadedDoc } from "@/components/common/uploads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { missingVerificationDocs } from "@/lib/constants";
import type { Tables } from "@/types/database";

export function ProfileEditor({ business }: { business: Tables<"businesses"> }) {
  const router = useRouter();
  const [logo, setLogo] = useState(business.logo_path);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
      <div>
        <p className="mb-2 text-[13px] font-medium text-navy-900">Logo</p>
        <ImageUpload prefix={`b/${business.id}`} value={logo} maxPx={600} png label="Upload logo" onChange={async (path) => {
          const r = await setBusinessLogo(business.id, path);
          if (r.ok) { setLogo(path); toast.success("Logo updated."); router.refresh(); } else toast.error(r.error);
        }} />
      </div>
      <BusinessForm
        initial={business as never}
        submitLabel="Save business profile"
        onSubmit={async (data) => {
          const r = await updateBusinessProfile(business.id, data);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
          return r;
        }}
      />
    </div>
  );
}

export function ResubmitVerification({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4">
      <VerificationDocs businessId={businessId} value={docs} onChange={setDocs} />
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you change? (optional)" maxLength={2000} aria-label="Note to reviewers" />
      <Button size="lg" variant="electric" className="justify-self-start" disabled={pending || missingVerificationDocs(docs.map((d) => d.type)).length > 0} onClick={() => start(async () => {
        const r = await submitVerification(businessId, docs, note);
        if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
      })}>
        {pending && <Loader2 className="animate-spin" />} Submit for verification
      </Button>
    </div>
  );
}
