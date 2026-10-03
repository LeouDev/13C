"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "cn";

const QUEUE = "/admin/businesses?status=queue";
const NAV = [
  ["/admin", "Overview"], ["/admin/businesses", "Businesses"], [QUEUE, "Verification"],
  ["/admin/vehicles", "Vehicles"], ["/admin/users", "Users"], ["/admin/bookings", "Bookings"],
  ["/admin/contracts", "Contracts"], ["/admin/reviews", "Reviews"], ["/admin/reports", "Reports"],
  ["/admin/subscriptions", "Subscriptions"], ["/admin/emails", "Emails"], ["/admin/settings", "Settings"],
] as const;

export function AdminNav() {
  const path = usePathname();
  const status = useSearchParams().get("status");
  // The verification queue is the Businesses list filtered to "Needs review", so it lights up instead of Businesses.
  const inQueue = path === "/admin/businesses" && status === "queue";
  const activeRef = useRef<HTMLAnchorElement>(null);
  // On phones the nav is a scrolling row: centre the current item in it (never scrolls the page).
  useEffect(() => {
    const a = activeRef.current, nav = a?.parentElement;
    if (!a || !nav || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft += a.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - a.offsetWidth) / 2;
  }, [path, inQueue]);
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:grid lg:overflow-visible" aria-label="Admin">
      {NAV.map(([href, label]) => {
        const active = href === "/admin" ? path === href : href === QUEUE ? inQueue : path.startsWith(href) && !(href === "/admin/businesses" && inQueue);
        return (
          <Link key={href} ref={active ? activeRef : undefined} href={href} aria-current={active ? "page" : undefined} className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition",
            active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
