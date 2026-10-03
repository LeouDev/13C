import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarRange, Car, Check, FileSignature, Globe, MessageCircle, ShieldCheck, Star, Store, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PLANS, ROOT_DOMAIN } from "@/lib/constants";

export const metadata: Metadata = {
  title: { absolute: "13C for rental businesses — your car rental business, online" },
  description: "Get your own professional car-rental website powered by 13C. Manage cars, availability, inquiries, bookings, digital contracts and customers in one place. Free for up to 3 vehicles.",
  alternates: { canonical: "/for-business" },
};

const FEATURES = [
  { icon: Store, title: "Your own storefront", body: `A branded website at ${ROOT_DOMAIN}/your-business with your logo, cover, colors, fleet, policies and reviews.` },
  { icon: Car, title: "Fleet management", body: "Photos, daily/weekly/monthly pricing, deposits, mileage rules, delivery and driver options." },
  { icon: CalendarRange, title: "Availability without double bookings", body: "Block dates and maintenance. Overlapping bookings are rejected by the database itself." },
  { icon: MessageCircle, title: "Inquiries & messaging", body: "Every customer conversation in one inbox — turn a chat into a booking proposal in one tap." },
  { icon: FileSignature, title: "Digital contracts", body: "Approve a request and a complete rental agreement is generated from your details. Sign, send, and get it e-signed." },
  { icon: Users, title: "Customers & history", body: "Renter details, license and ID (only for your bookings), payments and rental history." },
];

export default function ForBusinessPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="speed-lines absolute inset-0" />
        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="eyebrow text-cyan">13C for rental businesses</p>
            <h1 className="mt-4 font-display-italic text-5xl leading-[0.95] sm:text-6xl">Your car rental business, <span className="text-brand-red">online.</span></h1>
            <p className="mt-5 max-w-lg text-lg text-white/75">Get your own professional car-rental website powered by 13C. Manage your cars, availability, inquiries, bookings, contracts and customers from one place.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register/business" className={buttonVariants({ variant: "electric", size: "xl" })}>Create Your Rental Business</Link>
              <Link href="#pricing" className={buttonVariants({ variant: "light", size: "xl" })}>See pricing</Link>
            </div>
            <p className="mt-4 text-sm text-white/60">Free for up to 3 vehicles · No credit card · You keep 100% of your rental income</p>
          </div>
          {/* Storefront illustration */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="rotate-1 overflow-hidden rounded-[2rem] bg-white text-navy-900 shadow-2xl">
              <div className="flex items-center gap-2 border-b px-4 py-3 text-xs text-muted-foreground"><Globe className="size-3.5" /> {ROOT_DOMAIN}/<b className="text-navy-900">your-business</b></div>
              <div className="h-28 bg-gradient-to-br from-electric to-navy-900" />
              <div className="px-5 pb-5">
                <div className="-mt-7 grid size-14 place-items-center rounded-2xl border-4 border-white bg-brand-red font-display text-xl font-bold text-white">Y</div>
                <p className="mt-2 text-lg font-extrabold">Your Car Rental</p>
                <p className="text-sm text-muted-foreground">Self-drive cars in Cebu City & Mactan</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className="flex items-center gap-1"><Star className="size-3.5 fill-amber-400 text-amber-400" /> 4.9 · 127 reviews</span>
                  <span className="flex items-center gap-1 font-semibold text-electric"><BadgeCheck className="size-3.5" /> Verified Business</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {["Toyota Vios", "Mitsubishi Xpander"].map((c) => <div key={c} className="rounded-xl bg-canvas p-3 text-xs font-semibold">{c}<span className="mt-6 block font-display text-base">₱1,500<span className="text-[10px] font-normal text-muted-foreground">/day</span></span></div>)}
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-white/50">Illustration — your store, your brand.</p>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-24">
        <p className="eyebrow text-electric">Everything in one place</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">From Facebook messages and paper contracts to a real online rental business.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border bg-white p-6">
              <f.icon className="size-6 text-electric" />
              <h3 className="mt-4 font-semibold text-navy-900">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-3xl bg-canvas p-6">
          <ShieldCheck className="size-6 shrink-0 text-electric" />
          <p className="text-sm text-navy-800"><b>Plus a marketplace.</b> Verified stores also appear in 13C search, so customers looking for cars in Cebu can find you — an extra channel on top of your own website. 13C never takes a commission on your rentals in this version.</p>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 bg-canvas py-16 sm:py-24">
        <div className="container-page">
          <p className="eyebrow text-electric">Pricing</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Start free. Grow with your fleet.</h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.id} className={`flex flex-col rounded-3xl bg-white p-6 ${p.id === "PRO" ? "ring-2 ring-electric" : "ring-1 ring-black/5"}`}>
                <div className="flex items-center justify-between"><p className="font-semibold text-navy-900">{p.name}</p>{p.id === "PRO" && <span className="rounded-full bg-electric px-2.5 py-0.5 text-xs font-semibold text-white">Most popular</span>}</div>
                <p className="mt-3"><span className="font-display text-4xl font-bold">{p.price}</span><span className="text-sm text-muted-foreground">{p.period}</span></p>
                <p className="mt-1 text-sm font-medium text-electric">{p.vehicles}</p>
                <ul className="mt-5 grid gap-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-emerald-600" />{f}</li>)}</ul>
                <Link href="/register/business" className={buttonVariants({ variant: p.id === "PRO" ? "electric" : "outline", size: "lg", className: "mt-auto w-full" })} style={{ marginTop: "1.5rem" }}>Get started</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16 text-center sm:py-24">
        <h2 className="font-display-italic text-4xl text-navy-900">Ready to take your rental business online?</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">Register, get verified, add your cars and publish your store — most businesses are live the same week.</p>
        <Link href="/register/business" className={buttonVariants({ variant: "electric", size: "xl", className: "mt-8" })}>Create Your Rental Business</Link>
      </section>
    </>
  );
}
