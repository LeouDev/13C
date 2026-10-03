import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarSearch, Car, ChevronDown, Clock, MapPin, ShieldCheck, Truck } from "lucide-react";
import { Rating, Stars, VerifiedBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { VehicleCard } from "@/components/marketplace/vehicle-card";
import { MessageButton } from "@/components/storefront/message-button";
import { ViewTracker } from "@/components/storefront/view-tracker";
import { getCurrentUser } from "@/lib/auth";
import { POLICY_FIELDS, SITE_URL } from "@/lib/constants";
import { formatDate, labelize, responseTimeLabel, todayManila } from "@/lib/format";
import { plural } from "@/lib/format";
import { getStorefront, searchVehicles } from "@/lib/queries";
import { mediaUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[business]">): Promise<Metadata> {
  const { business: slug } = await params;
  const sf = await getStorefront(slug);
  if (!sf) return {};
  const { business, store } = sf;
  const title = `${business.name} — Car Rental in ${business.city}`;
  const description = store.tagline || business.description || `Rent cars from ${business.name} in ${business.city}, Cebu. Book online on 13C.`;
  const image = mediaUrl(store.cover_path) ?? mediaUrl(business.logo_path);
  const isPublic = business.status === "VERIFIED" && store.is_published;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/${business.slug}` },
    openGraph: { title, description, url: `/${business.slug}`, images: image ? [image] : undefined, type: "website" },
    robots: isPublic ? undefined : { index: false, follow: false },
  };
}

export default async function StorefrontPage({ params, searchParams }: PageProps<"/[business]">) {
  const { business: slug } = await params;
  const sp = (await searchParams) as { from?: string; to?: string };
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const { business, store, stats, paymentMethods } = sf;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ vehicles }, { data: reviews }] = await Promise.all([
    searchVehicles({ from: sp.from, to: sp.to }, { businessId: business.id, limit: 60 }),
    supabase.rpc("public_reviews", { p_business_id: business.id, p_limit: 12 }),
  ]);
  const featured = new Set(store.featured_vehicle_ids);
  const fleet = [...vehicles].sort((a, b) => Number(featured.has(b.id)) - Number(featured.has(a.id)));
  const hidden = new Set(store.hidden_sections);
  const policies = POLICY_FIELDS.filter((p) => (store.policies as Record<string, string>)[p.key]?.trim());
  const faqs = (store.faqs as { q: string; a: string }[]) ?? [];
  const cover = mediaUrl(store.cover_path);
  const response = responseTimeLabel(stats?.response_minutes);
  const dated = !!(sp.from && sp.to);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: business.name,
    url: `${SITE_URL}/${business.slug}`,
    image: cover ?? undefined,
    logo: mediaUrl(business.logo_path) ?? undefined,
    telephone: business.phone ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: business.address ?? undefined, addressLocality: business.city, addressRegion: business.province, addressCountry: "PH" },
    aggregateRating: stats?.review_count ? { "@type": "AggregateRating", ratingValue: stats.rating, reviewCount: stats.review_count } : undefined,
    paymentAccepted: paymentMethods.map(labelize).join(", "),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ViewTracker businessId={business.id} />

      {/* Hero */}
      <section className="container-page pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-navy-900" style={!cover ? { background: `linear-gradient(135deg, var(--store-accent), #0a1430)` } : undefined}>
          {cover && <Image src={cover} alt={`${business.name} cover`} fill loading="eager" fetchPriority="high" sizes="100vw" className="object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />
          <div className="relative flex min-h-[340px] flex-col justify-end p-5 text-white sm:min-h-[420px] sm:p-10">
            <BusinessLogo path={business.logo_path} name={business.name} accent={store.accent_color} className="size-16 border-4 border-white/90 shadow-lg sm:size-20" />
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">{business.name}</h1>
            <p className="mt-2 max-w-2xl text-base text-white/85 sm:text-lg">{store.tagline || business.description || `Car rental in ${business.city}`}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {stats?.review_count ? (
                <span className="flex items-center gap-1.5"><Stars value={Number(stats.rating)} /> <b>{Number(stats.rating).toFixed(1)}</b> · {stats.review_count} reviews</span>
              ) : <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">New on 13C</span>}
              {business.status === "VERIFIED" && <span className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="size-4" /> Verified Business</span>}
              <span className="flex items-center gap-1.5"><Car className="size-4" /> {plural(Number(stats?.vehicle_count ?? 0), "vehicle")}</span>
              <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {business.city}</span>
              {response && <span className="flex items-center gap-1.5"><Clock className="size-4" /> Usually responds {response}</span>}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <MessageButton businessId={business.id} businessName={business.name} signedIn={!!user} returnTo={`/${business.slug}`} variant="light" />
              <Link href="#fleet" className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-lg transition hover:brightness-110" style={{ background: "var(--store-accent)" }}>
                <Car className="size-4" /> Browse Fleet
              </Link>
              <Link href="#availability" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur hover:bg-white/20">
                <CalendarSearch className="size-4" /> Check Availability
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet */}
      {!hidden.has("fleet") && (
        <section id="fleet" className="container-page scroll-mt-20 pt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-[var(--store-accent)]">Our fleet</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{dated ? `Available ${formatDate(sp.from!, { month: "short", day: "numeric" })} – ${formatDate(sp.to!, { month: "short", day: "numeric" })}` : "Choose your car"}</h2>
            </div>
            <form id="availability" className="flex scroll-mt-24 flex-wrap items-end gap-2 rounded-2xl bg-white p-2 ring-1 ring-black/5">
              <label className="grid gap-0.5 px-2 text-[11px] font-semibold text-muted-foreground uppercase">Pickup<input type="date" name="from" min={todayManila()} defaultValue={sp.from} required className="text-sm font-semibold text-navy-900 normal-case outline-none" /></label>
              <label className="grid gap-0.5 px-2 text-[11px] font-semibold text-muted-foreground uppercase">Return<input type="date" name="to" min={todayManila(1)} defaultValue={sp.to} required className="text-sm font-semibold text-navy-900 normal-case outline-none" /></label>
              <button className="h-10 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: "var(--store-accent)" }}>Check</button>
              {dated && <Link href={`/${business.slug}#fleet`} className="px-2 text-xs font-medium text-muted-foreground hover:underline">Clear</Link>}
            </form>
          </div>
          {fleet.length ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {fleet.map((v, i) => <VehicleCard key={v.id} v={v} hideBusiness priority={i < 3} query={dated ? `from=${sp.from}&to=${sp.to}` : undefined} />)}
            </div>
          ) : (
            <EmptyState className="mt-6" icon={Car} title={dated ? "No cars free on those dates" : "No vehicles listed yet"} description={dated ? "Try different dates or message us — we may be able to help." : undefined} />
          )}
        </section>
      )}

      <div className="container-page mt-14 grid gap-6 lg:grid-cols-2">
        {!hidden.has("about") && store.about && (
          <section id="about" className="scroll-mt-20 rounded-3xl bg-white p-6 sm:p-8 lg:col-span-2">
            <p className="eyebrow text-[var(--store-accent)]">About us</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900">Meet {business.name}</h2>
            <p className="mt-4 max-w-3xl leading-relaxed whitespace-pre-line text-navy-800">{store.about}</p>
          </section>
        )}

        {!hidden.has("locations") && (store.pickup_locations.length > 0 || store.delivery_areas.length > 0) && (
          <section className="rounded-3xl bg-white p-6 sm:p-8">
            <p className="eyebrow text-[var(--store-accent)]">Pickup & delivery</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-navy-900">Where to get your car</h2>
            {store.pickup_locations.length > 0 && (
              <ul className="mt-4 grid gap-2">{store.pickup_locations.map((l) => <li key={l} className="flex items-center gap-2 text-sm"><MapPin className="size-4 text-[var(--store-accent)]" />{l}</li>)}</ul>
            )}
            {store.delivery_areas.length > 0 && (
              <>
                <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-navy-900"><Truck className="size-4 text-[var(--store-accent)]" /> We deliver to</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{store.delivery_areas.map((a) => <span key={a} className="rounded-full bg-canvas px-3 py-1 text-xs font-medium">{a}</span>)}</div>
              </>
            )}
          </section>
        )}

        {!hidden.has("policies") && (policies.length > 0 || paymentMethods.length > 0) && (
          <section id="policies" className="scroll-mt-20 rounded-3xl bg-white p-6 sm:p-8">
            <p className="eyebrow text-[var(--store-accent)]">Rental policies</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-navy-900">Good to know</h2>
            <dl className="mt-4 grid gap-4">
              {policies.map((p) => (
                <div key={p.key}><dt className="text-sm font-semibold text-navy-900">{p.label}</dt><dd className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{(store.policies as Record<string, string>)[p.key]}</dd></div>
              ))}
              {paymentMethods.length > 0 && (
                <div><dt className="text-sm font-semibold text-navy-900">Payment</dt><dd className="mt-1 flex flex-wrap gap-1.5">{paymentMethods.map((m) => <span key={m} className="rounded-full bg-canvas px-3 py-1 text-xs font-medium">{labelize(m)}</span>)}</dd></div>
              )}
            </dl>
          </section>
        )}
      </div>

      {!hidden.has("reviews") && (
        <section id="reviews" className="container-page mt-14 scroll-mt-20">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow text-[var(--store-accent)]">Reviews</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900">What renters say</h2>
            </div>
            <Rating value={stats?.rating} count={stats?.review_count} className="text-base" />
          </div>
          {reviews?.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <article key={r.id} className="rounded-3xl bg-white p-5">
                  <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span></div>
                  {r.comment && <p className="mt-3 text-sm text-navy-800">{r.comment}</p>}
                  <p className="mt-3 text-xs font-semibold text-navy-900">{r.reviewer_name} · <span className="font-normal text-muted-foreground">rented the {r.vehicle_name}</span></p>
                  {r.business_response && <p className="mt-3 rounded-xl bg-canvas p-3 text-xs text-navy-800"><b>Response from {business.name}:</b> {r.business_response}</p>}
                </article>
              ))}
            </div>
          ) : <EmptyState className="mt-6" title="No reviews yet" description="Reviews come only from renters who completed a booking on 13C." />}
        </section>
      )}

      {!hidden.has("faq") && faqs.length > 0 && (
        <section className="container-page mt-14">
          <p className="eyebrow text-[var(--store-accent)]">FAQ</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900">Frequently asked questions</h2>
          <div className="mt-6 grid gap-2">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-navy-900">{f.q}<ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" /></summary>
                <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="container-page mt-14">
        <div className="flex flex-col items-center gap-4 rounded-[2rem] p-8 text-center text-white sm:p-12" style={{ background: `linear-gradient(135deg, var(--store-accent), #0a1430)` }}>
          {business.status === "VERIFIED" && <VerifiedBadge className="rounded-full bg-white px-3 py-1" />}
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Ready to drive with {business.name}?</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="#fleet" className="inline-flex h-12 items-center rounded-full bg-white px-6 font-semibold text-navy-900">Browse fleet</Link>
            <MessageButton businessId={business.id} businessName={business.name} signedIn={!!user} returnTo={`/${business.slug}`} variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" />
          </div>
        </div>
      </section>
    </>
  );
}
