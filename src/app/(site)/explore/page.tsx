import type { Metadata } from "next";
import { ExploreView } from "@/components/marketplace/explore-view";
import { locationBySlug } from "@/lib/constants";
import type { SearchParams } from "@/lib/queries";

export const metadata: Metadata = {
  title: { absolute: "Rent a car in Cebu — compare local rental businesses · 13C" },
  description: "Search self-drive and with-driver cars from verified rental businesses in Cebu City, Mactan, Lapu-Lapu, Mandaue and Talisay.",
  alternates: { canonical: "/explore" },
};

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const p = (await searchParams) as SearchParams & { view?: string };
  const loc = locationBySlug(p.location);
  return <div className="bg-[#f6f7f9]"><ExploreView p={p} view={p.view} basePath="/explore" title={loc ? `Cars in ${loc.name}` : "Cars across Cebu"} /></div>;
}
