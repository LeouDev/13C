import type { Metadata } from "next";
import { ExploreView } from "@/components/marketplace/explore-view";
import { getPlaces, type SearchParams } from "@/lib/queries";

export const metadata: Metadata = {
  title: { absolute: "Rent a car in the Philippines — compare local rental businesses · 13C" },
  description: "Search self-drive and with-driver cars from verified local rental businesses across the Philippines. Book directly on 13C.",
  alternates: { canonical: "/explore" },
};

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const p = (await searchParams) as SearchParams & { view?: string };
  const loc = (await getPlaces()).find(p.location);
  return <div className="bg-[#f6f7f9]"><ExploreView p={p} view={p.view} basePath="/explore" title={loc ? `Cars in ${loc.name}` : "Cars across the Philippines"} /></div>;
}
