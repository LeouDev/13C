"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";
import type { Tables } from "@/types/database";

type Notification = Pick<Tables<"notifications">, "id" | "title" | "body" | "link" | "read_at" | "created_at">;

export function NotificationBell({ userId, initialUnread, tone = "dark" }: { userId: string; initialUnread: number; tone?: "dark" | "light" }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        setUnread((n) => n + 1);
        setItems((list) => (list ? [payload.new as Notification, ...list].slice(0, 12) : list));
        router.refresh();
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [userId, router]);

  async function load(open: boolean) {
    if (!open) return;
    const { data } = await createClient()
      .from("notifications").select("id, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false }).limit(12);
    setItems(data ?? []);
  }

  async function markAll() {
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null);
  }

  return (
    <Popover onOpenChange={load}>
      <PopoverTrigger
        className={cn("relative grid size-10 place-items-center rounded-full transition", tone === "dark" ? "hover:bg-black/5" : "text-white hover:bg-white/10")}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[10px] leading-4 font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && <button onClick={markAll} className="text-xs font-semibold text-electric hover:underline">Mark all read</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            items.map((n) => (
              <Link key={n.id} href={n.link ?? "/notifications"} className="flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/60">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-electric")} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy-900">{n.title}</span>
                  {n.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </span>
              </Link>
            ))
          )}
        </div>
        <Link href="/notifications" className="block border-t px-4 py-2.5 text-center text-xs font-semibold text-electric hover:bg-muted/60">View all</Link>
      </PopoverContent>
    </Popover>
  );
}
