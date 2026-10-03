import { Check, Eye, Fingerprint, PenLine, Send, ShieldCheck } from "lucide-react";
import { cn } from "cn";
import { Pill } from "@/components/common/badges";
import type { ContractPdfInput, ContractSignature } from "@/lib/contracts/pdf";
import { browserLabel, formatDate } from "@/lib/format";
import { groupFingerprint } from "@/lib/signature";

const at = (iso: string) => `${formatDate(iso, { dateStyle: "medium", timeStyle: "medium" })} (PHT)`;

/** On-screen version of the PDF's signature certificate (1f desktop / 2e phone): the audit trail of one signed version. */
export function SignatureCertificate({ c }: { c: ContractPdfInput }) {
  const provider = c.signatures.find((s) => s.signer_role === "PROVIDER");
  const renter = c.signatures.find((s) => s.signer_role === "RENTER");
  const rows = [
    provider && { icon: PenLine, title: "Signed by Rental Provider", at: provider.signed_at, lines: signer(provider) },
    c.sentAt && { icon: Send, title: "Sent for signature", at: c.sentAt, lines: [<span key="to" className="text-navy-800">To {c.sentTo ?? c.renterName}</span>] },
    c.viewedAt && { icon: Eye, title: "Opened by Renter", at: c.viewedAt, lines: [evidence(c.viewedIp, c.viewedUserAgent)] },
    renter && { icon: Check, title: "Signed by Renter", at: renter.signed_at, lines: signer(renter), done: true },
  ].filter((r) => !!r);

  return (
    <article className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
      <span className="block h-1.5 bg-navy-900" />
      <header className="flex flex-col-reverse items-start gap-3 px-5 pt-[22px] pb-4 sm:flex-row sm:gap-4 sm:px-9 sm:pt-7 sm:pb-5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted-foreground">Booking {c.reference} · Version {c.version}</p>
          <h1 className="mt-1 font-display text-2xl leading-tight font-bold text-navy-900 sm:text-[26px]">Signature certificate</h1>
          <p className="mt-1.5 text-xs break-all text-muted-foreground sm:mt-1 sm:text-[13px]">Document ID <span className="font-mono">{c.documentId}</span></p>
        </div>
        <Pill tone="success" className="h-[26px] gap-1.5 sm:h-7 sm:px-3 sm:text-[13px]"><ShieldCheck className="size-3.5 sm:size-4" /> Complete</Pill>
      </header>

      <div className="mx-5 rounded-2xl bg-navy-900 px-[18px] py-4 text-white sm:mx-9 sm:px-5 sm:py-[18px]">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-white/60 uppercase sm:text-[11px]">
          <Fingerprint className="size-3.5 text-cyan" /> <span className="sm:hidden">Fingerprint · SHA-256</span><span className="hidden sm:inline">Document fingerprint · SHA-256 of the agreement text</span>
        </p>
        <p className="mt-2.5 grid grid-cols-[repeat(4,auto)] justify-between gap-x-2 gap-y-1 font-mono text-[13px] leading-normal font-medium text-cream sm:justify-start sm:gap-x-[18px] sm:text-base sm:leading-snug">
          {groupFingerprint(c.contentHash).split(" ").map((g, i) => <span key={i}>{g}</span>)}
        </p>
      </div>

      <ol className="mt-[22px] mr-5 ml-[33px] grid gap-[18px] border-l-2 border-border pl-6 sm:mt-6 sm:mr-9 sm:ml-[50px] sm:gap-5 sm:pl-7">
        {rows.map((r) => (
          <li key={r.title} className="relative">
            <span className={cn("absolute -top-0.5 -left-[38px] grid size-[26px] place-items-center rounded-full text-white ring-4 ring-white sm:-left-[43px] sm:size-7", r.done ? "bg-emerald-500" : "bg-electric")}>
              <r.icon className="size-[13px] sm:size-3.5" strokeWidth={r.done ? 3 : 2} />
            </span>
            <div className="sm:flex sm:justify-between sm:gap-3">
              <p className="text-sm font-semibold text-navy-900">{r.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground sm:mt-0 sm:shrink-0">{at(r.at)}</p>
            </div>
            <div className="mt-1 grid text-[13px] leading-normal text-muted-foreground">{r.lines}</div>
          </li>
        ))}
      </ol>

      <p className="mx-5 mt-6 border-t pt-3.5 pb-[22px] text-xs leading-relaxed text-muted-foreground sm:mx-9 sm:mt-7 sm:pt-4 sm:pb-7">
        All times are Philippine Standard Time (UTC+8). IP addresses and browsers were recorded by the server from each request, not entered by the signers. Both signatures apply to the fingerprint above; any change to the agreement produces a different fingerprint and needs a new version signed by both parties.
      </p>
    </article>
  );
}

function signer(s: ContractSignature) {
  return [
    <span key="who" className="text-navy-800">{s.signer_name}{s.signer_email && ` · ${s.signer_email}`}</span>,
    evidence(s.ip_address, s.user_agent, `${s.signature_type === "DRAWN" ? "Drawn" : "Typed"} signature`),
  ];
}

function evidence(ip: unknown, ua: string | null | undefined, lead?: string) {
  const parts = [lead, ip ? `IP ${String(ip)}` : null, browserLabel(ua)].filter(Boolean);
  return parts.length ? <span key="evidence" title={ua ?? undefined}>{parts.join(" · ")}</span> : null;
}
