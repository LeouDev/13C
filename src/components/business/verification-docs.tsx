"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { DocumentUpload, type UploadedDoc } from "@/components/common/uploads";
import { BUSINESS_DOC_TYPES, VERIFICATION_GROUPS } from "@/lib/constants";

/** Verification uploads, one slot per group (the representative's ID, a business document, a dated car photo, extras). */
export function VerificationDocs({ businessId, value, onChange }: { businessId: string; value: UploadedDoc[]; onChange: (docs: UploadedDoc[]) => void }) {
  const groupOf = (type: string) => BUSINESS_DOC_TYPES.find((t) => t.value === type)?.group ?? "extra";
  return (
    <div className="grid gap-3">
      {VERIFICATION_GROUPS.map((g) => {
        const mine = value.filter((d) => groupOf(d.type) === g.key);
        const required = g.key !== "extra";
        return (
          <section key={g.key} className="grid gap-2 rounded-2xl border bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              {required && (mine.length ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-amber-500" />)}
              {g.title}
            </h3>
            <p className="text-sm text-muted-foreground">{g.hint}</p>
            <DocumentUpload bucket="business-docs" prefix={businessId} value={mine} footer={false}
              types={BUSINESS_DOC_TYPES.filter((t) => t.group === g.key)}
              onChange={(docs) => onChange([...value.filter((d) => groupOf(d.type) !== g.key), ...docs])} />
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">PDF, JPG, PNG or WebP · up to 10 MB each · stored privately, visible only to you and 13C reviewers.</p>
    </div>
  );
}
