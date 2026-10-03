import { NativeSelect } from "@/components/common/field";
import { LOCATIONS, TRANSMISSIONS } from "@/lib/constants";
import { todayManila } from "@/lib/format";
import type { SearchParams } from "@/lib/queries";

/** GET form; works without JavaScript. */
export function ExploreFilters({ p, categories, action = "/explore", lockLocation }: { p: SearchParams; categories: { slug: string; label: string }[]; action?: string; lockLocation?: boolean }) {
  const label = "mb-1.5 block text-xs font-semibold text-navy-900";
  const check = "flex items-center gap-2.5 py-1 text-sm text-navy-800";
  return (
    <form action={action} className="grid gap-5">
      <div>
        <label className={label} htmlFor="f-q">Search</label>
        <input id="f-q" name="q" defaultValue={p.q} placeholder="Vios, Innova, business…" className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm" />
      </div>
      {!lockLocation && (
        <div>
          <label className={label} htmlFor="f-loc">Location</label>
          <NativeSelect id="f-loc" name="location" defaultValue={p.location ?? ""}>
            <option value="">All of Cebu</option>
            {LOCATIONS.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
          </NativeSelect>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><label className={label} htmlFor="f-from">Pickup</label><input id="f-from" type="date" name="from" min={todayManila()} defaultValue={p.from} className="h-10 w-full rounded-xl border border-input bg-white px-2 text-sm" /></div>
        <div><label className={label} htmlFor="f-to">Return</label><input id="f-to" type="date" name="to" min={todayManila(1)} defaultValue={p.to} className="h-10 w-full rounded-xl border border-input bg-white px-2 text-sm" /></div>
      </div>
      <div>
        <label className={label} htmlFor="f-type">Vehicle type</label>
        <NativeSelect id="f-type" name="type" defaultValue={p.type ?? ""}>
          <option value="">Any type</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </NativeSelect>
      </div>
      <div>
        <span className={label}>Price per day (₱)</span>
        <div className="grid grid-cols-2 gap-2">
          <input name="min" type="number" min={0} step={100} placeholder="Min" defaultValue={p.min} aria-label="Minimum price" className="h-10 rounded-xl border border-input bg-white px-3 text-sm" />
          <input name="max" type="number" min={0} step={100} placeholder="Max" defaultValue={p.max} aria-label="Maximum price" className="h-10 rounded-xl border border-input bg-white px-3 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="f-tr">Transmission</label>
          <NativeSelect id="f-tr" name="transmission" defaultValue={p.transmission ?? ""}>
            <option value="">Any</option>
            {TRANSMISSIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </NativeSelect>
        </div>
        <div>
          <label className={label} htmlFor="f-seats">Seats</label>
          <NativeSelect id="f-seats" name="seats" defaultValue={p.seats ?? ""}>
            <option value="">Any</option>
            {[4, 5, 7, 8, 10, 12].map((n) => <option key={n} value={n}>{n}+</option>)}
          </NativeSelect>
        </div>
      </div>
      <fieldset>
        <legend className={label}>Service</legend>
        <label className={check}><input type="checkbox" name="selfDrive" value="1" defaultChecked={p.selfDrive === "1"} className="size-4 accent-[var(--electric)]" /> Self-drive</label>
        <label className={check}><input type="checkbox" name="driver" value="1" defaultChecked={p.driver === "1"} className="size-4 accent-[var(--electric)]" /> With driver</label>
        <label className={check}><input type="checkbox" name="delivery" value="1" defaultChecked={p.delivery === "1"} className="size-4 accent-[var(--electric)]" /> Delivery available</label>
      </fieldset>
      <div>
        <label className={label} htmlFor="f-rating">Rating</label>
        <NativeSelect id="f-rating" name="rating" defaultValue={p.rating ?? ""}>
          <option value="">Any rating</option>
          <option value="4.5">4.5 ★ & up</option>
          <option value="4">4 ★ & up</option>
          <option value="3">3 ★ & up</option>
        </NativeSelect>
      </div>
      <p className="rounded-xl bg-electric/5 px-3 py-2 text-xs text-navy-800">✓ Every business on 13C is verified before it can list cars.</p>
      {p.sort && <input type="hidden" name="sort" value={p.sort} />}
      <button className="h-11 rounded-full bg-navy-900 text-sm font-semibold text-white hover:bg-electric">Apply filters</button>
    </form>
  );
}
