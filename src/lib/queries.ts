import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { locationBySlug } from "@/lib/constants";
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

export async function searchVehicles(p: SearchParams, extra: { businessId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  const loc = locationBySlug(p.location);
  const page = Math.max(1, Number(p.page) || 1);
  const limit = extra.limit ?? PAGE_SIZE;
  const from = p.from && /^\d{4}-\d{2}-\d{2}$/.test(p.from) ? manilaToISO(p.from) : undefined;
  const to = p.to && /^\d{4}-\d{2}-\d{2}$/.test(p.to) ? manilaToISO(p.to) : undefined;
  const { data, error } = await supabase.rpc("search_vehicles", {
    p_cities: loc ? [...loc.match] : undefined,
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
