import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ConversationItem } from "@/components/chat/conversation-list";

export async function customerConversations(userId: string): Promise<ConversationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("conversations")
    .select("id, last_message_at, last_message_preview, last_sender_role, customer_last_read_at, businesses(name, logo_path), vehicles(make, model)")
    .eq("customer_id", userId).order("last_message_at", { ascending: false }).limit(100);
  return (data ?? []).map((c) => ({
    id: c.id, title: c.businesses?.name ?? "Business", subtitle: c.vehicles ? `${c.vehicles.make} ${c.vehicles.model}` : null,
    preview: c.last_message_preview, at: c.last_message_at,
    unread: c.last_sender_role !== "CUSTOMER" && (!c.customer_last_read_at || c.customer_last_read_at < c.last_message_at),
    logo: c.businesses ? { path: c.businesses.logo_path, name: c.businesses.name } : null,
  }));
}

/** Chats with something the renter hasn't read (same rule as customerConversations), for the app's Messages tab. */
export async function customerUnreadCount(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select("last_message_at, last_sender_role, customer_last_read_at")
    .eq("customer_id", userId).order("last_message_at", { ascending: false }).limit(100);
  return (data ?? []).filter((c) => c.last_sender_role !== "CUSTOMER"
    && (!c.customer_last_read_at || c.customer_last_read_at < c.last_message_at)).length;
}

export async function businessConversations(businessId: string, filter?: "inquiries") {
  const supabase = await createClient();
  const { data } = await supabase.from("conversations")
    .select("id, created_at, last_message_at, last_message_preview, last_sender_role, business_last_read_at, business_replied, customer:profiles!conversations_customer_id_fkey(full_name), vehicles(make, model), bookings(id, status)")
    .eq("business_id", businessId).order("last_message_at", { ascending: false }).limit(200);
  const rows = (data ?? []).filter((c) => filter !== "inquiries" || c.bookings.length === 0);
  return rows.map((c) => ({
    id: c.id, title: c.customer?.full_name || "Customer", subtitle: c.vehicles ? `${c.vehicles.make} ${c.vehicles.model}` : null,
    preview: c.last_message_preview, at: c.last_message_at, createdAt: c.created_at,
    unread: c.last_sender_role === "CUSTOMER" && (!c.business_last_read_at || c.business_last_read_at < c.last_message_at),
    // Derived inquiry stage (spec: INQUIRY → NEGOTIATING before a booking exists)
    stage: c.bookings.length ? ("BOOKED" as const) : c.business_replied ? ("NEGOTIATING" as const) : ("INQUIRY" as const),
  }));
}
