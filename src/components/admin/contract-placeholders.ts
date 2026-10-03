/**
 * Placeholders the contract renderer fills in. Keep in sync with the keys returned by
 * public.contract_vars() in supabase/migrations/20261003000003_rpc.sql — unknown {{keys}} render as "—".
 */
export const CONTRACT_PLACEHOLDERS: { group: string; keys: string[] }[] = [
  { group: "Agreement", keys: ["agreement_date", "booking_reference", "platform_name"] },
  {
    group: "Rental provider",
    keys: ["provider_name", "provider_registration", "provider_address", "provider_city", "provider_phone", "provider_email", "provider_representative"],
  },
  { group: "Renter", keys: ["renter_name", "renter_address", "renter_phone", "renter_email", "renter_license"] },
  {
    group: "Vehicle",
    keys: ["vehicle_name", "vehicle_plate", "vehicle_color", "vehicle_transmission", "vehicle_fuel", "vehicle_seats", "service_type"],
  },
  { group: "Rental period", keys: ["pickup_at", "return_at", "pickup_location", "return_location", "rental_days", "drivers_count"] },
  {
    group: "Fees & payment",
    keys: ["daily_rate", "base_amount", "delivery_fee", "driver_fee", "other_fees", "discount", "total_amount", "security_deposit", "payment_method", "payment_status"],
  },
  {
    group: "Policies (from the business's store settings, with defaults)",
    keys: ["mileage_policy", "fuel_policy", "late_return_policy", "cancellation_policy", "deposit_policy", "requirements_policy", "prohibited_use_extra", "other_terms"],
  },
];

export const KNOWN_PLACEHOLDERS = new Set(CONTRACT_PLACEHOLDERS.flatMap((g) => g.keys));

/** {{…}} tokens the renderer won't fill (unknown keys, or known keys written with spaces like {{ renter_name }}). */
export function unknownPlaceholders(text: string) {
  return [...text.matchAll(/\{\{([^}]*)\}\}/g)].map((m) => m[0]).filter((t) => !KNOWN_PLACEHOLDERS.has(t.slice(2, -2)));
}
