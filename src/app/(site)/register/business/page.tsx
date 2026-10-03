import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterWizard } from "@/components/business/register-wizard";
import { getMemberships, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create your rental business", robots: { index: false } };

export default async function RegisterBusinessPage({ searchParams }: PageProps<"/register/business">) {
  await requireUser("/register/business");
  const { new: fresh } = await searchParams;
  const owned = (await getMemberships()).filter((m) => m.role === "OWNER");
  const draft = owned.find((m) => ["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(m.business.status));
  if (!fresh && owned.length > 0 && !draft) redirect("/dashboard");

  let resume = null;
  if (draft && !fresh) {
    const supabase = await createClient();
    const { data } = await supabase.from("business_storefronts").select("cover_path, tagline").eq("business_id", draft.business.id).single();
    resume = { id: draft.business.id, logo_path: draft.business.logo_path, cover_path: data?.cover_path ?? null, tagline: data?.tagline ?? null };
  }

  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <p className="eyebrow text-electric">13C for rental businesses</p>
      <h1 className="mt-2 font-display-italic text-3xl text-navy-900 sm:text-4xl">Your car rental business, online.</h1>
      <p className="mt-2 text-muted-foreground">Set up your verified 13C store in about 10 minutes. It stays private until you publish it.</p>
      <div className="mt-8 rounded-3xl border bg-white p-5 sm:p-8">
        <RegisterWizard resume={resume} />
      </div>
    </div>
  );
}
