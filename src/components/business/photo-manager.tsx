"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { addVehicleImages, deleteVehicleImage, reorderVehicleImages } from "@/app/actions/vehicles";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/storage";
import { IMAGE_TYPES, uploadImage, validateFile } from "@/lib/upload";

type Img = { id: string; storage_path: string };

export function PhotoManager({ businessId, vehicleId, images }: { businessId: string; vehicleId: string; images: Img[] }) {
  const router = useRouter();
  const [list, setList] = useState(images);
  const [uploading, setUploading] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // keep local order in sync after server refreshes
  const serverKey = images.map((i) => i.id).join();
  const [lastKey, setLastKey] = useState(serverKey);
  if (serverKey !== lastKey) { setLastKey(serverKey); setList(images); }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const valid = Array.from(files).filter((f) => {
      const p = validateFile(f, IMAGE_TYPES, 20);
      if (p) toast.error(p);
      return !p;
    }).slice(0, 20 - list.length);
    setUploading(valid.length);
    const done: { path: string; width: number; height: number }[] = [];
    for (const f of valid) {
      try { done.push(await uploadImage(`b/${businessId}/v/${vehicleId}`, f, 2000)); } catch (e) { toast.error((e as Error).message); }
      setUploading((n) => n - 1);
    }
    if (done.length) {
      const r = await addVehicleImages(businessId, vehicleId, done);
      if (r.ok) { toast.success(`${done.length} photo${done.length > 1 ? "s" : ""} added`); router.refresh(); } else toast.error(r.error);
    }
    if (input.current) input.current.value = "";
  }

  function persist(next: Img[]) {
    setList(next);
    start(async () => {
      const r = await reorderVehicleImages(vehicleId, next.map((i) => i.id));
      if (!r.ok) toast.error(r.error);
    });
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    persist(next);
  };

  return (
    <div className="grid gap-4">
      <div
        className="grid place-items-center rounded-3xl border-2 border-dashed border-input bg-white p-8 text-center"
        onDragOver={(e) => { if (!dragId) e.preventDefault(); }}
        onDrop={(e) => { if (!dragId) { e.preventDefault(); upload(e.dataTransfer.files); } }}
      >
        <ImagePlus className="size-8 text-electric" />
        <p className="mt-2 font-semibold text-navy-900">Drop photos here</p>
        <p className="text-sm text-muted-foreground">JPG, PNG, WebP or HEIC · up to 20 photos · resized automatically</p>
        <Button className="mt-4" size="lg" onClick={() => input.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? <><Loader2 className="animate-spin" /> Uploading {uploading}…</> : "Choose photos"}
        </Button>
        <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => upload(e.target.files)} />
      </div>

      {list.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">Drag to reorder. The first photo is your main image on cards and your store.</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((img, i) => (
              <li key={img.id} draggable
                onDragStart={() => setDragId(img.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = list.findIndex((x) => x.id === dragId);
                  if (from >= 0 && from !== i) move(from, i);
                  setDragId(null);
                }}
                className={cn("group relative aspect-[4/3] overflow-hidden rounded-2xl border bg-canvas", dragId === img.id && "opacity-40")}>
                <Image src={mediaUrl(img.storage_path)!} alt={`Photo ${i + 1}`} fill sizes="300px" className="object-cover" />
                {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-navy-900 px-2 py-0.5 text-[11px] font-semibold text-white">Main</span>}
                <GripVertical className="absolute top-2 right-2 size-5 cursor-grab rounded bg-white/80 p-0.5 text-navy-900" />
                <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="grid size-8 place-items-center rounded-full bg-white/90 disabled:opacity-40" aria-label="Move earlier"><ArrowLeft className="size-4" /></button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} className="grid size-8 place-items-center rounded-full bg-white/90 disabled:opacity-40" aria-label="Move later"><ArrowRight className="size-4" /></button>
                  </div>
                  <button type="button" aria-label="Delete photo" className="grid size-8 place-items-center rounded-full bg-white/90 text-destructive"
                    onClick={() => start(async () => {
                      setList((l) => l.filter((x) => x.id !== img.id));
                      const r = await deleteVehicleImage(img.id);
                      if (!r.ok) { toast.error(r.error); router.refresh(); }
                    })}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
