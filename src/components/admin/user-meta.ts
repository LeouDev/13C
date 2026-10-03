import type { Enums } from "@/types/database";

/** admin_anonymize_user() replaces the name with "Deleted user" and clears the email. */
export const isAnonymized = (p: { full_name: string; email: string | null }) => p.full_name === "Deleted user" && !p.email;

export const KYC_TONE: Record<Enums<"kyc_status">, "neutral" | "warning" | "success" | "danger"> = {
  UNVERIFIED: "neutral", PENDING: "warning", VERIFIED: "success", REJECTED: "danger",
};
