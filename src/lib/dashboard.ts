import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type OnboardingStep = { key: string; label: string; done: boolean; href: string; optional?: boolean };

export async function getOnboarding(business: Tables<"businesses">) {
  const supabase = await createClient();
  const [store, vehicles, methods] = await Promise.all([
    supabase.from("business_storefronts").select("cover_path, is_published").eq("business_id", business.id).single(),
    supabase.from("vehicles").select("id, status, vehicle_pricing(daily_rate), vehicle_images(id)").eq("business_id", business.id).is("deleted_at", null),
    supabase.from("payment_methods").select("id").eq("business_id", business.id).eq("is_enabled", true),
  ]);
  const v = vehicles.data ?? [];
  const steps: OnboardingStep[] = [
    { key: "profile", label: "Business profile", done: !!(business.address && business.phone && business.representative_name), href: "/dashboard/profile" },
    { key: "verified", label: "Verification approved", done: business.status === "VERIFIED", href: "/dashboard/profile" },
    { key: "logo", label: "Logo", done: !!business.logo_path, href: "/dashboard/store" },
    { key: "cover", label: "Cover image", done: !!store.data?.cover_path, href: "/dashboard/store" },
    { key: "vehicle", label: "First vehicle", done: v.length > 0, href: "/dashboard/vehicles/new" },
    { key: "photos", label: "Vehicle photos", done: v.some((x) => x.vehicle_images.length > 0), href: "/dashboard/vehicles" },
    { key: "pricing", label: "Pricing", done: v.some((x) => x.vehicle_pricing), href: "/dashboard/vehicles" },
    { key: "availability", label: "Availability", done: v.some((x) => x.status === "ACTIVE"), href: "/dashboard/calendar" },
    { key: "payments", label: "Payment methods", done: (methods.data ?? []).length > 0, href: "/dashboard/payments" },
    { key: "second", label: "Add a second vehicle", done: v.length > 1, href: "/dashboard/vehicles/new", optional: true },
    { key: "publish", label: "Publish storefront", done: !!store.data?.is_published, href: "/dashboard/store" },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, percent: Math.round((done / steps.length) * 100), published: !!store.data?.is_published };
}
