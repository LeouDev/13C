"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveVehicle } from "@/app/actions/vehicles";
import { Field, NativeSelect } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CITY_OPTIONS, FUEL_TYPES, TRANSMISSIONS, VEHICLE_STATUSES } from "@/lib/constants";
import type { Tables } from "@/types/database";

type Vehicle = Tables<"vehicles"> & { vehicle_pricing: Tables<"vehicle_pricing"> | null };
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export function VehicleForm({
  businessId, businessCity, categories, vehicle,
}: {
  businessId: string;
  businessCity: string;
  categories: { slug: string; label: string }[];
  vehicle?: Vehicle;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const p = vehicle?.vehicle_pricing;
  const [v, setV] = useState({
    make: vehicle?.make ?? "", model: vehicle?.model ?? "", variant: vehicle?.variant ?? "", year: str(vehicle?.year ?? new Date().getFullYear()),
    category_slug: vehicle?.category_slug ?? categories[0]?.slug ?? "sedan", transmission: vehicle?.transmission ?? "AUTOMATIC",
    fuel_type: vehicle?.fuel_type ?? "GASOLINE", seats: str(vehicle?.seats ?? 5), color: vehicle?.color ?? "", plate_number: vehicle?.plate_number ?? "",
    description: vehicle?.description ?? "", status: vehicle?.status ?? "ACTIVE", self_drive: vehicle?.self_drive ?? true,
    with_driver: vehicle?.with_driver ?? false, delivery_available: vehicle?.delivery_available ?? false,
    pickup_location: vehicle?.pickup_location ?? "", city: vehicle?.city ?? businessCity, min_rental_days: str(vehicle?.min_rental_days ?? 1),
  });
  const [price, setPrice] = useState({
    daily_rate: str(p?.daily_rate), weekly_rate: str(p?.weekly_rate), monthly_rate: str(p?.monthly_rate), security_deposit: str(p?.security_deposit),
    mileage_limit_km: str(p?.mileage_limit_km), excess_km_fee: str(p?.excess_km_fee), delivery_fee: str(p?.delivery_fee), driver_fee_per_day: str(p?.driver_fee_per_day),
  });
  const txt = (k: keyof typeof v) => ({
    value: v[k] as string, "aria-invalid": !!errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value })),
  });
  const money = (k: keyof typeof price) => ({
    type: "number", inputMode: "decimal" as const, min: 0, step: "1", value: price[k], "aria-invalid": !!errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPrice((x) => ({ ...x, [k]: e.target.value })),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveVehicle(businessId, vehicle?.id ?? null, { ...v, transmission: v.transmission as "AUTOMATIC", fuel_type: v.fuel_type as "GASOLINE", status: v.status as "ACTIVE" }, price);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
      setErrors({});
      toast.success(r.message);
      if (!vehicle && r.data) router.push(`/dashboard/vehicles/${r.data.id}?tab=photos&new=1`);
      else router.refresh();
    });
  }

  const section = "grid gap-4 rounded-3xl border bg-white p-5 sm:grid-cols-2 sm:p-6";
  const heading = "font-semibold text-navy-900 sm:col-span-2";

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <section className={section}>
        <h2 className={heading}>Vehicle</h2>
        <Field label="Make" htmlFor="make" error={errors.make} required><Input id="make" placeholder="Toyota" {...txt("make")} /></Field>
        <Field label="Model" htmlFor="model" error={errors.model} required><Input id="model" placeholder="Vios" {...txt("model")} /></Field>
        <Field label="Variant" htmlFor="variant" error={errors.variant}><Input id="variant" placeholder="1.3 XLE CVT" {...txt("variant")} /></Field>
        <Field label="Year" htmlFor="year" error={errors.year} required><Input id="year" type="number" inputMode="numeric" min={1980} max={new Date().getFullYear() + 1} {...txt("year")} /></Field>
        <Field label="Type" htmlFor="category" error={errors.category_slug} required>
          <NativeSelect id="category" {...txt("category_slug")}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</NativeSelect>
        </Field>
        <Field label="Seats" htmlFor="seats" error={errors.seats} required><Input id="seats" type="number" inputMode="numeric" min={1} max={30} {...txt("seats")} /></Field>
        <Field label="Transmission" htmlFor="transmission" required>
          <NativeSelect id="transmission" {...txt("transmission")}>{TRANSMISSIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</NativeSelect>
        </Field>
        <Field label="Fuel" htmlFor="fuel" required>
          <NativeSelect id="fuel" {...txt("fuel_type")}>{FUEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</NativeSelect>
        </Field>
        <Field label="Color" htmlFor="color" error={errors.color}><Input id="color" placeholder="Pearl white" {...txt("color")} /></Field>
        <Field label="Plate number" htmlFor="plate" error={errors.plate_number} hint="Shown only in rental agreements."><Input id="plate" placeholder="ABC 1234" {...txt("plate_number")} /></Field>
        <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2">
          <Textarea id="description" rows={5} maxLength={5000} placeholder="Fuel-efficient, Bluetooth audio, dashcam, child seat available on request…" {...txt("description")} />
        </Field>
      </section>

      <section className={section}>
        <h2 className={heading}>Service & pickup</h2>
        {([["self_drive", "Self-drive", "Renters drive themselves."], ["with_driver", "With driver", "You provide a driver."], ["delivery_available", "Delivery available", "You can deliver to the renter."]] as const).map(([k, label, hint]) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
            <Switch checked={v[k]} onCheckedChange={(c) => setV((x) => ({ ...x, [k]: c }))} />
          </label>
        ))}
        {errors.self_drive && <p className="text-xs text-destructive sm:col-span-2">{errors.self_drive}</p>}
        <Field label="City" htmlFor="city" error={errors.city} required>
          <NativeSelect id="city" {...txt("city")}>{CITY_OPTIONS.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
        </Field>
        <Field label="Pickup location" htmlFor="pickup_location" error={errors.pickup_location}><Input id="pickup_location" placeholder="Our garage in Banilad" {...txt("pickup_location")} /></Field>
        <Field label="Minimum rental (days)" htmlFor="min_days" error={errors.min_rental_days}><Input id="min_days" type="number" min={1} max={90} {...txt("min_rental_days")} /></Field>
        <Field label="Status" htmlFor="status">
          <NativeSelect id="status" {...txt("status")}>{VEHICLE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect>
        </Field>
      </section>

      <section className={section}>
        <h2 className={heading}>Pricing (₱)</h2>
        <Field label="Daily rate" htmlFor="daily" error={errors.daily_rate} required><Input id="daily" placeholder="1500" {...money("daily_rate")} /></Field>
        <Field label="Security deposit" htmlFor="deposit" error={errors.security_deposit}><Input id="deposit" placeholder="3000" {...money("security_deposit")} /></Field>
        <Field label="Weekly rate" htmlFor="weekly" error={errors.weekly_rate} hint="Applied automatically for 7+ day rentals."><Input id="weekly" placeholder="9000" {...money("weekly_rate")} /></Field>
        <Field label="Monthly rate" htmlFor="monthly" error={errors.monthly_rate} hint="Applied automatically for 30+ day rentals."><Input id="monthly" placeholder="32000" {...money("monthly_rate")} /></Field>
        <Field label="Mileage allowance (km/day)" htmlFor="mileage" error={errors.mileage_limit_km} hint="Leave empty for unlimited."><Input id="mileage" placeholder="Unlimited" {...money("mileage_limit_km")} /></Field>
        <Field label="Excess fee (₱/km)" htmlFor="excess" error={errors.excess_km_fee}><Input id="excess" placeholder="10" {...money("excess_km_fee")} /></Field>
        {v.delivery_available && <Field label="Delivery fee" htmlFor="delivery" error={errors.delivery_fee}><Input id="delivery" placeholder="300" {...money("delivery_fee")} /></Field>}
        {v.with_driver && <Field label="Driver fee (per day)" htmlFor="driver" error={errors.driver_fee_per_day}><Input id="driver" placeholder="1000" {...money("driver_fee_per_day")} /></Field>}
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button type="submit" size="xl" disabled={pending} className="shadow-lg">{pending && <Loader2 className="animate-spin" />} {vehicle ? "Save vehicle" : "Add vehicle"}</Button>
      </div>
    </form>
  );
}
