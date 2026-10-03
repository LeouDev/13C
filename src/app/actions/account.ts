"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { renterSchema, type RenterInput } from "@/lib/validation";

export async function saveRenterDetails(input: RenterInput): Promise<ActionResult> {
  const parsed = renterSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { full_name, phone, ...renter } = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const p = await supabase.from("profiles").update({ full_name, phone }).eq("id", user.id);
  if (p.error) return fail(p.error);
  const r = await supabase.from("renters").update(renter).eq("user_id", user.id);
  if (r.error) return fail(r.error);
  revalidatePath("/account");
  return ok(undefined, "Your details are saved.");
}

const docSchema = z.object({ doc_type: z.enum(["DRIVERS_LICENSE_FRONT", "DRIVERS_LICENSE_BACK", "GOVERNMENT_ID"]), storage_path: z.string().max(300) });

export async function saveDriverDocument(input: z.input<typeof docSchema>): Promise<ActionResult> {
  const parsed = docSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid document." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !parsed.data.storage_path.startsWith(`${user.id}/`)) return { ok: false, error: "Invalid document." };
  const { data: old } = await supabase.from("driver_documents").select("id, storage_path").eq("user_id", user.id).eq("doc_type", parsed.data.doc_type).maybeSingle();
  if (old) {
    await supabase.from("driver_documents").delete().eq("id", old.id);
    await supabase.storage.from("kyc").remove([old.storage_path]);
  }
  const { error } = await supabase.from("driver_documents").insert({ user_id: user.id, ...parsed.data });
  if (error) return fail(error);
  revalidatePath("/account");
  return ok(undefined, "Document uploaded.");
}

export async function viewMyDocument(path: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("kyc").createSignedUrl(path, 60);
  if (error) return fail(error, "You don't have access to this document.");
  return ok(data.signedUrl);
}

export async function toggleFavorite(vehicleId: string, on: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to save cars." };
  const { error } = on
    ? await supabase.from("favorites").insert({ user_id: user.id, vehicle_id: vehicleId })
    : await supabase.from("favorites").delete().eq("user_id", user.id).eq("vehicle_id", vehicleId);
  if (error && error.code !== "23505") return fail(error);
  revalidatePath("/account/favorites");
  return ok(undefined, on ? "Saved to your favorites." : "Removed from favorites.");
}

export async function requestAccountDeletion(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return fail(error);
  revalidatePath("/account");
  return ok(undefined, "Deletion requested. 13C will process it within 30 days and email you when done.");
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/notifications");
}
