import Link from "next/link";
import { cn } from "cn";

export type FilterOption = { key: string; label: string; count?: number | null };

/**
 * Pill tabs + optional search box for admin list pages.
 * Plain links and a GET form, so it works without JavaScript and stays a server component.
 */
export function ListFilters({
  basePath, options, active, param = "status", q, searchPlaceholder, searchLabel,
}: {
  basePath: string;
  options: FilterOption[];
  active: string;
  param?: string;
  q?: string;
  searchPlaceholder?: string;
  searchLabel?: string;
}) {
  const href = (key: string) => {
    const sp = new URLSearchParams({ [param]: key });
    if (q) sp.set("q", q);
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <nav aria-label="Filters" className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Link
            key={o.key}
            href={href(o.key)}
            aria-current={o.key === active ? "page" : undefined}
            className={cn("rounded-full px-3 py-1.5 text-sm font-medium", o.key === active ? "bg-navy-900 text-white" : "bg-white hover:bg-white/70")}
          >
            {o.label}
            {o.count != null && <span className="ml-1 opacity-60">{o.count}</span>}
          </Link>
        ))}
      </nav>
      {searchPlaceholder && (
        <form role="search" className="w-full sm:ml-auto sm:w-auto">
          <input type="hidden" name={param} value={active} />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={searchPlaceholder}
            aria-label={searchLabel ?? searchPlaceholder}
            className="h-9 w-full rounded-full border bg-white px-4 text-sm sm:w-60"
          />
        </form>
      )}
    </div>
  );
}

/** Splits a search query into safe terms for PostgREST `or=(…)` filters (commas/parens would break the syntax). */
export function searchTerms(q: string | undefined, max = 4) {
  return (q ?? "").replace(/[,()"\\%*]/g, " ").split(/\s+/).filter(Boolean).slice(0, max);
}
