"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2, CalendarCheck, CalendarDays, Car, ClipboardList, Ellipsis, House, LayoutDashboard, LogIn, MessageSquare, UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { HoverPrefetchLink } from "@/components/common/hover-prefetch-link";
import { OPEN_DASHBOARD_MENU } from "@/components/dashboard/mobile-nav";

type Tab = { label: string; icon: LucideIcon; active: boolean; badge?: number } & ({ href: string } | { onClick: () => void });

/**
 * The bottom tab bar. It only shows when 13C is opened from the Home Screen on a phone (the `app` variant in
 * globals.css); a browser tab keeps its usual menus. While it shows, --app-bottom lifts what's fixed to the bottom.
 */
function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <>
      <div aria-hidden className="hidden h-[calc(4rem+env(safe-area-inset-bottom))] app:max-lg:block" />
      <nav data-app-tabbar aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl app:max-lg:block">
        <ul className="mx-auto grid h-16 max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const className = cn("flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              t.active ? "text-navy-900" : "text-slate-500");
            const content = (
              <>
                <span className="relative">
                  <t.icon className="size-6" strokeWidth={t.active ? 2.25 : 1.75} />
                  {!!t.badge && (
                    <span className="absolute -top-1.5 left-4 grid min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[10px] leading-4 font-bold text-white">
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  )}
                </span>
                {t.label}
              </>
            );
            return (
              <li key={t.label}>
                {"href" in t
                  ? <HoverPrefetchLink href={t.href} aria-current={t.active ? "page" : undefined} className={className}>{content}</HoverPrefetchLink>
                  : <button type="button" onClick={t.onClick} className={className}>{content}</button>}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Pages that need the whole screen: a chat, signing an agreement, signing in. */
const SITE_FULL_SCREEN = [/^\/account\/messages\/[^/]+/, /^\/account\/bookings\/[^/]+\/contract/, /^\/(login|signup)(\/|$)/, /^\/account\/security/];

/** Renters and visitors (the site and stores). Needs a Suspense boundary (search params). */
export function SiteTabBar({ signedIn, unread }: { signedIn: boolean; unread: number }) {
  const path = usePathname();
  const view = useSearchParams().get("view");
  const businesses = path === "/explore" && view === "businesses";
  if (SITE_FULL_SCREEN.some((page) => page.test(path))) return null;
  const home = { href: "/", label: "Home", icon: House, active: path === "/" };
  const cars = { href: "/explore", label: "Find a car", icon: Car, active: path === "/explore" && !businesses };
  return (
    <TabBar tabs={signedIn ? [
      home, cars,
      { href: "/account/bookings", label: "Bookings", icon: CalendarCheck, active: path.startsWith("/account/bookings") },
      { href: "/account/messages", label: "Messages", icon: MessageSquare, active: path.startsWith("/account/messages"), badge: unread },
      { href: "/account", label: "Account", icon: UserRound, active: path === "/account" || path.startsWith("/account/favorites") },
    ] : [
      home, cars,
      { href: "/explore?view=businesses", label: "Businesses", icon: Building2, active: businesses },
      { href: "/login", label: "Sign in", icon: LogIn, active: false },
    ]} />
  );
}

/** The business dashboard. "More" opens the full dashboard menu. */
export function DashboardTabBar({ badges }: { badges: { requests: number; unread: number } }) {
  const path = usePathname();
  if (/^\/dashboard\/messages\/[^/]+/.test(path)) return null;
  return (
    <TabBar tabs={[
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: path === "/dashboard" },
      { href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList, active: path.startsWith("/dashboard/bookings"), badge: badges.requests },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, active: path.startsWith("/dashboard/messages"), badge: badges.unread },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, active: path.startsWith("/dashboard/calendar") },
      { label: "More", icon: Ellipsis, active: false, onClick: () => window.dispatchEvent(new Event(OPEN_DASHBOARD_MENU)) },
    ]} />
  );
}
