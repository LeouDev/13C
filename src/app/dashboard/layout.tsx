import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardMobileNav } from "@/components/dashboard/mobile-nav";
import { PlanBanner } from "@/components/dashboard/plan-banner";
import { DashboardHelp } from "@/components/site/assistant-widget";
import { NotificationBell } from "@/components/site/notification-bell";
import { requireBusiness } from "@/lib/auth";
import { storeDisplayUrl } from "@/lib/constants";
import { getSubscription } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · 13C Dashboard" }, robots: { index: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user, business, role, memberships } = await requireBusiness();
  const supabase = await createClient();
  const [requests, convos, notes, sub] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "PENDING_OWNER_APPROVAL"),
    supabase.from("conversations").select("last_message_at, business_last_read_at, last_sender_role").eq("business_id", business.id).eq("last_sender_role", "CUSTOMER").limit(200),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    getSubscription(business.id).then((data) => ({ data })),
  ]);
  const unread = (convos.data ?? []).filter((c) => !c.business_last_read_at || c.business_last_read_at < c.last_message_at).length;
  const badges = { requests: requests.count ?? 0, unread };

  const switcher = (
    <BusinessSwitcher
      current={{ id: business.id, name: business.name, logo_path: business.logo_path, role }}
      all={memberships.map((m) => ({ id: m.business.id, name: m.business.name, logo_path: m.business.logo_path, role: m.role }))}
    />
  );

  return (
    <div className="flex min-h-svh bg-canvas">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-white p-4 lg:flex">
        <Link href="/" aria-label="13C home" className="px-2 pt-1"><Logo className="h-7" /></Link>
        {switcher}
        <DashboardNav badges={badges} />
        <p className="mt-auto px-2 text-[11px] text-muted-foreground">Signed in as {user.email}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-white/90 px-3 backdrop-blur sm:px-6">
          <DashboardMobileNav badges={badges} header={switcher} />
          <Link href="/" className="lg:hidden" aria-label="13C home"><Logo className="h-6" /></Link>
          <Link prefetch={false} href={`/${business.slug}`} target="_blank" className="ml-auto hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-canvas sm:flex">
            {storeDisplayUrl(business.slug)} <ExternalLink className="size-3.5" />
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:ml-0"><DashboardHelp /><NotificationBell userId={user.id} initialUnread={notes.count ?? 0} /></div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"><PlanBanner sub={sub.data} />{children}</main>
      </div>
    </div>
  );
}
