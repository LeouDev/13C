import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, CalendarCheck, CalendarRange, CalendarX, Car, Check, ChevronDown, FileCheck2, FilePenLine, FilePlus,
  FileText, Globe, Images, Lock, MapPin, MessageCircle, Rocket, Search, Store, TrendingUp, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { DriveCar } from "@/components/site/drive-car";
import { SpeedStreaks } from "@/components/site/speed-streaks";
import { buttonVariants } from "@/components/ui/button";
import { ACCENT_PRESETS, LOCATIONS, PLAN_VEHICLE_LIMIT, PLANS, ROOT_DOMAIN, TRIAL_DAYS } from "@/lib/constants";

// Signature lettering for the desktop contract preview (same face the signature pad types with); not preloaded since phones never show it.
const caveat = Caveat({ subsets: ["latin"], weight: "600", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { absolute: "13C for rental businesses — your car rental business, online" },
  description: `Get your own professional car-rental website powered by 13C. Manage cars, availability, inquiries, bookings, digital contracts and customers in one place. Free for ${TRIAL_DAYS} days.`,
  alternates: { canonical: "/for-business" },
};

const FEATURES = {
  storefront: { icon: Store, title: "Your own storefront", body: `A branded website at ${ROOT_DOMAIN}/your-business with your logo, cover, colors, fleet, policies and reviews.` },
  availability: { icon: CalendarRange, title: "Availability without double bookings", body: "Block dates and maintenance. Overlapping bookings are rejected by the database itself." },
  messaging: { icon: MessageCircle, title: "Inquiries & messaging", body: "Every customer conversation in one inbox. Turn a chat into a booking proposal in one tap." },
  contracts: { icon: FilePenLine, title: "Digital contracts", body: "Approve a request and a complete rental agreement is generated from your details. Sign, send, and get it e-signed." },
  fleet: { icon: Car, title: "Fleet management", body: "Photos, daily/weekly/monthly pricing, deposits, mileage rules, delivery and driver options." },
  customers: { icon: Users, title: "Customers & history", body: "Renter details, license and ID (only for your bookings), payments and rental history." },
} satisfies Record<string, { icon: LucideIcon; title: string; body: string }>;

const TODAY = [
  [MessageCircle, "Inquiries spread across Messenger, Viber and SMS"],
  [CalendarX, "A notebook calendar, and the occasional double booking"],
  [FileText, "Paper contracts filled in by hand at pickup"],
  [Images, "Car photos and prices re-sent in every chat"],
] as const;
// [desktop, phone] wording
const WITH_13C = [
  ["Every conversation in one inbox, one tap to a booking", "Every conversation in one inbox"],
  ["Double bookings rejected automatically", "Double bookings rejected automatically"],
  ["Agreements generated and e-signed before pickup", "Agreements e-signed before pickup"],
  [`Your own website at ${ROOT_DOMAIN}/your-business`, `Your own website at ${ROOT_DOMAIN}`],
] as const;
const MOBILE_FEATURES = [
  { icon: Store, title: "Your own storefront", body: "A branded website with your logo, cover, colors, fleet, policies and reviews." },
  { icon: FilePenLine, title: "Digital contracts", body: "Approve a request and the agreement is generated. Sign, send, and get it e-signed." },
  { icon: CalendarRange, title: "No double bookings", body: "Block dates and maintenance. Overlaps are rejected automatically." },
];
const STEPS = [
  ["Register", "Create your business account and pick your store address."],
  ["Get verified", "Upload your documents. Reviews usually take 1–\u20602 business days."],
  ["Add your cars", "Photos, pricing, policies and payment methods."],
  ["Publish your store", "Share your link and start taking bookings."],
] as const;
const SWATCHES = [0, 2, 4, 5, 7, 9].map((i) => ACCENT_PRESETS[i]!);
const PRO = PLANS.find((p) => p.id === "PRO")!;

const Eyebrow = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={cn("eyebrow text-electric", className)}>{children}</p>;
const IconTile = ({ icon: Icon, className }: { icon: LucideIcon; className?: string }) => (
  <span className={cn("grid size-12 shrink-0 place-items-center rounded-[16px] bg-accent text-electric", className)}><Icon className="size-6" /></span>
);
const CheckDot = ({ className }: { className?: string }) => (
  <span className={cn("grid size-[22px] shrink-0 place-items-center rounded-full bg-emerald-500 text-white", className)}><Check className="size-3.5" strokeWidth={3} /></span>
);

export default function ForBusinessPage() {
  return (
    <>
      <Hero />

      {/* Before → after */}
      <section className="container-page pt-14 lg:pt-28">
        <Eyebrow>Everything in one place</Eyebrow>
        <h2 className="mt-2 lg:mt-2.5 max-w-[820px] font-display text-[30px] leading-[1.1] font-bold tracking-tight text-navy-900 lg:text-[46px] lg:leading-[1.08]">
          From Facebook messages and paper contracts to a real online rental business.
        </h2>
        <div className="mt-6 grid items-stretch lg:mt-12 lg:grid-cols-[1fr_64px_1fr]">
          <div className="hidden rounded-3xl border border-dashed border-input bg-[#f6f7f9] p-8 lg:block">
            <p className="eyebrow text-muted-foreground">Today</p>
            <ul className="mt-[18px] grid gap-3.5 text-base text-muted-foreground">
              {TODAY.map(([Icon, text]) => <li key={text} className="flex items-center gap-3"><Icon className="size-5 shrink-0" />{text}</li>)}
            </ul>
          </div>
          <div className="hidden place-items-center lg:grid" aria-hidden>
            <span className="grid size-12 place-items-center rounded-full bg-navy-900 text-white"><ArrowRight className="size-[22px]" /></span>
          </div>
          <div className="relative overflow-hidden rounded-[25px] bg-navy-900 p-[22px] text-white lg:rounded-3xl lg:p-8">
            <p className="eyebrow text-cyan">With 13C</p>
            <ul className="mt-3.5 grid gap-3 text-sm lg:mt-[18px] lg:gap-3.5 lg:text-base">
              {WITH_13C.map(([full, short]) => (
                <li key={full} className="flex items-center gap-2.5 lg:gap-3"><CheckDot className="size-5 lg:size-[22px]" /><span className="lg:hidden">{short}</span><span className="hidden lg:inline">{full}</span></li>
              ))}
            </ul>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-brand-red" />
          </div>
        </div>
      </section>

      {/* Features: bento grid on desktop, a short list with "See all" on phones */}
      <section className="container-page pt-3.5 lg:pt-28">
        <div className="hidden grid-cols-6 gap-5 lg:grid">
          <div className="col-span-6 grid grid-cols-[1fr_360px] items-center gap-7 rounded-3xl border bg-white p-8 xl:col-span-4">
            <div>
              <IconTile icon={FEATURES.storefront.icon} />
              <h3 className="mt-5 font-display text-[26px] leading-[1.15] font-bold text-navy-900">{FEATURES.storefront.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-muted-foreground">{FEATURES.storefront.body}</p>
              <div className="mt-[18px] flex gap-2" aria-hidden>
                {SWATCHES.map((c) => <span key={c} className="size-6 rounded-full" style={{ background: c, boxShadow: c === "#E0312B" ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }} />)}
              </div>
            </div>
            <div className="overflow-hidden rounded-[22px] shadow-[0_0_0_1px_var(--border),0_12px_30px_rgb(18_31_59/0.1)]" aria-hidden>
              <div className="flex items-center gap-1.5 border-b px-3 py-2 text-[11px] text-muted-foreground"><Globe className="size-3" />{ROOT_DOMAIN}/<b className="text-navy-900">your-business</b></div>
              <div className="h-[90px] bg-[linear-gradient(135deg,#e0312b,#121f3b)]" />
              <div className="px-4 pb-4">
                <span className="-mt-[22px] grid size-11 place-items-center rounded-2xl border-[3px] border-white bg-brand-red font-display text-base font-bold text-white">Y</span>
                <p className="mt-1.5 text-[15px] font-extrabold text-navy-900">Your Car Rental</p>
                <p className="text-xs text-muted-foreground">Self-drive cars in Cebu City &amp; Mactan</p>
              </div>
            </div>
          </div>
          <div className="col-span-3 flex flex-col rounded-3xl bg-canvas p-8 xl:col-span-2">
            <IconTile icon={FEATURES.availability.icon} className="bg-white" />
            <h3 className="mt-5 font-display text-[22px] leading-[1.15] font-bold text-navy-900">{FEATURES.availability.title}</h3>
            <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{FEATURES.availability.body}</p>
            <div className="mt-auto grid grid-cols-7 gap-1 pt-5 text-center text-[11px] font-semibold" aria-hidden>
              {[8, 9, 10, 11, 12, 13, 14].map((d) => (
                <span key={d} className={cn("rounded-lg py-2", d === 10 || d === 11 ? "bg-electric text-white" : d === 12 ? "bg-[repeating-linear-gradient(135deg,#fde2e1_0_4px,#fff_4px_8px)] text-red-800" : "bg-white text-muted-foreground")}>{d}</span>
              ))}
            </div>
          </div>
          <div className="col-span-3 flex flex-col rounded-3xl border bg-white p-8 xl:col-span-2">
            <IconTile icon={FEATURES.messaging.icon} />
            <h3 className="mt-5 font-display text-[22px] leading-[1.15] font-bold text-navy-900">{FEATURES.messaging.title}</h3>
            <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{FEATURES.messaging.body}</p>
            <div className="mt-auto grid gap-1.5 pt-5 text-xs" aria-hidden>
              <span className="max-w-[80%] justify-self-start rounded-[16px_16px_16px_4px] bg-canvas px-3 py-2 text-navy-900">Is the Vios available Oct 10–12?</span>
              <span className="inline-flex items-center gap-1.5 justify-self-end rounded-[16px_16px_4px_16px] bg-electric px-3 py-2 font-semibold text-white"><FilePlus className="size-3.5" /> Booking proposal sent</span>
            </div>
          </div>
          <div className="relative col-span-6 grid grid-cols-[1fr_340px] items-center gap-7 overflow-hidden rounded-3xl bg-navy-900 p-8 text-white xl:col-span-4">
            <div>
              <IconTile icon={FEATURES.contracts.icon} className="bg-white/10 text-cyan" />
              <h3 className="mt-5 font-display text-[26px] leading-[1.15] font-bold">{FEATURES.contracts.title}</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-white/72">{FEATURES.contracts.body}</p>
            </div>
            <div className="rounded-[22px] bg-white p-[18px] text-navy-900" aria-hidden>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">Rental agreement v1</span>
                <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700"><BadgeCheck className="size-3" /> Signed</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[["You", "Maria Santos"], ["Renter", "Juan Dela Cruz"]].map(([role, name]) => (
                  <div key={role} className="rounded-[14px] border px-2.5 py-2">
                    <p className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">{role}</p>
                    <p className={cn(caveat.className, "mt-0.5 text-xl leading-[1.1]")}>{name}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-muted-foreground">Executed under RA 8792 · PDF for both parties</p>
            </div>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-brand-red" />
          </div>
          {[FEATURES.fleet, FEATURES.customers].map((f) => (
            <div key={f.title} className="col-span-3 flex gap-5 rounded-3xl border bg-white p-8">
              <IconTile icon={f.icon} />
              <div>
                <h3 className="font-display text-[22px] leading-[1.15] font-bold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:hidden">
          {MOBILE_FEATURES.map((f) => <MobileFeature key={f.title} {...f} />)}
          <details className="group">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-1.5 text-sm font-semibold text-electric [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">See all features</span><span className="hidden group-open:inline">Show fewer</span>
              <ChevronDown className="size-4 transition group-open:rotate-180" />
            </summary>
            <div className="grid gap-3">{[FEATURES.messaging, FEATURES.fleet, FEATURES.customers].map((f) => <MobileFeature key={f.title} {...f} />)}</div>
          </details>
        </div>

        <div className="mt-3 flex flex-col gap-4 rounded-[25px] bg-gradient-to-r from-accent to-canvas p-[22px] lg:mt-5 lg:flex-row lg:items-center lg:gap-5 lg:rounded-3xl lg:px-8 lg:py-7">
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-electric text-white lg:size-14 lg:rounded-[18px]"><Search className="size-5 lg:size-[26px]" /></span>
          <p className="flex-1 text-sm leading-[1.55] text-navy-800 lg:text-base"><b className="text-navy-900">Plus a marketplace.</b> Verified stores also appear in 13C search, so customers looking for cars in Cebu can find you. That&apos;s an extra channel on top of your own website. 13C never takes a commission on your rentals in this version.</p>
          <span className="flex flex-wrap gap-1.5 lg:max-w-[300px] lg:justify-end">
            {LOCATIONS.slice(0, 5).map((l) => <Link key={l.slug} href={`/explore/${l.slug}`} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-white/70">{l.name}</Link>)}
          </span>
        </div>
      </section>

      {/* How it works: a vertical timeline on phones, four columns on desktop */}
      <section className="container-page pt-14 lg:pt-28">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-2 font-display text-[30px] leading-[1.1] font-bold tracking-tight text-navy-900 lg:mt-2.5 lg:text-[46px] lg:leading-[1.08]">Live the same week.</h2>
          </div>
          <p className="max-w-[380px] text-sm leading-[1.6] text-muted-foreground lg:text-[15px]">Register, get verified, add your cars and publish your store. Most businesses are live the same week.</p>
        </div>
        <ol className="mt-7 grid lg:mt-11 lg:grid-cols-4 lg:gap-5">
          {STEPS.map(([title, body], i) => {
            const last = i === STEPS.length - 1;
            return (
              <li key={title} className="grid grid-cols-[44px_1fr] gap-x-4 gap-y-1 lg:grid-cols-1 lg:content-start lg:gap-3">
                <span className="row-span-2 flex flex-col items-center gap-2 lg:row-span-1 lg:flex-row lg:gap-3">
                  {last
                    ? <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-red text-white"><Rocket className="size-5" /></span>
                    : <span className="grid size-11 shrink-0 place-items-center rounded-full bg-navy-900 font-display text-lg font-bold text-white">{i + 1}</span>}
                  {!last && <span className="mb-2 w-0.5 flex-1 bg-[repeating-linear-gradient(180deg,var(--input)_0_8px,transparent_8px_14px)] lg:mb-0 lg:h-0.5 lg:w-auto lg:bg-[repeating-linear-gradient(90deg,var(--input)_0_8px,transparent_8px_14px)]" aria-hidden />}
                </span>
                <b className="pt-2.5 text-base text-navy-900 lg:pt-0 lg:text-[17px]">{title}</b>
                <span className={cn("text-[13px] leading-[1.55] text-muted-foreground lg:pb-0 lg:text-sm", !last && "pb-7")}>{body}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <Pricing />

      {/* Final CTA */}
      <section className="speed-lines relative overflow-hidden bg-navy-900 pt-[52px] text-center text-white lg:pt-24">
        <div className="container-page relative">
          <h2 className="font-display-italic text-[36px] leading-none lg:text-[64px]">Ready to take your rental business online?</h2>
          <p className="mx-auto mt-[18px] hidden max-w-[520px] text-[17px] leading-[1.55] text-white/72 lg:block">Register, get verified, add your cars and publish your store. Most businesses are live the same week.</p>
          <Link href="/register/business" className={buttonVariants({ variant: "electric", className: "mt-6 h-[52px] w-full gap-2.5 rounded-full px-[30px] text-base font-semibold shadow-[0_8px_24px_rgb(47_107_255/0.45)] sm:w-auto lg:mt-[34px] lg:h-14" })}>
            Create Your Rental Business <ArrowRight className="size-[18px]" />
          </Link>
          <p className="mt-3 text-xs text-white/55 lg:mt-4 lg:text-sm">{TRIAL_DAYS}-day free trial · No credit card<span className="hidden sm:inline"> · You keep 100% of your rental income</span></p>
          <div className="mt-12 overflow-hidden" aria-hidden>
            <div className="flex justify-center"><DriveCar className="w-[185px] lg:w-[282px]" /></div>
            <div className="road-dashes mb-2.5" />
          </div>
        </div>
      </section>
    </>
  );
}

function MobileFeature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex gap-3.5 rounded-[25px] border p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-accent text-electric"><Icon className="size-5" /></span>
      <div>
        <h3 className="font-display text-lg leading-[1.2] font-bold text-navy-900">{title}</h3>
        <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <div className="speed-lines absolute inset-0" />
      <SpeedStreaks count={18} seed={13} />
      <div className="container-page relative grid gap-7 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-10 lg:pt-[88px] lg:pb-24 xl:grid-cols-[minmax(0,1fr)_576px] xl:gap-14">
        <div>
          <p className="eyebrow inline-flex h-7 items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 text-[11px] text-cyan lg:h-[30px] lg:px-3.5 lg:text-xs">
            <span className="size-1.5 rounded-full bg-cyan" /> 13C for rental businesses<span className="hidden lg:inline">&nbsp;in Cebu</span>
          </p>
          <h1 className="mt-[18px] font-display-italic text-[50px] leading-[0.92] sm:text-[64px] lg:mt-[22px] xl:text-[84px]">Your car rental business, <span className="text-brand-red">online.</span></h1>
          <p className="mt-[18px] max-w-[540px] text-base leading-[1.55] text-white/75 lg:mt-[26px] lg:text-[19px]">Get your own professional car-rental website powered by 13C. Manage your cars, availability, inquiries, bookings, contracts and customers from one place.</p>
          <div className="mt-[26px] grid gap-2.5 sm:flex sm:gap-3 lg:mt-[34px]">
            <Link href="/register/business" className={buttonVariants({ variant: "electric", className: "h-[52px] gap-2.5 rounded-full px-[30px] text-base font-semibold shadow-[0_8px_24px_rgb(47_107_255/0.45)] lg:h-14" })}>
              Create Your Rental Business <ArrowRight className="size-[18px]" />
            </Link>
            <Link href="#pricing" className={buttonVariants({ variant: "light", className: "h-[52px] rounded-full px-7 text-base font-semibold lg:h-14" })}>See pricing</Link>
          </div>
          <div className="mt-[34px] hidden gap-7 lg:flex">
            {[[`${TRIAL_DAYS} days`, "free trial, no card"], ["100%", "of your rental income"], ["Same week", "most stores go live"]].map(([v, l], i) => (
              <div key={l} className="flex gap-7">
                {i > 0 && <span className="w-px bg-white/15" aria-hidden />}
                <p className="grid gap-0.5"><span className="font-display text-[28px] leading-none font-bold">{v}</span><span className="text-[13px] text-white/60">{l}</span></p>
              </div>
            ))}
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2 text-center lg:hidden">
            {[[`${TRIAL_DAYS} days`, "free, no card"], ["100%", "of your income"], ["0%", "commission"]].map(([v, l]) => (
              <p key={l} className="grid gap-1 rounded-[16px] bg-white/7 px-1 py-3"><span className="font-display text-xl leading-none font-bold">{v}</span><span className="text-[11px] text-white/60">{l}</span></p>
            ))}
          </div>
        </div>

        {/* Illustration: a storefront with bookings arriving. Sample data. */}
        <div className="relative mx-auto w-full max-w-[480px] pt-[30px] lg:max-w-none lg:px-10 lg:pb-10" aria-hidden>
          <div className="lg:rotate-[1.5deg]"><StoreMock /></div>
          <Toast className="top-0 right-3 left-3 lg:right-auto lg:-left-[30px]" delay={0.4} icon={CalendarCheck} tone="bg-electric" title="New booking request" sub="Juan D. · Toyota Vios · Oct 10–11" />
          <Toast className="top-[250px] -right-6 hidden lg:flex" delay={1.0} icon={FileCheck2} tone="bg-emerald-500" title="Contract signed" sub="Booking 13C-7G2AXE confirmed" />
          <Toast className="bottom-1.5 -left-2.5 hidden lg:flex" delay={1.6} icon={Wallet} tone="bg-navy-900" title="Paid to you via GCash" sub="No commission taken" amount="₱1,800" />
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-1 bg-brand-red" />
    </section>
  );
}

function StoreMock() {
  return (
    <div className="overflow-hidden rounded-[30px] bg-white text-navy-900 shadow-[0_30px_70px_rgb(5_10_30/0.45)]">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-xs text-muted-foreground">
        <span className="flex gap-[5px]">{["bg-brand-red", "bg-amber-400", "bg-emerald-500"].map((c) => <span key={c} className={cn("size-[9px] rounded-full opacity-70", c)} />)}</span>
        <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-[#f6f7f9] px-3 py-[5px]"><Lock className="size-[11px] shrink-0" /><span className="truncate">{ROOT_DOMAIN}/<b className="text-navy-900">your-business</b></span></span>
      </div>
      <div className="h-[88px] bg-[linear-gradient(135deg,#e0312b_0%,#7a1d3a_55%,#121f3b_100%)] lg:h-[110px]" />
      <div className="px-5 pb-5">
        <div className="flex items-end justify-between">
          <span className="-mt-7 grid size-14 place-items-center rounded-[20px] border-4 border-white bg-brand-red font-display text-xl font-bold text-white">Y</span>
          <span className="inline-flex h-[34px] items-center rounded-full bg-brand-red px-4 text-[13px] font-semibold text-white">Book now</span>
        </div>
        <p className="mt-2 text-lg font-extrabold">Your Car Rental</p>
        <p className="text-[13px] text-muted-foreground">Self-drive cars in Cebu City &amp; Mactan</p>
        <div className="mt-2.5 flex gap-3 text-xs">
          <span className="flex items-center gap-1 font-semibold text-electric"><BadgeCheck className="size-3.5" /> Verified Business</span>
          <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-[13px]" /> Airport delivery</span>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          {["Toyota Vios", "Mitsubishi Xpander"].map((name) => (
            <div key={name} className="overflow-hidden rounded-[18px] bg-canvas">
              <div className="grid h-[59px] place-items-center bg-[repeating-linear-gradient(135deg,var(--border)_0_8px,var(--input)_8px_9px)] text-muted-foreground lg:h-[74px]"><Car className="size-6 opacity-50" /></div>
              <div className="px-3 py-2.5">
                <p className="truncate text-xs font-semibold">{name}</p>
                <p className="mt-1 font-display text-base font-bold">₱1,500<span className="font-sans text-[10px] font-normal text-muted-foreground">/day</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toast({ className, delay, icon: Icon, tone, title, sub, amount }: {
  className?: string; delay: number; icon: LucideIcon; tone: string; title: string; sub: string; amount?: string;
}) {
  return (
    <div className={cn("animate-fb-toast absolute flex items-center gap-3 rounded-[20px] bg-white py-3 pr-4 pl-3 text-navy-900 shadow-[0_18px_40px_rgb(10_20_48/0.35)]", className)}
      style={{ "--fb-delay": `${delay}s` } as React.CSSProperties}>
      <span className={cn("grid size-[38px] shrink-0 place-items-center rounded-[12px] text-white", tone)}><Icon className="size-[18px]" /></span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold">{title}</p>
        <p className="mt-px truncate text-xs whitespace-nowrap text-muted-foreground">{sub}</p>
      </div>
      {amount && <span className="ml-1.5 font-display text-base font-bold text-emerald-700">{amount}</span>}
    </div>
  );
}

function Pricing() {
  const free = PLANS.find((p) => p.id === "FREE")!;
  const business = PLANS.find((p) => p.id === "BUSINESS")!;
  return (
    <section id="pricing" className="mt-14 scroll-mt-20 bg-canvas py-[52px] lg:mt-28 lg:py-[104px]">
      <div className="container-page">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-10">
          <div>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-2 lg:mt-2.5 font-display text-[30px] leading-[1.1] font-bold tracking-tight text-navy-900 lg:text-[46px] lg:leading-[1.08]">Try it free for {TRIAL_DAYS} days. Grow with your fleet.</h2>
          </div>
          <div className="hidden items-center gap-4 justify-self-end rounded-[25px] bg-white px-[22px] py-[18px] ring-1 ring-black/5 lg:flex">
            <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-emerald-50 text-emerald-700"><TrendingUp className="size-[22px]" /></span>
            <p className="max-w-[320px] text-sm leading-normal text-navy-800"><b className="text-navy-900">Pro pays for itself with one rental.</b> {PRO.price} a month is about a third of a single ₱1,500 rental day.</p>
          </div>
        </div>

        {/* Desktop: three cards, Pro lifted */}
        <div className="mt-11 hidden items-stretch gap-5 lg:grid lg:grid-cols-3">
          {PLANS.map((p) => {
            const pro = p.id === "PRO";
            return (
              <div key={p.id} className={cn("relative flex flex-col rounded-3xl p-8", pro ? "-translate-y-3 bg-navy-900 text-white shadow-[0_20px_50px_rgb(18_31_59/0.3)]" : "bg-white text-navy-900 ring-1 ring-black/5")}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{p.name}</p>
                  {pro && <span className="inline-flex h-[26px] items-center rounded-full bg-electric px-3 text-xs font-semibold">Most popular</span>}
                </div>
                <p className="mt-3.5"><span className="font-display text-5xl leading-none font-bold">{p.price}</span><span className={cn("text-sm", pro ? "text-white/60" : "text-muted-foreground")}>{p.period}</span></p>
                <p className={cn("mt-1.5 text-sm font-medium", pro ? "text-cyan" : "text-electric")}>{p.vehicles}</p>
                <ul className={cn("mt-[22px] mb-7 grid gap-2.5 text-sm", pro ? "text-white/90" : "text-navy-800")}>
                  {p.features.map((f) => <li key={f} className="flex gap-2.5"><Check className={cn("size-4 shrink-0", pro ? "text-emerald-400" : "text-emerald-600")} />{f}</li>)}
                </ul>
                <Link href="/register/business" className={cn(buttonVariants({ variant: pro ? "electric" : "outline" }), "mt-auto h-12 w-full rounded-full text-[15px] font-semibold", pro ? "shadow-[0_6px_18px_rgb(47_107_255/0.45)]" : "text-navy-900")}>
                  {p.id === "FREE" ? "Start free" : "Get started"}
                </Link>
                {pro && <span className="absolute inset-x-8 -bottom-1 h-1 rounded-b bg-brand-red" />}
              </div>
            );
          })}
        </div>

        {/* Phones: Pro first and large, Free and Business as a 2-up summary */}
        <div className="mt-[22px] lg:hidden">
          <div className="rounded-[25px] bg-navy-900 p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold">{PRO.name}</p>
              <span className="inline-flex h-6 items-center rounded-full bg-electric px-2.5 text-[11px] font-semibold">Most popular</span>
            </div>
            <p className="mt-2.5"><span className="font-display text-[40px] leading-none font-bold">{PRO.price}</span><span className="text-[13px] text-white/60">{PRO.period}</span></p>
            <p className="mt-1 text-[13px] text-cyan">{PRO.vehicles} · pays for itself with one rental</p>
            <Link href="/register/business" className={cn(buttonVariants({ variant: "electric" }), "mt-[18px] h-12 w-full rounded-full text-[15px] font-semibold")}>Start {TRIAL_DAYS}-day free trial</Link>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {[{ p: free, note: `${TRIAL_DAYS} days · ${PLAN_VEHICLE_LIMIT.FREE} vehicles` }, { p: business, note: `${business.period} · unlimited` }].map(({ p, note }) => (
              <Link key={p.id} href="/register/business" className="rounded-[22px] bg-white p-[18px] text-navy-900">
                <p className="text-[13px] font-semibold">{p.name}</p>
                <p className="mt-1.5 font-display text-[26px] leading-none font-bold">{p.price}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">Plans are prepaid monthly and never renew automatically. Pay with GCash, Maya, card or QR Ph.</p>
      </div>
    </section>
  );
}
