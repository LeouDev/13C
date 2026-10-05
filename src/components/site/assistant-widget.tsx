"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, CircleHelp, FileSignature, MessageCircle, Store, X } from "lucide-react";
import { cn } from "cn";
import { MessageButton } from "@/components/storefront/message-button";

// The 13C assistants (src/app/api/assistant): one chat panel, used on the For Business page, in the dashboard's
// top bar and on every store. The panel stays mounted after the first open, so closing it keeps the conversation.

type Message = { role: "user" | "assistant"; content: string };
type Context = { context: "for-business" } | { context: "dashboard" } | { context: "store"; store: string };

/** For Business page: answers owners deciding whether to join 13C. */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  return (
    <>
      <FloatingButton open={open} label="Ask about 13C" className="bg-navy-900 hover:bg-navy-800" onClick={() => { setOpen(!open); setUsed(true); }} />
      {used && (
        <ChatPanel open={open} onClose={() => setOpen(false)} context={{ context: "for-business" }}
          title="13C assistant" subtitle="Questions about 13C for rental businesses"
          greeting="Hi! I can answer questions about running your rental business on 13C: plans, setup, bookings, contracts and more."
          suggestions={["How much does 13C cost?", "How do digital contracts work?", "How do I get verified?", "Does 13C take a commission?"]}
          note="AI answers can be wrong. For account help, email support@13c.online."
          extras={
            <div className="flex flex-wrap gap-2">
              <Link href="/demo" className="flex items-center gap-2 rounded-2xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-electric hover:bg-accent/70">
                <Store className="size-4" /> See a sample store
              </Link>
              <Link href="/for-business/sample-contract" className="flex items-center gap-2 rounded-2xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-electric hover:bg-accent/70">
                <FileSignature className="size-4" /> Try a sample contract
              </Link>
            </div>
          } />
      )}
    </>
  );
}

/** Dashboard top bar: how-to answers for owners and their team. */
export function DashboardHelp() {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  return (
    <>
      <button type="button" onClick={() => { setOpen(!open); setUsed(true); }} aria-expanded={open} aria-controls="assistant-panel"
        className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-navy-800 hover:bg-canvas", open && "bg-canvas")}>
        <CircleHelp className="size-5" /><span className="hidden sm:inline">Help</span>
      </button>
      {used && (
        <ChatPanel open={open} onClose={() => setOpen(false)} context={{ context: "dashboard" }}
          title="13C help" subtitle="Ask how to do anything in 13C"
          greeting="Hi! Ask me how to do anything in 13C: cars, bookings, contracts, your store and more."
          suggestions={["How do I add a car?", "How do I block dates?", "How do I send a contract?", "Why isn't my store public?"]}
          note="AI answers can be wrong. For account problems, email support@13c.online."
          className="top-16 sm:top-16 sm:right-4 sm:bottom-auto sm:h-[min(600px,calc(100svh-6rem))]" />
      )}
    </>
  );
}

/** A store's assistant for renters: answers from that store's own details only. */
export function StoreAssistant({ businessId, slug, name, accent, isDemo, signedIn }: {
  businessId: string;
  slug: string;
  name: string;
  accent: string;
  isDemo: boolean;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const pathname = usePathname();
  const onCarPage = pathname.split("/").filter(Boolean).length > 1; // car pages have a booking bar at the bottom on phones
  return (
    <>
      <FloatingButton open={open} label="Ask us" style={{ background: accent }} className={cn("hover:brightness-110", onCarPage && "max-lg:bottom-24")}
        onClick={() => { setOpen(!open); setUsed(true); }} />
      {used && (
        <ChatPanel open={open} onClose={() => setOpen(false)} context={{ context: "store", store: slug }} accent={accent}
          title={name} subtitle="AI assistant"
          greeting="Hi! Ask me about our cars, rates, pickup and delivery, or how to book."
          suggestions={["What cars do you have?", "Do you deliver?", "What do I need to rent?", "How do I book?"]}
          note={`AI answers can be wrong. Check important details with ${name}.`}
          footer={!isDemo && (
            <MessageButton businessId={businessId} businessName={name} signedIn={signedIn} returnTo={pathname} label="Message the owner" variant="outline" className="h-10 w-full text-sm" />
          )} />
      )}
    </>
  );
}

function FloatingButton({ open, label, className, style, onClick }: { open: boolean; label: string; className?: string; style?: React.CSSProperties; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} aria-controls="assistant-panel" style={style}
      className={cn("fixed right-4 bottom-4 z-50 flex h-14 items-center gap-2 rounded-full px-5 font-semibold text-white shadow-[0_10px_30px_rgb(18_31_59/0.35)] transition sm:right-6 sm:bottom-6",
        open && "max-sm:hidden", className)}>
      {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      <span>{open ? "Close" : label}</span>
    </button>
  );
}

function ChatPanel({ open, onClose, context, title, subtitle, greeting, suggestions, note, extras, footer, accent, className }: {
  open: boolean;
  onClose: () => void;
  context: Context;
  title: string;
  subtitle: string;
  greeting: string;
  suggestions: string[];
  note: string;
  extras?: React.ReactNode;
  footer?: React.ReactNode;
  /** The store's color for the header (the panel is portaled out of the store's layout, so it can't inherit it) */
  accent?: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // Focus the field on open, except on touch screens, where the keyboard would cover the suggestions.
  useEffect(() => { if (open && matchMedia("(pointer: fine)").matches) field.current?.focus(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, open]);

  const reply = (update: (text: string) => string) =>
    setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: update(m.at(-1)!.content) }]);

  async function ask(question: string) {
    const text = question.trim().slice(0, 500);
    if (!text || busy) return;
    // The last 19 turns plus this one, starting with a question (the model expects the user first).
    const history: Message[] = [...messages, { role: "user", content: text }];
    let sent = history.slice(-20);
    while (sent[0]?.role === "assistant") sent = sent.slice(1);
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, messages: sent }) });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        reply(() => data.answer ?? "Sorry, something went wrong. Please try again later.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        reply((t) => t + chunk);
      }
    } catch {
      reply((t) => t || "I couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <section id="assistant-panel" role="dialog" aria-label={title} hidden={!open} onKeyDown={(e) => e.key === "Escape" && onClose()}
      className={cn("fixed inset-x-3 top-20 bottom-3 z-50 flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgb(10_20_48/0.35)] ring-1 ring-black/5 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-24 sm:h-[min(600px,calc(100svh-8rem))] sm:w-[390px]", className)}>
      <header className="flex items-start gap-3 bg-navy-900 px-5 py-4 text-white" style={accent ? { background: accent } : undefined}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{title}</p>
          <p className="text-xs text-white/75">{subtitle}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-white/10"><X className="size-5" /></button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <div className="grid gap-3">
          <Bubble role="assistant">{greeting}</Bubble>
          {extras}
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} accent={accent}>{m.content || <span className="inline-flex gap-1" aria-label="Typing"><Dot /><Dot /><Dot /></span>}</Bubble>
          ))}
          {messages.length === 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {suggestions.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border px-3 py-1.5 text-left text-[13px] text-navy-800 hover:border-electric hover:text-electric">{q}</button>
              ))}
            </div>
          )}
          <div ref={end} />
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="border-t px-3 pt-3 pb-2">
        {footer && <div className="mb-2">{footer}</div>}
        <div className="flex items-center gap-2">
          <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Ask a question…" aria-label="Your question"
            className="h-11 min-w-0 flex-1 rounded-full bg-canvas px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-electric" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-electric text-white disabled:opacity-40"
            style={accent ? { background: accent } : undefined}>
            <ArrowUp className="size-5" />
          </button>
        </div>
        <p className="px-2 pt-2 text-center text-[11px] text-muted-foreground">{note}</p>
      </form>
    </section>,
    document.body,
  );
}

function Bubble({ role, accent, children }: { role: Message["role"]; accent?: string; children: React.ReactNode }) {
  return (
    <div style={role === "user" && accent ? { background: accent } : undefined} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
      role === "user" ? "justify-self-end rounded-br-md bg-electric text-white" : "justify-self-start rounded-bl-md bg-canvas text-navy-900")}>
      {children}
    </div>
  );
}

const Dot = () => <span className="size-1.5 animate-pulse rounded-full bg-navy-700/50" />;
