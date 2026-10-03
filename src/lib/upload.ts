"use client";

import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];
export const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function validateFile(file: File, types: string[], maxMB: number): string | null {
  if (!types.includes(file.type)) return `${file.name}: unsupported file type.`;
  if (file.size > maxMB * 1024 * 1024) return `${file.name}: larger than ${maxMB} MB.`;
  return null;
}

/** Downscale to ≤ max px on the long edge and re-encode (WebP, or PNG for logos; JPEG fallback). Strips EXIF/GPS too. */
export async function resizeImage(file: File, max = 2000, quality = 0.85, type: "image/webp" | "image/png" = "image/webp") {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  let blob = await encode(type);
  if (!blob || blob.type !== type) blob = await encode("image/jpeg");
  if (!blob) throw new Error("Could not process image");
  return { blob, width, height, ext: ({ "image/webp": "webp", "image/png": "png" } as Record<string, string>)[blob.type] ?? "jpg" };
}

export async function uploadToBucket(bucket: "media" | "business-docs" | "kyc", path: string, body: Blob, contentType: string) {
  const { error } = await createClient().storage.from(bucket).upload(path, body, { contentType, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(friendlyError(error, "Upload failed. Please try again."));
  return path;
}

/** Resize + upload an image to the public media bucket under `prefix`. */
export async function uploadImage(prefix: string, file: File, max = 2000, type?: "image/png") {
  const { blob, width, height, ext } = await resizeImage(file, max, 0.85, type);
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  await uploadToBucket("media", path, blob, blob.type);
  return { path, width, height };
}

export async function uploadDocument(bucket: "business-docs" | "kyc", prefix: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  await uploadToBucket(bucket, path, file, file.type);
  return path;
}
