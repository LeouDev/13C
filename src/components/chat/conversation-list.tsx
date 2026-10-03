import Link from "next/link";
import { cn } from "cn";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";

export type ConversationItem = {
  id: string; title: string; subtitle?: string | null; preview: string | null; at: string; unread: boolean;
  logo?: { path: string | null; name: string } | null;
};

export function ConversationList({ items, hrefBase, activeId }: { items: ConversationItem[]; hrefBase: string; activeId?: string }) {
  return (
    <ul className="divide-y">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`${hrefBase}/${c.id}`} className={cn("flex items-center gap-3 px-4 py-3 transition hover:bg-canvas", activeId === c.id && "bg-canvas")}>
            {c.logo ? <BusinessLogo path={c.logo.path} name={c.logo.name} className="size-11 rounded-xl text-sm" /> : (
              <Avatar className="size-11"><AvatarFallback className="bg-navy-900 text-xs font-semibold text-white">{initials(c.title)}</AvatarFallback></Avatar>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", c.unread ? "font-bold text-navy-900" : "font-medium text-navy-800")}>{c.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.at)}</span>
              </span>
              {c.subtitle && <span className="block truncate text-xs text-electric">{c.subtitle}</span>}
              <span className={cn("block truncate text-xs", c.unread ? "text-navy-900" : "text-muted-foreground")}>{c.preview ?? "No messages yet"}</span>
            </span>
            {c.unread && <span className="size-2.5 shrink-0 rounded-full bg-brand-red" aria-label="Unread" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
