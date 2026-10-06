import "server-only";
import { subscriptionState } from "@/lib/plans";
import { getSubscription } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * required: needed to publish (set_storefront_published checks the same things, in
 * supabase/migrations/20261006000039_publish_checklist.sql); recommended: counts toward "ready", doesn't block;
 * optional: worth a look, not counted.
 */
export type ChecklistItem = { key: string; label: string; done: boolean; href: string; tier: "required" | "recommended" | "optional"; hint?: string };

/** What a business still needs before (and around) publishing its store: the dashboard card and My Store both show it. */
export async function getStoreChecklist(business: Tables<"businesses">) {
  const supabase = await createClient();
  const [{ data: store }, { data: vehicles }, { data: methods }, sub] = await Promise.all([
    supabase.from("business_storefronts").select("is_published, cover_path, tagline, about, policies, faqs, pickup_locations, business_hours").eq("business_id", business.id).single(),
    supabase.from("vehicles").select("id, status, vehicle_pricing(daily_rate), vehicle_images(id)").eq("business_id", business.id).is("deleted_at", null),
    supabase.from("payment_methods").select("id").eq("business_id", business.id).eq("is_enabled", true),
    getSubscription(business.id),
  ]);
  const cars = vehicles ?? [];
  const forRent = cars.filter((v) => v.status !== "INACTIVE");
  const policies = (store?.policies ?? {}) as Record<string, string>;
  const has = (key: string) => !!policies[key]?.trim();
  const filled = (s: string | null | undefined) => !!s?.trim();
  const verified = business.status === "VERIFIED";

  const items: ChecklistItem[] = [
    { key: "profile", tier: "required", label: "Business details: address, phone and representative", href: "/dashboard/profile",
      done: filled(business.address) && filled(business.phone) && filled(business.representative_name) },
    { key: "verified", tier: "required", label: "Verification approved by 13C", href: "/dashboard/profile#verification", done: verified,
      hint: business.status === "DRAFT" ? "Upload one document to apply"
        : ["PENDING", "UNDER_REVIEW"].includes(business.status) ? "In review, usually 1–2 business days"
        : business.status === "CHANGES_REQUESTED" ? "13C asked for changes" : undefined },
    ...(verified && !subscriptionState(sub).active
      ? [{ key: "plan", tier: "required", label: "An active plan (your free trial has ended)", href: "/dashboard/subscription", done: false } as const]
      : []),
    { key: "car", tier: "required", label: cars.length ? "A car that's active, priced and has a photo" : "Your first car, with a photo and a price",
      href: cars.length ? "/dashboard/vehicles" : "/dashboard/vehicles/new",
      done: cars.some((v) => v.status === "ACTIVE" && v.vehicle_pricing && v.vehicle_images.length > 0) },
    { key: "payments", tier: "required", label: "How renters pay you", href: "/dashboard/payments", done: (methods ?? []).length > 0 },
    { key: "cancellation", tier: "required", label: "Your cancellation policy", href: "/dashboard/store#policies", done: has("cancellation"),
      hint: "Write with AI can draft it" },

    { key: "logo", tier: "recommended", label: "Logo", href: "/dashboard/store#brand", done: !!business.logo_path },
    { key: "cover", tier: "recommended", label: "Cover photo", href: "/dashboard/store#brand", done: !!store?.cover_path },
    { key: "about", tier: "recommended", label: "Tagline and About text", href: "/dashboard/store#brand", done: filled(store?.tagline) && filled(store?.about) },
    { key: "photos", tier: "recommended", label: "Photos and prices on every car", href: "/dashboard/vehicles",
      done: forRent.length > 0 && forRent.every((v) => v.vehicle_pricing && v.vehicle_images.length > 0) },
    { key: "policies", tier: "recommended", label: "Fuel, deposit and late-return policies", href: "/dashboard/store#policies",
      done: has("fuel") && has("deposit") && has("late_return") },
    { key: "locations", tier: "recommended", label: "Pickup and delivery areas", href: "/dashboard/store#locations", done: (store?.pickup_locations ?? []).length > 0 },
    { key: "hours", tier: "recommended", label: "Business hours", href: "/dashboard/store#hours", done: ((store?.business_hours ?? []) as unknown[]).length > 0 },
    { key: "faq", tier: "recommended", label: "A few FAQs", href: "/dashboard/store#faq", done: ((store?.faqs ?? []) as unknown[]).length > 0 },

    { key: "down_payment", tier: "optional", label: "Down payment, to prevent no-shows", href: "/dashboard/settings", done: business.down_payment_percent > 0 },
    { key: "gap", tier: "optional", label: "Time between rentals for cleaning", href: "/dashboard/settings", done: business.turnaround_hours > 0 },
    { key: "second", tier: "optional", label: "A second car", href: "/dashboard/vehicles/new", done: cars.length > 1 },
  ];
  const counted = items.filter((i) => i.tier !== "optional");
  return {
    items,
    /** Everything required is done, so the store can be published */
    ready: items.every((i) => i.tier !== "required" || i.done),
    percent: Math.round((counted.filter((i) => i.done).length / counted.length) * 100),
    published: !!store?.is_published,
  };
}
export type StoreChecklist = Awaited<ReturnType<typeof getStoreChecklist>>;
