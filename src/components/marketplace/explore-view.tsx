import Link from "next/link";
import { Car, SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/common/states";
import { BusinessCard } from "@/components/marketplace/business-card";
import { ExploreFilters } from "@/components/marketplace/filters";
import { VehicleCard } from "@/components/marketplace/vehicle-card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatRange } from "@/lib/format";
import { getCategories, getFeaturedBusinesses, PAGE_SIZE, searchVehicles, type SearchParams } from "@/lib/queries";

const SORTS = [["recommended", "Recommended"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["newest", "Newest"]] as const;

export async function ExploreView({ p, title, basePath, lockLocation, view }: { p: SearchParams; title: string; basePath: string; lockLocation?: boolean; view?: string }) {
  const categories = await getCategories();
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(Object.entries({ ...p, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${next}`;
  };

  if (view === "businesses") {
    const businesses = await getFeaturedBusinesses(48);
    return (
      <div className="container-page py-8">
        <Tabs view="businesses" basePath={basePath} />
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-navy-900">Rental businesses in Cebu</h1>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{businesses.map((b) => <BusinessCard key={b.id} b={b} />)}</div>
        {businesses.length === 0 && <EmptyState className="mt-6" title="No businesses yet" />}
      </div>
    );
  }

  const { vehicles, total, page } = await searchVehicles(p);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dated = p.from && p.to;
  const carry = dated ? `from=${p.from}&to=${p.to}` : undefined;

  return (
    <div className="container-page py-8">
      <Tabs view="cars" basePath={basePath} />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-navy-900">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} car{total === 1 ? "" : "s"}{dated ? ` available ${formatRange(p.from!, p.to!)}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger className="inline-flex h-10 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold lg:hidden"><SlidersHorizontal className="size-4" /> Filters</SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto rounded-t-3xl p-5">
              <SheetTitle>Filters</SheetTitle>
              <ExploreFilters p={p} categories={categories} action={basePath} lockLocation={lockLocation} />
            </SheetContent>
          </Sheet>
          <div className="flex flex-wrap gap-1">
            {SORTS.map(([key, label]) => (
              <Link key={key} href={qs({ sort: key, page: undefined })} className={cn("rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap", (p.sort ?? "recommended") === key ? "bg-navy-900 text-white" : "bg-white text-navy-800 hover:bg-white/70")}>{label}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block"><div className="sticky top-20 rounded-3xl bg-white p-5 ring-1 ring-black/5"><ExploreFilters p={p} categories={categories} action={basePath} lockLocation={lockLocation} /></div></aside>
        <div>
          {vehicles.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{vehicles.map((v, i) => <VehicleCard key={v.id} v={v} query={carry} priority={i < 3} />)}</div>
          ) : (
            <EmptyState icon={Car} title="No cars match your search" description="Try different dates, a wider area, or fewer filters." action={{ label: "Clear filters", href: basePath }} />
          )}
          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 && <Link href={qs({ page: String(page - 1) })} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-border">Previous</Link>}
              <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
              {page < pages && <Link href={qs({ page: String(page + 1) })} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-border">Next</Link>}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

function Tabs({ view, basePath }: { view: "cars" | "businesses"; basePath: string }) {
  return (
    <div className="flex w-fit gap-1 rounded-full bg-white p-1 ring-1 ring-border">
      <Link href={basePath} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", view === "cars" ? "bg-navy-900 text-white" : "text-navy-800")}>Cars</Link>
      <Link href="/explore?view=businesses" className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", view === "businesses" ? "bg-navy-900 text-white" : "text-navy-800")}>Businesses</Link>
    </div>
  );
}
