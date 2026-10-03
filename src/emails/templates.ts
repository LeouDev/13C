import { PLANS, TRIAL_DAYS } from "@/lib/constants";
import type { Block, Email } from "./layout";

/** Values arrive pre-formatted (dates in Manila time, amounts as ₱). */
export type EmailData = {
  name?: string;
  businessName?: string;
  customerName?: string;
  vehicle?: string;
  reference?: string;
  pickup?: string;
  return?: string;
  pickupLocation?: string;
  returnLocation?: string;
  total?: string;
  deposit?: string;
  paymentMethod?: string;
  paymentInstructions?: string;
  bookingId?: string;
  versionId?: string;
  conversationId?: string;
  businessId?: string;
  note?: string;
  message?: string;
  rating?: number;
  comment?: string;
  trialEnds?: string;
  daysLeft?: number;
  plan?: string;
  role?: string;
  version?: number;
  accent?: string;
  reason?: string;
  email?: string;
};

export type Audience = "Renter" | "Business" | "Admin";
export type EmailTemplate = {
  audience: Audience;
  /** When it goes out */
  trigger: string;
  /** Matching in-app notification type, when one exists */
  notificationType?: string;
  sample: EmailData;
  build: (d: EmailData) => Email;
};

const renterBooking = (d: EmailData) => `/account/bookings/${d.bookingId}`;
const businessBooking = (d: EmailData) => `/dashboard/bookings/${d.bookingId}`;
const hi = (d: EmailData) => (d.name ? `Hi ${d.name.split(" ")[0]},` : "Hi,");
const provider = (d: EmailData) =>
  `${d.businessName} is the rental provider for this booking. 13C is the technology platform and doesn't process payments.`;

const bookingDetails = (d: EmailData): Block => ({
  details: [
    ["Booking", d.reference],
    ["Vehicle", d.vehicle],
    ["Pickup", d.pickup && [d.pickup, d.pickupLocation].filter(Boolean).join(" · ")],
    ["Return", d.return && [d.return, d.returnLocation].filter(Boolean).join(" · ")],
    ["Total", d.total],
    ["Deposit", d.deposit],
    ["Payment", d.paymentMethod],
  ],
});

const SAMPLE: EmailData = {
  name: "Juan Dela Cruz",
  customerName: "Juan Dela Cruz",
  businessName: "Cebu XYZ Car Rental",
  vehicle: "2023 Toyota Vios 1.3 XLE",
  reference: "13C-7G2AXE",
  pickup: "Oct 10, 2026, 10:00 AM",
  return: "Oct 11, 2026, 10:00 AM",
  pickupLocation: "Mactan-Cebu Int'l Airport",
  returnLocation: "Mactan-Cebu Int'l Airport",
  total: "₱1,800",
  deposit: "₱3,000",
  paymentMethod: "GCash",
  bookingId: "00000000-0000-0000-0000-000000000001",
  versionId: "00000000-0000-0000-0000-000000000002",
  conversationId: "00000000-0000-0000-0000-000000000003",
  businessId: "00000000-0000-0000-0000-000000000004",
  accent: "#E0312B",
};

export const EMAILS = {
  // ─────────────────────────────── Renters ───────────────────────────────
  welcome: {
    audience: "Renter",
    trigger: "After a new account confirms its email",
    sample: SAMPLE,
    build: (d) => ({
      subject: "Welcome to 13C",
      preheader: "Find and book cars from verified rental businesses across Cebu.",
      heading: `Welcome to 13C${d.name ? `, ${d.name.split(" ")[0]}` : ""}`,
      blocks: [
        { p: "13C connects you with verified, local rental businesses in Cebu City, Mactan, Lapu-Lapu, Mandaue, Talisay and beyond." },
        { list: ["Compare cars, prices and real availability", "Message businesses before you book", "Review and e-sign your rental agreement from your phone"] },
        { note: "Tip: add your driver's license details in your profile so booking takes seconds.", tone: "info" },
      ],
      cta: { label: "Find a car", url: "/explore" },
      secondary: { label: "Own a rental business? Get your store", url: "/for-business" },
    }),
  },
  booking_request_sent: {
    audience: "Renter",
    trigger: "Right after a renter submits a booking request",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Request sent: ${d.vehicle}`,
      preheader: `${d.businessName} will review your request for ${d.pickup}.`,
      heading: "Your request was sent",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** has your request and will review it shortly. You won't be charged — the business confirms first.` },
        bookingDetails(d),
        { p: "Next: once approved, you'll review and sign the rental agreement online." },
      ],
      cta: { label: "View booking", url: renterBooking(d) },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  booking_proposal: {
    audience: "Renter",
    trigger: "A business turns a conversation into a booking proposal",
    notificationType: "booking_proposal",
    sample: SAMPLE,
    build: (d) => ({
      subject: `${d.businessName} sent you a booking proposal`,
      preheader: `${d.vehicle} · ${d.pickup} · ${d.total}`,
      heading: "You have a booking proposal",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** prepared a booking for you. Review the details and accept to continue.` },
        bookingDetails(d),
      ],
      cta: { label: "Review proposal", url: renterBooking(d) },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  booking_approved: {
    audience: "Renter",
    trigger: "The business approves the request (the agreement is generated automatically)",
    notificationType: "booking_approved",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Approved: ${d.vehicle}`,
      preheader: "Your rental agreement is being prepared.",
      heading: "Your booking is approved",
      blocks: [
        { p: `${hi(d)} good news — **${d.businessName}** approved your booking. They're reviewing your rental agreement now; we'll email you when it's ready to sign.` },
        bookingDetails(d),
      ],
      cta: { label: "View booking", url: renterBooking(d) },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  contract_sent: {
    audience: "Renter",
    trigger: "The business signs and sends the rental agreement",
    notificationType: "contract_sent",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Sign your rental agreement — ${d.reference}`,
      preheader: "Review and sign from your phone in about 2 minutes.",
      heading: "Your rental agreement is ready",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** has signed your rental agreement. Please review it and sign to confirm your booking.` },
        bookingDetails(d),
        { note: "You can type or draw your signature. Your booking is confirmed as soon as you sign.", tone: "info" },
      ],
      cta: { label: "Review & sign", url: `${renterBooking(d)}/contract` },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  contract_amended: {
    audience: "Renter",
    trigger: "The business changes the terms of a sent or signed agreement",
    notificationType: "contract_amended",
    sample: { ...SAMPLE, version: 2 },
    build: (d) => ({
      subject: `Your rental agreement was updated — ${d.reference}`,
      preheader: "A new version needs your signature.",
      heading: "Your agreement was updated",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** updated your booking, so a new version${d.version ? ` (v${d.version})` : ""} of your rental agreement is on its way for signing.` },
        { note: "Your previously signed version stays on record and can still be downloaded.", tone: "info" },
        bookingDetails(d),
      ],
      cta: { label: "View booking", url: renterBooking(d) },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  booking_confirmed: {
    audience: "Renter",
    trigger: "The renter signs the agreement — booking confirmed",
    notificationType: "booking_confirmed",
    sample: { ...SAMPLE, paymentInstructions: "Send ₱1,800 via GCash to 0917 123 4567 (Maria Santos) before pickup." },
    build: (d) => ({
      subject: `You're confirmed: ${d.vehicle}`,
      preheader: `Pickup ${d.pickup} · ${d.pickupLocation}`,
      heading: "You're all set!",
      blocks: [
        { p: `${hi(d)} your rental agreement is signed and your booking with **${d.businessName}** is confirmed.` },
        bookingDetails(d),
        ...(d.paymentInstructions ? [{ note: `**Payment:** ${d.paymentInstructions}`, tone: "warning" } as Block] : []),
        { list: ["Bring your driver's license and one valid government ID", "Inspect the car with the business at pickup", "Your signed agreement is always available in 13C"] },
      ],
      cta: { label: "Download signed agreement", url: `/api/contracts/${d.versionId}/pdf` },
      secondary: { label: "View booking", url: renterBooking(d) },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  booking_rejected: {
    audience: "Renter",
    trigger: "The business declines a request",
    notificationType: "booking_rejected",
    sample: { ...SAMPLE, reason: "The car is reserved for a long-term rental that week." },
    build: (d) => ({
      subject: `Booking request declined — ${d.vehicle}`,
      preheader: `${d.businessName} couldn't accept this request.`,
      heading: "Your request was declined",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** couldn't accept your request for the ${d.vehicle}.` },
        ...(d.reason ? [{ quote: d.reason, by: d.businessName } as Block] : []),
        { p: "Other verified businesses may have cars available for your dates." },
      ],
      cta: { label: "Find another car", url: "/explore" },
    }),
  },
  booking_cancelled_by_business: {
    audience: "Renter",
    trigger: "The business cancels a booking",
    notificationType: "booking_cancelled",
    sample: { ...SAMPLE, reason: "Vehicle unavailable due to repairs." },
    build: (d) => ({
      subject: `Booking cancelled — ${d.reference}`,
      preheader: `${d.businessName} cancelled your booking.`,
      heading: "Your booking was cancelled",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** cancelled booking ${d.reference} for the ${d.vehicle}.` },
        ...(d.reason ? [{ quote: d.reason, by: d.businessName } as Block] : []),
        { note: "If you paid anything, the business's cancellation policy and your agreement apply — contact them directly about refunds.", tone: "warning" },
      ],
      cta: { label: "View booking", url: renterBooking(d) },
      secondary: { label: "Find another car", url: "/explore" },
      disclaimer: provider(d),
    }),
  },
  booking_expired: {
    audience: "Renter",
    trigger: "A request wasn't approved before the pickup time",
    notificationType: "booking_expired",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Booking request expired — ${d.reference}`,
      preheader: "The pickup time passed before the business responded.",
      heading: "Your request expired",
      blocks: [{ p: `${hi(d)} your request for the ${d.vehicle} with **${d.businessName}** expired because the pickup time passed before it was approved.` }],
      cta: { label: "Find a car", url: "/explore" },
    }),
  },
  rental_starting: {
    audience: "Renter",
    trigger: "24 hours before pickup",
    notificationType: "rental_starting",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Pickup tomorrow: ${d.vehicle}`,
      preheader: `${d.pickup} · ${d.pickupLocation}`,
      heading: "Your rental starts soon",
      blocks: [
        { p: `${hi(d)} here's what you need for pickup with **${d.businessName}**.` },
        bookingDetails(d),
        { list: ["Driver's license and one valid government ID", "Payment and security deposit as agreed", "Walk around the car with the business and note any existing marks"] },
      ],
      cta: { label: "View booking", url: renterBooking(d) },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  rental_ending: {
    audience: "Renter",
    trigger: "24 hours before return",
    notificationType: "rental_ending",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Return by ${d.return}: ${d.vehicle}`,
      preheader: `Return to ${d.returnLocation}.`,
      heading: "Your rental ends soon",
      blocks: [
        { p: `${hi(d)} please return the ${d.vehicle} to **${d.returnLocation}** by **${d.return}**.` },
        { list: ["Refuel to the agreed level", "Bring back all keys, documents and accessories", "Message the business early if you need more time"] },
      ],
      cta: { label: "Message the business", url: d.conversationId ? `/account/messages/${d.conversationId}` : renterBooking(d) },
      accent: d.accent,
      disclaimer: provider(d),
    }),
  },
  review_request: {
    audience: "Renter",
    trigger: "The business marks the rental completed",
    notificationType: "review_request",
    sample: SAMPLE,
    build: (d) => ({
      subject: `How was your rental with ${d.businessName}?`,
      preheader: "Your review helps other renters choose with confidence.",
      heading: "How was your trip?",
      blocks: [
        { p: `${hi(d)} thanks for renting the ${d.vehicle} with **${d.businessName}**. Rate the car and the business — it takes 30 seconds.` },
        { note: "Only renters with completed bookings can review on 13C, so every review is real.", tone: "success" },
      ],
      cta: { label: "Leave a review", url: renterBooking(d) },
      accent: d.accent,
    }),
  },
  message_to_customer: {
    audience: "Renter",
    trigger: "A business replies in a conversation (batched per conversation)",
    notificationType: "message",
    sample: { ...SAMPLE, message: "Yes, it's available Oct 10–12. Delivery to Mactan Airport is ₱300." },
    build: (d) => ({
      subject: `New message from ${d.businessName}`,
      preheader: d.message ?? "You have a new message.",
      heading: `${d.businessName} replied`,
      blocks: [
        ...(d.message ? [{ quote: d.message, by: d.businessName } as Block] : []),
      ],
      cta: { label: "Reply", url: `/account/messages/${d.conversationId}` },
      accent: d.accent,
    }),
  },
  deletion_received: {
    audience: "Renter",
    trigger: "A user requests account deletion (Data Privacy Act)",
    sample: SAMPLE,
    build: (d) => ({
      subject: "We received your account deletion request",
      preheader: "We'll process it within 30 days.",
      heading: "Your deletion request was received",
      blocks: [
        { p: `${hi(d)} we'll delete your 13C account and personal data within 30 days and email you when it's done.` },
        { list: ["Your profile, contact details, driver's license and ID files will be erased", "Completed bookings and signed rental agreements are kept as required by law, with your personal details removed", "You won't be able to sign in once it's processed"] },
        { p: "Didn't request this? Reply to support@13c.online right away." },
      ],
    }),
  },

  // ─────────────────────────────── Businesses ───────────────────────────────
  business_submitted: {
    audience: "Business",
    trigger: "An owner submits their business for verification",
    sample: SAMPLE,
    build: (d) => ({
      subject: `We're reviewing ${d.businessName}`,
      preheader: "Meanwhile, set up your store and fleet.",
      heading: "Thanks — we're reviewing your business",
      blocks: [
        { p: `${hi(d)} we received **${d.businessName}**'s documents. Our team usually reviews new businesses within 1–2 business days.` },
        { p: "While you wait, get your store ready so you can publish the moment you're verified:" },
        { list: ["Upload your logo and cover photo", "Add your cars with photos and pricing", "Set your rental policies and payment methods"] },
        { note: `Your ${TRIAL_DAYS}-day free trial starts when you're verified.`, tone: "info" },
      ],
      cta: { label: "Set up your store", url: "/dashboard/store" },
    }),
  },
  verification_under_review: {
    audience: "Business",
    trigger: "An admin starts reviewing the business",
    notificationType: "verification_under_review",
    sample: SAMPLE,
    build: (d) => ({
      subject: `${d.businessName} is under review`,
      preheader: "A 13C reviewer is checking your documents.",
      heading: "Your verification is under review",
      blocks: [{ p: `${hi(d)} a 13C reviewer is checking **${d.businessName}** now. We'll email you as soon as there's a decision.` }],
      cta: { label: "Go to dashboard", url: "/dashboard" },
    }),
  },
  verification_verified: {
    audience: "Business",
    trigger: "An admin approves the business",
    notificationType: "verification_verified",
    sample: { ...SAMPLE, trialEnds: "Oct 28, 2026" },
    build: (d) => ({
      subject: `${d.businessName} is verified`,
      preheader: "Publish your store and start taking bookings.",
      heading: "You're verified!",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** is now a Verified Business on 13C. Publish your store to start taking bookings.` },
        { note: `Your ${TRIAL_DAYS}-day free trial has started${d.trialEnds ? ` and runs until **${d.trialEnds}**` : ""}. Try everything in Pro, with up to 10 vehicles.`, tone: "success" },
      ],
      cta: { label: "Publish your store", url: "/dashboard/store" },
    }),
  },
  verification_changes_requested: {
    audience: "Business",
    trigger: "An admin asks for changes",
    notificationType: "verification_changes_requested",
    sample: { ...SAMPLE, note: "Please upload your current Mayor's permit — the one provided expired in 2025." },
    build: (d) => ({
      subject: `Action needed: ${d.businessName} verification`,
      preheader: "We need a few changes before we can verify you.",
      heading: "A few changes are needed",
      blocks: [
        { p: `${hi(d)} we reviewed **${d.businessName}** and need a few updates before we can verify it.` },
        ...(d.note ? [{ quote: d.note, by: "13C review team" } as Block] : []),
      ],
      cta: { label: "Update & resubmit", url: "/dashboard/profile#verification" },
    }),
  },
  verification_rejected: {
    audience: "Business",
    trigger: "An admin rejects the verification",
    notificationType: "verification_rejected",
    sample: { ...SAMPLE, note: "We couldn't confirm the business registration number." },
    build: (d) => ({
      subject: `${d.businessName} wasn't verified`,
      preheader: "See the reviewer's note and resubmit.",
      heading: "We couldn't verify your business",
      blocks: [
        { p: `${hi(d)} we weren't able to verify **${d.businessName}** this time.` },
        ...(d.note ? [{ quote: d.note, by: "13C review team" } as Block] : []),
        { p: "You can correct your details and resubmit, or reply to support@13c.online if you have questions." },
      ],
      cta: { label: "Review & resubmit", url: "/dashboard/profile#verification" },
    }),
  },
  verification_suspended: {
    audience: "Business",
    trigger: "An admin suspends the business",
    notificationType: "verification_suspended",
    sample: { ...SAMPLE, note: "Multiple renter reports are under investigation." },
    build: (d) => ({
      subject: `${d.businessName} has been suspended`,
      preheader: "Your store is hidden from customers.",
      heading: "Your business has been suspended",
      blocks: [
        { p: `${hi(d)} **${d.businessName}** has been suspended and your store is hidden from customers. Existing bookings and contracts remain accessible.` },
        ...(d.note ? [{ quote: d.note, by: "13C review team" } as Block] : []),
        { p: "Please contact support@13c.online to resolve this." },
      ],
      cta: { label: "Go to dashboard", url: "/dashboard" },
    }),
  },
  booking_request: {
    audience: "Business",
    trigger: "A renter requests a booking",
    notificationType: "booking_request",
    sample: SAMPLE,
    build: (d) => ({
      subject: `New booking request: ${d.vehicle}, ${d.pickup}`,
      preheader: `${d.customerName} · ${d.total}`,
      heading: "New booking request",
      blocks: [
        { p: `**${d.customerName}** wants to book your ${d.vehicle}. Approving generates the rental agreement automatically.` },
        bookingDetails(d),
        { note: "Fast replies win more bookings — and your response time shows on your store.", tone: "info" },
      ],
      cta: { label: "Review request", url: businessBooking(d) },
    }),
  },
  inquiry: {
    audience: "Business",
    trigger: "A customer messages the business (batched per conversation)",
    notificationType: "message",
    sample: { ...SAMPLE, message: "Hi! Is the Vios available Oct 10–12? Can you deliver to Mactan Airport?" },
    build: (d) => ({
      subject: `New message from ${d.customerName}`,
      preheader: d.message ?? "A customer sent you a message.",
      heading: `${d.customerName} sent a message`,
      blocks: [
        ...(d.vehicle ? [{ p: `About your **${d.vehicle}**.` } as Block] : []),
        ...(d.message ? [{ quote: d.message, by: d.customerName } as Block] : []),
      ],
      cta: { label: "Reply", url: `/dashboard/messages/${d.conversationId}` },
    }),
  },
  contract_generated: {
    audience: "Business",
    trigger: "A booking is approved and its agreement is generated (or regenerated)",
    notificationType: "contract_generated",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Review and send the agreement — ${d.reference}`,
      preheader: "Auto-filled from the booking and your store policies.",
      heading: "Your rental agreement is ready to review",
      blocks: [
        { p: `The agreement for **${d.customerName}** was filled in automatically from the booking, your business profile and your store policies. Review it, then sign and send.` },
        bookingDetails(d),
      ],
      cta: { label: "Review & send", url: businessBooking(d) },
    }),
  },
  contract_signed: {
    audience: "Business",
    trigger: "The renter signs — booking confirmed",
    notificationType: "contract_signed",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Signed & confirmed: ${d.reference}`,
      preheader: `${d.customerName} signed the rental agreement.`,
      heading: "Contract signed — booking confirmed",
      blocks: [
        { p: `**${d.customerName}** signed the rental agreement. The booking is confirmed and the signed PDF is stored securely.` },
        bookingDetails(d),
      ],
      cta: { label: "View booking", url: businessBooking(d) },
      secondary: { label: "Download signed agreement", url: `/api/contracts/${d.versionId}/pdf` },
    }),
  },
  booking_cancelled_by_renter: {
    audience: "Business",
    trigger: "The renter cancels",
    notificationType: "booking_cancelled",
    sample: { ...SAMPLE, reason: "Flight was rescheduled." },
    build: (d) => ({
      subject: `Booking cancelled by renter — ${d.reference}`,
      preheader: `${d.customerName} cancelled ${d.vehicle}.`,
      heading: "A booking was cancelled",
      blocks: [
        { p: `**${d.customerName}** cancelled booking ${d.reference}. The dates are open again on your calendar.` },
        ...(d.reason ? [{ quote: d.reason, by: d.customerName } as Block] : []),
        bookingDetails(d),
      ],
      cta: { label: "View booking", url: businessBooking(d) },
    }),
  },
  pickup_soon: {
    audience: "Business",
    trigger: "24 hours before pickup",
    notificationType: "rental_starting",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Pickup within 24 hours — ${d.reference}`,
      preheader: `${d.customerName} · ${d.pickup}`,
      heading: "Pickup tomorrow",
      blocks: [
        bookingDetails(d),
        { list: ["Check the renter's license and ID against the booking", "Collect payment and deposit as agreed, then record it in 13C", "Do the walk-around inspection, then mark the booking as picked up"] },
      ],
      cta: { label: "Open booking", url: businessBooking(d) },
    }),
  },
  return_soon: {
    audience: "Business",
    trigger: "24 hours before return",
    notificationType: "rental_ending",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Return within 24 hours — ${d.reference}`,
      preheader: `${d.customerName} · ${d.return}`,
      heading: "Return tomorrow",
      blocks: [bookingDetails(d), { p: "After inspecting the car, mark it returned and settle the deposit, then complete the rental to request a review." }],
      cta: { label: "Open booking", url: businessBooking(d) },
    }),
  },
  review_received: {
    audience: "Business",
    trigger: "A renter leaves a review",
    notificationType: "review_received",
    sample: { ...SAMPLE, rating: 5, comment: "Clean car, smooth airport handover. Will book again!" },
    build: (d) => ({
      subject: `New ${d.rating}★ review from ${d.customerName}`,
      preheader: d.comment ?? "A renter reviewed their rental.",
      heading: `You got a ${d.rating}-star review`,
      blocks: [...(d.comment ? [{ quote: d.comment, by: d.customerName } as Block] : []), { p: "A short public reply shows future renters you care." }],
      cta: { label: "Respond", url: "/dashboard/reviews" },
    }),
  },
  trial_ending: {
    audience: "Business",
    trigger: "3 days before the free trial ends",
    notificationType: "trial_ending",
    sample: { ...SAMPLE, trialEnds: "Oct 28, 2026", daysLeft: 3 },
    build: (d) => ({
      subject: `Your free trial ends ${d.trialEnds}`,
      preheader: "Choose a plan to keep your store live.",
      heading: `${d.daysLeft ?? 3} days left in your free trial`,
      blocks: [
        { p: `${hi(d)} **${d.businessName}**'s free trial ends on **${d.trialEnds}**. Choose a plan to keep your store live and bookings coming in.` },
        { details: PLANS.filter((p) => p.id !== "FREE").map((p) => [`${p.name} · ${p.vehicles}`, `${p.price}${p.period}`]) },
        { p: "If the trial ends without a plan, your store is hidden from customers. Existing bookings and contracts keep working." },
      ],
      cta: { label: "Choose a plan", url: "/dashboard/subscription" },
    }),
  },
  trial_ended: {
    audience: "Business",
    trigger: "The free trial ends without a paid plan",
    notificationType: "trial_ended",
    sample: SAMPLE,
    build: (d) => ({
      subject: "Your free trial has ended",
      preheader: "Your store is hidden until you upgrade.",
      heading: "Your free trial has ended",
      blocks: [
        { p: `${hi(d)} **${d.businessName}**'s store is now hidden from customers and you can't add vehicles. Your dashboard, existing bookings and contracts still work.` },
        { details: PLANS.filter((p) => p.id !== "FREE").map((p) => [`${p.name} · ${p.vehicles}`, `${p.price}${p.period}`]) },
      ],
      cta: { label: "Upgrade to go live", url: "/dashboard/subscription" },
    }),
  },
  plan_changed: {
    audience: "Business",
    trigger: "An admin changes the business's plan",
    sample: { ...SAMPLE, plan: "Pro" },
    build: (d) => {
      const p = PLANS.find((x) => x.name.toLowerCase() === (d.plan ?? "").toLowerCase());
      return {
        subject: `You're on the ${d.plan} plan`,
        preheader: p ? `${p.vehicles} · ${p.price}${p.period}` : "Your plan was updated.",
        heading: `Welcome to ${d.plan}`,
        blocks: [
          { p: `${hi(d)} **${d.businessName}** is now on the **${d.plan}** plan.` },
          ...(p ? [{ list: [p.vehicles, ...p.features.slice(0, 4)] } as Block] : []),
        ],
        cta: { label: "Go to dashboard", url: "/dashboard" },
      };
    },
  },
  team_added: {
    audience: "Business",
    trigger: "An owner adds someone to their team",
    notificationType: "team_added",
    sample: { ...SAMPLE, role: "Manager" },
    build: (d) => ({
      subject: `You've joined ${d.businessName} on 13C`,
      preheader: `You were added as ${d.role}.`,
      heading: `You're on the ${d.businessName} team`,
      blocks: [{ p: `${hi(d)} you were added to **${d.businessName}** as **${d.role}**. Switch businesses from the menu at the top of your dashboard.` }],
      cta: { label: "Open dashboard", url: "/dashboard" },
    }),
  },

  // ─────────────────────────────── Admins ───────────────────────────────
  admin_verification_submitted: {
    audience: "Admin",
    trigger: "A business submits verification documents",
    notificationType: "verification_submitted",
    sample: SAMPLE,
    build: (d) => ({
      subject: `Awaiting verification: ${d.businessName}`,
      preheader: "Review documents and decide.",
      heading: "A business is awaiting verification",
      blocks: [{ p: `**${d.businessName}** submitted its documents for verification.` }],
      cta: { label: "Review business", url: `/admin/businesses/${d.businessId}` },
      footer: "admin",
    }),
  },
  admin_deletion_requested: {
    audience: "Admin",
    trigger: "A user requests account deletion",
    notificationType: "deletion_requested",
    sample: { ...SAMPLE, email: "juan@example.com" },
    build: (d) => ({
      subject: "Account deletion requested",
      preheader: `${d.email} asked to delete their account.`,
      heading: "Account deletion requested",
      blocks: [
        { p: `**${d.email}** asked to delete their account. Under the Data Privacy Act, process it within 30 days.` },
        { note: "Anonymizing erases personal data and ID files and disables sign-in; booking and contract records are retained.", tone: "info" },
      ],
      cta: { label: "Open users", url: "/admin/users?filter=deletion" },
      footer: "admin",
    }),
  },
  admin_report_submitted: {
    audience: "Admin",
    trigger: "A user reports a listing, business or review",
    sample: { ...SAMPLE, reason: "Misleading listing or photos", note: "Photos are of a newer model than the actual car." },
    build: (d) => ({
      subject: `New report: ${d.reason}`,
      preheader: d.note ?? "A user submitted a report.",
      heading: "New report submitted",
      blocks: [{ details: [["Reason", d.reason], ["Details", d.note]] }],
      cta: { label: "Review reports", url: "/admin/reports" },
      footer: "admin",
    }),
  },
} satisfies Record<string, EmailTemplate>;

export type EmailKey = keyof typeof EMAILS;
