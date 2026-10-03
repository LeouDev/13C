import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { ConversationList } from "@/components/chat/conversation-list";
import { EmptyState, PageHeader } from "@/components/common/states";
import { requireBusiness } from "@/lib/auth";
import { businessConversations } from "@/lib/conversations";

export const metadata: Metadata = { title: "Messages" };

export default async function BusinessMessagesPage() {
  const { business } = await requireBusiness();
  const items = await businessConversations(business.id);
  return (
    <>
      <PageHeader eyebrow="Communication" title="Messages" description="Every conversation with customers, in real time." />
      {items.length === 0 ? <EmptyState icon={MessageSquare} title="No messages yet" description="When customers message your store, conversations appear here." /> : (
        <div className="overflow-hidden rounded-3xl border bg-white"><ConversationList items={items} hrefBase="/dashboard/messages" /></div>
      )}
    </>
  );
}
