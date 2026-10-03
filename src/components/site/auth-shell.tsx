import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/** Split layout for auth pages: form on the left, brand panel on the right (desktop). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container-page grid min-h-[calc(100svh-4rem)] items-center gap-10 py-10 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display-italic text-3xl text-navy-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative hidden h-full min-h-[520px] overflow-hidden rounded-[2rem] bg-navy-900 p-10 text-white lg:flex lg:flex-col">
        <div className="speed-lines absolute inset-0" />
        <Logo tone="light" speed className="relative h-16 self-start" />
        <div className="relative mt-auto">
          <p className="font-display-italic text-4xl leading-tight">Drive anywhere<br />in Cebu.</p>
          <p className="mt-3 max-w-sm text-white/70">Verified local rental businesses, transparent prices, and digital rental agreements you can sign from your phone.</p>
          <Link href="/for-business" className="mt-6 inline-block text-sm font-semibold text-cyan hover:underline">Own a rental business? Get your own storefront →</Link>
        </div>
      </div>
    </div>
  );
}
