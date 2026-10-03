import Link from "next/link";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  icon: Icon, title, description, action, className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href: string } | React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-border bg-white/60 px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-canvas text-navy-700">
          <Icon className="size-5" />
        </span>
      )}
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <div className="mt-5">
          {typeof action === "object" && action !== null && "href" in action ? (
            <Link href={action.href} className={buttonVariants({ size: "lg" })}>{action.label}</Link>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, children }: { title?: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center" role="alert">
      <AlertTriangle className="mb-3 size-6 text-destructive" />
      <h3 className="font-semibold text-navy-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title, description, actions, eyebrow,
}: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1 text-electric">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "default" | "brand" }) {
  return (
    <div className={cn("rounded-2xl border p-4", tone === "brand" ? "border-navy-900 bg-navy-900 text-white" : "border-border bg-white")}>
      <div className="flex items-center justify-between">
        <p className={cn("text-[13px] font-medium", tone === "brand" ? "text-white/70" : "text-muted-foreground")}>{label}</p>
        {Icon && <Icon className={cn("size-4", tone === "brand" ? "text-cyan" : "text-electric")} />}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className={cn("mt-0.5 text-xs", tone === "brand" ? "text-white/60" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}
