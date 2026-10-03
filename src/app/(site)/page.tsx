import Link from "next/link";
import { ArrowRight, BarChart3, CalendarRange, Car, FileSignature, KeyRound, MessageCircle, Search, ShieldCheck, Store, Users } from "lucide-react";
import { LogoBadge } from "@/components/brand/logo";
import { EmptyState } from "@/components/common/states";
import { BusinessCard } from "@/components/marketplace/business-card";
import { SearchBar } from "@/components/marketplace/search-bar";
import { VehicleCard } from "@/components/marketplace/vehicle-card";
import { buttonVariants } from "@/components/ui/button";
import { LOCATIONS, PLAN_VEHICLE_LIMIT, TRIAL_DAYS } from "@/lib/constants";
import { getCategories, getFeaturedBusinesses, searchVehicles } from "@/lib/queries";

const STEPS = [
  { icon: Search, title: "Find a car", body: "Search verified local businesses by place, dates and type." },
  { icon: MessageCircle, title: "Message the business", body: "Ask about delivery, drivers or the airport — right in 13C." },
  { icon: CalendarRange, title: "Request a booking", body: "Pick your dates and payment method. No surprise fees." },
  { icon: FileSignature, title: "Review & sign", body: "Read the rental agreement and sign from your phone." },
  { icon: KeyRound, title: "Pick up the car", body: "Meet the rental business and drive anywhere in Cebu." },
];

const BIZ_FEATURES = [
  { icon: Store, title: "Your own storefront", body: "A branded website at 13c.online/your-business." },
  { icon: Car, title: "Fleet management", body: "Photos, pricing, availability and maintenance." },
  { icon: MessageCircle, title: "Online inquiries", body: "Every customer conversation in one inbox." },
  { icon: CalendarRange, title: "Booking management", body: "Approve requests with double-booking protection." },
  { icon: FileSignature, title: "Digital contracts", body: "Auto-filled agreements with e-signatures." },
  { icon: Users, title: "Customer management", body: "Rental history and details for every renter." },
];

export default async function HomePage() {
  const [categories, featured, businesses] = await Promise.all([
    getCategories(),
    searchVehicles({}, { limit: 6 }),
    getFeaturedBusinesses(6),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="speed-lines absolute inset-0" />
        <div className="absolute -right-40 -bottom-40 size-[36rem] rounded-full bg-electric/20 blur-3xl" />
        <div className="container-page relative grid grid-cols-1 items-center gap-10 pt-12 pb-36 md:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-44">
          <div>
            <p className="eyebrow animate-rush text-cyan">Cebu&apos;s car rental marketplace</p>
            <h1 className="mt-4 font-display-italic text-[2.75rem] leading-[0.95] sm:text-6xl lg:text-7xl">
              Find your next car in <span className="text-brand-red">Cebu.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
              Discover trusted local rental businesses, compare vehicles, and book directly.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
              <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-cyan" /> Verified businesses</span>
              <span className="flex items-center gap-2"><FileSignature className="size-4 text-cyan" /> Digital rental agreements</span>
            </div>
          </div>
          <LogoBadge className="mx-auto hidden w-full max-w-md lg:block" />
        </div>
      </section>
      <div className="container-page relative z-10 -mt-24 lg:-mt-28">
        <SearchBar categories={categories} />
      </div>

      {/* Featured cars */}
      <section className="container-page py-16 sm:py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-electric">Featured cars</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Ready to drive this week</h2>
          </div>
          <Link href="/explore" className="hidden items-center gap-1 text-sm font-semibold text-navy-900 hover:text-electric sm:flex">
            Browse all cars <ArrowRight className="size-4" />
          </Link>
        </div>
        {featured.vehicles.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.vehicles.map((v, i) => <VehicleCard key={v.id} v={v} priority={i < 3} />)}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={Car} title="Cars are on their way"
            description="Cebu's rental businesses are setting up their 13C stores. Own a rental business? Be one of the first."
            action={{ label: "List your cars", href: "/register/business" }} />
        )}
      </section>

      {/* Locations */}
      <section className="bg-canvas py-16 sm:py-20">
        <div className="container-page">
          <p className="eyebrow text-electric">Popular locations</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Pick up where you land</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {LOCATIONS.slice(0, 5).map((l, i) => (
              <Link key={l.slug} href={`/explore/${l.slug}`}
                className={`group relative flex min-h-36 flex-col justify-end overflow-hidden rounded-3xl p-5 text-white transition hover:-translate-y-0.5 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}
                style={{ background: `linear-gradient(150deg, ${["#2f6bff", "#0ea5e9", "#121f3b", "#273b69", "#14b8a6"][i]}, #0a1430)` }}>
                <div className="speed-lines absolute inset-0 opacity-60" />
                <span className="relative font-display-italic text-2xl">{l.name}</span>
                <span className="relative mt-1 text-xs text-white/70">{l.blurb}</span>
                <ArrowRight className="absolute top-5 right-5 size-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Businesses */}
      <section className="container-page py-16 sm:py-20">
        <p className="eyebrow text-electric">Featured rental businesses</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Local, verified, and reviewed</h2>
        {businesses.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => <BusinessCard key={b.id} b={b} />)}
          </div>
        ) : (
          <EmptyState className="mt-8" icon={ShieldCheck} title="The first verified businesses are onboarding"
            description="Every business on 13C is reviewed before it can accept bookings." />
        )}
      </section>

      {/* How it works */}
      <section className="bg-canvas py-16 sm:py-20">
        <div className="container-page">
          <p className="eyebrow text-electric">How 13C works</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">From search to keys in five steps</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl bg-white p-5">
                <span className="font-display-italic text-5xl text-navy-900/10">{i + 1}</span>
                <s.icon className="absolute top-5 right-5 size-6 text-electric" />
                <h3 className="mt-2 font-semibold text-navy-900">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* For rental businesses */}
      <section className="container-page py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-navy-900 px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="speed-lines absolute inset-0" />
          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="eyebrow text-cyan">For rental businesses</p>
              <h2 className="mt-3 font-display-italic text-4xl leading-tight sm:text-5xl">Turn your rental business into a digital business.</h2>
              <p className="mt-4 max-w-lg text-white/70">Get your own professional car-rental website powered by 13C. Manage your cars, availability, inquiries, bookings, contracts and customers from one place.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register/business" className={buttonVariants({ variant: "electric", size: "xl" })}>Create Your Rental Business</Link>
                <Link href="/for-business" className={buttonVariants({ variant: "light", size: "xl" })}>See how it works</Link>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {BIZ_FEATURES.map((f) => (
                <li key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <f.icon className="size-5 text-cyan" />
                  <p className="mt-3 font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm text-white/60">{f.body}</p>
                </li>
              ))}
              <li className="flex items-center gap-3 rounded-2xl bg-white p-4 text-navy-900 sm:col-span-2">
                <BarChart3 className="size-5 text-electric" />
                <p className="text-sm"><span className="font-semibold">Free for {TRIAL_DAYS} days</span> — up to {PLAN_VEHICLE_LIMIT.FREE} vehicles, no credit card.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
