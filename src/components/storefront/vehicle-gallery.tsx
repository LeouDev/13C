"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "cn";
import { CarSilhouette } from "@/components/common/vehicle-image";
import { mediaUrl } from "@/lib/storage";

export function VehicleGallery({ images, alt }: { images: { id: string; storage_path: string }[]; alt: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-[2rem] bg-gradient-to-b from-white to-[#eceef2]">
        <CarSilhouette className="w-2/3 text-slate-300" />
      </div>
    );
  }
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);
  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] bg-gradient-to-b from-white to-[#eceef2]"
        onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}>
        {images.map((img, k) => (
          <Image key={img.id} src={mediaUrl(img.storage_path)!} alt={`${alt} — photo ${k + 1}`} fill loading={k === 0 ? "eager" : "lazy"} fetchPriority={k === 0 ? "high" : "auto"}
            sizes="(max-width: 1024px) 100vw, 60vw" className={cn("object-cover transition-opacity duration-500", k === i ? "opacity-100" : "opacity-0")} />
        ))}
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            <button type="button" onClick={() => go(-1)} className="grid size-10 place-items-center rounded-full bg-white shadow-md transition hover:scale-105" aria-label="Previous photo"><ArrowLeft className="size-4" /></button>
            <span className="grid min-w-14 place-items-center rounded-full bg-white/90 px-3 text-xs font-semibold shadow-md">{i + 1} / {images.length}</span>
            <button type="button" onClick={() => go(1)} className="grid size-10 place-items-center rounded-full bg-white shadow-md transition hover:scale-105" aria-label="Next photo"><ArrowRight className="size-4" /></button>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, k) => (
            <button key={img.id} type="button" onClick={() => setI(k)} aria-label={`Show photo ${k + 1}`}
              className={cn("relative h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2 transition", k === i ? "ring-[var(--store-accent)]" : "ring-transparent opacity-70 hover:opacity-100")}>
              <Image src={mediaUrl(img.storage_path)!} alt="" fill sizes="96px" loading="eager" fetchPriority="low" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
