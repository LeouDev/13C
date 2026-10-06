"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { manilaToISO } from "@/lib/format";
import { PAYMENT_METHOD_VALUES } from "@/lib/validation";
import type { Enums } from "@/types/database";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Choose a time");

const requestSchema = z.object({
  vehicleId: z.uuid(),
  from: date, fromTime: time, to: date, toTime: time,
  pickupLocation: z.string().trim().min(2, "Enter a pickup location").max(200),
  returnLocation: z.string().trim().min(2, "Enter a return location").max(200),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES, { error: "Choose a payment method" }),
  withDriver: z.boolean(),
  delivery: z.boolean(),
  driversCount: z.coerce.number().int().min(1).max(5),
  notes: z.string().trim().max(2000).optional(),
});

function refresh() {
  revalidatePath("/account", "layout");
  revalidatePath("/dashboard", "layout");
}

export async function requestBooking(input: z.input<typeof requestSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_booking", {
    p_vehicle_id: d.vehicleId,
    p_pickup_at: manilaToISO(d.from, d.fromTime),
    p_return_at: manilaToISO(d.to, d.toTime),
    p_pickup_location: d.pickupLocation,
    p_return_location: d.returnLocation,
    p_payment_method: d.paymentMethod,
    p_with_driver: d.withDriver,
    p_delivery: d.delivery,
    p_drivers_count: d.driversCount,
    p_notes: d.notes || undefined,
  });
  if (error) return fail(error);
  refresh();
  return ok({ id: data }, "Booking requested! The business will review it shortly.");
}

export async function transitionBooking(bookingId: string, to: Enums<"booking_status">, note?: string): Promise<ActionResult<{ status: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_booking", { p_booking_id: bookingId, p_to: to, p_note: note?.trim() || undefined });
  if (error) return fail(error);
  refresh();
  return ok({ status: data }, to === "APPROVED" ? "Approved — your rental agreement was generated." : "Booking updated.");
}

export async function acceptProposal(bookingId: string, method: Enums<"payment_method_type">): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_booking_proposal", { p_booking_id: bookingId, p_payment_method: method });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Proposal accepted. The business will send your rental agreement.");
}

const proposalSchema = z.object({
  conversationId: z.uuid(), vehicleId: z.uuid({ error: "Choose a vehicle" }),
  from: date, fromTime: time, to: date, toTime: time,
  pickupLocation: z.string().trim().min(2).max(200), returnLocation: z.string().trim().min(2).max(200),
  withDriver: z.boolean(), delivery: z.boolean(), notes: z.string().trim().max(2000).optional(),
});

export async function proposeBooking(input: z.input<typeof proposalSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("propose_booking", {
    p_conversation_id: d.conversationId, p_vehicle_id: d.vehicleId,
    p_pickup_at: manilaToISO(d.from, d.fromTime), p_return_at: manilaToISO(d.to, d.toTime),
    p_pickup_location: d.pickupLocation, p_return_location: d.returnLocation,
    p_with_driver: d.withDriver, p_delivery: d.delivery, p_notes: d.notes || undefined,
  });
  if (error) return fail(error);
  refresh();
  return ok({ id: data }, "Booking proposal sent to the customer.");
}

const termsSchema = z.object({
  from: date, fromTime: time, to: date, toTime: time,
  pickupLocation: z.string().trim().min(2).max(200), returnLocation: z.string().trim().min(2).max(200),
  otherFees: z.coerce.number().min(0).max(1_000_000), discount: z.coerce.number().min(0).max(1_000_000),
  securityDeposit: z.coerce.number().min(0).max(1_000_000),
});

export async function updateBookingTerms(bookingId: string, input: z.input<typeof termsSchema>): Promise<ActionResult> {
  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_booking_terms", {
    p_booking_id: bookingId, p_pickup_at: manilaToISO(d.from, d.fromTime), p_return_at: manilaToISO(d.to, d.toTime),
    p_pickup_location: d.pickupLocation, p_return_location: d.returnLocation,
    p_other_fees: d.otherFees, p_discount: d.discount, p_security_deposit: d.securityDeposit,
  });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Booking updated. If a contract existed, a new version was generated.");
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount").max(10_000_000),
  method: z.enum(PAYMENT_METHOD_VALUES),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function recordPayment(bookingId: string, input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({ booking_id: bookingId, ...parsed.data } as never);
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Payment recorded.");
}

/** The renter's "I've paid" for the down payment: the business is told to check its account (and the reference). */
export async function reportDownPayment(bookingId: string, reference: string): Promise<ActionResult> {
  const parsed = z.object({ bookingId: z.uuid(), reference: z.string().trim().max(120) }).safeParse({ bookingId, reference });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_down_payment", { p_booking_id: parsed.data.bookingId, p_reference: parsed.data.reference });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Sent. The business will check and confirm it.");
}

/** The business skips this booking's down payment; the rental agreement is prepared right away. */
export async function waiveDownPayment(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("waive_down_payment", { p_booking_id: z.uuid().parse(bookingId) });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Down payment waived. The rental agreement is ready to review.");
}

/** The business never got the down payment the renter reported: cancels the booking and flags it to 13C. */
export async function rejectDownPayment(bookingId: string, note: string): Promise<ActionResult> {
  const parsed = z.object({ bookingId: z.uuid(), note: z.string().trim().max(300) }).safeParse({ bookingId, note });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_down_payment", { p_booking_id: parsed.data.bookingId, p_note: parsed.data.note });
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Booking cancelled. 13C will follow up with the renter.");
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) return fail(error);
  refresh();
  return ok(undefined, "Payment removed.");
}

export async function setPaymentStatus(bookingId: string, status: Enums<"payment_status">): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings").update({ payment_status: status }).eq("id", bookingId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You don't have permission to update this booking." };
  refresh();
  return ok(undefined, "Payment status updated.");
}
