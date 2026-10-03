import { BadgeCheck } from "lucide-react";
import type { ContractSection, ContractSignature } from "@/lib/contracts/pdf";
import { formatDateTime } from "@/lib/format";

export function ContractDocument({
  title, version, reference, sections, signatures, contentHash, providerName, renterName,
}: {
  title: string; version: number; reference: string; sections: ContractSection[]; signatures: ContractSignature[];
  contentHash: string; providerName: string; renterName: string;
}) {
  return (
    <article className="rounded-3xl bg-white ring-1 ring-black/5">
      <header className="border-b px-5 py-6 sm:px-10">
        <p className="eyebrow text-muted-foreground">Booking {reference} · Version {version}</p>
        <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{title}</h2>
        <dl className="mt-4 grid gap-2 rounded-2xl bg-canvas p-4 text-sm sm:grid-cols-3">
          <div><dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Rental Provider</dt><dd className="font-semibold">{providerName}</dd></div>
          <div><dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Renter</dt><dd className="font-semibold">{renterName}</dd></div>
          <div><dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Technology Platform</dt><dd className="font-semibold">13C <span className="font-normal text-muted-foreground">(not a party)</span></dd></div>
        </dl>
      </header>
      <div className="prose-contract grid gap-6 px-5 py-6 text-[14px] leading-relaxed text-navy-800 sm:px-10">
        {sections.map((s) => (
          <section key={s.key}>
            <h3 className="font-semibold text-navy-900">{s.title}</h3>
            <p>{s.body}</p>
          </section>
        ))}
      </div>
      <footer className="grid gap-4 border-t px-5 py-6 sm:grid-cols-2 sm:px-10">
        {(["PROVIDER", "RENTER"] as const).map((role) => {
          const sig = signatures.find((x) => x.signer_role === role);
          return (
            <div key={role} className="rounded-2xl border p-4">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{role === "PROVIDER" ? "Rental Provider" : "Renter"}</p>
              {sig ? (
                <>
                  {sig.signature_data
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={sig.signature_data} alt={`Signature of ${sig.signer_name}`} className="mt-2 h-14 w-auto" />
                    : <p className="mt-2 font-serif text-2xl text-navy-900 italic">{sig.signer_name}</p>}
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
