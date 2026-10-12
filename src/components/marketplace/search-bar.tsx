import { CalendarDays, Car, MapPin, Search } from "lucide-react";
import { cn } from "cn";
import { DateInput } from "@/components/common/date-input";
import { PROVINCES } from "@/lib/constants";
import { todayManila } from "@/lib/format";
import { placeLabel, type Province } from "@/lib/queries";

/** Suggestions while typing a location: places with cars first (cities, then provinces), then every other province. */
export function PlaceSuggestions({ id, provinces }: { id: string; provinces: Province[] }) {
  const withCars = [...provinces.flatMap((p) => p.cities), ...provinces].map(placeLabel);
  return (
    <datalist id={id}>
      {[...new Set([...withCars, ...PROVINCES])].map((label) => <option key={label} value={label} />)}
    </datalist>
  );
}

/** Plain GET form → /explore. Native date/select inputs give phones their native pickers. */
export function SearchBar({
  categories, provinces, defaults = {}, className,
}: { categories: { slug: string; label: string }[]; provinces: Province[]; defaults?: Record<string, string | undefined>; className?: string }) {
  const field = "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-2.5 transition focus-within:bg-canvas hover:bg-canvas";
  const label = "block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";
  const input = "w-full bg-transparent text-[15px] font-semibold text-navy-900 outline-none";
  return (
    <form action="/explore" className={cn("grid gap-1 rounded-[1.75rem] bg-white p-2 shadow-[0_24px_60px_-24px_rgba(10,20,48,0.45)] md:flex md:items-center", className)}>
      <label className={field}>
        <MapPin className="size-5 shrink-0 text-electric" />
        <span className="min-w-0 flex-1">
          <span className={label}>Pickup location</span>
          <input name="location" list="places-home" defaultValue={defaults.location ?? ""} placeholder="Any city or province" autoComplete="off" enterKeyHint="search"
            className={cn(input, "placeholder:text-navy-900")} />
          <PlaceSuggestions id="places-home" provinces={provinces} />
        </span>
      </label>
      <span className="hidden h-10 w-px bg-border md:block" />
      <label className={field}>
        <CalendarDays className="size-5 shrink-0 text-electric" />
        <span className="min-w-0 flex-1">
          <span className={label}>Pickup date</span>
          <DateInput name="from" min={todayManila()} defaultValue={defaults.from} placeholder="Any date" className={cn(input, "[&::-webkit-calendar-picker-indicator]:hidden")} />
        </span>
      </label>
      <span className="hidden h-10 w-px bg-border md:block" />
      <label className={field}>
        <CalendarDays className="size-5 shrink-0 text-electric" />
        <span className="min-w-0 flex-1">
          <span className={label}>Return date</span>
          <DateInput name="to" min={todayManila(1)} defaultValue={defaults.to} placeholder="Any date" className={cn(input, "[&::-webkit-calendar-picker-indicator]:hidden")} />
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
