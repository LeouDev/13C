import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/common/social-icons";
import { Logo } from "@/components/brand/logo";
import { VerifiedBadge } from "@/components/common/badges";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { getCurrentUser } from "@/lib/auth";
import { getStorefront, storeSections } from "@/lib/queries";

export default async function StorefrontLayout({ children, params }: LayoutProps<"/[business]">) {
  const { business: slug } = await params;
  const sf = await getStorefront(slug);
  if (!sf) notFound();
  const { business, store } = sf;
  const user = await getCurrentUser();
  const isPublic = business.status === "VERIFIED" && store.is_published;
  const social = store.social_links as Record<string, string | undefined>;
  const show = storeSections(sf);
  const tabs = [["fleet", "Fleet"], ["about", "About"], ["policies", "Policies"], ["reviews", "Reviews"], ["contact", "Contact"]]
    .filter(([id]) => id === "fleet" || id === "contact" || show.has(id))
    .map(([id, label]) => <Link key={id} href={`/${business.slug}#${id}`} className="shrink-0 rounded-full px-3 py-1.5 hover:bg-canvas">{label}</Link>);

  return (
    <div className="flex min-h-svh flex-col bg-[#f6f7f9]" style={{ ["--store-accent" as string]: store.accent_color }}>
      {!isPublic && (
        <div className="bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-amber-950">
          Preview — this store isn&apos;t public yet. Only your team can see it.{" "}
          <Link href="/dashboard/store" className="underline">Go to My Store</Link>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-3">
          <Link href={`/${business.slug}`} className="flex min-w-0 items-center gap-2.5">
            <BusinessLogo path={business.logo_path} name={business.name} accent={store.accent_color} className="size-9 rounded-xl text-sm" />
            <span className="truncate font-bold tracking-tight text-navy-900">{business.name}</span>
            {business.status === "VERIFIED" && <VerifiedBadge compact className="hidden sm:inline-flex" />}
          </Link>
          <nav className="ml-6 hidden items-center gap-1 text-sm font-medium text-navy-800 lg:flex" aria-label="Store">{tabs}</nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link href="/account/bookings" className="hidden rounded-full px-3 py-2 text-sm font-medium text-navy-800 hover:bg-canvas sm:block">My bookings</Link>
            ) : (
              <Link href={`/login?next=/${business.slug}`} className="rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap text-navy-800 hover:bg-canvas">Sign in</Link>
            )}
            <Link href={`/${business.slug}#fleet`} className="rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:brightness-110" style={{ background: "var(--store-accent)" }}>
              Book a car
            </Link>
          </div>
        </div>
        <nav className="container-page flex gap-1 overflow-x-auto pb-2 pl-1 sm:pl-3 text-sm font-medium text-navy-800 [scrollbar-width:none] lg:hidden" aria-label="Store">{tabs}</nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer id="contact" className="mt-16 scroll-mt-30 bg-white lg:scroll-mt-20">
        <div className="container-page grid gap-8 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <BusinessLogo path={business.logo_path} name={business.name} accent={store.accent_color} className="size-11" />
              <div>
                <p className="font-bold text-navy-900">{business.name}</p>
                {store.tagline && <p className="text-sm text-muted-foreground">{store.tagline}</p>}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              {social.facebook && <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-full bg-canvas hover:text-[var(--store-accent)]" aria-label="Facebook"><FacebookIcon className="size-4" /></a>}
              {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-full bg-canvas hover:text-[var(--store-accent)]" aria-label="Instagram"><InstagramIcon className="size-4" /></a>}
              {social.messenger && <a href={social.messenger} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-full bg-canvas hover:text-[var(--store-accent)]" aria-label="Messenger"><MessageCircle className="size-4" /></a>}
              {social.website && <a href={social.website} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-full bg-canvas hover:text-[var(--store-accent)]" aria-label="Website"><Globe className="size-4" /></a>}
            </div>
          </div>
          <ul className="grid content-start gap-2.5 text-sm text-navy-800">
            {business.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-[var(--store-accent)]" />{[business.address, business.city].join(", ")}</li>}
            {business.phone && <li><a href={`tel:${business.phone.replace(/\s/g, "")}`} className="flex gap-2 hover:underline"><Phone className="mt-0.5 size-4 text-[var(--store-accent)]" />{business.phone}</a></li>}
            {business.email && <li><a href={`mailto:${business.email}`} className="flex gap-2 hover:underline"><Mail className="mt-0.5 size-4 text-[var(--store-accent)]" />{business.email}</a></li>}
          </ul>
          <HoursList hours={store.business_hours as { day: string; open: string; close: string; closed: boolean }[]} />
        </div>
        <div className="border-t">
          <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-muted-foreground sm:flex-row">
            <p>{business.name} is an independent rental business and the provider of all vehicles listed here.</p>
            <Link href="/" className="flex items-center gap-2 font-medium text-navy-800 hover:text-navy-900">Powered by <Logo className="h-4" /></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HoursList({ hours }: { hours: { day: string; open: string; close: string; closed: boolean }[] }) {
  if (!hours?.length) return null;
  const fmt = (t: string) => new Date(`2000-01-01T${t}:00`).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-navy-900">Business hours</p>
      <ul className="grid gap-1 text-sm text-muted-foreground">
        {hours.map((h) => <li key={h.day} className="flex justify-between gap-4"><span>{h.day}</span><span>{h.closed ? "Closed" : `${fmt(h.open)} – ${fmt(h.close)}`}</span></li>)}
      </ul>
    </div>
  );
}
