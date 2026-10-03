"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { switchBusiness } from "@/app/actions/business";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Biz = { id: string; name: string; logo_path: string | null; role: string };

export function BusinessSwitcher({ current, all }: { current: Biz; all: Biz[] }) {
  const [, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-2xl border bg-white p-2 text-left outline-none hover:bg-canvas focus-visible:ring-3 focus-visible:ring-ring/50">
        <BusinessLogo path={current.logo_path} name={current.name} className="size-9 rounded-xl text-sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-navy-900">{current.name}</span>
          <span className="block text-[11px] text-muted-foreground capitalize">{current.role.toLowerCase()}</span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {all.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => start(() => switchBusiness(b.id))}>
            <BusinessLogo path={b.logo_path} name={b.name} className="size-6 rounded-md text-[10px]" />
            <span className="truncate">{b.name}</span>
            {b.id === current.id && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/register/business?new=1" />}><Plus /> Add another business</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
