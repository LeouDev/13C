"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { markConversationRead, sendMessage } from "@/app/actions/messages";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatTime } from "@/lib/format";
import type { Tables } from "@/types/database";

type Message = Pick<Tables<"messages">, "id" | "body" | "sender_role" | "created_at" | "booking_id">;

export function ChatThread({
  conversationId, viewer, initial, otherReadAt, bookingBase,
}: {
  conversationId: string;
  viewer: "CUSTOMER" | "BUSINESS";
  initial: Message[];
  otherReadAt: string | null;
  /** e.g. "/account/bookings/" — functions can't cross the server→client boundary */
  bookingBase: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markConversationRead(conversationId);
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list.filter((x) => !x.id.startsWith("tmp-") || x.body !== m.body), m]));
        if (m.sender_role !== viewer) markConversationRead(conversationId);
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [conversationId, viewer]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  function send() {
    const body = text.trim();
    if (!body) return;
    const tmp: Message = { id: `tmp-${Date.now()}`, body, sender_role: viewer, created_at: new Date().toISOString(), booking_id: null };
    setMessages((m) => [...m, tmp]);
    setText("");
    start(async () => {
      const r = await sendMessage(conversationId, body);
      if (!r.ok) { toast.error(r.error); setMessages((m) => m.filter((x) => x.id !== tmp.id)); setText(body); }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>}
        {messages.map((m, i) => {
          const day = formatDate(m.created_at);
          const showDay = i === 0 || formatDate(messages[i - 1]!.created_at) !== day;
          const mine = m.sender_role === viewer;
          const seen = mine && otherReadAt && otherReadAt >= m.created_at;
          return (
            <div key={m.id}>
              {showDay && <p className="my-3 text-center text-[11px] font-medium text-muted-foreground">{day}</p>}
              {m.sender_role === "SYSTEM" ? (
                <div className="mx-auto max-w-md rounded-2xl bg-electric/5 px-4 py-2.5 text-center text-xs text-navy-800">
                  {m.body}
                  {m.booking_id && (viewer === "CUSTOMER" && m.body.startsWith("Booking proposal")
                    ? <Link href={`${bookingBase}${m.booking_id}`} className="mx-auto mt-2 flex w-fit rounded-full bg-electric px-4 py-1.5 font-semibold text-white hover:bg-electric/90">Review &amp; accept</Link>
                    : <Link href={`${bookingBase}${m.booking_id}`} className="mt-1 block font-semibold text-electric hover:underline">View booking →</Link>)}
                </div>
              ) : (
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm", mine ? "rounded-br-md bg-navy-900 text-white" : "rounded-bl-md bg-white text-navy-900 ring-1 ring-black/5")}>
                    {m.body}
                    <span className={cn("mt-0.5 block text-right text-[10px]", mine ? "text-white/60" : "text-muted-foreground")}>
                      {formatTime(m.created_at)}{m.id.startsWith("tmp-") ? " · sending" : seen ? " · seen" : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="flex items-end gap-2 border-t bg-white p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} placeholder="Write a message…" aria-label="Message"
          className="max-h-40 min-h-11 resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button type="submit" disabled={!text.trim() || pending} className="grid size-11 shrink-0 place-items-center rounded-full bg-navy-900 text-white transition hover:bg-electric disabled:opacity-40" aria-label="Send">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </button>
      </form>
    </div>
  );
}
