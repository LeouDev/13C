"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const NAV = [
  ["/admin", "Overview"], ["/admin/businesses", "Businesses"], ["/admin/verification", "Verification"],
  ["/admin/vehicles", "Vehicles"], ["/admin/users", "Users"], ["/admin/bookings", "Bookings"],
  ["/admin/contracts", "Contracts"], ["/admin/reviews", "Reviews"], ["/admin/reports", "Reports"],
  ["/admin/subscriptions", "Subscriptions"], ["/admin/emails", "Emails"], ["/admin/settings", "Settings"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:grid lg:overflow-visible" aria-label="Admin">
      {NAV.map(([href, label]) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition",
            active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
