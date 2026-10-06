"use server";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const body = z.string().trim().min(1, "Write a message").max(4000, "Message is too long");

export async function startConversation(businessId: string, vehicleId: string | null, text: string): Promise<ActionResult<{ id: string }>> {
  const b = body.safeParse(text);
  if (!b.success) return { ok: false, error: b.error.issues[0]!.message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_business_id: businessId, p_vehicle_id: vehicleId as string, p_body: b.data });
  if (error) return fail(error);
  revalidatePath("/account/messages");
  return ok({ id: data });
}

export async function sendMessage(conversationId: string, text: string): Promise<ActionResult> {
  const b = body.safeParse(text);
  if (!b.success) return { ok: false, error: b.error.issues[0]!.message };
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, body: b.data });
  if (error) return fail(error, "Your message couldn't be sent. Please try again.");
  return ok();
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  refresh(); // the unread badges (app tab bar, dashboard menu) are in layouts, which navigation doesn't re-render
}

const reportSchema = z.object({
  entity_type: z.enum(["BUSINESS", "VEHICLE", "REVIEW", "USER", "BOOKING"]),
  entity_id: z.uuid(),
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(2000).optional(),
});

export async function submitReport(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a reason for your report." };
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert(parsed.data as never);
  if (error) return fail(error);
  return ok(undefined, "Thanks — our team will review this report.");
}
