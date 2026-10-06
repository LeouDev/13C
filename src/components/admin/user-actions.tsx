"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { anonymizeUser, resetTwoStep, setKycStatus, setUserSuspended } from "@/app/actions/admin";
import { NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions";
import type { Enums } from "@/types/database";

const KYC: { value: Enums<"kyc_status">; label: string }[] = [
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

export function UserActions({
  userId, name, suspended, kycStatus, anonymized, isSelf, twoStep = false,
}: {
  userId: string;
  name: string;
  suspended: boolean;
  /** null when the user has no renter profile yet. */
  kycStatus: Enums<"kyc_status"> | null;
  anonymized: boolean;
  isSelf: boolean;
  /** They have two-step sign-in on (support can remove it for a lost phone; shown on the user's page) */
  twoStep?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionResult>) => start(async () => {
    const r = await action();
    if (r.ok) { toast.success(r.message ?? "Saved."); router.refresh(); } else toast.error(r.error);
  });

  if (anonymized) return <span className="text-xs text-muted-foreground">Personal data erased</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {kycStatus ? (
        <NativeSelect
          key={kycStatus}
          defaultValue={kycStatus}
          disabled={pending}
          aria-label={`KYC status for ${name}`}
          className="h-8 w-32 rounded-lg text-sm"
          onChange={(e) => run(() => setKycStatus(userId, e.target.value as Enums<"kyc_status">))}
        >
          {KYC.map((k) => <option key={k.value} value={k.value}>KYC: {k.label}</option>)}
        </NativeSelect>
      ) : (
        <span className="text-xs text-muted-foreground">No renter profile</span>
      )}
      {!isSelf && (
        <>
          <Button
            size="sm"
            variant={suspended ? "electric" : "outline"}
            disabled={pending}
            onClick={() => {
              if (!suspended && !confirm(`Suspend ${name}? They will be blocked from messaging and booking until reinstated.`)) return;
              run(() => setUserSuspended(userId, !suspended));
            }}
          >
            {suspended ? "Reinstate" : "Suspend"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (!confirm(
                `Erase ${name}'s personal data?\n\nTheir name, email, phone, avatar, KYC details and driver documents will be removed and the account suspended.\n\n` +
                "Booking, payment, contract and e-signature records are retained as required by law. This cannot be undone.",
              )) return;
              run(() => anonymizeUser(userId));
            }}
          >
            Anonymize
          </Button>
          {twoStep && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => {
              if (!confirm(`Remove ${name}'s two-step sign-in? Only do this after confirming it's really them (for example a lost phone).`)) return;
              run(() => resetTwoStep(userId));
            }}>
              Remove two-step sign-in
            </Button>
          )}
        </>
      )}
      {pending && <Loader2 className="size-4 animate-spin text-electric" aria-label="Saving" />}
    </div>
  );
}
