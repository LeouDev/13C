"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { savePaymentMethods } from "@/app/actions/business";
import { ImageUpload } from "@/components/common/uploads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Enums, Tables } from "@/types/database";

type Row = { method: Enums<"payment_method_type">; is_enabled: boolean; account_name: string; account_number: string; instructions: string; qr_path: string | null };
/** Methods renters can pay by scanning (GCash, Maya, and banks via InstaPay QR) */
const QR = new Set<Row["method"]>(["GCASH", "MAYA", "BANK_TRANSFER"]);

export function PaymentMethodsEditor({ businessId, existing, canEdit }: { businessId: string; existing: Tables<"payment_methods">[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(PAYMENT_METHODS.map((m) => {
    const e = existing.find((x) => x.method === m.value);
    return { method: m.value, is_enabled: e?.is_enabled ?? false, account_name: e?.account_name ?? "", account_number: e?.account_number ?? "", instructions: e?.instructions ?? "", qr_path: e?.qr_path ?? null };
  }));
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="grid gap-3">
      {rows.map((r, i) => (
        <div key={r.method} className={cn("rounded-2xl border bg-white p-4", r.is_enabled && "border-electric/40")}>
          <label className="flex items-center justify-between gap-3">
            <span className="font-semibold text-navy-900">{PAYMENT_METHODS[i]!.label}</span>
            <Switch checked={r.is_enabled} disabled={!canEdit} onCheckedChange={(c) => set(i, { is_enabled: c })} />
          </label>
          {r.is_enabled && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {r.method !== "CASH" && <>
                <Input disabled={!canEdit} placeholder="Account name" value={r.account_name} onChange={(e) => set(i, { account_name: e.target.value })} aria-label="Account name" />
                <Input disabled={!canEdit} placeholder={r.method === "BANK_TRANSFER" ? "Bank · account number" : r.method === "CARD" ? "Card terminal / link" : "Number"} value={r.account_number} onChange={(e) => set(i, { account_number: e.target.value })} aria-label="Account number" />
              </>}
              <Input disabled={!canEdit} className="sm:col-span-2" placeholder="Instructions shown to renters with a booking (e.g. send screenshot via chat)" value={r.instructions} onChange={(e) => set(i, { instructions: e.target.value })} aria-label="Instructions" />
              {QR.has(r.method) && canEdit && (
                <div className="flex items-center gap-3 sm:col-span-2">
                  <ImageUpload prefix={`b/${businessId}/pay`} value={r.qr_path} onChange={(path) => set(i, { qr_path: path })} png contain maxPx={1000} label="QR code" className="size-28 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Optional: your {PAYMENT_METHODS[i]!.label} QR code. Renters with a booking can scan it instead of typing your number, so payments don&apos;t go to a mistyped account.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {canEdit && (
        <Button size="lg" className="justify-self-start" disabled={pending} onClick={() => start(async () => {
          const res = await savePaymentMethods(businessId, rows);
          if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0]! : res.error);
        })}>{pending && <Loader2 className="animate-spin" />} Save payment methods</Button>
      )}
    </div>
  );
}
