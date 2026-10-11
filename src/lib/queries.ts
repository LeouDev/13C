import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { POLICY_FIELDS } from "@/lib/constants";
import { manilaToISO } from "@/lib/format";
import type { Database, Enums } from "@/types/database";

export type VehicleResult = Database["public"]["Functions"]["search_vehicles"]["Returns"][number];
export type BusinessStats = Database["public"]["Functions"]["business_public_stats"]["Returns"][number];

export type SearchParams = {
  location?: string; q?: string; type?: string; transmission?: string; seats?: string;
  min?: string; max?: string; from?: string; to?: string; selfDrive?: string; driver?: string;
  delivery?: string; rating?: string; sort?: string; page?: string;
};

export const PAGE_SIZE = 18;

/** A province, or a city in it (`spellings`: how its listings write the city, e.g. "Lapu-Lapu" and "Lapu Lapu"). */
export type Place = { slug: string; name: string; province: string; spellings?: string[]; cars: number };
export type Province = Place & { cities: Place[] };

/**
 * The provinces and cities that have cars on the marketplace, most cars first. A place's slug is its name; a city also
 * gets its province's when another province has a town by that name, or a province shares it.
 */
export function placesFrom(rows: { province: string; city: string; cars: number }[]) {
  const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const byProvince = new Map<string, Province>();
  for (const r of rows) {
    const p = byProvince.get(r.province) ?? { slug: slug(r.province), name: r.province, province: r.province, cars: 0, cities: [] };
    byProvince.set(r.province, p);
    p.cars += Number(r.cars);
    const same = p.cities.find((c) => c.slug === slug(r.city));
    if (same) { same.spellings!.push(r.city); same.cars += Number(r.cars); }
    else p.cities.push({ slug: slug(r.city), name: r.city, province: r.province, spellings: [r.city], cars: Number(r.cars) });
  }
  const mostCars = (a: Place, b: Place) => b.cars - a.cars || a.name.localeCompare(b.name);
  const provinces = [...byProvince.values()].sort(mostCars);
  const cities = provinces.flatMap((p) => p.cities.sort(mostCars));
  const uses = new Map<string, number>();
  for (const c of [...provinces, ...cities]) uses.set(c.slug, (uses.get(c.slug) ?? 0) + 1);
  for (const c of cities) if (uses.get(c.slug)! > 1) c.slug += `-${slug(c.province)}`;
  return { provinces, cities: [...cities].sort(mostCars), find: (s?: string) => [...provinces, ...cities].find((x) => x.slug === s) };
}

export const getPlaces = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("marketplace_locations");
  return placesFrom(data ?? []);
});

export async function searchVehicles(p: SearchParams, extra: { businessId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  const loc = p.location ? (await getPlaces()).find(p.location) : undefined;
  const page = Math.max(1, Number(p.page) || 1);
  const limit = extra.limit ?? PAGE_SIZE;
  const from = p.from && /^\d{4}-\d{2}-\d{2}$/.test(p.from) ? manilaToISO(p.from) : undefined;
  const to = p.to && /^\d{4}-\d{2}-\d{2}$/.test(p.to) ? manilaToISO(p.to) : undefined;
  const { data, error } = await supabase.rpc("search_vehicles", {
    p_cities: loc?.spellings,
    p_province: loc?.province,
    p_q: p.q || undefined,
    p_category: p.type || undefined,
    p_transmission: (p.transmission as Enums<"transmission_type">) || undefined,
    p_min_seats: p.seats ? Number(p.seats) : undefined,
    p_min_price: p.min ? Number(p.min) : undefined,
    p_max_price: p.max ? Number(p.max) : undefined,
    p_self_drive: p.selfDrive === "1" || undefined,
    p_with_driver: p.driver === "1" || undefined,
    p_delivery: p.delivery === "1" || undefined,
    p_min_rating: p.rating ? Number(p.rating) : undefined,
    p_business_id: extra.businessId,
    p_start: from,
    p_end: to,
    p_sort: p.sort || "recommended",
    p_limit: limit,
    p_offset: (page - 1) * limit,
  });
  if (error) throw error;
  return { vehicles: data ?? [], total: Number(data?.[0]?.total_count ?? 0), page };
}

export async function getStats(ids: string[]) {
  if (ids.length === 0) return new Map<string, BusinessStats>();
  const supabase = await createClient();
  const { data } = await supabase.rpc("business_public_stats", { p_ids: ids });
  return new Map((data ?? []).map((s) => [s.business_id, s]));
}

export const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicle_categories").select("slug, label").eq("is_active", true).order("sort_order");
  return data ?? [];
});

export async function getFeaturedBusinesses(limit = 6) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, name, slug, city, logo_path, description, business_storefronts!inner(tagline, cover_path, accent_color, is_published)")
    .eq("status", "VERIFIED")
    .eq("business_storefronts.is_published", true)
    .eq("is_demo", false)
    .is("deleted_at", null)
    .order("verified_at", { ascending: false })
    .limit(limit);
  const list = data ?? [];
  const stats = await getStats(list.map((b) => b.id));
  return list.map((b) => ({ ...b, stats: stats.get(b.id) }));
}
export type FeaturedBusiness = Awaited<ReturnType<typeof getFeaturedBusinesses>>[number];

/** Public storefront (RLS returns it only when VERIFIED + published, or to its members/admins). */
export const getStorefront = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*, business_storefronts(*)")
    .eq("slug", slug.toLowerCase())
    .is("deleted_at", null)
    .maybeSingle();
  if (!data || !data.business_storefronts) return null;
  const { business_storefronts: store, ...business } = data;
  const [stats, methods] = await Promise.all([
    getStats([business.id]),
    supabase.rpc("get_public_payment_methods", { p_business_id: business.id }),
  ]);
  return { business, store, stats: stats.get(business.id), paymentMethods: methods.data ?? [] };
});
export type Storefront = NonNullable<Awaited<ReturnType<typeof getStorefront>>>;

/** The business's subscription (once per request). */
export const getSubscription = cache(async (businessId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("plan, status, current_period_end").eq("business_id", businessId).maybeSingle();
  return data;
});

/** Optional storefront sections that render: the owner didn't hide them and they have content. The page and its tabs both use this. */
export function storeSections({ store, paymentMethods }: Storefront) {
  const has: Record<string, boolean> = {
    about: !!store.about?.trim(),
    locations: store.pickup_locations.length > 0 || store.delivery_areas.length > 0,
    policies: paymentMethods.length > 0 || POLICY_FIELDS.some((p) => (store.policies as Record<string, string>)[p.key]?.trim()),
    reviews: true,
    faq: ((store.faqs as unknown[]) ?? []).length > 0,
  };
  return new Set(Object.keys(has).filter((k) => has[k] && !store.hidden_sections.includes(k)));
}

export const getVehicleBySlug = cache(async (businessId: string, slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("*, vehicle_pricing(*), vehicle_images(id, storage_path, position, width, height), vehicle_categories(label)")
    .eq("business_id", businessId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .order("position", { referencedTable: "vehicle_images" })
    .maybeSingle();
  return data;
});
export type VehicleDetail = NonNullable<Awaited<ReturnType<typeof getVehicleBySlug>>>;
