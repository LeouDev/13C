import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LOCATIONS } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-navy-950 text-white/70">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" speed className="h-10" />
          <p className="mt-4 max-w-xs text-sm">Find and book cars from trusted local rental businesses across Cebu.</p>
          <p className="mt-4 max-w-xs text-xs text-white/45">
            13C is a technology marketplace and software platform. Vehicles are owned, operated and rented by independent rental businesses.
          </p>
        </div>
        <div>
          <p className="eyebrow text-white">Rent</p>
          <ul className="mt-4 grid gap-2 text-sm">
            {LOCATIONS.slice(0, 5).map((l) => (
              <li key={l.slug}><Link href={`/explore/${l.slug}`} className="hover:text-white">Cars in {l.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white">Businesses</p>
          <ul className="mt-4 grid gap-2 text-sm">
            <li><Link href="/for-business" className="hover:text-white">Why 13C</Link></li>
            <li><Link href="/for-business#pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link href="/register/business" className="hover:text-white">Create your rental business</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">Business dashboard</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white">13C</p>
          <ul className="mt-4 grid gap-2 text-sm">
            <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><a href="mailto:support@air-rally.com" className="hover:text-white">support@air-rally.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/45 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} 13C. Made in Cebu.</p>
          <p>Car rental · Drive anywhere</p>
        </div>
      </div>
    </footer>
  );
}
