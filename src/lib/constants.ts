import type { Enums } from "@/types/database";

/** Explicit in production; Vercel previews fall back to their own deployment URL. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3000");
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "13c.online";
/** How a storefront URL is displayed to owners (13c.online/<slug>). */
export const storeDisplayUrl = (slug: string) => `${ROOT_DOMAIN}/${slug}`;

/** Launch locations. `match` lists the city values a search for this location covers. */
export const LOCATIONS = [
  { slug: "cebu-city", name: "Cebu City", match: ["Cebu City"], blurb: "Downtown, IT Park & Ayala" },
  { slug: "mactan", name: "Mactan", match: ["Lapu-Lapu", "Mactan", "Cordova"], blurb: "Airport & island resorts" },
  { slug: "lapu-lapu", name: "Lapu-Lapu", match: ["Lapu-Lapu", "Mactan"], blurb: "Mactan-Cebu Int'l Airport" },
  { slug: "mandaue", name: "Mandaue", match: ["Mandaue"], blurb: "Central business corridor" },
  { slug: "talisay", name: "Talisay", match: ["Talisay"], blurb: "South Cebu gateway" },
  { slug: "consolacion", name: "Consolacion", match: ["Consolacion"], blurb: "North Cebu" },
  { slug: "liloan", name: "Liloan", match: ["Liloan"], blurb: "North coast" },
] as const;

export const CITY_OPTIONS = ["Cebu City", "Mandaue", "Lapu-Lapu", "Cordova", "Talisay", "Consolacion", "Liloan", "Minglanilla", "Danao", "Carcar", "Toledo"];

export const locationBySlug = (slug?: string | null) => LOCATIONS.find((l) => l.slug === slug);

/** /explore/cebu — the whole province (no city filter). */
export const ALL_CEBU = { slug: "cebu", name: "Cebu", match: [] as string[], blurb: "Cebu City, Mactan, Mandaue, Talisay and beyond" };
export const cityPageBySlug = (slug: string) => (slug === ALL_CEBU.slug ? ALL_CEBU : locationBySlug(slug));

export const PAYMENT_METHODS: { value: Enums<"payment_method_type">; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "GCASH", label: "GCash" },
  { value: "MAYA", label: "Maya" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

export const PAYMENT_STATUSES: { value: Enums<"payment_status">; label: string }[] = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "PAYMENT_ON_PICKUP", label: "Payment on pickup" },
];

export const TRANSMISSIONS = [
  { value: "AUTOMATIC", label: "Automatic" },
  { value: "MANUAL", label: "Manual" },
] as const;

export const FUEL_TYPES = [
  { value: "GASOLINE", label: "Gasoline" },
  { value: "DIESEL", label: "Diesel" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ELECTRIC", label: "Electric" },
] as const;

export const VEHICLE_STATUSES: { value: Enums<"vehicle_status">; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "UNAVAILABLE", label: "Unavailable" },
];

/** Mirrors public.trial_days() and public.plan_vehicle_limit() — tests/db.test.ts keeps them in sync. */
export const TRIAL_DAYS = 25;
export const PLAN_VEHICLE_LIMIT: Record<Enums<"subscription_plan">, number | null> = { FREE: 10, PRO: 10, BUSINESS: null };
/** Registered business that bills 13C plans; it's the merchant name on PayMongo checkout pages and receipts. */
export const BILLED_BY = "AIR/RALLY BOOKING SERVICES";
/** Monthly price in centavos. Must match public.plan_price_centavos() — tests/db.test.ts checks. */
export const PLAN_PRICE_CENTAVOS: Record<Enums<"subscription_plan">, number> = { FREE: 0, PRO: 49900, BUSINESS: 150000 };

export const PLANS = [
  { id: "FREE", name: "Free trial", price: "₱0", period: ` for ${TRIAL_DAYS} days`, vehicles: "Up to 10 vehicles",
    features: ["Try everything in Pro", "Your own storefront", "Inquiries, bookings & digital contracts", "Calendar, customers & analytics", "No credit card required"] },
  { id: "PRO", name: "Pro", price: "₱499", period: "/month", vehicles: "Up to 10 vehicles",
    features: ["Everything in Free", "Unlimited bookings", "Digital contracts & e-signatures", "Customer management", "Calendar", "Analytics", "Automated notifications"] },
  { id: "BUSINESS", name: "Business", price: "₱1,500", period: "/month", vehicles: "Unlimited vehicles",
    features: ["Everything in Pro", "Multiple staff accounts", "Advanced analytics", "Fleet management", "GPS integrations (soon)", "Custom contract settings", "Priority support"] },
] as const;

/** Must match public.is_reserved_slug() — tests/db.test.ts checks every entry. */
export const RESERVED_SLUGS = [
  "explore", "register", "login", "signup", "logout", "dashboard", "admin", "account", "api", "auth",
  "about", "privacy", "terms", "help", "support", "for-business", "business", "businesses", "search",
  "cars", "vehicles", "pricing", "contact", "settings", "notifications", "messages", "bookings", "new",
  "edit", "www", "app", "mail", "blog", "13c", "static", "assets", "images", "favicon.ico", "robots.txt",
  "sitemap.xml", "_next", "opengraph-image", "icon", "manifest.webmanifest",
];

export const ACCENT_PRESETS = ["#2F6BFF", "#0EA5E9", "#14B8A6", "#16A34A", "#E0312B", "#F26A1B", "#D97706", "#7C3AED", "#DB2777", "#121F3B"];

export const STORE_SECTIONS = [
  { id: "about", label: "About Us" },
  { id: "locations", label: "Pickup & Delivery" },
  { id: "policies", label: "Rental Policies" },
  { id: "reviews", label: "Reviews" },
  { id: "faq", label: "FAQ" },
] as const;

export const POLICY_FIELDS = [
  { key: "requirements", label: "Rental requirements", placeholder: "Valid driver's license + 1 government ID. Minimum age 21." },
  { key: "fuel", label: "Fuel policy", placeholder: "Return with the same fuel level as pickup." },
  { key: "mileage", label: "Mileage notes", placeholder: "Unlimited within Cebu island." },
  { key: "late_return", label: "Late return", placeholder: "1-hour grace period, then ₱200/hour." },
  { key: "cancellation", label: "Cancellation", placeholder: "Free cancellation up to 48 hours before pickup." },
  { key: "deposit", label: "Security deposit", placeholder: "Refunded within 3 days after return." },
  { key: "prohibited", label: "Additional prohibited uses", placeholder: "No pets. No smoking." },
  { key: "other", label: "Other terms", placeholder: "" },
] as const;

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
