"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, ExternalLink, Eye, EyeOff, Loader2, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { setStorePublished } from "@/app/actions/business";
import { StoreEditor } from "@/components/business/store-editor";
import { Pill } from "@/components/common/badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { ROOT_DOMAIN, SITE_URL } from "@/lib/constants";
import type { Tables } from "@/types/database";

export function StoreWorkspace({
  business, store, vehicles, canPublish,
}: {
  business: Tables<"businesses">;
  store: Tables<"business_storefronts">;
  vehicles: { id: string; make: string; model: string; year: number }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [pending, start] = useTransition();
  const url = `${SITE_URL}/${business.slug}`;
  const display = `${ROOT_DOMAIN}/${business.slug}`;

  const togglePublish = () => start(async () => {
    const r = await setStorePublished(business.id, !store.is_published);
    if (r.ok) { toast.success(r.message); router.refresh(); setPreviewKey((k) => k + 1); } else toast.error(r.error);
  });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
      <div className="grid content-start gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-navy-900 p-5 text-white sm:p-6">
          <div className="speed-lines absolute inset-0" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow text-cyan">Your 13C Store</p>
              {store.is_published ? <Pill tone="success">Live</Pill> : <Pill className="bg-white/10 text-white">Not published</Pill>}
            </div>
            <p className="mt-2 font-display text-2xl font-bold break-all sm:text-3xl">{display}</p>
            <p className="mt-1 text-xs text-white/60">Coming soon: <span className="font-mono">{business.slug}.{ROOT_DOMAIN}</span> and your own custom domain.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link prefetch={false} href={`/${business.slug}`} target="_blank" className={buttonVariants({ variant: "light", size: "lg" })}><ExternalLink /> View Store</Link>
              <a href="#customize" className={buttonVariants({ variant: "electric", size: "lg" })}>Customize</a>
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Store link copied"))}>
                <Copy /> Copy Store Link
              </Button>
              {canPublish && (
                <Button size="lg" variant="outline" disabled={pending} onClick={togglePublish}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                  {pending ? <Loader2 className="animate-spin" /> : store.is_published ? <EyeOff /> : <Eye />}
                  {store.is_published ? "Unpublish" : "Publish store"}
                </Button>
              )}
            </div>
            {!store.is_published && business.status !== "VERIFIED" && (
              <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">You can publish once 13C verifies your business. Until then, only your team can see the preview.</p>
            )}
          </div>
        </section>
        <div id="customize" className="scroll-mt-20">
          <StoreEditor business={business} store={store} vehicles={vehicles} onSaved={() => setPreviewKey((k) => k + 1)} />
        </div>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-20 grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-navy-900">Live preview</p>
            <div className="flex rounded-full bg-white p-1 ring-1 ring-border">
              {(["mobile", "desktop"] as const).map((d) => (
                <button key={d} onClick={() => setDevice(d)} aria-label={`${d} preview`} className={cn("rounded-full p-1.5", device === d && "bg-navy-900 text-white")}>
                  {d === "mobile" ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border-8 border-navy-900 bg-white shadow-xl">
            <div className={cn("relative overflow-hidden", device === "mobile" ? "h-[720px]" : "h-[520px]")}>
              <iframe
                key={`${previewKey}-${device}`}
                src={`/${business.slug}?preview=1`}
                title="Store preview"
                className="absolute top-0 left-0 origin-top-left border-0"
                style={device === "mobile" ? { width: 384, height: 720 } : { width: 1280, height: 1733, transform: "scale(0.3)" }}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
