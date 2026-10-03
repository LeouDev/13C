import type { Enums } from "@/types/database";

export type BookingStatus = Enums<"booking_status">;
export type Actor = "RENTER" | "BUSINESS" | "SYSTEM";

/**
 * The booking state machine. Mirrors public.booking_transitions — the database enforces it,
 * this copy drives which actions the UI offers. tests/db.test.ts asserts both are identical.
 */
export const TRANSITIONS: ReadonlyArray<readonly [BookingStatus, BookingStatus, Actor]> = [
  ["INQUIRY", "NEGOTIATING", "SYSTEM"],
  ["INQUIRY", "BOOKING_REQUESTED", "BUSINESS"],
  ["INQUIRY", "PENDING_OWNER_APPROVAL", "RENTER"],
  ["INQUIRY", "CANCELLED", "RENTER"],
  ["INQUIRY", "CANCELLED", "BUSINESS"],
  ["INQUIRY", "EXPIRED", "SYSTEM"],
  ["NEGOTIATING", "BOOKING_REQUESTED", "BUSINESS"],
  ["NEGOTIATING", "PENDING_OWNER_APPROVAL", "RENTER"],
  ["NEGOTIATING", "CANCELLED", "RENTER"],
  ["NEGOTIATING", "CANCELLED", "BUSINESS"],
  ["NEGOTIATING", "EXPIRED", "SYSTEM"],
  ["BOOKING_REQUESTED", "APPROVED", "RENTER"],
  ["BOOKING_REQUESTED", "CANCELLED", "RENTER"],
  ["BOOKING_REQUESTED", "CANCELLED", "BUSINESS"],
  ["BOOKING_REQUESTED", "EXPIRED", "SYSTEM"],
  ["PENDING_OWNER_APPROVAL", "APPROVED", "BUSINESS"],
  ["PENDING_OWNER_APPROVAL", "REJECTED", "BUSINESS"],
  ["PENDING_OWNER_APPROVAL", "CANCELLED", "RENTER"],
  ["PENDING_OWNER_APPROVAL", "EXPIRED", "SYSTEM"],
  ["APPROVED", "CONTRACT_DRAFT", "SYSTEM"],
  ["APPROVED", "CANCELLED", "RENTER"],
  ["APPROVED", "CANCELLED", "BUSINESS"],
  ["CONTRACT_DRAFT", "CONTRACT_SENT", "SYSTEM"],
  ["CONTRACT_DRAFT", "CANCELLED", "RENTER"],
  ["CONTRACT_DRAFT", "CANCELLED", "BUSINESS"],
  ["CONTRACT_SENT", "AWAITING_SIGNATURE", "SYSTEM"],
  ["CONTRACT_SENT", "SIGNED", "SYSTEM"],
  ["CONTRACT_SENT", "CONTRACT_DRAFT", "SYSTEM"],
  ["CONTRACT_SENT", "CANCELLED", "RENTER"],
  ["CONTRACT_SENT", "CANCELLED", "BUSINESS"],
  ["AWAITING_SIGNATURE", "SIGNED", "SYSTEM"],
  ["AWAITING_SIGNATURE", "CONTRACT_DRAFT", "SYSTEM"],
  ["AWAITING_SIGNATURE", "CANCELLED", "RENTER"],
  ["AWAITING_SIGNATURE", "CANCELLED", "BUSINESS"],
  ["SIGNED", "CONFIRMED", "SYSTEM"],
  ["SIGNED", "CONTRACT_DRAFT", "SYSTEM"],
  ["SIGNED", "CANCELLED", "RENTER"],
  ["SIGNED", "CANCELLED", "BUSINESS"],
  ["CONFIRMED", "ACTIVE", "BUSINESS"],
  ["CONFIRMED", "CONTRACT_DRAFT", "SYSTEM"],
  ["CONFIRMED", "CANCELLED", "RENTER"],
  ["CONFIRMED", "CANCELLED", "BUSINESS"],
  ["ACTIVE", "RETURNED", "BUSINESS"],
  ["RETURNED", "COMPLETED", "BUSINESS"],
];

export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor) {
  return TRANSITIONS.some(([f, t, a]) => f === from && t === to && a === actor);
}

export function nextStatuses(from: BookingStatus, actor: Actor): BookingStatus[] {
  return TRANSITIONS.filter(([f, , a]) => f === from && a === actor).map(([, t]) => t);
}

export const BLOCKING_STATUSES: BookingStatus[] = [
  "APPROVED", "CONTRACT_DRAFT", "CONTRACT_SENT", "AWAITING_SIGNATURE", "SIGNED", "CONFIRMED", "ACTIVE",
];
export const OPEN_REQUEST_STATUSES: BookingStatus[] = ["BOOKING_REQUESTED", "PENDING_OWNER_APPROVAL"];
export const TERMINAL_STATUSES: BookingStatus[] = ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"];

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "brand";

export const STATUS_META: Record<BookingStatus, { label: string; tone: Tone; renterHint: string }> = {
  INQUIRY: { label: "Inquiry", tone: "neutral", renterHint: "You asked about this car." },
  NEGOTIATING: { label: "Negotiating", tone: "neutral", renterHint: "You're chatting with the owner." },
  BOOKING_REQUESTED: { label: "Proposal received", tone: "info", renterHint: "The business proposed a booking. Review and accept it." },
  PENDING_OWNER_APPROVAL: { label: "Awaiting owner", tone: "warning", renterHint: "The rental business is reviewing your request." },
  APPROVED: { label: "Approved", tone: "info", renterHint: "Approved — your rental agreement is being prepared." },
  CONTRACT_DRAFT: { label: "Preparing contract", tone: "info", renterHint: "The business is reviewing your rental agreement." },
  CONTRACT_SENT: { label: "Contract sent", tone: "brand", renterHint: "Your rental agreement is ready. Review and sign it." },
  AWAITING_SIGNATURE: { label: "Awaiting signature", tone: "brand", renterHint: "Sign your rental agreement to confirm the booking." },
  SIGNED: { label: "Signed", tone: "success", renterHint: "Agreement signed." },
  CONFIRMED: { label: "Confirmed", tone: "success", renterHint: "You're all set. See pickup details below." },
  ACTIVE: { label: "On rent", tone: "success", renterHint: "Enjoy your trip. Return the car on time." },
  RETURNED: { label: "Returned", tone: "neutral", renterHint: "Car returned — the business is closing out your rental." },
  COMPLETED: { label: "Completed", tone: "neutral", renterHint: "Rental completed. Thanks for renting!" },
  CANCELLED: { label: "Cancelled", tone: "danger", renterHint: "This booking was cancelled." },
  REJECTED: { label: "Declined", tone: "danger", renterHint: "The business declined this request." },
  EXPIRED: { label: "Expired", tone: "danger", renterHint: "This request expired." },
};

/** The happy path, used for progress timelines. */
export const TIMELINE: BookingStatus[] = [
  "PENDING_OWNER_APPROVAL", "APPROVED", "CONTRACT_SENT", "SIGNED", "CONFIRMED", "ACTIVE", "COMPLETED",
];

export function timelineIndex(status: BookingStatus) {
  const map: Partial<Record<BookingStatus, number>> = {
    BOOKING_REQUESTED: 0, PENDING_OWNER_APPROVAL: 0, APPROVED: 1, CONTRACT_DRAFT: 1,
    CONTRACT_SENT: 2, AWAITING_SIGNATURE: 2, SIGNED: 3, CONFIRMED: 4, ACTIVE: 5, RETURNED: 5, COMPLETED: 6,
  };
  return map[status] ?? -1;
}
