import type { Metadata } from "next";
import { SampleContractDemo } from "@/components/site/sample-contract-demo";
import { sampleAgreement } from "@/lib/contracts/sample";

export const metadata: Metadata = {
  title: "Try a sample rental agreement",
  description: "See how 13C rental agreements are signed: sign a sample as the rental business, then as the renter. Nothing is saved.",
  alternates: { canonical: "/for-business/sample-contract" },
};

export default async function SampleContractPage() {
  // The live template, so the sample reads exactly like a real 13C agreement (no real booking or customer data).
  return <SampleContractDemo {...await sampleAgreement()} />;
}
