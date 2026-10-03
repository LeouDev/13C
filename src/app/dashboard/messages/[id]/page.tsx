import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatThread } from "@/components/chat/chat-thread";
import { ProposeBooking } from "@/components/chat/propose-booking";
import { BookingStatusBadge } from "@/components/common/badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { requireBusiness } from "@/lib/auth";
import { initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversation" };

export default async function BusinessConversationPage({ params }: PageProps<"/dashboard/messages/[id]">) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const [{ data: c }, { data: messages }, { data: vehicles }] = await Promise.all([
    supabase.from("conversations").select("id, vehicle_id, customer_last_read_at, customer:profiles!conversations_customer_id_fkey(full_name, phone), vehicles(make, model), bookings(id, reference, status)")
      .eq("id", id).eq("business_id", business.id).maybeSingle(),
    supabase.from("messages").select("id, body, sender_role, created_at, booking_id").eq("conversation_id", id).order("created_at").limit(500),
    supabase.from("vehicles").select("id, make, model, year").eq("business_id", business.id).eq("status", "ACTIVE").is("deleted_at", null),
  ]);
  if (!c) notFound();
  return (
    <div className="-mx-4 -my-6 flex h-[calc(100svh-3.5rem)] flex-col sm:mx-0 sm:my-0 sm:h-[calc(100svh-8rem)] sm:overflow-hidden sm:rounded-3xl sm:border">
      <header className="flex flex-wrap items-center gap-3 border-b bg-white px-3 py-3 sm:px-5">
        <Link href="/dashboard/messages" className="grid size-9 place-items-center rounded-full hover:bg-canvas" aria-label="Back to messages"><ArrowLeft className="size-4" /></Link>
        <Avatar className="size-10"><AvatarFallback className="bg-navy-900 text-xs text-white">{initials(c.customer?.full_name)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-navy-900">{c.customer?.full_name || "Customer"}</p>
          <p className="truncate text-xs text-muted-foreground">{c.vehicles ? `About: ${c.vehicles.make} ${c.vehicles.model}` : "General inquiry"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.bookings.map((b) => <Link key={b.id} href={`/dashboard/bookings/${b.id}`} className="flex items-center gap-1.5 text-xs font-semibold"><span className="font-mono text-muted-foreground">{b.reference}</span><BookingStatusBadge status={b.status} /></Link>)}
          <ProposeBooking conversationId={c.id} vehicles={vehicles ?? []} defaultVehicleId={c.vehicle_id} defaultLocation={business.city} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col bg-[#f6f7f9]">
        <ChatThread conversationId={c.id} viewer="BUSINESS" initial={messages ?? []} otherReadAt={c.customer_last_read_at} bookingBase="/dashboard/bookings/" />
      </div>
    </div>
  );
}
