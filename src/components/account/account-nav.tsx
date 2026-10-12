"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const NAV = [["/account/bookings", "Bookings"], ["/account/messages", "Messages"], ["/account/favorites", "Saved"], ["/account", "Account"]] as const;

export function AccountNav() {
  const path = usePathname();
  if (path === "/account/security") return null; // the reset-link page shows only the new-password form
  return (
    <nav className="flex w-full gap-0.5 overflow-x-auto sm:gap-1 rounded-full bg-white p-1 ring-1 ring-border sm:w-fit" aria-label="Account">
      {NAV.map(([href, label]) => {
        const active = href === "/account" ? path === href : path.startsWith(href);
        return <Link key={href} href={href} className={cn("rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap sm:px-4", active ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-canvas")}>{label}</Link>;
      })}
    </nav>
  );
}
