import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "cn";
import { markAllNotificationsRead } from "@/app/actions/account";
import { EmptyState, PageHeader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  await requireUser("/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).some((n) => !n.read_at);
  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title="Notifications" actions={unread && <form action={markAllNotificationsRead}><Button variant="outline" type="submit">Mark all read</Button></form>} />
      {!data?.length ? <EmptyState icon={Bell} title="You're all caught up" /> : (
        <ul className="divide-y overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
          {data.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? "#"} className="flex gap-3 px-5 py-4 hover:bg-canvas">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-electric")} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-navy-900">{n.title}</span>{n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
