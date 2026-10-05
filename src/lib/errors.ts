/**
 * Turns Postgres / PostgREST / Storage / Auth errors into copy a renter or owner can act on.
 * Raw messages are logged server-side only.
 */
const CODES: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in to continue.",
  NOT_AUTHORIZED: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find that. It may have been removed.",
  SLUG_TAKEN: "That store link is already taken. Try another.",
  BUSINESS_LIMIT: "You've reached the maximum number of businesses for one account.",
  VERIFICATION_NOT_ALLOWED: "Verification has already been submitted for this business.",
  DOCUMENTS_REQUIRED: "Upload at least one registration document.",
  INVALID_DOCUMENT: "One of the documents is invalid. Please upload it again.",
  BUSINESS_PROFILE_INCOMPLETE: "Complete your business address, phone and representative before submitting.",
  INVALID_DECISION: "That decision isn't valid.",
  NOTE_REQUIRED: "Please add a short note explaining the reason.",
  BUSINESS_NOT_VERIFIED: "Your business must be verified before your store can be published.",
  STORE_NEEDS_VEHICLE: "Add at least one active vehicle with pricing before publishing.",
  PLAN_VEHICLE_LIMIT: "You've reached your plan's vehicle limit. Upgrade to add more vehicles.",
  TRIAL_ENDED: "Your free trial or plan has ended. Choose a plan to keep your store live and add vehicles.",
  PICKUP_NOT_YET: "The car can be marked as picked up from the pickup date. To hand it over earlier, change the booking dates first.",
  PLAN_TOO_SMALL: "You have more vehicles than this plan allows. Archive some vehicles first, or choose Business.",
  INVALID_PLAN: "Choose Pro or Business.",
  INVALID_INPUT: "Please check the details and try again.",
  PLAN_STAFF_LIMIT: "Adding team members needs an active Business plan.",
  PLAN_BUSINESS_REQUIRED: "This is a Business plan feature. Upgrade to Business under Subscription to use it.",
  USER_NOT_FOUND: "No 13C account uses that email. Ask them to sign up first.",
  INVALID_ROLE: "That role can't be assigned.",
  VEHICLE_HAS_BOOKINGS: "This vehicle has upcoming bookings. Resolve them before archiving.",
  NO_PRICING: "This vehicle doesn't have pricing yet.",
  INVALID_DATES: "The return time must be after the pickup time.",
  RENTAL_TOO_LONG: "Rentals can be at most 90 days. Contact the business for longer rentals.",
  DRIVER_NOT_OFFERED: "This vehicle isn't offered with a driver.",
  SELF_DRIVE_NOT_OFFERED: "This vehicle is only offered with a driver.",
  DELIVERY_NOT_OFFERED: "This vehicle isn't available for delivery.",
  MIN_RENTAL_DAYS: "This vehicle has a minimum rental period.",
  VEHICLE_NOT_BOOKABLE: "This vehicle isn't available for booking right now.",
  DEMO_STORE: "This is a sample store, so booking and messaging are turned off.",
  OWN_BUSINESS: "You can't book or message your own business.",
  PICKUP_IN_PAST: "Pickup must be at least an hour from now.",
  PAYMENT_METHOD_NOT_ACCEPTED: "This business doesn't accept that payment method.",
  NO_PAYMENT_METHODS: "Add at least one payment method in Payment Settings first.",
  VEHICLE_UNAVAILABLE: "This vehicle is already booked for the selected dates.",
  DUPLICATE_REQUEST: "You already have a pending request for these dates.",
  RENTER_DOCUMENTS_MISSING: "Upload your driver's license (front and back) and a government ID first. You'll find them in Profile & documents.",
  RENTER_PROFILE_INCOMPLETE: "Add your full name, phone, address and driver's license number first.",
  INVALID_TRANSITION: "This booking can't be updated that way anymore. Refresh to see its latest status.",
  NO_ACTIVE_TEMPLATE: "No contract template is active. Please contact 13C support.",
  BOOKING_LOCKED: "This booking can no longer be edited.",
  INVALID_AMOUNT: "The total can't be negative.",
  SIGNATURE_REQUIRED: "Please provide your signature.",
  AGREEMENT_REQUIRED: "Please confirm that you have read and agree to the Rental Agreement.",
  CONTRACT_CHANGED: "The agreement was updated while you were reading. Please review the latest version.",
  CONTRACT_NOT_SIGNABLE: "This agreement can't be signed right now. Refresh to see its latest status.",
  CONTRACT_IMMUTABLE: "Signed agreements can't be changed. Create a new version instead.",
  REVIEW_NOT_ALLOWED: "You can review a rental once it's completed.",
  VEHICLE_BLOCKED: "Those dates are blocked on the calendar.",
  BOOKING_CONFLICT: "Those dates overlap an existing booking.",
  VEHICLE_BUSINESS_MISMATCH: "That vehicle doesn't belong to this business.",
  INVALID_TEMPLATE: "The template needs at least one section.",
  INVALID_TARGET: "You can't do that to your own account.",
};

const CONSTRAINTS: Record<string, string> = {
  bookings_no_overlap: CODES.VEHICLE_UNAVAILABLE,
  businesses_slug_key: CODES.SLUG_TAKEN,
  businesses_slug_check: "Store links use 3–48 lowercase letters, numbers and dashes, and can't be a reserved word.",
  vehicles_business_slug_key: "You already have a vehicle with that name.",
  reviews_booking_id_key: "You've already reviewed this rental.",
  favorites_pkey: "Already saved.",
  conversations_business_id_customer_id_vehicle_id_key: "You already have a conversation about this car.",
  payment_methods_business_id_method_key: "That payment method is already added.",
  contract_signatures_contract_version_id_signer_role_key: "This agreement has already been signed.",
};

type ErrorLike = { message?: string; code?: string; details?: string | null; hint?: string | null; statusCode?: string | number };

export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  const e = err as ErrorLike;
  const msg = e.message ?? String(err);

  const code = msg.trim().split(/\s/)[0];
  if (CODES[code]) return CODES[code];

  for (const [name, copy] of Object.entries(CONSTRAINTS)) if (msg.includes(name)) return copy;

  if (e.code === "23505") return "That already exists.";
  if (e.code === "23514" || e.code === "22P02" || e.code === "23502") return "Some details are invalid. Please check the form.";
  if (e.code === "42501" || /row-level security|permission denied/i.test(msg)) return CODES.NOT_AUTHORIZED;
  if (e.code === "PGRST116") return CODES.NOT_FOUND;
  if (/Invalid login credentials/i.test(msg)) return "Incorrect email or password.";
  if (/Email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox.";
  if (/User already registered/i.test(msg)) return "An account with this email already exists. Try signing in.";
  if (e.code === "same_password" || /different from the old password/i.test(msg)) return "That's your current password. Choose a new one.";
  if (/Password should be|Password should contain/i.test(msg)) return "Use a stronger password: at least 8 characters, with letters and numbers.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
  if (e.code === "captcha_failed" || /captcha/i.test(msg)) return "The security check didn't go through. Wait for it to finish, then try again.";
  if (/mime type|invalid_mime_type/i.test(msg)) return "That file type isn't allowed.";
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return "That file is too large.";
  if (/fetch failed|network/i.test(msg)) return "Network problem. Check your connection and try again.";
  return fallback;
}
