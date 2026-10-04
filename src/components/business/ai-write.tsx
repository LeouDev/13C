"use client";

import { useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { suggestStoreFaqs, writeStoreText } from "@/app/actions/business";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/format";
import type { Faq, StoreTextField } from "@/lib/store-writer";

// "Write with AI" for the store editor. Drafts go into the form unsaved, and Undo brings back what was there.

export function AiWriteButton({ businessId, field, value, onChange }: {
  businessId: string;
  field: StoreTextField;
  value: string;
  onChange: (text: string) => void;
}) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="xs" disabled={pending} className="shrink-0 text-electric hover:text-electric"
      onClick={() => start(async () => {
        const r = await writeStoreText(businessId, field, value);
        if (!r.ok) return void toast.error(r.error);
        onChange(r.data!);
        toast.success(r.data!.includes("___") ? "Draft ready. Fill in the blanks (___), then save." : "Draft ready. Check it, then save.", {
          action: { label: "Undo", onClick: () => onChange(value) },
        });
      })}>
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {value.trim() ? "Improve with AI" : "Write with AI"}
    </Button>
  );
}

export function AiFaqButton({ businessId, faqs, onChange }: {
  businessId: string;
  faqs: Faq[];
  onChange: (update: (faqs: Faq[]) => Faq[]) => void;
}) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" disabled={pending}
      onClick={() => start(async () => {
        const r = await suggestStoreFaqs(businessId, faqs.map((f) => f.q));
        if (!r.ok) return void toast.error(r.error);
        const added = r.data!.slice(0, 20 - faqs.length);
        onChange((list) => [...list, ...added]);
        toast.success(`Added ${plural(added.length, "question")}. Check the answers, then save.`, {
          action: { label: "Undo", onClick: () => onChange((list) => list.filter((f) => !added.includes(f))) },
        });
      })}>
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest questions with AI
    </Button>
  );
}
