import Image from "next/image";
import { cn } from "cn";
import { mediaUrl } from "@/lib/storage";

/** Car silhouette used when a vehicle has no photo yet. */
export function CarSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 100" className={className} aria-hidden fill="currentColor">
      <path d="M38 70c-9 0-16-3-17-10l2-14c1-5 5-8 10-9l35-6 24-15c6-4 13-6 21-6h44c8 0 15 3 21 8l17 14 22 4c7 1 12 7 12 14v8c0 7-5 12-12 12h-8a22 22 0 0 0-43 0H85a22 22 0 0 0-43 0zm72-44-19 12h46V18h-15c-4 0-8 3-12 8zm38-8v20h47l-14-12c-4-5-10-8-17-8zM63 86a14 14 0 1 1 0-28 14 14 0 0 1 0 28zm118 0a14 14 0 1 1 0-28 14 14 0 0 1 0 28z" />
    </svg>
  );
}

export function VehicleImage({
  path, alt, className, sizes = "(max-width: 768px) 100vw, 33vw", priority, fit = "cover",
}: { path: string | null | undefined; alt: string; className?: string; sizes?: string; priority?: boolean; fit?: "cover" | "contain" }) {
  const src = mediaUrl(path);
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className={fit === "cover" ? "object-cover" : "object-contain"} />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <CarSilhouette className="w-1/2 text-slate-300" />
        </div>
      )}
    </div>
  );
}

export function BusinessLogo({ path, name, className, accent }: { path: string | null | undefined; name: string; className?: string; accent?: string | null }) {
  const src = mediaUrl(path);
  return (
    <span
      className={cn("relative inline-grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-navy-900 font-display text-lg font-bold text-white ring-1 ring-black/5", className)}
      style={!src && accent ? { background: accent } : undefined}
    >
      {src ? <Image src={src} alt={`${name} logo`} fill sizes="96px" className="object-cover" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
