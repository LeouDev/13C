import { BadgeCheck } from "lucide-react";
import { cn } from "cn";
import type { ContractSection, ContractSignature } from "@/lib/contracts/pdf";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { CollapsibleSections } from "@/components/contract/collapsible-sections";
import { formatDate, formatDateTime } from "@/lib/format";

/** A party's signature image (older signatures without one show the name). */
export function SignatureMark({ sig, className }: { sig: Pick<ContractSignature, "signer_name" | "signature_data">; className?: string }) {
  return sig.signature_data
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={sig.signature_data} alt={`Signature of ${sig.signer_name}`} className={cn("w-auto", className)} />
    : <p className={cn("font-serif text-2xl text-navy-900 italic", className)}>{sig.signer_name}</p>;
}

/** The agreement's numbered sections. */
export function ContractSections({ sections, className }: { sections: ContractSection[]; className?: string }) {
  return (
    <div className={cn("prose-contract grid gap-6 text-[14px] leading-relaxed text-navy-800", className)}>
      {sections.map((s) => (
        <section key={s.key}>
          <h3 className="font-semibold text-navy-900">{s.title}</h3>
          <p>{s.body}</p>
        </section>
      ))}
    </div>
  );
}

export function ContractDocument({
  title, version, reference, sections, signatures, contentHash, providerName, renterName, providerLogo, signedAt, collapsible,
}: {
  title: string; version: number; reference: string; sections: ContractSection[]; signatures: ContractSignature[];
  contentHash: string; providerName: string; renterName: string; providerLogo?: string | null;
  /** Signed versions get a "Signed" stamp. */
  signedAt?: string | null;
  /** Show a preview of the sections on large screens until the reader expands them. */
  collapsible?: boolean;
}) {
  const body = <ContractSections sections={sections} className={cn("px-5 sm:px-10", collapsible ? "pt-6 pb-6 lg:pb-2" : "py-6")} />;
  return (
    <article className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
      <header className="relative border-b px-5 py-6 sm:px-10">
        {signedAt && (
          <span className="absolute top-5 right-5 -rotate-6 rounded-[10px] border-2 border-emerald-600 px-3 py-1.5 text-center font-condensed text-[13px] leading-[1.1] font-semibold tracking-[.14em] text-emerald-600 uppercase sm:top-7 sm:right-9">
            Signed<br /><span className="text-[11px] tracking-[.08em]">{formatDate(signedAt)}</span>
          </span>
        )}
        {providerLogo && <BusinessLogo path={providerLogo} name={providerName} className="mb-4 size-14" />}
        <div className={cn(signedAt && "pr-24")}>
          <p className="eyebrow text-muted-foreground">Booking {reference} · Version {version}</p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{title}</h2>
        </div>
        <dl className="mt-4 grid gap-2 rounded-2xl bg-canvas p-4 text-sm sm:grid-cols-3">
          <div><dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Rental Provider</dt><dd className="font-semibold">{providerName}</dd></div>
          <div><dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Renter</dt><dd className="font-semibold">{renterName}</dd></div>
          <div><dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Technology Platform</dt><dd className="font-semibold">13C <span className="font-normal text-muted-foreground">(not a party)</span></dd></div>
        </dl>
      </header>
      {collapsible ? <CollapsibleSections count={sections.length}>{body}</CollapsibleSections> : body}
      <footer className="grid gap-4 border-t px-5 py-6 sm:grid-cols-2 sm:px-10">
        {(["PROVIDER", "RENTER"] as const).map((role) => {
          const sig = signatures.find((x) => x.signer_role === role);
          return (
            <div key={role} className="rounded-2xl border p-4">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{role === "PROVIDER" ? "Rental Provider" : "Renter"}</p>
              {sig ? (
                <>
                  <SignatureMark sig={sig} className="mt-2 h-14" />
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><BadgeCheck className="size-3.5" /> Signed by {sig.signer_name} · {formatDateTime(sig.signed_at)}</p>
                </>
              ) : <p className="mt-2 text-sm text-muted-foreground">Not signed yet</p>}
            </div>
          );
        })}
        <p className="text-[11px] break-all text-muted-foreground sm:col-span-2">SHA-256 fingerprint: {contentHash}</p>
      </footer>
    </article>
  );
}
