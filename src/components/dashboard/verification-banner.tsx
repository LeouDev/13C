import Link from "next/link";
import { AlertTriangle, BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Tables } from "@/types/database";

export function VerificationBanner({ business }: { business: Tables<"businesses"> }) {
  const s = business.status;
  if (s === "VERIFIED") return null;
  const map = {
    DRAFT: { icon: AlertTriangle, tone: "border-amber-200 bg-amber-50 text-amber-900", title: "Finish registering your business", body: "Upload your documents to submit your business for verification.", cta: { href: "/register/business", label: "Continue setup" } },
    PENDING: { icon: Clock, tone: "border-sky-200 bg-sky-50 text-sky-900", title: "Verification submitted", body: "13C is reviewing your documents. You can keep setting up your store and fleet in the meantime.", cta: null },
    UNDER_REVIEW: { icon: Clock, tone: "border-sky-200 bg-sky-50 text-sky-900", title: "Verification under review", body: "A reviewer is checking your business. We'll notify you as soon as it's done.", cta: null },
    CHANGES_REQUESTED: { icon: AlertTriangle, tone: "border-amber-200 bg-amber-50 text-amber-900", title: "Changes requested", body: business.status_note ?? "Please update your details and resubmit.", cta: { href: "/dashboard/profile#verification", label: "Update & resubmit" } },
    REJECTED: { icon: ShieldAlert, tone: "border-red-200 bg-red-50 text-red-900", title: "Verification not approved", body: business.status_note ?? "Contact support@13c.online for details.", cta: { href: "/dashboard/profile#verification", label: "Review & resubmit" } },
    SUSPENDED: { icon: ShieldAlert, tone: "border-red-200 bg-red-50 text-red-900", title: "Business suspended", body: business.status_note ?? "Your store is hidden. Contact support@13c.online.", cta: null },
  }[s];
  const Icon = map.icon ?? BadgeCheck;
  return (
    <div className={`mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${map.tone}`} role="status">
      <Icon className="size-5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">{map.title}</p>
        <p className="text-sm opacity-80">{map.body}</p>
      </div>
      {map.cta && <Link href={map.cta.href} className={buttonVariants({ size: "lg" })}>{map.cta.label}</Link>}
    </div>
  );
}
