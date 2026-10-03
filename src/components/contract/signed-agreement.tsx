import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight, BadgeCheck, Car, Check, CircleCheck, Download, FileCheck2, FileText, Fingerprint, IdCard, MapPin, MessageSquare, ShieldCheck } from "lucide-react";
import { cn } from "cn";
import { Pill } from "@/components/common/badges";
import { ContractDocument, SignatureMark } from "@/components/contract/contract-document";
import { buttonVariants } from "@/components/ui/button";
import type { ContractSection, ContractSignature } from "@/lib/contracts/pdf";
import { formatDate, formatDateTime, formatPHP, formatTime, labelize } from "@/lib/format";
import { groupFingerprint } from "@/lib/signature";
import type { Database } from "@/types/database";

type Booking = Pick<Database["public"]["Tables"]["bookings"]["Row"],
  "id" | "reference" | "status" | "conversation_id" | "pickup_at" | "return_at" | "pickup_location" | "return_location" |
  "total_amount" | "security_deposit" | "payment_method" | "payment_status">;
type Version = {
  id: string; version: number; title: string; sections: ContractSection[]; content_hash: string;
  signed_at: string | null; sent_at: string | null; viewed_at: string | null; signatures: ContractSignature[];
};

const STEP_TONE = { todo: "bg-amber-50 text-amber-800", done: "bg-emerald-50 text-emerald-700", next: "bg-accent text-electric" };
const PAYMENT_PILL = {
  UNPAID: <Pill tone="warning">Unpaid</Pill>,
  PARTIALLY_PAID: <Pill tone="warning">Partly paid</Pill>,
  PAID: <Pill tone="success">Paid</Pill>,
  PAYMENT_ON_PICKUP: <Pill tone="info">At pickup</Pill>,
};
const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const dayTime = (iso: string) => formatDate(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The booking page's card for the latest signed version (1d desktop / 2c phone). */
export function SignedAgreementCard({ bookingId, providerName, version: v, older }: {
  bookingId: string; providerName: string; older: { id: string; version: number }[];
  version: { id: string; version: number; signed_at: string | null; content_hash: string;
    signatures: Pick<ContractSignature, "signer_role" | "signer_name" | "signature_data" | "signed_at">[] };
}) {
  const groups = groupFingerprint(v.content_hash).split(" ");
  const certificate = `/account/bookings/${bookingId}/contract/certificate`;
  return (
    <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3.5 sm:gap-3.5 sm:pb-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-emerald-50 text-emerald-700 sm:size-11 sm:rounded-2xl"><FileCheck2 className="size-5 sm:size-[22px]" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-navy-900 sm:text-base">Signed rental agreement</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-[13px]">
            Version {v.version}<span className="hidden sm:inline"> · signed by both parties</span>{v.signed_at && ` · ${formatDateTime(v.signed_at)}`}
          </p>
        </div>
        <Pill tone="success" className="hidden sm:inline-flex"><BadgeCheck className="size-3.5" /> Signed</Pill>
      </div>
      <div className="mx-5 grid overflow-hidden rounded-2xl border sm:grid-cols-2">
        {(["PROVIDER", "RENTER"] as const).map((role) => {
          const s = v.signatures.find((x) => x.signer_role === role);
          return s && (
            <div key={role} className="flex items-center gap-2.5 border-b px-4 py-3 last:border-b-0 sm:block sm:border-r sm:border-b-0 sm:py-3.5 sm:last:border-r-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:text-[11px]">
                  {role === "PROVIDER" ? "Rental Provider" : <>Renter<span className="sm:hidden"> · You</span></>}
                </p>
                <SignatureMark sig={s} className="mt-0.5 h-8 max-w-full object-contain object-left sm:h-9" />
                <p className="hidden text-xs text-muted-foreground sm:block">{role === "PROVIDER" ? providerName : "You"} · {dayTime(s.signed_at)}</p>
              </div>
              <span className="text-right text-[11px] text-emerald-700 sm:hidden">Signed<br />{dayTime(s.signed_at)}</span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 px-5 pt-4 pb-2 sm:flex sm:items-center sm:pb-5">
        <a href={`/api/contracts/${v.id}/pdf`} target="_blank" className={buttonVariants({ className: "h-11 sm:h-8" })}>
          <Download /> <span className="sm:hidden">PDF (v{v.version})</span><span className="hidden sm:inline">Version {v.version} (PDF)</span>
        </a>
        <Link href={certificate} className={buttonVariants({ variant: "outline", className: "h-11 sm:h-8" })}><ShieldCheck /> Certificate</Link>
        <Link href={`/account/bookings/${bookingId}/contract`} className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>View online</Link>
        <span className="ml-auto hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground sm:flex"><Fingerprint className="size-3.5" /> {groups.slice(0, 2).join(" ")}…</span>
      </div>
      <div className="flex items-center justify-between px-5 pt-1 pb-[18px] sm:hidden">
        <Link href={`/account/bookings/${bookingId}/contract`} className="text-sm font-medium text-navy-900">View online</Link>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"><Fingerprint className="size-3.5" /> {groups[0]}…</span>
      </div>
      {older.length > 0 && (
        <p className="-mt-1 px-5 pb-5 text-xs text-muted-foreground">
          Earlier signed versions:{" "}
          {older.map((o, i) => (
            <Fragment key={o.id}>{i > 0 && ", "}<a href={`/api/contracts/${o.id}/pdf`} target="_blank" className="font-medium text-navy-900 hover:underline">Version {o.version} (PDF)</a></Fragment>
          ))}
        </p>
      )}
    </section>
  );
}

/** The renter's view of a signed agreement (1a desktop / 1b phone). */
export function SignedAgreement({ booking: b, version: v, providerName, providerLogo, renterName, payTo }: {
  booking: Booking; version: Version; providerName: string; providerLogo?: string | null; renterName: string;
  payTo?: { account_name: string | null; account_number: string | null } | null;
}) {
  const pdf = `/api/contracts/${v.id}/pdf`;
  const certificate = `/account/bookings/${b.id}/contract/certificate`;
  const provider = v.signatures.find((s) => s.signer_role === "PROVIDER");
  const renter = v.signatures.find((s) => s.signer_role === "RENTER");
  const confirmed = ["SIGNED", "CONFIRMED", "ACTIVE"].includes(b.status);
  const upcoming = b.status === "SIGNED" || b.status === "CONFIRMED";
  const events = [
    { label: `Signed by ${providerName}`, at: provider?.signed_at },
    { label: "Sent to you", at: v.sent_at },
    { label: "Opened by you", at: v.viewed_at },
    { label: "Signed by you · confirmed", at: renter?.signed_at },
  ].filter((e): e is { label: string; at: string } => !!e.at);

  return (
    <div className="mx-auto grid max-w-[1040px] gap-4 pb-24 lg:gap-6 lg:pb-0">
      <Link href={`/account/bookings/${b.id}`} className="text-sm text-muted-foreground hover:text-navy-900">← Booking {b.reference}</Link>

      <section className="speed-lines relative grid gap-2.5 overflow-hidden rounded-3xl bg-navy-900 px-5 pt-6 pb-[26px] text-white lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-9 lg:px-10 lg:pt-9 lg:pb-10">
        <div className="flex flex-col gap-2.5 lg:gap-3.5">
          <span className="grid size-11 place-items-center rounded-full bg-emerald-500 ring-6 ring-emerald-500/18 lg:size-[52px] lg:ring-8">
            <Check className="size-6 lg:size-7" strokeWidth={3} />
          </span>
          <p className="eyebrow mt-1.5 text-cyan"><span className="hidden lg:inline">Booking {b.reference} · Version {v.version} · </span>Signed by both parties</p>
          <h1 className="font-display text-[30px] leading-[1.05] font-bold tracking-tight lg:text-[40px]">
            {confirmed ? `You're all set, ${renterName.split(" ")[0]}.` : "Signed rental agreement"}
          </h1>
          <p className="text-sm text-white/75 lg:hidden">{confirmed ? `Your booking with ${providerName} is confirmed.` : `Signed by you and ${providerName}.`}</p>
          <p className="hidden max-w-[470px] text-[15px] leading-[1.55] text-pretty text-white/75 lg:block">
            {confirmed ? `Your rental agreement is signed and your booking with ${providerName} is confirmed.` : `You and ${providerName} both signed this agreement.`} Both of you can download this agreement anytime.
          </p>
          <div className="mt-2 hidden gap-2.5 lg:flex">
            <a href={pdf} target="_blank" className={buttonVariants({ variant: "electric", size: "xl" })}><Download /> Download signed PDF</a>
            <Link href={certificate} className={buttonVariants({ variant: "light", size: "xl" })}><ShieldCheck /> Signature certificate</Link>
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-2 lg:mt-0 lg:grid-cols-1 lg:content-center lg:gap-3">
          {provider && <SignatureTile sig={provider} short="Provider" label={`Rental Provider · ${providerName}`} />}
          {renter && <SignatureTile sig={renter} short="You" label="Renter · You" />}
        </div>
        <span className="absolute inset-x-0 bottom-0 h-1 bg-brand-red" />
      </section>

      {upcoming && (
        <section className="grid gap-3">
          <h2 className="hidden font-display text-lg leading-tight font-bold text-navy-900 lg:block">Before pickup</h2>
          <div className="grid divide-y rounded-3xl bg-white px-5 py-1.5 ring-1 ring-black/5 lg:grid-cols-3 lg:gap-4 lg:divide-y-0 lg:bg-transparent lg:p-0 lg:ring-0">
            <PayStep b={b} providerName={providerName} payTo={payTo} />
            <Step n={2} tone="next" title="Pick up the car" mobileTitle={`Pickup ${day(b.pickup_at)}, ${formatTime(b.pickup_at)}`}
              big={<>{day(b.pickup_at)} <Small>{formatTime(b.pickup_at)}</Small></>}>
              <p className="flex gap-1"><MapPin className="mt-[3px] size-3.5 shrink-0" />
                <span>{b.pickup_location ?? "Pickup location to be confirmed"}<span className="hidden lg:inline">. Return {day(b.return_at)}, {formatTime(b.return_at)}{b.return_location && b.return_location !== b.pickup_location ? ` at ${b.return_location}` : ", same place"}.</span></span>
              </p>
            </Step>
            <Step n={3} tone="next" title="Bring" mobileTitle="Bring your license + 1 government ID">
              <ul className="grid gap-1.5 text-navy-800 lg:mt-1.5">
                <li className="hidden gap-2 lg:flex"><IdCard className="size-4 text-electric" /> Driver&apos;s license</li>
                <li className="hidden gap-2 lg:flex"><IdCard className="size-4 text-electric" /> One valid government ID</li>
                <li className="flex gap-2 text-muted-foreground lg:text-navy-800"><Car className="hidden size-4 text-electric lg:block" /><span>Inspect the car with the business<span className="lg:hidden"> at pickup</span></span></li>
              </ul>
            </Step>
          </div>
        </section>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <a href="#agreement" className="flex items-center gap-3.5 rounded-3xl bg-white px-5 py-[18px] ring-1 ring-black/5 lg:hidden">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-canvas text-navy-900"><FileText className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-navy-900">{v.title}</span><span className="text-xs text-muted-foreground">Version {v.version} · {v.sections.length} sections</span></span>
          <span className="text-[13px] font-semibold text-electric">Read</span>
        </a>
        <div id="agreement" className="hidden scroll-mt-24 target:block lg:block">
          <ContractDocument title={v.title} version={v.version} reference={b.reference} sections={v.sections} signatures={v.signatures}
            contentHash={v.content_hash} providerName={providerName} renterName={renterName} providerLogo={providerLogo} signedAt={v.signed_at} collapsible />
        </div>
        <aside className="grid gap-4 lg:sticky lg:top-24">
          <section className="rounded-3xl bg-white px-5 py-[18px] ring-1 ring-black/5 lg:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900 lg:text-base"><ShieldCheck className="size-[18px] text-electric lg:size-5" /> Verified record</h2>
            <p className="mt-3 mb-1.5 hidden text-[11px] font-semibold tracking-wide text-muted-foreground uppercase lg:block">SHA-256 fingerprint</p>
            <p className="mt-2.5 grid grid-cols-[repeat(4,auto)] justify-start gap-x-2 gap-y-1 rounded-lg bg-canvas px-3 py-2.5 font-mono text-xs leading-normal text-navy-900 lg:mt-0">
              {groupFingerprint(v.content_hash).split(" ").map((g, i) => <span key={i}>{g}</span>)}
            </p>
            <p className="mt-2 hidden items-center gap-1.5 text-xs text-emerald-700 lg:flex"><CircleCheck className="size-3.5" /> Both signatures apply to this exact version</p>
            <ol className="mt-4 ml-1.5 hidden gap-3 border-l border-border pl-5 lg:grid">
              {events.map((e, i) => (
                <li key={e.label} className="relative">
                  <span className={cn("absolute top-0.5 -left-[27px] size-3.5 rounded-full", i === events.length - 1 ? "bg-emerald-500" : "bg-electric")} />
                  <p className="text-[13px] font-semibold text-navy-900">{e.label}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(e.at)}</p>
                </li>
              ))}
            </ol>
            <Link href={certificate} className="mt-2.5 flex items-center gap-1 text-[13px] font-semibold text-electric hover:underline lg:mt-4">
              <span>View<span className="hidden lg:inline"> full</span> certificate</span> <ArrowRight className="size-3.5" />
            </Link>
          </section>
          <p className="hidden px-2 text-xs leading-normal text-muted-foreground lg:block">{providerName} is your Rental Provider. 13C is only the technology platform. Executed under RA 8792.</p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-white/92 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <a href={pdf} target="_blank" className={buttonVariants({ variant: "electric", size: "xl", className: "flex-1" })}><Download /> Download signed PDF</a>
        {b.conversation_id && (
          <Link href={`/account/messages/${b.conversation_id}`} aria-label={`Message ${providerName}`} className={buttonVariants({ variant: "outline", className: "size-12 rounded-full" })}>
            <MessageSquare className="size-[18px]" />
          </Link>
        )}
      </div>
    </div>
  );
}

function SignatureTile({ sig, short, label }: { sig: ContractSignature; short: string; label: string }) {
  return (
    <div className="min-w-0 rounded-[18px] bg-white px-3 py-2.5 text-navy-900 lg:rounded-2xl lg:px-5 lg:py-4">
      <p className="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase lg:text-[11px]">
        <span className="lg:hidden">{short}</span><span className="hidden lg:inline">{label}</span>
      </p>
      <SignatureMark sig={sig} className="mt-1 h-8 max-w-full object-contain object-left lg:h-10" />
      <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 lg:text-xs">
        <BadgeCheck className="hidden size-3.5 lg:block" /><span className="hidden lg:inline">Signed</span> {formatDateTime(sig.signed_at)}
      </p>
    </div>
  );
}

const Small = ({ children }: { children: React.ReactNode }) => <span className="font-sans text-[13px] font-medium text-muted-foreground">{children}</span>;

function Step({ n, tone, title, mobileTitle, pill, big, children }: {
  n: number; tone: keyof typeof STEP_TONE; title: string; mobileTitle?: string; pill?: React.ReactNode; big?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] content-start items-start gap-x-3 py-3.5 lg:gap-y-1.5 lg:rounded-2xl lg:bg-white lg:p-5 lg:ring-1 lg:ring-black/5">
      <span className={cn("row-span-2 grid size-7 place-items-center rounded-full text-[13px] font-bold lg:row-span-1", STEP_TONE[tone])}>{n}</span>
      <p className="self-center text-sm font-semibold text-navy-900"><span className="lg:hidden">{mobileTitle ?? title}</span><span className="hidden lg:inline">{title}</span></p>
      <span className="self-center">{pill}</span>
      <div className="col-span-2 col-start-2 mt-0.5 grid gap-1.5 text-[13px] leading-normal text-muted-foreground lg:col-span-3 lg:col-start-1 lg:mt-0">
        {big && <p className="mt-1.5 hidden font-display text-2xl leading-none font-bold text-navy-900 lg:block">{big}</p>}
        {children}
      </div>
    </div>
  );
}

function PayStep({ b, providerName, payTo }: { b: Booking; providerName: string; payTo?: { account_name: string | null; account_number: string | null } | null }) {
  const total = formatPHP(b.total_amount);
  const cash = b.payment_method === "CASH";
  const deposit = Number(b.security_deposit) > 0 ? formatPHP(b.security_deposit) : null;
  return (
    <Step n={1} tone={b.payment_status === "PAID" ? "done" : b.payment_status === "PAYMENT_ON_PICKUP" ? "next" : "todo"}
      title={`Pay ${providerName}`} mobileTitle={cash ? `Pay ${total} in cash` : `Pay ${total} via ${labelize(b.payment_method)}`}
      pill={PAYMENT_PILL[b.payment_status]} big={<>{total} <Small>{cash ? "in cash" : `via ${labelize(b.payment_method)}`}</Small></>}>
      <p>
        {b.payment_status === "PAID" ? "Paid in full." : cash ? "Pay at pickup." : payTo?.account_number
          ? <>Send to <span className="font-mono text-navy-900">{payTo.account_number}</span>{payTo.account_name && ` (${payTo.account_name})`}.</>
          : "Payment details are on your booking."}
        {deposit && ` Plus ${deposit} refundable deposit at pickup.`}
      </p>
    </Step>
  );
}
