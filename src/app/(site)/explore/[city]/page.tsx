import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExploreView } from "@/components/marketplace/explore-view";
import { getPlaces, placeLabel, type SearchParams } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/explore/[city]">): Promise<Metadata> {
  const loc = (await getPlaces()).find((await params).city);
  if (!loc) return {};
  return {
    title: `Car rental in ${placeLabel(loc)} — self-drive & with driver`,
    description: `Compare cars from verified local rental businesses in ${placeLabel(loc)}. Book directly on 13C.`,
    alternates: { canonical: `/explore/${loc.slug}` },
  };
}

/** One page per province or city with cars on 13C; a place without any (yet) goes to the full search. */
export default async function CityPage({ params, searchParams }: PageProps<"/explore/[city]">) {
  const loc = (await getPlaces()).find((await params).city);
  if (!loc) redirect("/explore");
  const p = { ...((await searchParams) as SearchParams), location: loc.slug };
  return <div className="bg-[#f6f7f9]"><ExploreView p={p} basePath={`/explore/${loc.slug}`} lockLocation title={`Car rental in ${loc.name}`} /></div>;
}
