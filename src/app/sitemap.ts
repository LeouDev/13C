import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { LOCATIONS, SITE_URL } from "@/lib/constants";
import type { Database } from "@/types/database";

export const revalidate = 3600;

/** Public pages only: home, explore, city pages, published storefronts and their active vehicles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data: businesses } = await supabase.from("businesses").select("slug, updated_at, vehicles(slug, updated_at, status, deleted_at)").limit(5000);
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/explore`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/for-business`, changeFrequency: "monthly", priority: 0.6 },
    ...LOCATIONS.map((l) => ({ url: `${SITE_URL}/explore/${l.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(businesses ?? []).flatMap((b) => [
      { url: `${SITE_URL}/${b.slug}`, lastModified: new Date(b.updated_at), changeFrequency: "daily" as const, priority: 0.8 },
      ...b.vehicles.filter((v) => v.status === "ACTIVE" && !v.deleted_at).map((v) => ({ url: `${SITE_URL}/${b.slug}/${v.slug}`, lastModified: new Date(v.updated_at), changeFrequency: "weekly" as const, priority: 0.7 })),
    ]),
  ];
}
