import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { CategoryManager } from "@/components/admin/category-manager";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { TemplateEditor, type TemplateSection } from "@/components/admin/template-editor";
import { Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export const metadata: Metadata = { title: "Settings" };

const isSection = (s: Json): s is TemplateSection =>
  !!s && typeof s === "object" && !Array.isArray(s) && typeof s.key === "string" && typeof s.title === "string" && typeof s.body === "string";

const parseSections = (json: Json | undefined): TemplateSection[] =>
  Array.isArray(json) ? json.filter(isSection).map(({ key, title, body }) => ({ key, title, body })) : [];

const NAV = [["contract-template", "Contract template"], ["categories", "Vehicle categories"], ["platform", "Platform settings"]] as const;

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const [{ data: template }, { data: history }, { data: categories }, { data: settings }] = await Promise.all([
    supabase.from("contract_templates").select("id, name, version, sections, created_at").eq("is_active", true)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("contract_templates").select("id, name, version, is_active, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("vehicle_categories").select("slug, label, sort_order, is_active").order("sort_order"),
    supabase.from("platform_settings").select("key, value, updated_at").order("key"),
  ]);
  const card = "scroll-mt-6 rounded-2xl border bg-white p-4 sm:p-5";

  return (
    <>
      <PageHeader title="Settings" description="Contract template, vehicle categories and platform configuration." />
      <nav aria-label="Settings sections" className="mb-5 flex flex-wrap gap-2">
        {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium hover:bg-white/70">{label}</a>)}
      </nav>
      <div className="grid grid-cols-1 gap-6">
        <section id="contract-template" className={card} aria-labelledby="contract-template-heading">
          <h2 id="contract-template-heading" className="font-semibold">Contract template</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The rental agreement generated for every booking. Publishing creates a new active version; drafts already generated and signed contracts keep the text they were created with.
          </p>
          <div className="mt-4 mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="note">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>Legal review required.</strong> Contract templates must be reviewed by qualified Philippine legal counsel before they are published.
              13C provides this template as a tool for rental businesses; it is not legal advice.
            </p>
          </div>
          <TemplateEditor key={template?.id ?? "none"} name={template?.name ?? "Standard Vehicle Rental Agreement"} version={template?.version ?? null}
            sections={parseSections(template?.sections)} />
          {!!history?.length && (
            <details className="mt-6 rounded-xl bg-canvas p-3 text-sm">
              <summary className="cursor-pointer font-medium">Version history</summary>
              <ul className="mt-2 grid gap-1.5">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{h.name} · v{h.version} {h.is_active && <Pill tone="success" className="ml-1">Active</Pill>}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section id="categories" className={card} aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="font-semibold">Vehicle categories</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Shown in listing forms and marketplace filters, in sort order. Categories can&apos;t be deleted once vehicles use them — hide them instead.
          </p>
          <CategoryManager categories={categories ?? []} />
        </section>

        <section id="platform" className={card} aria-labelledby="platform-heading">
          <h2 id="platform-heading" className="font-semibold">Platform settings</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">Values are JSON: strings need quotes (<code>&quot;support@13c.ph&quot;</code>), lists use brackets.</p>
          {!settings?.length ? <EmptyState title="No platform settings" description="Settings are seeded by database migrations." /> : (
            <SettingsEditor settings={settings.map((s) => ({ key: s.key, value: s.value, updatedAt: s.updated_at, updatedLabel: formatDateTime(s.updated_at) }))} />
          )}
        </section>
      </div>
    </>
  );
}
