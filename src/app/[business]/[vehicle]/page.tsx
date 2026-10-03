import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Car, Cog, Fuel, Gauge, Palette, Users } from "lucide-react";
import { FavoriteButton } from "@/components/account/account-panels";
import { MonthCalendar } from "@/components/booking/month-calendar";
import { ReportButton } from "@/components/storefront/report-button";
import { Rating, Stars, VerifiedBadge } from "@/components/common/badges";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { BookingWidget } from "@/components/storefront/booking-widget";
import { MessageButton } from "@/components/storefront/message-button";
import { VehicleGallery } from "@/components/storefront/vehicle-gallery";
import { ViewTracker } from "@/components/storefront/view-tracker";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/constants";
import { formatDate, formatPHP, isoDaysFromNow, labelize, responseTimeLabel } from "@/lib/format";
import { plural } from "@/lib/format";
import { getStorefront, getVehicleBySlug } from "@/lib/queries";
import { mediaUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

async function load(slug: string, vehicleSlug: string) {
  const sf = await getStorefront(slug);
  if (!sf) return null;
  const vehicle = await getVehicleBySlug(sf.business.id, vehicleSlug);
  return vehicle ? { ...sf, vehicle } : null;
}

export async function generateMetadata({ params }: PageProps<"/[business]/[vehicle]">): Promise<Metadata> {
  const { business, vehicle } = await params;
  const d = await load(business, vehicle);
  if (!d) return {};
  const v = d.vehicle;
  const title = `${v.year} ${v.make} ${v.model} for rent in ${v.city} — ${formatPHP(v.vehicle_pricing?.daily_rate)}/day · ${d.business.name}`;
  const description = `Rent a ${v.make} ${v.model} (${labelize(v.transmission)}, ${v.seats} seats) from ${d.business.name} in ${v.city}, Cebu. ${v.description?.slice(0, 120) ?? ""}`.trim();
  const image = mediaUrl(v.vehicle_images[0]?.storage_path);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/${d.business.slug}/${v.slug}` },
    openGraph: { title, description, images: image ? [image] : undefined, url: `/${d.business.slug}/${v.slug}` },
    robots: d.business.status === "VERIFIED" && d.store.is_published && v.status === "ACTIVE" ? undefined : { index: false },
  };
}

export default async function VehiclePage({ params, searchParams }: PageProps<"/[business]/[vehicle]">) {
  const { business: slug, vehicle: vehicleSlug } = await params;
  const sp = (await searchParams) as { from?: string; to?: string };
  const d = await load(slug, vehicleSlug);
  if (!d) notFound();
  const { business, store, stats, vehicle: v } = d;
  const p = v.vehicle_pricing;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const horizon = isoDaysFromNow(180);
  const [{ data: ranges }, { data: reviews }, fav] = await Promise.all([
    supabase.rpc("vehicle_unavailable_ranges", { p_vehicle_id: v.id, p_from: isoDaysFromNow(0), p_to: horizon }),
    supabase.rpc("public_reviews", { p_business_id: business.id, p_vehicle_id: v.id, p_limit: 6 }),
    user ? supabase.from("favorites").select("vehicle_id").eq("user_id", user.id).eq("vehicle_id", v.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const name = `${v.make} ${v.model}`;
  const bookable = v.status === "ACTIVE" && business.status === "VERIFIED" && store.is_published;
  const tiles = [
    { icon: Fuel, label: "Fuel", value: labelize(v.fuel_type) },
    { icon: CalendarDays, label: "Year", value: v.year },
    { icon: Users, label: "Seats", value: v.seats },
    { icon: Cog, label: "Transmission", value: labelize(v.transmission) },
    { icon: Car, label: "Type", value: v.vehicle_categories?.label ?? labelize(v.category_slug) },
    { icon: Palette, label: "Color", value: v.color ?? "—" },
  ];
  const pricing = [
    ["Daily rate", formatPHP(p?.daily_rate)],
    p?.weekly_rate && ["Weekly rate (7+ days)", formatPHP(p.weekly_rate)],
    p?.monthly_rate && ["Monthly rate (30+ days)", formatPHP(p.monthly_rate)],
    ["Security deposit", p?.security_deposit ? formatPHP(p.security_deposit) : "None"],
    ["Mileage", p?.mileage_limit_km ? `${p.mileage_limit_km} km/day${p.excess_km_fee ? ` · ${formatPHP(p.excess_km_fee, true)}/km after` : ""}` : "Unlimited"],
    v.delivery_available && ["Delivery fee", formatPHP(p?.delivery_fee)],
    v.with_driver && ["Driver (per day)", formatPHP(p?.driver_fee_per_day)],
    v.min_rental_days > 1 && ["Minimum rental", `${v.min_rental_days} days`],
  ].filter(Boolean) as [string, string][];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${v.year} ${name} rental`,
    image: v.vehicle_images.map((i) => mediaUrl(i.storage_path)),
    description: v.description ?? undefined,
    brand: { "@type": "Brand", name: v.make },
    offers: { "@type": "Offer", priceCurrency: "PHP", price: p?.daily_rate, availability: bookable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE_URL}/${business.slug}/${v.slug}`, seller: { "@type": "AutoRental", name: business.name } },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ViewTracker businessId={business.id} vehicleId={v.id} />
      <div className="container-page pt-6 pb-28 lg:pb-12">
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link href={`/${business.slug}`} className="hover:text-navy-900">{business.name}</Link><span>/</span>
          <Link href={`/${business.slug}#fleet`} className="hover:text-navy-900">Fleet</Link><span>/</span>
          <span className="truncate text-navy-900">{name}</span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-navy-900 sm:text-5xl">
              {v.make} <span className="text-[var(--store-accent)]">{v.model}</span>
            </h1>
            <p className="mt-1 text-muted-foreground">{[v.year, v.variant, v.city].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-4xl font-bold text-navy-900 sm:text-5xl">{formatPHP(p?.daily_rate)}<span className="text-base font-medium text-muted-foreground"> /day</span></p>
            <Rating value={stats?.rating} count={stats?.review_count} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <div className="relative">
              <VehicleGallery images={v.vehicle_images} alt={`${v.year} ${name}`} />
              <FavoriteButton vehicleId={v.id} initial={!!fav.data} signedIn={!!user} className="absolute top-4 right-4" />
            </div>

            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {tiles.map((t) => (
                <li key={t.label} className="flex flex-col items-center rounded-2xl bg-white p-3 text-center ring-1 ring-black/5">
                  <t.icon className="size-5 text-[var(--store-accent)]" />
                  <span className="mt-1.5 text-sm font-bold text-navy-900">{t.value}</span>
                  <span className="text-[11px] text-muted-foreground">{t.label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {v.self_drive && <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-black/5">Self-drive</span>}
              {v.with_driver && <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-black/5">With driver available</span>}
              {v.delivery_available && <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-black/5">Delivery available</span>}
              {v.pickup_location && <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-black/5">Pickup: {v.pickup_location}</span>}
            </div>

            {v.description && (
              <section className="mt-8">
                <h2 className="text-xl font-extrabold tracking-tight text-navy-900">About this car</h2>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-navy-800">{v.description}</p>
              </section>
            )}

            <section className="mt-8 rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
              <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-navy-900"><Gauge className="size-5 text-[var(--store-accent)]" /> Pricing</h2>
              <dl className="mt-4 grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                {pricing.map(([k, val]) => <div key={k} className="flex justify-between gap-3 border-b border-dashed pb-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold text-navy-900">{val}</dd></div>)}
              </dl>
            </section>

            <section className="mt-8 rounded-3xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
              <h2 className="text-xl font-extrabold tracking-tight text-navy-900">Availability</h2>
              <MonthCalendar className="mt-4" months={2} ranges={(ranges ?? []).map((r) => ({ start: r.starts_at, end: r.ends_at, kind: r.kind === "BOOKED" ? "BOOKED" : "BLOCKED" }))} />
            </section>

            {reviews && reviews.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-extrabold tracking-tight text-navy-900">Reviews of this car</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {reviews.map((r) => (
                    <article key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                      <div className="flex justify-between"><Stars value={r.vehicle_rating ?? r.rating} /><span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span></div>
                      {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                      <p className="mt-2 text-xs font-semibold">{r.reviewer_name}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="grid content-start gap-4 lg:sticky lg:top-20 lg:self-start">
            <div id="book" className="scroll-mt-24">
              {bookable && p ? (
                <BookingWidget vehicleId={v.id} bookHref={`/${business.slug}/${v.slug}/book`} dailyRate={Number(p.daily_rate)}
                  selfDrive={v.self_drive} withDriver={v.with_driver} delivery={v.delivery_available} initialFrom={sp.from} initialTo={sp.to} />
              ) : (
                <div className="rounded-3xl bg-white p-5 text-sm text-muted-foreground ring-1 ring-black/5">This vehicle isn&apos;t accepting bookings right now. Message the business for options.</div>
              )}
            </div>
            <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
              <Link href={`/${business.slug}`} className="flex items-center gap-3">
                <BusinessLogo path={business.logo_path} name={business.name} accent={store.accent_color} className="size-12" />
                <div className="min-w-0">
                  <p className="truncate font-bold text-navy-900">{business.name}</p>
                  {business.status === "VERIFIED" && <VerifiedBadge />}
                </div>
              </Link>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Rating value={stats?.rating} count={stats?.review_count} />
                <span>{plural(Number(stats?.vehicle_count ?? 0), "vehicle")}</span>
                {responseTimeLabel(stats?.response_minutes) && <span>Responds {responseTimeLabel(stats?.response_minutes)}</span>}
              </div>
              <MessageButton businessId={business.id} businessName={business.name} vehicleId={v.id} vehicleName={name} signedIn={!!user}
                returnTo={`/${business.slug}/${v.slug}`} label="Message Owner" className="mt-4 w-full" />
            </div>
            <div className="px-2"><ReportButton entityType="VEHICLE" entityId={v.id} signedIn={!!user} /></div>
          </aside>
        </div>
      </div>

      {bookable && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 backdrop-blur lg:hidden">
          <div className="container-page flex items-center gap-3">
            <p className="flex-1"><span className="font-display text-xl font-bold">{formatPHP(p?.daily_rate)}</span><span className="text-sm text-muted-foreground"> /day</span></p>
            <Link href="#book" className="inline-flex h-12 items-center rounded-full px-6 font-semibold text-white" style={{ background: "var(--store-accent)" }}>Request Booking</Link>
          </div>
        </div>
      )}
    </>
  );
}
