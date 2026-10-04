import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { SampleContractDemo } from "@/components/site/sample-contract-demo";
import { POLICY_FIELDS } from "@/lib/constants";
import type { ContractSection } from "@/lib/contracts/pdf";
import { formatDate, formatDateTime, formatPHP, manilaToISO, todayManila } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Try a sample rental agreement",
  description: "See how 13C rental agreements are signed: sign a sample as the rental business, then as the renter. Nothing is saved.",
  alternates: { canonical: "/for-business/sample-contract" },
};

const policy = (key: (typeof POLICY_FIELDS)[number]["key"]) => POLICY_FIELDS.find((p) => p.key === key)!.placeholder;

/** Sample values for the template's {{placeholders}} (the same names as contract_vars() in the database). */
function sampleVars(): Record<string, string> {
  const at9 = (days: number) => formatDateTime(manilaToISO(todayManila(days), "09:00"));
  return {
    agreement_date: formatDate(new Date()), booking_reference: "13C-SAMPLE", platform_name: "13C",
    provider_name: "Your Car Rental", provider_registration: "DTI No. 0000000", provider_address: "Your address, Cebu City, Cebu",
    provider_city: "Cebu City", provider_phone: "+63 900 000 0000", provider_email: "hello@example.com", provider_representative: "Maria Santos, Owner",
    renter_name: "Juan Dela Cruz", renter_address: "Lahug, Cebu City", renter_phone: "+63 900 000 0001", renter_email: "juan@example.com",
    renter_license: `N01-00-000000 (valid until ${formatDate(manilaToISO(todayManila(3 * 365)))})`,
    vehicle_name: "2026 Toyota Vios 1.3 XLE", vehicle_plate: "ABC 1234", vehicle_color: "White", vehicle_transmission: "Automatic",
    vehicle_fuel: "Gasoline", vehicle_seats: "5", service_type: "Self-drive",
    pickup_at: at9(7), return_at: at9(9),
    pickup_location: "Mactan-Cebu International Airport", return_location: "Mactan-Cebu International Airport",
    rental_days: "2", drivers_count: "1", daily_rate: formatPHP(1500, true), base_amount: formatPHP(3000, true),
    delivery_fee: formatPHP(0, true), driver_fee: formatPHP(0, true), other_fees: formatPHP(0, true), discount: formatPHP(0, true),
    total_amount: formatPHP(3000, true), security_deposit: formatPHP(3000, true), payment_method: "GCash", payment_status: "Unpaid",
    mileage_policy: "Unlimited mileage is included.", fuel_policy: policy("fuel"), late_return_policy: policy("late_return"),
    cancellation_policy: policy("cancellation"), deposit_policy: policy("deposit"), requirements_policy: policy("requirements"),
    prohibited_use_extra: policy("prohibited"), other_terms: "None.",
  };
}

/** Like render_template() in the database: fill {{placeholders}}, anything unknown becomes "—". */
const render = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => vars[key] ?? "—");

export default async function SampleContractPage() {
  // The live template, so the sample reads exactly like a real 13C agreement (no real booking or customer data).
  const { data: template } = await createAdminClient().from("contract_templates").select("name, sections").eq("is_active", true).maybeSingle();
  const vars = sampleVars();
  const sections = ((template?.sections ?? []) as ContractSection[]).map((s) => ({ key: s.key, title: s.title, body: render(s.body, vars) }));
  const contentHash = createHash("sha256").update(JSON.stringify(sections)).digest("hex");
  return <SampleContractDemo title={template?.name ?? "Vehicle Rental Agreement"} sections={sections} contentHash={contentHash} />;
}
