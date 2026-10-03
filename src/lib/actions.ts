import type { ZodError } from "zod";
import { friendlyError } from "@/lib/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(err: unknown, fallback?: string): ActionResult<never> {
  console.error("[action]", err);
  return { ok: false, error: friendlyError(err, fallback) };
}

export function invalid(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}

export const ok = <T>(data?: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
