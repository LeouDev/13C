import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "cn";
import { HoverPrefetchLink } from "@/components/common/hover-prefetch-link";
import type { ChecklistItem } from "@/lib/dashboard";

const GROUPS = [["required", "Needed to go live"], ["recommended", "Recommended"], ["optional", "Optional"]] as const;

/** The store checklist (getStoreChecklist), grouped: what publishing needs, what's recommended, and optional extras. */
export function StoreChecklistGroups({ items, className }: { items: ChecklistItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-5", className)}>
      {GROUPS.map(([tier, title]) => {
        const group = items.filter((i) => i.tier === tier);
        if (!group.length) return null;
        return (
          <div key={tier}>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {title} · {group.filter((i) => i.done).length} of {group.length}
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {group.map((s) => (
                <li key={s.key}>
                  <HoverPrefetchLink href={s.href} className="flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-canvas">
                    {s.done
                      ? <CheckCircle2 className="mt-px size-5 shrink-0 text-emerald-600" />
                      : <Circle className={cn("mt-px size-5 shrink-0", tier === "required" ? "text-amber-500" : "text-slate-300")} />}
                    <span className="min-w-0">
                      <span className={s.done ? "text-muted-foreground line-through decoration-slate-300" : "font-medium text-navy-900"}>{s.label}</span>
                      {!s.done && s.hint && <span className="block text-xs text-muted-foreground">{s.hint}</span>}
                    </span>
                  </HoverPrefetchLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
