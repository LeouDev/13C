"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { saveCategory } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type Category = { slug: string; label: string; sort_order: number; is_active: boolean };

function useSave(onSaved?: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (c: { slug: string; label: string; sort_order: string; is_active: boolean }) => start(async () => {
    const r = await saveCategory({ ...c, slug: c.slug.trim(), label: c.label.trim() });
    if (r.ok) { toast.success(r.message); onSaved?.(); router.refresh(); } else toast.error(r.error);
  });
  return { pending, save };
}

const ROW = "grid grid-cols-[1fr_80px] items-center gap-2 sm:grid-cols-[130px_1fr_90px_110px_auto]";

function CategoryRow({ category }: { category: Category }) {
  const [label, setLabel] = useState(category.label);
  const [order, setOrder] = useState(String(category.sort_order));
  const [active, setActive] = useState(category.is_active);
  const { pending, save } = useSave();
  const dirty = label !== category.label || order !== String(category.sort_order) || active !== category.is_active;
  return (
    <form className={ROW} onSubmit={(e) => { e.preventDefault(); save({ slug: category.slug, label, sort_order: order, is_active: active }); }}>
      <code className="col-span-2 truncate text-xs text-muted-foreground sm:col-span-1">{category.slug}</code>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} aria-label={`Label for ${category.slug}`} maxLength={40} className="h-9" />
      <Input type="number" min={0} max={999} value={order} onChange={(e) => setOrder(e.target.value)} aria-label={`Sort order for ${category.slug}`} className="h-9" />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} aria-label={`${category.slug} active`} /> {active ? "Active" : "Hidden"}
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending || !dirty}>{pending && <Loader2 className="animate-spin" />} Save</Button>
    </form>
  );
}

function NewCategory({ nextOrder, existing }: { nextOrder: number; existing: string[] }) {
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [order, setOrder] = useState(String(nextOrder));
  const [active, setActive] = useState(true);
  const { pending, save } = useSave(() => { setSlug(""); setLabel(""); setOrder(String(nextOrder + 1)); setActive(true); });
  return (
    <form className={`${ROW} rounded-xl bg-canvas p-3`} onSubmit={(e) => {
      e.preventDefault();
      if (existing.includes(slug.trim())) { toast.error(`“${slug.trim()}” already exists. Edit it above instead.`); return; }
      save({ slug, label, sort_order: order, is_active: active });
    }}>
      <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="slug" aria-label="New category slug"
        pattern="[a-z0-9-]{2,30}" title="2–30 lowercase letters, numbers or dashes" required className="col-span-2 h-9 font-mono text-xs sm:col-span-1" />
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" aria-label="New category label" required minLength={2} maxLength={40} className="h-9" />
      <Input type="number" min={0} max={999} value={order} onChange={(e) => setOrder(e.target.value)} aria-label="New category sort order" className="h-9" />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} aria-label="New category active" /> {active ? "Active" : "Hidden"}
      </label>
      <Button type="submit" size="sm" variant="electric" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Add</Button>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const nextOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1;
  return (
    <div className="grid gap-2">
      <div className={`${ROW} hidden text-xs font-medium text-muted-foreground sm:grid`} aria-hidden>
        <span>Slug</span><span>Label</span><span>Order</span><span>Visibility</span><span />
      </div>
      {categories.map((c) => <CategoryRow key={c.slug} category={c} />)}
      <NewCategory nextOrder={nextOrder} existing={categories.map((c) => c.slug)} />
    </div>
  );
}
