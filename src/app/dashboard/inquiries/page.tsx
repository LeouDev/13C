import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Pill } from "@/components/common/badges";
import { EmptyState, PageHeader } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { businessConversations } from "@/lib/conversations";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Inquiries" };

export default async function InquiriesPage() {
  const { business } = await requireBusiness();
  const items = await businessConversations(business.id, "inquiries");
  return (
    <>
      <PageHeader eyebrow="Communication" title="Inquiries" description="Customers who asked about your cars but haven't booked yet. Reply fast — or turn the chat into a booking proposal." />
      {items.length === 0 ? <EmptyState icon={Inbox} title="No open inquiries" /> : (
        <ul className="grid gap-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/messages/${c.id}`} className="flex items-center gap-4 rounded-2xl border bg-white p-4 hover:border-electric/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-navy-900">{c.title}</p>
                    <Pill tone={c.stage === "INQUIRY" ? "warning" : "info"}>{c.stage === "INQUIRY" ? "New inquiry" : "Negotiating"}</Pill>
                    {c.unread && <span className="size-2 rounded-full bg-brand-red" aria-label="Unread" />}
                  </div>
                  {c.subtitle && <p className="text-xs text-electric">{c.subtitle}</p>}
                  <p className="truncate text-sm text-muted-foreground">{c.preview}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
