"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { BUSINESS_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessSchema, paymentMethodsSchema, storefrontSchema, type BusinessInput, type StorefrontInput } from "@/lib/validation";

async function setActive(businessId: string) {
  (await cookies()).set(BUSINESS_COOKIE, businessId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function switchBusiness(businessId: string) {
  await setActive(z.uuid().parse(businessId));
  revalidatePath("/dashboard", "layout");
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

export async function savePaymentMethods(businessId: string, input: z.input<typeof paymentMethodsSchema>): Promise<ActionResult> {
  const parsed = paymentMethodsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
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

const docSchema = z.array(z.object({ type: z.string().max(40), path: z.string().max(300), name: z.string().max(200) })).min(1, "Upload at least one document");

export async function submitVerification(businessId: string, documents: z.input<typeof docSchema>, note?: string): Promise<ActionResult> {
  const parsed = docSchema.safeParse(documents);
  if (!parsed.success) return invalid(parsed.error);
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
