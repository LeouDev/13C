"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveRenterDetails } from "@/app/actions/account";
import { Field, PhoneInput } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RenterInput } from "@/lib/validation";

export function useRenterForm(initial: RenterInput) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function save(silent = false) {
    const r = await saveRenterDetails(values);
    setErrors(r.ok ? {} : r.fieldErrors ?? {});
    if (!r.ok) toast.error(r.error); else if (!silent) toast.success(r.message);
    return r.ok;
  }
  return { values, setValues, errors, save };
}

export function RenterFields({ form }: { form: ReturnType<typeof useRenterForm> }) {
  const { values, setValues, errors } = form;
  const bind = (k: keyof RenterInput) => ({
    id: `r-${k}`, value: (values[k] as string) ?? "", "aria-invalid": !!errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value })),
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor="r-full_name" error={errors.full_name} required><Input autoComplete="name" {...bind("full_name")} /></Field>
      <Field label="Mobile number" htmlFor="r-phone" error={errors.phone} required><PhoneInput {...bind("phone")} /></Field>
      <Field label="Name on driver's license" htmlFor="r-legal_name" error={errors.legal_name} hint="If different from your full name."><Input {...bind("legal_name")} /></Field>
      <Field label="Date of birth" htmlFor="r-date_of_birth" error={errors.date_of_birth}><Input type="date" {...bind("date_of_birth")} /></Field>
      <Field label="Home address" htmlFor="r-address" error={errors.address} required className="sm:col-span-2"><Input autoComplete="street-address" {...bind("address")} /></Field>
      <Field label="City" htmlFor="r-city" error={errors.city}><Input autoComplete="address-level2" {...bind("city")} /></Field>
      <Field label="Driver's license no." htmlFor="r-license_number" error={errors.license_number} required><Input placeholder="N01-23-456789" {...bind("license_number")} /></Field>
      <Field label="License expiry" htmlFor="r-license_expiry" error={errors.license_expiry}><Input type="date" {...bind("license_expiry")} /></Field>
    </div>
  );
}

export function RenterForm({ initial }: { initial: RenterInput }) {
  const form = useRenterForm(initial);
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); start(async () => { await form.save(); }); }}>
      <RenterFields form={form} />
      <p className="text-xs text-muted-foreground">Shared only with rental businesses you book with, to prepare your rental agreement.</p>
      <Button type="submit" size="lg" disabled={pending} className="justify-self-start">{pending && <Loader2 className="animate-spin" />} Save details</Button>
    </form>
  );
}
