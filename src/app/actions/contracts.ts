"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { finalizeSignedPdf, requestMeta } from "@/lib/contracts/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MAX_SIGNATURE_CHARS, SIGNATURE_PNG } from "@/lib/signature";

function refresh() {
  revalidatePath("/account", "layout");
  revalidatePath("/dashboard", "layout");
}

async function verifiedUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(); // verified with Supabase Auth, not just the cookie
  return data.user?.id ?? null;
}

const signature = {
  type: z.enum(["TYPED", "DRAWN"]),
  name: z.string().trim().min(2, "Type your full name").max(120),
  // Drawn or typed, the browser sends a PNG; the database enforces the same rule.
  image: z.string().max(MAX_SIGNATURE_CHARS, "That signature image is too large. Please clear it and sign again.").regex(SIGNATURE_PNG, "Please add your signature."),
};

const sendSchema = z.object({
  contractId: z.uuid(),
  ...signature,
  agreed: z.literal(true, { error: "Please confirm you're authorized to sign for this business." }),
});

/** Provider signs and sends the agreement. Runs with the secret key so IP/UA come from the request. */
export async function sendContract(input: z.input<typeof sendSchema>): Promise<ActionResult> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const userId = await verifiedUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { ip, userAgent } = await requestMeta();
  const { error } = await createAdminClient().rpc("send_contract", {
    p_actor_id: userId, p_contract_id: d.contractId, p_signer_name: d.name, p_signature_type: d.type,
    p_signature_data: d.image, p_ip: ip as string, p_user_agent: userAgent,
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

/** First time the renter opens the agreement: the server records when and from where. */
export async function markContractViewed(contractId: string): Promise<void> {
  if (!z.uuid().safeParse(contractId).success) return;
  const userId = await verifiedUserId();
  if (!userId) return;
  const { ip, userAgent } = await requestMeta();
  await createAdminClient().rpc("record_contract_view", { p_actor_id: userId, p_contract_id: contractId, p_ip: ip as string, p_user_agent: userAgent });
  refresh();
}

const signSchema = z.object({
  versionId: z.uuid(),
  ...signature,
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  agreed: z.literal(true, { error: "Please confirm that you have read and agree to the Rental Agreement." }),
});

export async function signContract(input: z.input<typeof signSchema>): Promise<ActionResult> {
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const userId = await verifiedUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { ip, userAgent } = await requestMeta();
  const { error } = await createAdminClient().rpc("sign_contract", {
    p_actor_id: userId, p_version_id: d.versionId, p_signature_type: d.type, p_signer_name: d.name,
    p_signature_data: d.image, p_content_hash: d.contentHash,
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
