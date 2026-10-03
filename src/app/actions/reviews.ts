"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const stars = z.number().int().min(1).max(5);
const reviewSchema = z.object({ rating: stars, vehicle: stars, business: stars, comment: z.string().trim().max(2000) });

export async function createReview(bookingId: string, input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  const r = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_review", {
    p_booking_id: bookingId, p_rating: r.rating, p_vehicle_rating: r.vehicle, p_business_rating: r.business, p_comment: r.comment,
  });
  if (error) return fail(error);
  revalidatePath("/account", "layout");
  revalidatePath("/[business]", "layout");
  return ok(undefined, "Thanks for your review!");
}

export async function respondToReview(reviewId: string, response: string): Promise<ActionResult> {
  const text = z.string().trim().min(1).max(2000).safeParse(response);
  if (!text.success) return { ok: false, error: "Write a response first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_review", { p_review_id: reviewId, p_response: text.data });
  if (error) return fail(error);
  revalidatePath("/dashboard/reviews");
  revalidatePath("/[business]", "layout");
  return ok(undefined, "Response published.");
}
