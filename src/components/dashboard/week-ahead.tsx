import { KeyRound, Undo2 } from "lucide-react";
import { cn } from "cn";
import { HoverPrefetchLink } from "@/components/common/hover-prefetch-link";
import { weekAhead } from "@/lib/calendar";
import { formatDate, formatTime, isoToManilaDate, plural } from "@/lib/format";

type Booking = {
  id: string; status: string; pickup_at: string; return_at: string; pickup_location: string; return_location: string;
  vehicles: { make: string; model: string } | null; renter: { full_name: string | null } | null;
};

const noon = (day: string) => `${day}T12:00:00+08:00`;

/** The dashboard's next 7 days: pickups and returns per day, then each one in time order. */
export function WeekAhead({ bookings, days }: { bookings: Booking[]; days: string[] }) {
  const events = weekAhead(bookings, days);
  return (
    <section className="rounded-3xl border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-navy-900">This week</h2>
        <HoverPrefetchLink href="/dashboard/calendar" className="text-xs font-semibold text-electric hover:underline">Open calendar</HoverPrefetchLink>
      </div>
      <ol className="grid grid-cols-7 gap-1 text-center">
        {days.map((day, i) => {
          const on = events.filter((e) => isoToManilaDate(e.at) === day);
          const pickups = on.filter((e) => e.kind === "pickup").length, returns = on.length - pickups;
          return (
            <li key={day} className={cn("rounded-2xl px-0.5 py-2", i === 0 ? "bg-navy-900 text-white" : "bg-canvas text-navy-900")}>
              <p className="text-[11px] font-medium opacity-70">{i === 0 ? "Today" : formatDate(noon(day), { weekday: "short" })}</p>
              <p className="font-display text-lg leading-tight font-bold">{formatDate(noon(day), { day: "numeric" })}</p>
              <p className="mt-1 flex h-2 justify-center gap-0.5" aria-label={on.length ? `${plural(pickups, "pickup")}, ${plural(returns, "return")}` : "Nothing"}>
                {Array.from({ length: Math.min(pickups, 3) }, (_, k) => <span key={`p${k}`} className="size-1.5 rounded-full bg-electric" />)}
                {Array.from({ length: Math.min(returns, 3) }, (_, k) => <span key={`r${k}`} className="size-1.5 rounded-full bg-amber-500" />)}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-electric" /> Pickup</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" /> Return</span>
      </p>
      {events.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-canvas p-4 text-sm text-muted-foreground">No pickups or returns in the next 7 days.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {events.map((e) => {
            const pickup = e.kind === "pickup", Icon = pickup ? KeyRound : Undo2;
            return (
              <li key={`${e.booking.id}-${e.kind}`}>
                <HoverPrefetchLink href={`/dashboard/bookings/${e.booking.id}`} className="flex items-center gap-3 py-2.5 hover:bg-canvas/60">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", pickup ? "bg-electric/10 text-electric" : "bg-amber-50 text-amber-600")}><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-900">{pickup ? "Pickup" : "Return"} · {e.booking.vehicles?.make} {e.booking.vehicles?.model}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.booking.renter?.full_name ?? "Renter"} · {pickup ? e.booking.pickup_location : e.booking.return_location}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className="font-semibold text-navy-900">{isoToManilaDate(e.at) === days[0] ? "Today" : formatDate(e.at, { weekday: "short", month: "short", day: "numeric" })}</p>
                    <p className="text-muted-foreground">{formatTime(e.at)}</p>
                  </div>
                </HoverPrefetchLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
