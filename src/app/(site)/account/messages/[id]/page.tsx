import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatThread } from "@/components/chat/chat-thread";
import { ConversationList } from "@/components/chat/conversation-list";
import { BusinessLogo } from "@/components/common/vehicle-image";
import { requireUser } from "@/lib/auth";
import { customerConversations } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/account/messages/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/account/messages/${id}`);
  const supabase = await createClient();
  const [{ data: c }, { data: messages }, items] = await Promise.all([
    supabase.from("conversations").select("id, business_last_read_at, businesses(name, slug, logo_path), vehicles(make, model, slug)").eq("id", id).eq("customer_id", user.id).maybeSingle(),
    supabase.from("messages").select("id, body, sender_role, created_at, booking_id").eq("conversation_id", id).order("created_at").limit(500),
    customerConversations(user.id),
  ]);
  if (!c) notFound();
  return (
    <div className="grid grid-cols-1 h-[calc(100svh-12rem)] min-h-[480px] overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 lg:grid-cols-[340px_1fr]">
      <div className="hidden overflow-y-auto border-r lg:block"><ConversationList items={items} hrefBase="/account/messages" activeId={id} /></div>
      <div className="flex min-h-0 flex-col bg-[#f6f7f9]">
        <header className="flex items-center gap-3 border-b bg-white px-3 py-3 sm:px-5">
          <Link href="/account/messages" className="grid size-9 place-items-center rounded-full hover:bg-canvas lg:hidden" aria-label="Back"><ArrowLeft className="size-4" /></Link>
          <BusinessLogo path={c.businesses?.logo_path} name={c.businesses?.name ?? ""} className="size-10 rounded-xl text-sm" />
          <div className="min-w-0 flex-1">
            <Link href={`/${c.businesses?.slug}`} className="block truncate font-semibold text-navy-900 hover:underline">{c.businesses?.name}</Link>
            {c.vehicles && <Link href={`/${c.businesses?.slug}/${c.vehicles.slug}`} className="block truncate text-xs text-electric hover:underline">{c.vehicles.make} {c.vehicles.model}</Link>}
          </div>
          {c.vehicles && <Link href={`/${c.businesses?.slug}/${c.vehicles.slug}#book`} className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-electric">Book this car</Link>}
        </header>
        <ChatThread conversationId={c.id} viewer="CUSTOMER" initial={messages ?? []} otherReadAt={c.business_last_read_at} bookingBase="/account/bookings/" />
      </div>
    </div>
  );
}
