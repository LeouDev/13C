import Link from "next/link";
import { Check, Gem } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Shown in place of a Business-plan feature for businesses on another plan. */
export function BusinessUpsell({ title, points }: { title: string; points: string[] }) {
  return (
    <section className="rounded-3xl border border-dashed border-electric/40 bg-white p-5 sm:p-6">
      <p className="flex items-center gap-2 font-semibold text-navy-900"><Gem className="size-4 text-electric" /> {title}</p>
      <ul className="mt-3 grid gap-1.5 text-sm text-navy-800">
        {points.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{p}</li>)}
      </ul>
      <Link href="/dashboard/subscription" className={buttonVariants({ variant: "electric", className: "mt-4" })}>Available on Business · See plans</Link>
    </section>
  );
}
