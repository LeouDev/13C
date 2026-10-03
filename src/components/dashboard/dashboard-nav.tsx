"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3, Building2, CalendarDays, Car, ClipboardList, CreditCard, FileSignature, Gem, Inbox,
  LayoutDashboard, MessageSquare, Settings, Star, Store, Users, Wrench,
} from "lucide-react";
import { cn } from "cn";
import { HoverPrefetchLink } from "@/components/common/hover-prefetch-link";

export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/store", label: "My Store", icon: Store },
  { href: "/dashboard/vehicles", label: "Vehicles", icon: Car },
  { href: "/dashboard/fleet", label: "Fleet", icon: Wrench },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList, badge: "requests" },
  { href: "/dashboard/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, badge: "unread" },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/contracts", label: "Contracts", icon: FileSignature },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/profile", label: "Business Profile", icon: Building2 },
  { href: "/dashboard/payments", label: "Payment Settings", icon: CreditCard },
  { href: "/dashboard/subscription", label: "Subscription", icon: Gem },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardNav({ badges, onNavigate }: { badges: { requests: number; unread: number }; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5" aria-label="Dashboard">
      {DASHBOARD_NAV.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        const count = "badge" in item ? badges[item.badge] : 0;
        return (
          <HoverPrefetchLink key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-canvas")}>
            <item.icon className={cn("size-[18px]", active ? "text-cyan" : "text-navy-700/70")} />
            {item.label}
            {count > 0 && (
              <span className={cn("ml-auto rounded-full px-1.5 text-[11px] font-bold leading-5", active ? "bg-white/15" : "bg-brand-red text-white")}>{count}</span>
            )}
          </HoverPrefetchLink>
        );
      })}
    </nav>
  );
}
