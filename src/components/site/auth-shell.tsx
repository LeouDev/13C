import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DriveCar } from "@/components/site/drive-car";
import { SpeedStreaks } from "@/components/site/speed-streaks";

const after = (seconds: number) => ({ animationDelay: `${seconds}s` });

/** Split layout for auth pages: form on the left, animated brand panel on the right (desktop) or a compact hero above (mobile). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container-page grid min-h-[calc(100svh-4rem)] content-start gap-8 py-4 lg:grid-cols-2 lg:content-normal lg:items-center lg:gap-10 lg:py-10">
      <div className="relative flex h-[200px] flex-col overflow-hidden rounded-[28px] bg-navy-900 px-6 pt-5 lg:hidden">
        <div className="speed-lines absolute inset-0" />
        <SpeedStreaks count={6} seed={11} top={4} bottom={40} />
        <p className="relative font-display-italic text-[26px] leading-[1.15] text-white">Drive anywhere in Cebu.</p>
        <div className="relative -mx-6 mt-auto pb-[22px]">
          <div className="flex justify-center"><DriveCar className="w-[190px]" /></div>
          <div className="road-dashes mt-0.5" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display-italic text-3xl text-navy-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative hidden h-full min-h-[520px] overflow-hidden rounded-[2rem] bg-navy-900 p-10 text-white lg:flex lg:flex-col">
        <div className="speed-lines absolute inset-0" />
        <SpeedStreaks count={10} seed={7} top={6} bottom={40} />
        <Logo tone="light" speed rush className="relative h-16 self-start" />
        <div className="relative -mx-10 flex flex-1 flex-col justify-center">
          <div className="flex justify-center"><DriveCar className="w-[380px]" /></div>
          <div className="road-dashes mt-0.5" />
        </div>
        <div className="relative">
          <p style={after(0.5)} className="animate-fade-in-x font-display-italic text-4xl leading-tight">Drive anywhere<br />in Cebu.</p>
          <p style={after(0.65)} className="animate-fade-in-x mt-3 max-w-sm text-white/70">Verified local rental businesses, transparent prices, and digital rental agreements you can sign from your phone.</p>
          <Link href="/for-business" style={after(0.8)} className="animate-fade-in-x mt-6 inline-block text-sm font-semibold text-cyan hover:underline">Own a rental business? Get your own storefront →</Link>
        </div>
      </div>
    </div>
  );
}
