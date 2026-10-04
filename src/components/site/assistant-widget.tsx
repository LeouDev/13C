"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileSignature, MessageCircle, X } from "lucide-react";
import { cn } from "cn";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTED = ["How much does 13C cost?", "How do digital contracts work?", "How do I get verified?", "Does 13C take a commission?"];
const GREETING = "Hi! I can answer questions about running your rental business on 13C: plans, setup, bookings, contracts and more.";

/** The For Business assistant: a floating chat that answers owners' questions (src/app/api/assistant). */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // Focus the field on open, except on touch screens, where the keyboard would cover the suggestions.
  useEffect(() => { if (open && matchMedia("(pointer: fine)").matches) field.current?.focus(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages]);

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
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: sent }) });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        reply(() => data.answer ?? "Sorry, something went wrong. Please email support@13c.online.");
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
      reply((t) => t || "I couldn't reach the assistant. Check your connection, or email support@13c.online.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="assistant-panel"
        className={cn("fixed right-4 bottom-4 z-50 flex h-14 items-center gap-2 rounded-full bg-navy-900 px-5 font-semibold text-white shadow-[0_10px_30px_rgb(18_31_59/0.35)] transition hover:bg-navy-800 sm:right-6 sm:bottom-6",
          open && "max-sm:hidden")}>
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        <span>{open ? "Close" : "Ask about 13C"}</span>
      </button>

      {open && (
        <section id="assistant-panel" role="dialog" aria-label="13C assistant" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="fixed inset-x-3 top-20 bottom-3 z-50 flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgb(10_20_48/0.35)] ring-1 ring-black/5 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-24 sm:h-[min(600px,calc(100svh-8rem))] sm:w-[390px]">
          <header className="flex items-start gap-3 bg-navy-900 px-5 py-4 text-white">
            <div className="flex-1">
              <p className="font-display text-lg font-bold">13C assistant</p>
              <p className="text-xs text-white/70">Questions about 13C for rental businesses</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-white/10"><X className="size-5" /></button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="grid gap-3">
              <Bubble role="assistant">{GREETING}</Bubble>
              <Link href="/for-business/sample-contract" className="flex items-center gap-2 justify-self-start rounded-2xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-electric hover:bg-accent/70">
                <FileSignature className="size-4" /> Try a sample contract
              </Link>
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role}>{m.content || <span className="inline-flex gap-1" aria-label="Typing"><Dot /><Dot /><Dot /></span>}</Bubble>
              ))}
              {messages.length === 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {SUGGESTED.map((q) => (
                    <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border px-3 py-1.5 text-left text-[13px] text-navy-800 hover:border-electric hover:text-electric">{q}</button>
                  ))}
                </div>
              )}
              <div ref={end} />
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="border-t px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Ask a question…" aria-label="Your question"
                className="h-11 min-w-0 flex-1 rounded-full bg-canvas px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-electric" />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-electric text-white disabled:opacity-40">
                <ArrowUp className="size-5" />
              </button>
            </div>
            <p className="px-2 pt-2 text-center text-[11px] text-muted-foreground">AI answers can be wrong. For account help, email support@13c.online.</p>
          </form>
        </section>
      )}
    </>
  );
}

function Bubble({ role, children }: { role: Message["role"]; children: React.ReactNode }) {
  return (
    <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
      role === "user" ? "justify-self-end rounded-br-md bg-electric text-white" : "justify-self-start rounded-bl-md bg-canvas text-navy-900")}>
      {children}
    </div>
  );
}

const Dot = () => <span className="size-1.5 animate-pulse rounded-full bg-navy-700/50" />;
