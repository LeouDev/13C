import Image from "next/image";
import { AlertTriangle, QrCode } from "lucide-react";
import { formatDateTime, labelize } from "@/lib/format";
import { mediaUrl } from "@/lib/storage";
import type { Enums } from "@/types/database";

export type PayTo = {
  account_name: string | null; account_number: string | null; instructions: string | null; qr_path: string | null; details_changed_at: string | null;
};

/** The business's account for this booking, as the renter sees it. Details changed after `bookedAt` get a warning. */
export function PayToDetails({ payTo, method, businessName, bookedAt }: {
  payTo: PayTo | null; method: Enums<"payment_method_type">; businessName: string; bookedAt: string;
}) {
  const qr = mediaUrl(payTo?.qr_path ?? null);
  const changed = payTo?.details_changed_at && new Date(payTo.details_changed_at) > new Date(bookedAt) ? payTo.details_changed_at : null;
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <p className="font-semibold">{method === "CASH" ? `Pay ${businessName} in cash` : `Send via ${labelize(method)}`}</p>
        {payTo?.account_name && <p>Account name: {payTo.account_name}</p>}
        {payTo?.account_number && <p>Number: <span className="font-mono">{payTo.account_number}</span></p>}
        {payTo?.instructions && <p className="mt-1 text-muted-foreground">{payTo.instructions}</p>}
        {!payTo?.account_number && !payTo?.instructions && !qr && method !== "CASH" && (
          <p className="text-muted-foreground">Message {businessName} for their {labelize(method)} details.</p>
        )}
      </div>
      {qr && (
        <a href={qr} target="_blank" rel="noreferrer" className="grid justify-items-start gap-1 sm:justify-items-center">
          <Image src={qr} alt={`${labelize(method)} QR code for ${businessName}`} width={144} height={144} className="size-36 rounded-xl border bg-white object-contain" />
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><QrCode className="size-3.5" /> Open to save, then upload in your app</span>
        </a>
      )}
      {changed && (
        <p className="flex gap-2 rounded-xl bg-amber-100 p-3 text-xs text-amber-950 sm:col-span-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{businessName} changed these details on {formatDateTime(changed)}, after you booked. Call them on the number on this page to confirm before you pay.</span>
        </p>
      )}
    </div>
  );
}
