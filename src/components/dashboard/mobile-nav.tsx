"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Opens this menu from elsewhere (the Home Screen app's "More" tab, components/site/app-tab-bar.tsx). */
export const OPEN_DASHBOARD_MENU = "13c:dashboard-menu";

export function DashboardMobileNav({ badges, header }: { badges: { requests: number; unread: number }; header: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_DASHBOARD_MENU, show);
    return () => window.removeEventListener(OPEN_DASHBOARD_MENU, show);
  }, []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="grid size-10 place-items-center rounded-full hover:bg-black/5 lg:hidden" aria-label="Open dashboard menu">
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-xs gap-4 overflow-y-auto p-4">
        <SheetTitle className="sr-only">Dashboard menu</SheetTitle>
        {header}
        <DashboardNav badges={badges} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
