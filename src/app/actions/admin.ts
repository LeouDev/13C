"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export async function reviewBusiness(businessId: string, decision: Enums<"business_status">, note?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_business", { p_business_id: businessId, p_decision: decision, p_note: note?.trim() || undefined });
  if (error) return fail(error);
  revalidatePath("/admin", "layout");
  return ok(undefined, "Decision saved.");
}

/** 60-second signed URL for a private verification document (storage RLS: owner or admin). */
export async function getDocumentUrl(bucket: "business-docs" | "kyc", path: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error) return fail(error, "You don't have access to this document.");
  return ok(data.signedUrl);
}

export async function setPlan(businessId: string, plan: Enums<"subscription_plan">, status: Enums<"subscription_status">): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan", { p_business_id: businessId, p_plan: plan, p_status: status });
  if (error) return fail(error);
  revalidatePath("/admin/subscriptions");
  return ok(undefined, "Plan updated.");
}

export async function setReviewHidden(reviewId: string, hidden: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_review_hidden", { p_review_id: reviewId, p_hidden: hidden });
  if (error) return fail(error);
  revalidatePath("/admin/reviews");
  return ok(undefined, hidden ? "Review hidden." : "Review visible.");
}

export async function resolveReport(reportId: string, status: Enums<"report_status">, note?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_report", { p_report_id: reportId, p_status: status, p_note: note || undefined });
  if (error) return fail(error);
  revalidatePath("/admin/reports");
  return ok(undefined, "Report updated.");
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_suspended", { p_user_id: userId, p_suspended: suspended });
  if (error) return fail(error);
  revalidatePath("/admin/users");
  return ok(undefined, suspended ? "User suspended." : "User reinstated.");
}

export async function setKycStatus(userId: string, status: Enums<"kyc_status">): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_kyc_status", { p_user_id: userId, p_status: status });
  if (error) return fail(error);
  revalidatePath("/admin/users");
  return ok(undefined, "KYC status updated.");
}

/**
 * Data Privacy Act erasure: the RPC (admin-checked) clears profile/renter data; then, with the
 * secret key, we delete the user's private KYC files and scrub + ban the auth identity.
 * Booking and signed-contract records are retained as required by law.
 */
/** Support: removes a user's two-step sign-in (a lost phone), after checking who they are outside 13C. */
export async function resetTwoStep(userId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user." };
  const me = await getCurrentUser();
  if (!me?.is_admin || !me.twoStepPassed) return { ok: false, error: "You don't have permission to do that." };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: id.data });
  if (error) return fail(error);
  for (const f of data.factors) {
    const { error: delError } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: id.data });
    if (delError) return fail(delError);
  }
  await admin.rpc("log_audit", { p_action: "user.two_step_removed", p_entity_type: "user", p_entity_id: id.data, p_actor: me.id });
  revalidatePath(`/admin/users/${id.data}`);
  return ok(undefined, "Two-step sign-in removed. They can sign in with their password and turn it on again.");
}

export async function anonymizeUser(userId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_anonymize_user", { p_user_id: id.data });
  if (error) return fail(error); // NOT_AUTHORIZED unless the caller is an admin

  const admin = createAdminClient();
  const { data: files } = await admin.storage.from("kyc").list(id.data, { limit: 1000 });
  if (files?.length) {
    const { error: rmError } = await admin.storage.from("kyc").remove(files.map((f) => `${id.data}/${f.name}`));
    if (rmError) return fail(rmError, "Profile erased, but some ID files could not be deleted. Please retry.");
  }
  const { error: authError } = await admin.auth.admin.updateUserById(id.data, {
    email: `deleted-${id.data}@deleted.13c.invalid`, email_confirm: true, phone: "", user_metadata: {}, ban_duration: "876000h",
  });
  if (authError) return fail(authError, "Profile erased, but the login could not be disabled. Please retry.");
  revalidatePath("/admin/users", "layout");
  return ok(undefined, "Personal data and ID files erased; login disabled. Booking and contract records were retained.");
}

const sectionsSchema = z.array(z.object({ key: z.string().min(1).max(40), title: z.string().trim().min(2).max(120), body: z.string().trim().min(5).max(8000) })).min(1).max(40);

export async function saveContractTemplate(name: string, sections: z.input<typeof sectionsSchema>): Promise<ActionResult> {
  const parsed = sectionsSchema.safeParse(sections);
  if (!parsed.success) return { ok: false, error: "Each section needs a title and body." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_contract_template", { p_name: name, p_sections: parsed.data });
  if (error) return fail(error);
  revalidatePath("/admin/settings");
  return ok(undefined, "New template version published. It applies to contracts generated from now on.");
}

const categorySchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,30}$/), label: z.string().trim().min(2).max(40), sort_order: z.coerce.number().int().min(0).max(999), is_active: z.boolean() });

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Slug: 2–30 lowercase letters/dashes; label: 2–40 characters." };
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_categories").upsert(parsed.data, { onConflict: "slug" });
  if (error) return fail(error);
  revalidatePath("/admin/settings");
  return ok(undefined, "Category saved.");
}

export async function saveSetting(key: string, value: string): Promise<ActionResult> {
  let json: unknown;
  try { json = JSON.parse(value); } catch { return { ok: false, error: "Value must be valid JSON." }; }
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").update({ value: json as never }).eq("key", key);
  if (error) return fail(error);
  revalidatePath("/admin/settings");
  return ok(undefined, "Setting saved.");
}
