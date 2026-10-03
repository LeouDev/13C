"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { finalizeSignedPdf, requestMeta } from "@/lib/contracts/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function refresh() {
  revalidatePath("/account", "layout");
  revalidatePath("/dashboard", "layout");
}

async function verifiedUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(); // verified with Supabase Auth, not just the cookie
  return data.user?.id ?? null;
}

/** Provider signs (typed) and sends the agreement. Runs with the secret key so IP/UA come from the request. */
export async function sendContract(contractId: string, signerName: string): Promise<ActionResult> {
  const userId = await verifiedUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const name = z.string().trim().min(2, "Type your full name to sign").max(120).safeParse(signerName);
  if (!name.success) return { ok: false, error: name.error.issues[0]!.message };
  const { ip, userAgent } = await requestMeta();
  const { error } = await createAdminClient().rpc("send_contract", {
    p_actor_id: userId, p_contract_id: contractId, p_signer_name: name.data, p_ip: ip as string, p_user_agent: userAgent,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Agreement sent to the renter for signature.");
}

export async function regenerateContract(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_contract", { p_booking_id: bookingId });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "A new contract version was generated from the latest booking details.");
}

export async function markContractViewed(contractId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_contract_viewed", { p_contract_id: contractId });
  refresh();
}

const signSchema = z.object({
  versionId: z.uuid(),
  type: z.enum(["TYPED", "DRAWN"]),
  name: z.string().trim().min(2, "Type your full name").max(120),
  drawing: z.string().max(500_000).nullable(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  agreed: z.literal(true, { error: "Please confirm that you have read and agree to the Rental Agreement." }),
});

export async function signContract(input: z.input<typeof signSchema>): Promise<ActionResult> {
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  if (d.type === "DRAWN" && !d.drawing?.startsWith("data:image/png;base64,")) return { ok: false, error: "Please draw your signature." };
  const userId = await verifiedUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { ip, userAgent } = await requestMeta();
  const { error } = await createAdminClient().rpc("sign_contract", {
    p_actor_id: userId, p_version_id: d.versionId, p_signature_type: d.type, p_signer_name: d.name,
    p_signature_data: (d.type === "DRAWN" ? d.drawing : null) as string, p_content_hash: d.contentHash,
    p_agreed: d.agreed, p_ip: ip as string, p_user_agent: userAgent,
  });
  if (error) return fail(error);
  try {
    await finalizeSignedPdf(d.versionId);
  } catch (e) {
    // The signature is recorded; the PDF is regenerated on first download if this failed.
    console.error("[contracts] PDF generation failed", e);
  }
  refresh();
  return ok(undefined, "Signed! Your booking is confirmed.");
}
