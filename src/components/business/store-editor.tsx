"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { setBusinessLogo, setStoreCover, updateStorefront } from "@/app/actions/business";
import { AiFaqButton, AiWriteButton } from "@/components/business/ai-write";
import { Field } from "@/components/common/field";
import { TagInput } from "@/components/common/tag-input";
import { ImageUpload } from "@/components/common/uploads";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACCENT_PRESETS, CITY_OPTIONS, DAYS, LOCATIONS, POLICY_FIELDS, STORE_SECTIONS } from "@/lib/constants";
import type { StorefrontInput } from "@/lib/validation";
import type { Tables } from "@/types/database";

type Hours = { day: string; open: string; close: string; closed: boolean };
const AREA_SUGGESTIONS = ["Mactan-Cebu Int'l Airport", ...LOCATIONS.map((l) => l.name), "SM Seaside", "IT Park"];

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-3xl border bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

export function StoreEditor({
  business, store, vehicles, onSaved,
}: {
  business: Tables<"businesses">;
  store: Tables<"business_storefronts">;
  vehicles: { id: string; make: string; model: string; year: number }[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState(business.logo_path);
  const [cover, setCover] = useState(store.cover_path);
  const hours0 = (store.business_hours as Hours[]).length ? (store.business_hours as Hours[]) : DAYS.map((d) => ({ day: d, open: "08:00", close: "20:00", closed: false }));
  const [v, setV] = useState<StorefrontInput>({
    tagline: store.tagline ?? "",
    about: store.about ?? "",
    accent_color: store.accent_color,
    pickup_locations: store.pickup_locations,
    delivery_areas: store.delivery_areas,
    featured_vehicle_ids: store.featured_vehicle_ids,
    hidden_sections: store.hidden_sections,
    faqs: (store.faqs as { q: string; a: string }[]) ?? [],
    policies: (store.policies as Record<string, string>) ?? {},
    social_links: { facebook: "", instagram: "", tiktok: "", website: "", messenger: "", ...(store.social_links as Record<string, string>) },
    business_hours: hours0,
  });
  const set = <K extends keyof StorefrontInput>(k: K, val: StorefrontInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const setPolicy = (key: string, text: string) => setV((x) => ({ ...x, policies: { ...x.policies, [key]: text } }));

  function save() {
    start(async () => {
      const r = await updateStorefront(business.id, v);
      if (r.ok) { setErrors({}); toast.success(r.message); router.refresh(); onSaved?.(); }
      else { setErrors(r.fieldErrors ?? {}); toast.error(r.error); }
    });
  }

  return (
    <div className="grid gap-5">
      <Section id="brand" title="Brand" description="Logo, cover and accent color. Your layout stays 13C-quality on every device.">
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <Field label="Logo">
            <ImageUpload prefix={`b/${business.id}`} value={logo} maxPx={600} png label="Upload logo" onChange={async (p) => {
              const r = await setBusinessLogo(business.id, p);
              if (r.ok) { setLogo(p); router.refresh(); onSaved?.(); } else toast.error(r.error);
            }} />
          </Field>
          <Field label="Cover image">
            <ImageUpload prefix={`b/${business.id}`} value={cover} aspect="aspect-[16/7]" maxPx={2400} label="Upload cover" onChange={async (p) => {
              const r = await setStoreCover(business.id, p);
              if (r.ok) { setCover(p); router.refresh(); onSaved?.(); } else toast.error(r.error);
            }} />
          </Field>
        </div>
        <Field label="Accent color" error={errors.accent_color} hint="Used for buttons and highlights on your store.">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((c) => (
              <button key={c} type="button" onClick={() => set("accent_color", c)} aria-label={`Accent ${c}`}
                className={cn("size-9 rounded-full ring-offset-2 transition", v.accent_color.toLowerCase() === c.toLowerCase() && "ring-2 ring-navy-900")} style={{ background: c }} />
            ))}
            <label className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
              Custom <input type="color" value={v.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="size-6 cursor-pointer rounded-full border-0 bg-transparent" />
            </label>
          </div>
        </Field>
        <Field label="Tagline" htmlFor="tagline" error={errors.tagline}
          labelAside={<AiWriteButton businessId={business.id} field="tagline" value={v.tagline ?? ""} onChange={(t) => set("tagline", t)} />}>
          <Input id="tagline" value={v.tagline ?? ""} maxLength={140} onChange={(e) => set("tagline", e.target.value)} placeholder="Self-drive vehicles across Cebu." />
        </Field>
        <Field label="About your business" htmlFor="about" error={errors.about} hint="Tell your story: how long you've been renting, what makes you different. Rough notes are fine; AI can polish them."
          labelAside={<AiWriteButton businessId={business.id} field="about" value={v.about ?? ""} onChange={(t) => set("about", t)} />}>
          <Textarea id="about" value={v.about ?? ""} rows={6} maxLength={5000} onChange={(e) => set("about", e.target.value)} />
        </Field>
      </Section>

      <Section title="Fleet & sections" description="Choose up to 6 featured vehicles and which sections appear on your store.">
        {vehicles.length === 0 ? <p className="text-sm text-muted-foreground">Add vehicles to feature them.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {vehicles.map((x) => {
              const on = v.featured_vehicle_ids.includes(x.id);
              return (
                <label key={x.id} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm", on && "border-electric/40 bg-electric/5")}>
                  <Checkbox checked={on} onCheckedChange={(c) => set("featured_vehicle_ids", c ? [...v.featured_vehicle_ids, x.id].slice(0, 6) : v.featured_vehicle_ids.filter((i) => i !== x.id))} />
                  {x.year} {x.make} {x.model}
                </label>
              );
            })}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {STORE_SECTIONS.map((s) => (
            <label key={s.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm">
              {s.label}
              <Switch checked={!v.hidden_sections.includes(s.id)} onCheckedChange={(c) => set("hidden_sections", c ? v.hidden_sections.filter((h) => h !== s.id) : [...v.hidden_sections, s.id])} />
            </label>
          ))}
        </div>
      </Section>

      <Section id="locations" title="Pickup & delivery">
        <Field label="Pickup locations" hint="Press Enter to add.">
          <TagInput value={v.pickup_locations} onChange={(x) => set("pickup_locations", x)} placeholder="e.g. Our garage, A.S. Fortuna St." suggestions={[business.city]} />
        </Field>
        <Field label="Delivery areas" hint="Customers searching these areas will also see your delivery-enabled cars.">
          <TagInput value={v.delivery_areas} onChange={(x) => set("delivery_areas", x)} placeholder="Add an area" suggestions={[...new Set([...AREA_SUGGESTIONS, ...CITY_OPTIONS.slice(0, 5)])]} />
        </Field>
      </Section>

      <Section id="policies" title="Rental policies" description="Shown on your store and inserted automatically into every rental agreement.">
        <div className="grid gap-4 sm:grid-cols-2">
          {POLICY_FIELDS.map((p) => (
            <Field key={p.key} label={p.label} htmlFor={`policy-${p.key}`} error={errors[`policies.${p.key}`]}
              labelAside={<AiWriteButton businessId={business.id} field={p.key} value={v.policies[p.key] ?? ""} onChange={(t) => setPolicy(p.key, t)} />}>
              <Textarea id={`policy-${p.key}`} rows={3} maxLength={1500} placeholder={p.placeholder} value={v.policies[p.key] ?? ""}
                onChange={(e) => setPolicy(p.key, e.target.value)} />
            </Field>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Frequently asked questions">
        {v.faqs.map((f, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border p-3">
            <div className="flex gap-2">
              <Input value={f.q} placeholder="Question" aria-label={`Question ${i + 1}`} onChange={(e) => set("faqs", v.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon-lg" onClick={() => set("faqs", v.faqs.filter((_, j) => j !== i))} aria-label="Remove question"><Trash2 /></Button>
            </div>
            <Textarea value={f.a} placeholder="Answer" aria-label={`Answer ${i + 1}`} onChange={(e) => set("faqs", v.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
          </div>
        ))}
        {errors.faqs && <p className="text-xs text-destructive">Each FAQ needs a question (3+ characters) and an answer.</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => set("faqs", [...v.faqs, { q: "", a: "" }])}><Plus /> Add question</Button>
          {v.faqs.length < 20 && <AiFaqButton businessId={business.id} faqs={v.faqs} onChange={(update) => setV((x) => ({ ...x, faqs: update(x.faqs) }))} />}
        </div>
      </Section>

      <Section id="hours" title="Business hours & contact">
        <div className="grid gap-2">
          {(v.business_hours as Hours[]).map((h, i) => (
            <div key={h.day} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-10 font-medium">{h.day}</span>
              <input type="time" value={h.open} disabled={h.closed} aria-label={`${h.day} opens`} className="h-9 rounded-lg border px-2 disabled:opacity-40"
                onChange={(e) => set("business_hours", (v.business_hours as Hours[]).map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
              <span>–</span>
              <input type="time" value={h.close} disabled={h.closed} aria-label={`${h.day} closes`} className="h-9 rounded-lg border px-2 disabled:opacity-40"
                onChange={(e) => set("business_hours", (v.business_hours as Hours[]).map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
              <label className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={h.closed} onCheckedChange={(c) => set("business_hours", (v.business_hours as Hours[]).map((x, j) => (j === i ? { ...x, closed: !!c } : x)))} /> Closed
              </label>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["facebook", "instagram", "tiktok", "messenger", "website"] as const).map((k) => (
            <Field key={k} label={k[0]!.toUpperCase() + k.slice(1)} htmlFor={`social-${k}`} error={errors[`social_links.${k}`]}>
              <Input id={`social-${k}`} value={v.social_links[k] ?? ""} placeholder={k === "website" ? "yourwebsite.ph" : `${k === "messenger" ? "m.me" : `${k}.com`}/yourpage`}
                onChange={(e) => set("social_links", { ...v.social_links, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Button size="xl" onClick={save} disabled={pending} className="shadow-lg">{pending && <Loader2 className="animate-spin" />} Save store</Button>
      </div>
    </div>
  );
}
