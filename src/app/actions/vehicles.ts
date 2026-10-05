"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { blockWindow } from "@/lib/calendar";
import { fleetSchema, pricingSchema, serviceLogSchema, vehicleSchema } from "@/lib/validation";
import type { Enums } from "@/types/database";

function refresh() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/[business]", "layout");
}

export async function saveVehicle(
  businessId: string, vehicleId: string | null, vehicle: z.input<typeof vehicleSchema>, pricing: z.input<typeof pricingSchema>,
): Promise<ActionResult<{ id: string }>> {
  const v = vehicleSchema.safeParse(vehicle);
  if (!v.success) return invalid(v.error);
  const p = pricingSchema.safeParse(pricing);
  if (!p.success) return invalid(p.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_vehicle", {
    p_business_id: businessId, p_vehicle_id: vehicleId as string, p_vehicle: v.data, p_pricing: p.data,
  });
  if (error) return fail(error);
  refresh();
  return ok({ id: data }, vehicleId ? "Vehicle saved." : "Vehicle added.");
}

export async function setVehicleStatus(vehicleId: string, status: Enums<"vehicle_status">): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicles").update({ status }).eq("id", vehicleId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You don't have permission to edit this vehicle." };
  refresh();
  return ok(undefined, "Status updated.");
}

export async function archiveVehicle(vehicleId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_vehicle", { p_vehicle_id: vehicleId });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Vehicle archived.");
}

const imagesSchema = z.array(z.object({ path: z.string().max(300), width: z.number().int().positive(), height: z.number().int().positive() })).min(1).max(20);

export async function addVehicleImages(businessId: string, vehicleId: string, images: z.input<typeof imagesSchema>): Promise<ActionResult> {
  const parsed = imagesSchema.safeParse(images);
  if (!parsed.success) return { ok: false, error: "Invalid upload." };
  const supabase = await createClient();
  const { count } = await supabase.from("vehicle_images").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId);
  if ((count ?? 0) + parsed.data.length > 20) return { ok: false, error: "A vehicle can have up to 20 photos." };
  const { error } = await supabase.from("vehicle_images").insert(parsed.data.map((img, i) => ({
    vehicle_id: vehicleId, business_id: businessId, storage_path: img.path, width: img.width, height: img.height, position: (count ?? 0) + i,
  })));
  if (error) return fail(error);
  refresh();
  return ok();
}

export async function reorderVehicleImages(vehicleId: string, orderedIds: string[]): Promise<ActionResult> {
  const ids = z.array(z.uuid()).max(20).safeParse(orderedIds);
  if (!ids.success) return { ok: false, error: "Invalid order." };
  const supabase = await createClient();
  const results = await Promise.all(ids.data.map((id, position) => supabase.from("vehicle_images").update({ position }).eq("id", id).eq("vehicle_id", vehicleId)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(failed.error);
  refresh();
  return ok();
}

export async function deleteVehicleImage(imageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicle_images").delete().eq("id", imageId).select("storage_path");
  if (error) return fail(error);
  if (data?.[0]) await supabase.storage.from("media").remove([data[0].storage_path]);
  refresh();
  return ok();
}

const time = z.string().regex(/^\d{2}:\d{2}$/, "Choose a time").optional();
const blockSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an end date"),
  fromTime: time,
  toTime: time,
  reason: z.enum(["BLOCKED", "MAINTENANCE"]),
  note: z.string().trim().max(300).optional(),
}).refine((b) => b.to >= b.from, { message: "End date must be on or after the start date", path: ["to"] })
  .refine((b) => { const w = blockWindow(b); return w.ends_at > w.starts_at; }, { message: "End must be after the start", path: ["toTime"] });

/** Blocks whole days (Manila time, `to` included), or set hours: from `fromTime` on `from` to `toTime` on `to`. */
export async function addBlock(vehicleId: string, input: z.input<typeof blockSchema>): Promise<ActionResult> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { reason, note, fromTime } = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("vehicle_blocked_dates").insert({
    vehicle_id: vehicleId, ...blockWindow(parsed.data), reason, note: note || null, created_by: user?.id,
  } as never);
  if (error) return fail(error);
  refresh();
  return ok(undefined, reason === "MAINTENANCE" ? "Maintenance scheduled." : fromTime ? "Hours blocked." : "Dates blocked.");
}

export async function removeBlock(blockId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_blocked_dates").delete().eq("id", blockId);
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Dates reopened.");
}

// ── Fleet records (Business plan; the database also checks the plan and role) ──
const FLEET_DENIED = "Only owners and managers on the Business plan can edit fleet records.";

export async function saveFleetInfo(businessId: string, vehicleId: string, input: z.input<typeof fleetSchema>): Promise<ActionResult> {
  const f = fleetSchema.safeParse(input);
  if (!f.success) return invalid(f.error);
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_fleet").upsert({ vehicle_id: vehicleId, business_id: businessId, ...f.data });
  if (error) return fail(error, FLEET_DENIED);
  refresh();
  return ok(undefined, "Fleet details saved.");
}

export async function addServiceLog(businessId: string, vehicleId: string, input: z.input<typeof serviceLogSchema>): Promise<ActionResult> {
  const l = serviceLogSchema.safeParse(input);
  if (!l.success) return invalid(l.error);
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_service_logs").insert({ vehicle_id: vehicleId, business_id: businessId, ...l.data });
  if (error) return fail(error, FLEET_DENIED);
  refresh();
  return ok(undefined, "Service recorded.");
}

export async function deleteServiceLog(logId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicle_service_logs").delete().eq("id", logId).select("id");
  if (error) return fail(error, FLEET_DENIED);
  if (!data?.length) return { ok: false, error: FLEET_DENIED };
  refresh();
  return ok(undefined, "Service entry removed.");
}
