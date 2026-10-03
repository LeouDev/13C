import type { Metadata } from "next";
import Link from "next/link";
import { VehicleForm } from "@/components/business/vehicle-form";
import { PageHeader } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { getCategories } from "@/lib/queries";

export const metadata: Metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  const { business } = await requireBusiness("MANAGER");
  const categories = await getCategories();
  return (
    <>
      <Link href="/dashboard/vehicles" className="mb-3 inline-block text-sm text-muted-foreground hover:text-navy-900">← Vehicles</Link>
      <PageHeader eyebrow="Fleet" title="Add a vehicle" description="Next you'll add photos and availability." />
      <VehicleForm businessId={business.id} businessCity={business.city} categories={categories} />
    </>
  );
}
