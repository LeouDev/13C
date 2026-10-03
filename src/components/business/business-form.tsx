"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { checkSlug } from "@/app/actions/business";
import { Field, NativeSelect, PhoneInput } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CITY_OPTIONS, ROOT_DOMAIN } from "@/lib/constants";
import type { ActionResult } from "@/lib/actions";
import type { BusinessInput } from "@/lib/validation";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

export function BusinessForm({
  initial, submitLabel, onSubmit, lockSlug,
}: {
  initial?: Partial<BusinessInput>;
  submitLabel: string;
  onSubmit: (data: BusinessInput) => Promise<ActionResult<unknown>>;
  lockSlug?: boolean;
}) {
  const [values, setValues] = useState<BusinessInput>({
    name: "", slug: "", city: "Cebu City", province: "Cebu", address: "", phone: "", email: "", description: "",
    representative_name: "", representative_title: "", registration_type: "DTI", registration_number: "",
    ...Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, v ?? ""])),
  } as BusinessInput);
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [slugFree, setSlugFree] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof BusinessInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const skipCheck = !!lockSlug || !values.slug || values.slug === initial?.slug;
  useEffect(() => {
    if (skipCheck) return;
    const t = setTimeout(() => checkSlug(values.slug).then(setSlugFree), 350);
    return () => clearTimeout(t);
  }, [values.slug, skipCheck]);
  const slugStatus = skipCheck ? null : slugFree;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await onSubmit(values);
      setErrors(!res.ok ? res.fieldErrors ?? {} : {});
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" htmlFor="name" error={errors.name} required className="sm:col-span-2">
          <Input id="name" value={values.name} onChange={(e) => {
            const name = e.target.value;
            setValues((v) => ({ ...v, name, slug: slugTouched || lockSlug ? v.slug : slugify(name) }));
          }} placeholder="Cebu XYZ Car Rental" required />
        </Field>
        <Field label="Store link" htmlFor="slug" error={errors.slug} required className="sm:col-span-2"
          hint={slugStatus === false ? <span className="text-destructive">That link is taken.</span> : "Customers will find your store here. Choose carefully — changing it later breaks shared links."}>
          <div className="flex items-center overflow-hidden rounded-xl border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <span className="shrink-0 border-r bg-canvas px-3 py-2.5 text-sm text-muted-foreground">{ROOT_DOMAIN}/</span>
            <input id="slug" value={values.slug} disabled={lockSlug} onChange={(e) => { setSlugTouched(true); setSlugFree(null); setValues((v) => ({ ...v, slug: slugify(e.target.value) })); }}
              className="h-10 min-w-0 flex-1 px-3 text-base outline-none disabled:opacity-60 md:text-sm" placeholder="cebu-xyz-rental" />
            {slugStatus === true && <Check className="mr-3 size-4 text-emerald-600" aria-label="Available" />}
            {slugStatus === false && <X className="mr-3 size-4 text-destructive" aria-label="Taken" />}
          </div>
        </Field>
        <Field label="City" htmlFor="city" error={errors.city} required>
          <NativeSelect id="city" value={values.city} onChange={set("city")}>
            {CITY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Province" htmlFor="province" error={errors.province}>
          <Input id="province" value={values.province} onChange={set("province")} />
        </Field>
        <Field label="Business address" htmlFor="address" error={errors.address} required className="sm:col-span-2">
          <Input id="address" value={values.address} onChange={set("address")} placeholder="Street, barangay" autoComplete="street-address" />
        </Field>
        <Field label="Contact number" htmlFor="phone" error={errors.phone} required>
          <PhoneInput id="phone" value={values.phone} onChange={set("phone")} autoComplete="tel-national" />
        </Field>
        <Field label="Business email" htmlFor="email" error={errors.email} required>
          <Input id="email" type="email" value={values.email} onChange={set("email")} placeholder="hello@yourbusiness.ph" />
        </Field>
        <Field label="Short description" htmlFor="description" error={errors.description} className="sm:col-span-2" hint="Shown on marketplace cards. Max 600 characters.">
          <Textarea id="description" value={values.description ?? ""} onChange={set("description")} maxLength={600} rows={3} placeholder="Self-drive cars in Cebu City & Mactan with free airport delivery." />
        </Field>
      </div>

      <fieldset className="grid gap-5 rounded-2xl border p-4 sm:grid-cols-2 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-navy-900">Legal details (for verification & contracts)</legend>
        <Field label="Authorized representative" htmlFor="representative_name" error={errors.representative_name} required>
          <Input id="representative_name" value={values.representative_name} onChange={set("representative_name")} placeholder="Full name" />
        </Field>
        <Field label="Position" htmlFor="representative_title" error={errors.representative_title}>
          <Input id="representative_title" value={values.representative_title ?? ""} onChange={set("representative_title")} placeholder="Owner / Manager" />
        </Field>
        <Field label="Registration type" htmlFor="registration_type" error={errors.registration_type}>
          <NativeSelect id="registration_type" value={values.registration_type ?? ""} onChange={set("registration_type")}>
            <option value="DTI">DTI (sole proprietorship)</option>
            <option value="SEC">SEC (corporation / partnership)</option>
            <option value="CDA">CDA (cooperative)</option>
            <option value="MAYORS_PERMIT">Mayor&apos;s / business permit</option>
            <option value="OTHER">Other</option>
          </NativeSelect>
        </Field>
        <Field label="Registration number" htmlFor="registration_number" error={errors.registration_number}>
          <Input id="registration_number" value={values.registration_number ?? ""} onChange={set("registration_number")} />
        </Field>
      </fieldset>

      <Button type="submit" size="xl" disabled={pending || slugStatus === false} className="w-full sm:w-auto sm:justify-self-end">
        {pending && <Loader2 className="animate-spin" />} {submitLabel}
      </Button>
    </form>
  );
}
