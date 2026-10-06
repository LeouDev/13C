"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { BUSINESS_COOKIE, FRESH_SIGN_IN_MS, getCurrentUser } from "@/lib/auth";
import { SIGN_IN_AGAIN } from "@/lib/errors";
import { missingVerificationDocs, POLICY_FIELDS } from "@/lib/constants";
import { draftStoreText, suggestFaqs, type Faq, type StoreTextField } from "@/lib/store-writer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { businessSchema, paymentMethodsSchema, storefrontSchema, type BusinessInput, type StorefrontInput } from "@/lib/validation";

async function setActive(businessId: string) {
  (await cookies()).set(BUSINESS_COOKIE, businessId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function switchBusiness(businessId: string) {
  await setActive(z.uuid().parse(businessId));
  revalidatePath("/dashboard", "layout");
}

/** From a storefront: open the dashboard on that business (requireBusiness ignores it for non-members). */
export async function openDashboard(businessId: string) {
  await setActive(z.uuid().parse(businessId));
  redirect("/dashboard");
}

export async function registerBusiness(input: BusinessInput): Promise<ActionResult<{ id: string }>> {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_business", {
    p_name: d.name, p_slug: d.slug, p_city: d.city, p_province: d.province, p_address: d.address,
    p_phone: d.phone, p_email: d.email, p_description: d.description ?? undefined,
    p_representative_name: d.representative_name, p_representative_title: d.representative_title ?? undefined,
    p_registration_type: d.registration_type ?? undefined, p_registration_number: d.registration_number ?? undefined,
  });
  if (error) return fail(error);
  await setActive(data);
  return ok({ id: data });
}

export async function checkSlug(slug: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_slug_available", { p_slug: slug.toLowerCase() });
  return !!data;
}

export async function updateBusinessProfile(businessId: string, input: BusinessInput): Promise<ActionResult> {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").update(parsed.data).eq("id", businessId).select("slug");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You don't have permission to edit this business." };
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${data[0]!.slug}`);
  return ok(undefined, "Business profile saved.");
}

export async function setBusinessLogo(businessId: string, path: string | null): Promise<ActionResult> {
  if (path && !path.startsWith(`b/${businessId}/`)) return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const { error } = await supabase.from("businesses").update({ logo_path: path }).eq("id", businessId);
  if (error) return fail(error);
  revalidatePath("/dashboard", "layout");
  return ok();
}

export async function setStoreCover(businessId: string, path: string | null): Promise<ActionResult> {
  if (path && !path.startsWith(`b/${businessId}/`)) return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const { error } = await supabase.from("business_storefronts").update({ cover_path: path }).eq("business_id", businessId);
  if (error) return fail(error);
  revalidatePath("/dashboard", "layout");
  return ok();
}

/** With FRESH_SIGN_IN_MS set, changes on a verified business (renters may be paying) need a recent sign-in. */
export async function savePaymentMethods(businessId: string, input: z.input<typeof paymentMethodsSchema>): Promise<ActionResult> {
  const parsed = paymentMethodsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  if (FRESH_SIGN_IN_MS) {
    const [user, { data: biz }] = await Promise.all([getCurrentUser(), supabase.from("businesses").select("status").eq("id", businessId).maybeSingle()]);
    if (biz?.status === "VERIFIED" && Date.now() - (user?.signedInAt ?? 0) > FRESH_SIGN_IN_MS) return { ok: false, error: SIGN_IN_AGAIN };
  }
  const { data: existing, error: readError } = await supabase.from("payment_methods").select("method").eq("business_id", businessId);
  if (readError) return fail(readError);
  const have = new Set(existing.map((m) => m.method));
  for (const m of parsed.data) {
    const { method, ...rest } = m;
    const res = have.has(method)
      ? await supabase.from("payment_methods").update(rest).eq("business_id", businessId).eq("method", method)
      : m.is_enabled
        ? await supabase.from("payment_methods").insert({ business_id: businessId, method, ...rest })
        : { error: null };
    if (res.error) return fail(res.error);
  }
  revalidatePath("/dashboard", "layout");
  return ok(undefined, "Payment methods saved.");
}

const docSchema = z.array(z.object({ type: z.string().max(40), path: z.string().max(300), name: z.string().max(200) })).max(30);

export async function submitVerification(businessId: string, documents: z.input<typeof docSchema>, note?: string): Promise<ActionResult> {
  const parsed = docSchema.safeParse(documents);
  if (!parsed.success) return invalid(parsed.error);
  const missing = missingVerificationDocs(parsed.data.map((d) => d.type));
  if (missing.length) return { ok: false, error: `Still needed: ${missing.join("; ").toLowerCase()}.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_business_verification", {
    p_business_id: businessId, p_documents: parsed.data, p_note: note?.slice(0, 2000) || undefined,
  });
  if (error) return fail(error);
  revalidatePath("/dashboard", "layout");
  return ok(undefined, "Submitted for verification. We'll notify you once reviewed.");
}

export async function updateStorefront(businessId: string, input: StorefrontInput): Promise<ActionResult> {
  const parsed = storefrontSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_storefronts").update(parsed.data).eq("business_id", businessId).select("business_id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You don't have permission to edit this store." };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/[business]", "layout");
  return ok(undefined, "Store saved.");
}

export async function patchStorefront(businessId: string, input: Partial<StorefrontInput>): Promise<ActionResult> {
  const parsed = storefrontSchema.partial().safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("business_storefronts").update(parsed.data).eq("business_id", businessId);
  if (error) return fail(error);
  revalidatePath("/dashboard", "layout");
  return ok();
}

const AI_DAILY_LIMIT = 30; // AI drafts per store per day, so one store can't use up the free AI allowance every store shares
const AI_UNAVAILABLE = "AI writing isn't available right now. Please try again later.";

/** Only people who can edit the store, within its daily limit. An error message, or null when allowed (and counted). */
async function refuseAiWriting(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string) {
  const { data: canEdit } = await supabase.rpc("has_business_role", { p_business: businessId, p_min: "MANAGER" });
  if (!canEdit) return "Only owners and managers can edit the store.";
  const key = `write:${new Date().toISOString().slice(0, 10)}:${businessId}`;
  const { data: allowed } = await createAdminClient().rpc("assistant_allow", { p_key: key, p_limit: AI_DAILY_LIMIT });
  return allowed ? null : `That's today's ${AI_DAILY_LIMIT} AI drafts for this store. You can write more tomorrow.`;
}

/** "Write with AI": a draft of the tagline, about text or one rental policy. Not saved; the owner checks it first. */
export async function writeStoreText(businessId: string, field: StoreTextField, draft: string): Promise<ActionResult<string>> {
  const parsed = z.object({ businessId: z.uuid(), field: z.enum(["tagline", "about", ...POLICY_FIELDS.map((p) => p.key)]), draft: z.string().max(5000) })
    .safeParse({ businessId, field, draft });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const refused = await refuseAiWriting(supabase, businessId);
  if (refused) return { ok: false, error: refused };
  const text = await draftStoreText(supabase, businessId, parsed.data.field, draft);
  return text ? ok(text) : { ok: false, error: AI_UNAVAILABLE };
}

/** "Suggest questions with AI": up to 5 FAQs the store doesn't have yet. Not saved; the owner checks them first. */
export async function suggestStoreFaqs(businessId: string, questions: string[]): Promise<ActionResult<Faq[]>> {
  const parsed = z.object({ businessId: z.uuid(), questions: z.array(z.string().max(200)).max(20) }).safeParse({ businessId, questions });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const refused = await refuseAiWriting(supabase, businessId);
  if (refused) return { ok: false, error: refused };
  const faqs = await suggestFaqs(supabase, businessId, questions);
  if (!faqs) return { ok: false, error: AI_UNAVAILABLE };
  return faqs.length ? ok(faqs) : { ok: false, error: "The AI couldn't think of new questions. Try again, or add more details about your cars and policies first." };
}

/** Hours needed between one rental's return and the next pickup. The database applies it to every booking. */
/** Down payment asked after approval: a % of the total (0 = none), due within `hours`. Unpaid bookings are cancelled then. */
export async function saveDownPayment(businessId: string, percent: number, hours: number): Promise<ActionResult> {
  const parsed = z.object({ percent: z.number().int().min(0).max(100), hours: z.number().int().min(1).max(168) }).safeParse({ percent, hours });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses")
    .update({ down_payment_percent: parsed.data.percent, down_payment_hours: parsed.data.hours }).eq("id", businessId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Only owners and managers can change this." };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/[business]", "layout");
  return ok(undefined, parsed.data.percent
    ? `Saved. Renters pay ${parsed.data.percent}% within ${parsed.data.hours} hour${parsed.data.hours === 1 ? "" : "s"} of approval.`
    : "Saved. No down payment is asked.");
}

export async function saveRentalGap(businessId: string, hours: number): Promise<ActionResult> {
  const parsed = z.number().int().min(0).max(48).safeParse(hours);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").update({ turnaround_hours: parsed.data }).eq("id", businessId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Only owners and managers can change this." };
  revalidatePath("/dashboard", "layout");
  return ok(undefined, parsed.data ? `Saved. Rentals now need ${parsed.data} hour${parsed.data === 1 ? "" : "s"} in between.` : "Saved. Rentals can now be back to back.");
}

export async function setStorePublished(businessId: string, publish: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_storefront_published", { p_business_id: businessId, p_publish: publish });
  if (error) return fail(error);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/[business]", "layout");
  return ok(undefined, publish ? "Your store is live!" : "Your store is now hidden.");
}

export async function addTeamMember(businessId: string, email: string, role: "MANAGER" | "STAFF"): Promise<ActionResult> {
  const e = z.email().safeParse(email.trim());
  if (!e.success) return { ok: false, error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_business_member", { p_business_id: businessId, p_email: e.data, p_role: role });
  if (error) return fail(error);
  revalidatePath("/dashboard/settings");
  return ok(undefined, "Team member added.");
}

export async function removeTeamMember(businessId: string, userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_business_member", { p_business_id: businessId, p_user_id: userId });
  if (error) return fail(error);
  revalidatePath("/dashboard/settings");
  return ok(undefined, "Team member removed.");
}
