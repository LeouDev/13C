"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, CalendarDays, ImageIcon, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { archiveVehicle, setVehicleStatus } from "@/app/actions/vehicles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VEHICLE_STATUSES } from "@/lib/constants";
import type { Enums } from "@/types/database";

export function VehicleRowActions({ id, status }: { id: string; status: Enums<"vehicle_status"> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(r.message ?? "Updated"); router.refresh(); } else toast.error(r.error);
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} className="grid size-9 place-items-center rounded-full hover:bg-canvas" aria-label="Vehicle actions"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={`/dashboard/vehicles/${id}`} />}><Pencil /> Edit details</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/dashboard/vehicles/${id}?tab=photos`} />}><ImageIcon /> Photos</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/dashboard/vehicles/${id}?tab=availability`} />}><CalendarDays /> Availability</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          {VEHICLE_STATUSES.filter((s) => s.value !== status).map((s) => (
            <DropdownMenuItem key={s.value} onClick={() => run(() => setVehicleStatus(id, s.value))}>{s.label}</DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => { if (confirm("Archive this vehicle? It will be removed from your store.")) run(() => archiveVehicle(id)); }}><Archive /> Archive</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
