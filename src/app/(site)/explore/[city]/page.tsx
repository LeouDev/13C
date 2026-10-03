import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreView } from "@/components/marketplace/explore-view";
import { LOCATIONS, locationBySlug } from "@/lib/constants";
import type { SearchParams } from "@/lib/queries";

export function generateStaticParams() {
  return LOCATIONS.map((l) => ({ city: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/explore/[city]">): Promise<Metadata> {
  const loc = locationBySlug((await params).city);
  if (!loc) return {};
  return {
    title: `Car rental in ${loc.name}, Cebu — self-drive & with driver`,
    description: `Compare cars from verified local rental businesses in ${loc.name}. ${loc.blurb}. Book directly on 13C.`,
    alternates: { canonical: `/explore/${loc.slug}` },
  };
}

export default async function CityPage({ params, searchParams }: PageProps<"/explore/[city]">) {
  const loc = locationBySlug((await params).city);
  if (!loc) notFound();
  const p = { ...((await searchParams) as SearchParams), location: loc.slug };
  return <div className="bg-[#f6f7f9]"><ExploreView p={p} basePath={`/explore/${loc.slug}`} lockLocation title={`Car rental in ${loc.name}`} /></div>;
}
