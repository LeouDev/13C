import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { ListFilters } from "@/components/admin/list-filters";
import { ReviewVisibility } from "@/components/admin/review-visibility";
import { Pill, Stars } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "cn";

export const metadata: Metadata = { title: "Reviews" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "visible", label: "Visible" },
  { key: "hidden", label: "Hidden" },
  { key: "low", label: "1–2 stars" },
];

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const { status = "all" } = (await searchParams) as { status?: string };
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0]!;
  const supabase = await createClient();
  let query = supabase.from("reviews")
    .select("id, rating, vehicle_rating, business_rating, comment, business_response, created_at, is_hidden, businesses(id, name), vehicles(make, model, year), bookings(reference), renter:profiles!reviews_renter_id_fkey(id, full_name)")
    .order("created_at", { ascending: false }).limit(200);
  if (filter.key === "visible") query = query.eq("is_hidden", false);
  if (filter.key === "hidden") query = query.eq("is_hidden", true);
  if (filter.key === "low") query = query.lte("rating", 2);
  const { data: rows } = await query;

  return (
    <>
      <PageHeader title="Reviews" description="Moderate renter reviews. Hidden reviews are removed from storefronts and ratings but kept on record." />
      <ListFilters basePath="/admin/reviews" options={FILTERS} active={filter.key} />
      {!rows?.length ? <EmptyState icon={Star} title="No reviews here" /> : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id} className={cn("rounded-2xl border bg-white p-4 sm:p-5", r.is_hidden && "border-dashed bg-white/60")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="text-sm font-semibold">{r.rating}/5</span>
                    {r.is_hidden && <Pill tone="warning">Hidden</Pill>}
                    <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    {r.businesses ? <Link href={`/admin/businesses/${r.businesses.id}`} className="font-semibold text-navy-900 hover:text-electric">{r.businesses.name}</Link> : "—"}
                    {r.vehicles && <span className="text-muted-foreground"> · {r.vehicles.year} {r.vehicles.make} {r.vehicles.model}</span>}
                  </p>
                </div>
                <ReviewVisibility reviewId={r.id} hidden={r.is_hidden} />
              </div>
              {r.comment ? <p className="mt-3 text-sm whitespace-pre-line text-navy-900">{r.comment}</p> : <p className="mt-3 text-sm text-muted-foreground italic">No written comment.</p>}
              {!!(r.vehicle_rating || r.business_rating) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.vehicle_rating ? `Vehicle ${r.vehicle_rating}/5` : ""}{r.vehicle_rating && r.business_rating ? " · " : ""}{r.business_rating ? `Business ${r.business_rating}/5` : ""}
                </p>
              )}
              {r.business_response && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm"><span className="font-semibold">Business response: </span>{r.business_response}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                By {r.renter ? <Link href={`/admin/users/${r.renter.id}`} className="font-medium hover:text-electric">{r.renter.full_name}</Link> : "—"}
                {r.bookings && <> · booking <span className="font-mono">{r.bookings.reference}</span></>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
