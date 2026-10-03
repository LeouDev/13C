import { z } from "zod";
import { RESERVED_SLUGS } from "@/lib/constants";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const slugSchema = z
  .string().trim().toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/, "Use 3–48 lowercase letters, numbers and dashes")
  .refine((s) => !RESERVED_SLUGS.includes(s), "That link is reserved — try another");

export const phoneSchema = z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number");

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
  policies: z.record(z.string(), z.string().trim().max(1500)),
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
