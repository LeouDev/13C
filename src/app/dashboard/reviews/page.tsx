import type { Metadata } from "next";
import { Star } from "lucide-react";
import { ReviewResponse } from "@/components/booking/booking-actions";
import { Rating, Stars } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { hasRole, requireBusiness } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getStats } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();
  const [{ data }, stats] = await Promise.all([
    supabase.from("reviews").select("id, rating, vehicle_rating, business_rating, comment, business_response, created_at, is_hidden, vehicles(make, model), renter:profiles!reviews_renter_id_fkey(full_name)")
      .eq("business_id", business.id).order("created_at", { ascending: false }),
    getStats([business.id]),
  ]);
  const s = stats.get(business.id);
  return (
    <>
      <PageHeader eyebrow="Reputation" title="Reviews" description="Only renters with a completed booking can review you. Respond publicly to show you care." actions={<Rating value={s?.rating} count={s?.review_count} className="text-base" />} />
      {!data?.length ? <EmptyState icon={Star} title="No reviews yet" description="Completed rentals prompt renters to leave a review." /> : (
        <ul className="grid gap-3">
          {data.map((r) => (
            <li key={r.id} className="rounded-3xl border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Stars value={r.rating} /><span className="text-sm font-semibold">{r.renter?.full_name}</span><span className="text-xs text-muted-foreground">· {r.vehicles?.make} {r.vehicles?.model}</span></div>
                <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}{r.is_hidden ? " · hidden by 13C" : ""}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Vehicle {r.vehicle_rating ?? "—"}/5 · Business {r.business_rating ?? "—"}/5</p>
              {r.comment && <p className="mt-3 text-sm text-navy-800">{r.comment}</p>}
              {hasRole(role, "MANAGER") ? <div className="mt-4"><ReviewResponse reviewId={r.id} initial={r.business_response} /></div>
                : r.business_response && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm">{r.business_response}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
