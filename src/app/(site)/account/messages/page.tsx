import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { ConversationList } from "@/components/chat/conversation-list";
import { EmptyState } from "@/components/common/states";
import { requireUser } from "@/lib/auth";
import { customerConversations } from "@/lib/conversations";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUser("/account/messages");
  const items = await customerConversations(user.id);
  return items.length === 0 ? (
    <EmptyState icon={MessageSquare} title="No conversations yet" description="Message a rental business from any car or storefront." action={{ label: "Find a car", href: "/explore" }} />
  ) : (
    <div className="grid grid-cols-1 overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 lg:grid-cols-[340px_1fr]">
      <ConversationList items={items} hrefBase="/account/messages" />
      <div className="hidden place-items-center border-l text-sm text-muted-foreground lg:grid">Select a conversation</div>
    </div>
  );
}
