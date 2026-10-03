import { BadgeCheck, Star } from "lucide-react";
import { cn } from "cn";
import { STATUS_META, type BookingStatus } from "@/lib/bookings/status";

const TONES = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-sky-50 text-sky-700",
  warning: "bg-amber-50 text-amber-800",
  success: "bg-emerald-50 text-emerald-700",
  danger: "bg-red-50 text-red-700",
  brand: "bg-electric/10 text-electric",
} as const;

export function Pill({ tone = "neutral", className, children }: { tone?: keyof typeof TONES; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const meta = STATUS_META[status];
  return <Pill tone={meta.tone} className={className}>{meta.label}</Pill>;
}

export function VerifiedBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-electric", className)} title="Verified by 13C">
      <BadgeCheck className="size-4" aria-hidden />
      {compact ? <span className="sr-only">Verified business</span> : "Verified Business"}
    </span>
  );
}

export function Rating({ value, count, className }: { value: number | string | null | undefined; count?: number | string | null; className?: string }) {
  if (value == null || Number(count ?? 1) === 0) {
    return <span className={cn("text-xs font-medium text-muted-foreground", className)}>New</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold text-navy-900", className)}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      {Number(value).toFixed(1)}
      {count != null && <span className="font-normal text-muted-foreground">({count})</span>}
    </span>
  );
}

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")} aria-hidden />
      ))}
    </span>
  );
}

export const VEHICLE_STATUS_TONE = { ACTIVE: "success", INACTIVE: "neutral", MAINTENANCE: "warning", UNAVAILABLE: "danger" } as const;
export const BUSINESS_STATUS_TONE = {
  DRAFT: "neutral", PENDING: "warning", UNDER_REVIEW: "info", CHANGES_REQUESTED: "warning",
  VERIFIED: "success", REJECTED: "danger", SUSPENDED: "danger",
} as const;
