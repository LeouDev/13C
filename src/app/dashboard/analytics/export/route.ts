import { NextResponse, type NextRequest } from "next/server";
import { hasRole, requireBusiness } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { businessPlanActive } from "@/lib/plans";
import { getSubscription } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

const manila = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(iso)).replace(", ", " ") : "";

/** Bookings made in the last N days as CSV (Business plan; owners and managers, since it lists renters' contact details). */
export async function GET(request: NextRequest) {
  const { business, role } = await requireBusiness();
  if (!hasRole(role, "MANAGER")) return new NextResponse("Only owners and managers can export bookings.", { status: 403 });
  if (!businessPlanActive(await getSubscription(business.id))) {
    return new NextResponse("CSV export is on the Business plan.", { status: 403 });
  }
  const days = [7, 30, 90, 365].includes(Number(request.nextUrl.searchParams.get("days"))) ? Number(request.nextUrl.searchParams.get("days")) : 30;
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings")
    .select("reference, status, created_at, pickup_at, return_at, pickup_location, return_location, rental_days, total_amount, security_deposit, payment_method, payment_status, vehicles(year, make, model, plate_number), renter:profiles!bookings_renter_id_fkey(full_name, email, phone)")
    .eq("business_id", business.id).gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString())
    .order("created_at", { ascending: false }).limit(5000);
  if (error) return new NextResponse("Couldn't export bookings. Please try again.", { status: 500 });

  const csv = toCsv([
    ["Reference", "Status", "Booked at", "Pickup", "Return", "Pickup location", "Return location", "Days", "Vehicle", "Plate",
      "Renter", "Renter email", "Renter phone", "Total (PHP)", "Deposit (PHP)", "Payment method", "Payment status"],
    ...(data ?? []).map((b) => [
      b.reference, b.status, manila(b.created_at), manila(b.pickup_at), manila(b.return_at), b.pickup_location, b.return_location, b.rental_days,
      b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "", b.vehicles?.plate_number,
      b.renter?.full_name, b.renter?.email, b.renter?.phone, Number(b.total_amount), Number(b.security_deposit), b.payment_method, b.payment_status,
    ]),
  ]);
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="13C-${business.slug}-bookings-${days}d-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
