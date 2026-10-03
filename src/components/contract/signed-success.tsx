"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Download, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { groupFingerprint } from "@/lib/signature";

// [top %, height px, delay s, colour, width %]
const STREAKS = [[12, 3, 0, "bg-cream/25", 46], [22, 2, 0.08, "bg-brand-red", 34], [31, 4, 0.03, "bg-cream/18", 58], [44, 2, 0.12, "bg-brand-red", 28], [57, 3, 0.06, "bg-cream/22", 40]] as const;

export type SuccessInfo = {
  bookingId: string; versionId: string; reference: string; version: number; contentHash: string;
  vehicle: string; providerName: string; pickupAt: string; providerSigner?: string; providerSignature?: string | null;
};

/** Right after the renter signs (?signed=1): a dialog on desktop (2a), a full screen on phones (2b). Closing drops the parameter. */
export function SignedSuccess({ info: i, renterName, renterSignature }: { info: SuccessInfo; renterName: string; renterSignature: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const close = () => router.replace(pathname, { scroll: false });
  const rows = [
    { who: i.providerName, name: i.providerSigner ?? i.providerName, image: i.providerSignature, delay: 1.5 },
    { who: "You · just now", name: renterName, image: renterSignature, delay: 1.9 },
  ];

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-success-fade fixed inset-0 z-50 hidden bg-navy-950/60 backdrop-blur-[3px] lg:block" />
        <Dialog.Popup onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          className="fixed inset-0 z-50 overflow-y-auto text-white outline-none lg:grid lg:place-items-center">
          <div className="speed-lines animate-success-dialog relative flex min-h-full flex-col overflow-hidden bg-navy-900 lg:min-h-0 lg:w-[560px] lg:rounded-3xl lg:px-12 lg:pt-10 lg:pb-9 lg:shadow-[0_30px_80px_rgb(10_20_48/0.5)]">
            {STREAKS.map(([top, height, delay, color, width]) => (
              <span key={top} aria-hidden className={`animate-success-sweep pointer-events-none absolute right-0 rounded ${color}`}
                style={{ top: `${top}%`, height, width: `${width}%`, animationDelay: `${delay}s` }} />
            ))}
            <header className="relative flex items-center justify-between px-5 py-[18px] lg:hidden">
              <Logo tone="light" className="h-[26px]" />
              <Dialog.Close aria-label="Close" className="grid size-9 place-items-center rounded-full bg-white/10"><X className="size-[18px]" /></Dialog.Close>
            </header>

            <div className="relative flex flex-1 flex-col items-center px-7 pt-10 text-center lg:px-0 lg:pt-2">
              <span className="animate-success-badge grid size-24 place-items-center rounded-full bg-emerald-500 lg:size-[88px]">
                <svg viewBox="0 0 24 24" className="size-[50px] lg:size-[46px]" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" className="animate-success-check" />
                </svg>
              </span>
              <p className="eyebrow animate-success-rise mt-11 text-cyan lg:mt-8" style={{ animationDelay: "1s" }}>Signed &amp; confirmed</p>
              <Dialog.Title className="font-display-italic animate-success-rise mt-2 text-[40px] leading-none lg:text-[44px]" style={{ animationDelay: "1.1s" }}>
                See you {formatDate(i.pickupAt, { month: "short", day: "numeric" })}!
              </Dialog.Title>
              <p className="animate-success-rise mt-3.5 max-w-[400px] text-[15px] leading-[1.55] text-pretty text-white/75" style={{ animationDelay: "1.2s" }}>
                Your {i.vehicle} is booked with {i.providerName}. We emailed the signed PDF to you.
              </p>
              <div className="animate-success-rise mt-7 grid w-full gap-3 rounded-2xl border border-white/12 bg-white/7 p-4 text-left" style={{ animationDelay: "1.35s" }}>
                {rows.map((r) => (
                  <div key={r.who} className="animate-success-rise flex items-center gap-2.5" style={{ animationDelay: `${r.delay}s` }}>
                    <span className="animate-success-pop grid size-[22px] shrink-0 place-items-center rounded-full bg-emerald-500" style={{ animationDelay: `${r.delay + 0.1}s` }}>
                      <Check className="size-[13px]" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{r.who}</span>
                    {r.image
                      // Signatures are navy ink; inverted they read as cream on navy.
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.image} alt={`Signature of ${r.name}`} className="animate-success-write h-6 w-auto max-w-[45%] object-contain invert lg:h-7" style={{ animationDelay: `${r.delay + 0.2}s` }} />
                      : <span className="animate-success-write font-serif text-lg text-cream italic" style={{ animationDelay: `${r.delay + 0.2}s` }}>{r.name}</span>}
                  </div>
                ))}
                <p className="border-t border-white/12 pt-2.5 font-mono text-[11px] text-white/55">
                  {i.reference} · v{i.version} · {groupFingerprint(i.contentHash).split(" ").slice(0, 2).join(" ")}…
                </p>
              </div>
            </div>

            <div className="animate-success-rise relative grid gap-2 p-5 lg:mt-6 lg:grid-cols-2 lg:gap-2.5 lg:p-0" style={{ animationDelay: "1.5s" }}>
              <Link href={`/account/bookings/${i.bookingId}`} className={buttonVariants({ variant: "electric", size: "xl" })}>See pickup &amp; payment</Link>
              <a href={`/api/contracts/${i.versionId}/pdf`} target="_blank" className={buttonVariants({ variant: "light", size: "xl" })}><Download /> Download signed PDF</a>
            </div>
            <span className="absolute inset-x-0 bottom-0 h-1 bg-brand-red" />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
