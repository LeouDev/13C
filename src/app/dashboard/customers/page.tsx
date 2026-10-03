import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { requireBusiness } from "@/lib/auth";
import { formatDate, formatPHP, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customers" };

type Customer = { id: string; name: string; phone: string | null; email: string | null; bookings: number; completed: number; spent: number; last: string; lastBookingId?: string; conversationId?: string };

export default async function CustomersPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const [{ data: bookings }, { data: convos }] = await Promise.all([
    supabase.from("bookings").select("id, status, total_amount, pickup_at, renter:profiles!bookings_renter_id_fkey(id, full_name, phone, email)").eq("business_id", business.id).order("pickup_at", { ascending: false }),
    supabase.from("conversations").select("id, last_message_at, customer:profiles!conversations_customer_id_fkey(id, full_name, phone, email)").eq("business_id", business.id),
  ]);
  const map = new Map<string, Customer>();
  for (const b of bookings ?? []) {
    if (!b.renter) continue;
    const c = map.get(b.renter.id) ?? { id: b.renter.id, name: b.renter.full_name, phone: b.renter.phone, email: b.renter.email, bookings: 0, completed: 0, spent: 0, last: b.pickup_at, lastBookingId: b.id };
    c.bookings++;
    if (b.status === "COMPLETED") { c.completed++; c.spent += Number(b.total_amount); }
    map.set(c.id, c);
  }
  for (const cv of convos ?? []) {
    if (!cv.customer) continue;
    const c = map.get(cv.customer.id) ?? { id: cv.customer.id, name: cv.customer.full_name, phone: cv.customer.phone, email: cv.customer.email, bookings: 0, completed: 0, spent: 0, last: cv.last_message_at };
    c.conversationId ??= cv.id;
    map.set(c.id, c);
  }
  const customers = [...map.values()].sort((a, b) => b.last.localeCompare(a.last));

  return (
    <>
      <PageHeader eyebrow="CRM" title="Customers" description="Everyone who has booked or messaged your business. Contact details are shared only because of those interactions." />
      {customers.length === 0 ? <EmptyState icon={Users} title="No customers yet" /> : (
        <ul className="grid gap-2">
          {customers.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4">
              <Avatar className="size-11"><AvatarFallback className="bg-navy-900 text-xs text-white">{initials(c.name)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-900">{c.name || "Customer"}</p>
                <p className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="text-sm"><span className="font-semibold">{c.bookings}</span> <span className="text-muted-foreground">bookings · {c.completed} completed</span></div>
              <div className="text-sm"><span className="font-semibold">{formatPHP(c.spent)}</span> <span className="text-muted-foreground">lifetime</span></div>
              <div className="text-xs text-muted-foreground">Last activity {formatDate(c.last)}</div>
              <div className="flex gap-2 text-xs font-semibold">
                {c.lastBookingId && <Link href={`/dashboard/bookings/${c.lastBookingId}`} className="text-electric hover:underline">Latest booking</Link>}
                {c.conversationId && <Link href={`/dashboard/messages/${c.conversationId}`} className="text-electric hover:underline">Message</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
