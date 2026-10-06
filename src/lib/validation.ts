import { z } from "zod";
import { RESERVED_SLUGS } from "@/lib/constants";

// No eval-compiled parsers: Zod would otherwise probe `Function("")`, which the Content-Security-Policy
// reports (and will block once enforced). These forms are small, so the faster path doesn't matter.
z.config({ jitless: true });

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const slugSchema = z
  .string().trim().toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/, "Use 3–48 lowercase letters, numbers and dashes")
  .refine((s) => !RESERVED_SLUGS.includes(s), "That link is reserved — try another");

/** Philippine numbers are stored as +63 followed by 9–10 digits. Accepts "917…", "0917…", "63917…" and "+63 917…". */
export function toPhilippinePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  return `+63${digits.startsWith("63") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits}`;
}
/** The part after +63, for showing in a field that already displays the prefix. */
export const localPhone = (stored: string | null | undefined) => (stored ?? "").replace(/^\s*\+?63\s*/, "");

export const phoneSchema = z.string().trim().min(1, "Enter your mobile number")
  .transform(toPhilippinePhone)
  .pipe(z.string().regex(/^\+63\d{9,10}$/, "Enter a valid Philippine number, e.g. 917 123 4567"));

export const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(80),
  slug: slugSchema,
  city: z.string().trim().min(2, "Choose a city").max(80),
  province: z.string().trim().max(80).default("Cebu"),
  address: z.string().trim().min(5, "Enter your business address").max(300),
  phone: phoneSchema,
  email: z.email("Enter a valid email").trim().max(120),
  description: optionalText(600),
  representative_name: z.string().trim().min(2, "Enter the authorized representative").max(120),
  representative_title: optionalText(80),
  registration_type: z.enum(["DTI", "SEC", "CDA", "MAYORS_PERMIT", "OTHER"]).optional().nullable(),
  registration_number: optionalText(60),
});
export type BusinessInput = z.input<typeof businessSchema>;

export const PAYMENT_METHOD_VALUES = ["CASH", "GCASH", "MAYA", "BANK_TRANSFER", "CARD", "OTHER"] as const;

export const paymentMethodsSchema = z
  .array(z.object({
    method: z.enum(PAYMENT_METHOD_VALUES),
    is_enabled: z.boolean(),
    account_name: optionalText(120),
    account_number: optionalText(60),
    instructions: optionalText(500),
    /** A QR image in the public media bucket, under b/<business>/pay/ (the database checks the business) */
    qr_path: z.string().regex(/^b\/[0-9a-f-]{36}\/pay\/[\w.-]+$/, "Upload the QR image again").nullable().optional(),
  }))
  .refine((list) => list.some((m) => m.is_enabled), "Accept at least one payment method");

const url = z.string().trim().max(200).optional().transform((v) => {
  if (!v) return undefined;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}).pipe(z.url("Enter a valid link").optional());

export const storefrontSchema = z.object({
  tagline: optionalText(140),
  about: optionalText(5000),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a color"),
  pickup_locations: z.array(z.string().trim().min(2).max(120)).max(20),
  delivery_areas: z.array(z.string().trim().min(2).max(120)).max(30),
  featured_vehicle_ids: z.array(z.uuid()).max(6),
  hidden_sections: z.array(z.string()).max(10),
  faqs: z.array(z.object({ q: z.string().trim().min(3).max(200), a: z.string().trim().min(1).max(1500) })).max(20),
  // "___" is a blank left by "Write with AI"; policies go into rental agreements, so it must be filled in first.
  policies: z.record(z.string(), z.string().trim().max(1500).refine((t) => !t.includes("___"), "Fill in the blank (___) first.")),
  social_links: z.object({ facebook: url, instagram: url, tiktok: url, website: url, messenger: url }),
  business_hours: z.array(z.object({ day: z.string(), open: z.string(), close: z.string(), closed: z.boolean() })).max(7),
});
export type StorefrontInput = z.input<typeof storefrontSchema>;

const money = (label: string) => z.coerce.number({ error: `Enter ${label}` }).min(0).max(10_000_000);
const optionalMoney = z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0).max(10_000_000)])
  .transform((v) => (v === "" || v == null ? null : Number(v)));

export const vehicleSchema = z.object({
  make: z.string().trim().min(1, "Enter the make").max(40),
  model: z.string().trim().min(1, "Enter the model").max(60),
  variant: optionalText(60),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  category_slug: z.string().min(1, "Choose a type"),
  transmission: z.enum(["AUTOMATIC", "MANUAL"]),
  fuel_type: z.enum(["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"]),
  seats: z.coerce.number().int().min(1).max(30),
  color: optionalText(40),
  plate_number: optionalText(20),
  description: optionalText(5000),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE", "UNAVAILABLE"]),
  self_drive: z.boolean(),
  with_driver: z.boolean(),
  delivery_available: z.boolean(),
  pickup_location: optionalText(200),
  city: z.string().trim().min(2, "Choose a city").max(80),
  min_rental_days: z.coerce.number().int().min(1).max(90),
}).refine((v) => v.self_drive || v.with_driver, { message: "Offer self-drive, with driver, or both", path: ["self_drive"] });

export const pricingSchema = z.object({
  daily_rate: money("a daily rate").refine((n) => n > 0, "Enter a daily rate"),
  weekly_rate: optionalMoney,
  monthly_rate: optionalMoney,
  security_deposit: optionalMoney,
  mileage_limit_km: optionalMoney,
  excess_km_fee: optionalMoney,
  delivery_fee: optionalMoney,
  driver_fee_per_day: optionalMoney,
});

export const renterSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: phoneSchema,
  legal_name: optionalText(120),
  date_of_birth: z.string().optional().transform((v) => v || null),
  address: z.string().trim().min(5, "Enter your address").max(300),
  city: optionalText(80),
  license_number: z.string().trim().min(5, "Enter your driver's license number").max(40),
  license_expiry: z.string().optional().transform((v) => v || null),
});
export type RenterInput = z.input<typeof renterSchema>;

// ── Business plan: fleet records and custom contract terms ──
const optionalDate = z.union([z.literal(""), z.null(), z.undefined(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])
  .transform((v) => v || null);
const optionalKm = z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int("Whole kilometres only").min(0).max(2_000_000)])
  .transform((v) => (v === "" || v == null ? null : Number(v)));

export const fleetSchema = z.object({
  registration_expires_on: optionalDate,
  insurance_expires_on: optionalDate,
  odometer_km: optionalKm,
  next_service_on: optionalDate,
  next_service_km: optionalKm,
});

export const serviceLogSchema = z.object({
  serviced_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the service date"),
  kind: z.string().trim().min(2, "What was done? (e.g. Oil change)").max(80),
  odometer_km: optionalKm,
  cost: optionalMoney,
  note: optionalText(1000),
});

export const contractTermsSchema = z.array(z.object({
  title: z.string().trim().min(2, "Add a short title").max(80),
  body: z.string().trim().min(2, "Write the term").max(2000),
})).max(10, "Up to 10 terms");
