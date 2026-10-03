import { CalendarDays, Car, MapPin, Search } from "lucide-react";
import { cn } from "cn";
import { LOCATIONS } from "@/lib/constants";
import { todayManila } from "@/lib/format";

/** Plain GET form → /explore. Native date/select inputs give phones their native pickers. */
export function SearchBar({
  categories, defaults = {}, className,
}: { categories: { slug: string; label: string }[]; defaults?: Record<string, string | undefined>; className?: string }) {
  const field = "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-2.5 transition focus-within:bg-canvas hover:bg-canvas";
  const label = "block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";
  const input = "w-full bg-transparent text-[15px] font-semibold text-navy-900 outline-none";
  return (
    <form action="/explore" className={cn("grid gap-1 rounded-[1.75rem] bg-white p-2 shadow-[0_24px_60px_-24px_rgba(10,20,48,0.45)] md:flex md:items-center", className)}>
      <label className={field}>
        <MapPin className="size-5 shrink-0 text-electric" />
        <span className="min-w-0 flex-1">
          <span className={label}>Pickup location</span>
          <select name="location" defaultValue={defaults.location ?? ""} className={cn(input, "appearance-none")}>
            <option value="">All of Cebu</option>
            {LOCATIONS.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
          </select>
        </span>
      </label>
      <span className="hidden h-10 w-px bg-border md:block" />
      <label className={field}>
        <CalendarDays className="size-5 shrink-0 text-electric" />
        <span className="min-w-0 flex-1">
          <span className={label}>Pickup date</span>
          <input type="date" name="from" min={todayManila()} defaultValue={defaults.from} className={input} />
        </span>
      </label>
      <span className="hidden h-10 w-px bg-border md:block" />
      <label className={field}>
        <CalendarDays className="size-5 shrink-0 text-electric" />
        <span className="min-w-0 flex-1">
          <span className={label}>Return date</span>
          <input type="date" name="to" min={todayManila(1)} defaultValue={defaults.to} className={input} />
        </span>
      </label>
      <span className="hidden h-10 w-px bg-border md:block" />
      <label className={field}>
        <Car className="size-5 shrink-0 text-electric" />
        <span className="min-w-0 flex-1">
          <span className={label}>Vehicle type</span>
          <select name="type" defaultValue={defaults.type ?? ""} className={cn(input, "appearance-none")}>
            <option value="">Any type</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </span>
      </label>
      <button type="submit" className="mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-[1.25rem] bg-navy-900 px-7 text-[15px] font-semibold text-white transition hover:bg-electric md:mt-0">
        <Search className="size-5" /> Search Cars
      </button>
    </form>
  );
}
