import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderContractPdf, type ContractPdfInput, type ContractSection, type ContractSignature } from "@/lib/contracts/pdf";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Client IP + user agent from the incoming request (set by the hosting proxy, not the browser). */
export async function requestMeta() {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ip = raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
  return { ip, userAgent: (h.get("user-agent") ?? "").slice(0, 400) };
}

/** Loads everything the PDF needs. RLS applies when `client` is a user client. */
export async function loadVersion(client: SupabaseClient<Database>, versionId: string) {
  const { data } = await client
    .from("contract_versions")
    .select("id, version, status, title, sections, content_hash, pdf_path, contract_id, booking_id, data, sent_at, sent_to_email, viewed_at, viewed_ip, viewed_user_agent, bookings(reference, business_id), contract_signatures(signer_role, signer_name, signer_email, signature_type, signature_data, signed_at, ip_address, user_agent, content_hash)")
    .eq("id", versionId)
    .maybeSingle();
  return data;
}
export type LoadedVersion = NonNullable<Awaited<ReturnType<typeof loadVersion>>>;

export function pdfInput(v: LoadedVersion): ContractPdfInput {
  const vars = v.data as Record<string, string>;
  return {
    documentId: v.id, title: v.title, version: v.version, reference: v.bookings?.reference ?? "", status: v.status,
    sentAt: v.sent_at, sentTo: v.sent_to_email, viewedAt: v.viewed_at, viewedIp: v.viewed_ip as string | null, viewedUserAgent: v.viewed_user_agent,
    sections: v.sections as ContractSection[], signatures: v.contract_signatures as ContractSignature[],
    contentHash: v.content_hash, providerName: vars.provider_name ?? "Rental Provider", renterName: vars.renter_name ?? "Renter",
  };
}

/** Renders the signed agreement, stores it privately, and records its path + SHA-256 (once). */
export async function finalizeSignedPdf(versionId: string) {
  const admin = createAdminClient();
  const v = await loadVersion(admin, versionId);
  if (!v || v.status !== "SIGNED") return null;
  if (v.pdf_path) return v.pdf_path;
  const bytes = await renderContractPdf(pdfInput(v));
  const path = `${v.bookings!.business_id}/${v.booking_id}/${v.id}.pdf`;
  const { error } = await admin.storage.from("contracts").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  const sha = createHash("sha256").update(bytes).digest("hex");
  const { error: attachError } = await admin.rpc("attach_contract_pdf", { p_version_id: v.id, p_path: path, p_sha256: sha });
  if (attachError) throw attachError;
  return path;
}
