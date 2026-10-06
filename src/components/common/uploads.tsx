"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { FileText, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/storage";
import { DOC_TYPES, IMAGE_TYPES, uploadDocument, uploadImage, validateFile } from "@/lib/upload";

/** Single image (logo / cover) that uploads immediately to the public media bucket. */
export function ImageUpload({
  prefix, value, onChange, aspect = "aspect-square", maxPx = 1200, label = "Upload image", className, rounded = "rounded-2xl", png, contain,
}: {
  prefix: string;
  /** Store as PNG (logos: transparency, and contract PDFs can embed it) */
  png?: boolean;
  /** Show the whole image (QR codes) instead of filling the box */
  contain?: boolean;
  value: string | null;
  onChange: (path: string | null) => Promise<void> | void;
  aspect?: string;
  maxPx?: number;
  label?: string;
  className?: string;
  rounded?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const src = mediaUrl(value);

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = validateFile(file, IMAGE_TYPES, 15);
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const { path } = await uploadImage(prefix, file, maxPx, png ? "image/png" : undefined);
      await onChange(path);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("group relative overflow-hidden border border-dashed border-input bg-canvas", aspect, rounded, className)}>
      {src && <Image src={src} alt="" fill sizes="600px" className={contain ? "object-contain" : "object-cover"} />}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn("absolute inset-0 grid place-items-center text-sm font-medium transition", src ? "bg-black/0 text-transparent hover:bg-black/40 hover:text-white focus-visible:bg-black/40 focus-visible:text-white" : "text-muted-foreground hover:bg-black/5")}
        aria-label={label}
      >
        {busy ? <Loader2 className="size-5 animate-spin text-electric" /> : (
          <span className="flex flex-col items-center gap-1.5"><ImagePlus className="size-5" />{src ? "Replace" : label}</span>
        )}
      </button>
      {src && !busy && (
        <button type="button" onClick={() => onChange(null)} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white/90 text-destructive opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100" aria-label="Remove image">
          <Trash2 className="size-4" />
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export type UploadedDoc = { type: string; path: string; name: string };

/** Private document list (business verification). Files go to `bucket/prefix/…`. */
export function DocumentUpload({
  bucket, prefix, value, onChange, types,
}: {
  bucket: "business-docs" | "kyc";
  prefix: string;
  value: UploadedDoc[];
  onChange: (docs: UploadedDoc[]) => void;
  types: { value: string; label: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState(types[0]!.value);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: UploadedDoc[] = [];
    for (const file of Array.from(files)) {
      const problem = validateFile(file, DOC_TYPES, 10);
      if (problem) { toast.error(problem); continue; }
      try {
        added.push({ type, path: await uploadDocument(bucket, prefix, file), name: file.name.slice(0, 200) });
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    onChange([...value, ...added]);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-input bg-white px-3 text-sm" aria-label="Document type">
          {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload file
        </Button>
        <input ref={input} type="file" multiple accept=".pdf,image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files)} />
      </div>
      {value.length > 0 && (
        <ul className="grid gap-2">
          {value.map((d) => (
            <li key={d.path} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-electric" />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs">{types.find((t) => t.value === d.type)?.label ?? d.type}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.path !== d.path))} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${d.name}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">PDF, JPG, PNG or WebP · up to 10 MB each · stored privately, visible only to you and 13C reviewers.</p>
    </div>
  );
}
