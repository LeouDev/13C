import type { Metadata } from "next";
import { StoreWorkspace } from "@/components/business/store-workspace";
import { PageHeader } from "@/components/common/states";
import { hasRole, requireBusiness } from "@/lib/auth";
import { getStoreChecklist } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Store" };

export default async function MyStorePage() {
  const { business, role } = await requireBusiness("MANAGER");
  const supabase = await createClient();
  const [{ data: store }, { data: vehicles }, checklist] = await Promise.all([
    supabase.from("business_storefronts").select("*").eq("business_id", business.id).single(),
    supabase.from("vehicles").select("id, make, model, year").eq("business_id", business.id).is("deleted_at", null).order("created_at"),
    getStoreChecklist(business),
  ]);
  return (
    <>
      <PageHeader eyebrow="My Store" title="Your storefront" description="This is your business's own website on 13C. Customize how customers see you." />
      <StoreWorkspace business={business} store={store!} vehicles={vehicles ?? []} canPublish={hasRole(role, "OWNER")} checklist={checklist} />
    </>
  );
}
