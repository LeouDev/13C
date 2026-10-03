"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveReport } from "@/app/actions/admin";
import { Field, NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Enums } from "@/types/database";

const STATUSES: { value: Enums<"report_status">; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
];

export function ReportControl({ reportId, status, note }: { reportId: string; status: Enums<"report_status">; note: string | null }) {
  const router = useRouter();
  const [next, setNext] = useState(status);
  const [text, setText] = useState(note ?? "");
  const [pending, start] = useTransition();
  const dirty = next !== status || text.trim() !== (note ?? "").trim();

  return (
    <form
      className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await resolveReport(reportId, next, text.trim() || undefined);
          if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
        });
      }}
    >
      <Field label="Status" htmlFor={`report-status-${reportId}`}>
        <NativeSelect id={`report-status-${reportId}`} value={next} onChange={(e) => setNext(e.target.value as Enums<"report_status">)} disabled={pending}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Resolution note" htmlFor={`report-note-${reportId}`}>
        <Textarea id={`report-note-${reportId}`} value={text} onChange={(e) => setText(e.target.value)} disabled={pending}
          placeholder="What was done and why (the reporter can see this)" className="min-h-10" maxLength={2000} />
      </Field>
      <Button type="submit" variant="electric" size="lg" disabled={pending || !dirty}>
        {pending && <Loader2 className="animate-spin" />} Save
      </Button>
    </form>
  );
}
