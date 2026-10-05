import { createHmac } from "node:crypto";
import { z } from "zod";
import { answerText, ASSISTANT_INSTRUCTIONS, DASHBOARD_FALLBACK, DASHBOARD_INSTRUCTIONS, faqAnswer, storeAssistantInstructions } from "@/lib/assistant";
import { getStorefront } from "@/lib/queries";
import { storeFacts } from "@/lib/store-writer";
import { createAdminClient } from "@/lib/supabase/admin";
import { workersAI } from "@/lib/workers-ai";

// When the AI can't answer (free daily allowance used up, outage), people get a ready-made answer instead.
const DAILY_LIMIT = 40; // messages per visitor per day, across every assistant
const STORE_DAILY_LIMIT = 50; // messages per store per day, so one busy store can't use up the allowance all assistants share

const chat = z.object({
  /** Where the chat is: the For Business page, the dashboard's Help, or a store (`store` is its slug). */
  context: z.enum(["for-business", "dashboard", "store"]).default("for-business"),
  store: z.string().max(100).optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) })).min(1).max(20),
}).refine((c) => c.messages.at(-1)!.role === "user" && c.messages.at(-1)!.content.length <= 500);

/** The 13C assistants (src/lib/assistant.ts): answers streamed as plain text. */
export async function POST(request: Request) {
  const parsed = chat.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid message." }, { status: 400 });
  const { context, store, messages } = parsed.data;
  const question = messages.at(-1)!.content;

  // A store's assistant answers anyone who can see the store, unless the owner turned it off.
  const sf = context === "store" && store ? await getStorefront(store) : null;
  if (context === "store" && (!sf || sf.store.hidden_sections.includes("assistant"))) return Response.json({ error: "Not found." }, { status: 404 });

  /** Ready-made answer (no AI) as a non-2xx response, so the widget shows it and knows the AI isn't answering. */
  const fallback = (status: number) => Response.json({
    answer: sf
      ? sf.business.is_demo ? "I can't answer right now. Have a look at the cars on this page." : `I can't answer right now. Please check the car pages, or tap "Message the owner" to ask ${sf.business.name} directly.`
      : context === "dashboard" ? DASHBOARD_FALLBACK : faqAnswer(question),
  }, { status });

  // A keyed hash of the day and IP: limits one visitor without storing their IP.
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = createHmac("sha256", process.env.SUPABASE_SECRET_KEY!).update(`${day}:${ip}`).digest("hex").slice(0, 40);
  const admin = createAdminClient();
  const { data: allowed } = await admin.rpc("assistant_allow", { p_key: key, p_limit: DAILY_LIMIT });
  if (!allowed) return fallback(429);

  let instructions = context === "dashboard" ? DASHBOARD_INSTRUCTIONS : ASSISTANT_INSTRUCTIONS;
  if (sf) {
    const { data: storeAllowed } = await admin.rpc("assistant_allow", { p_key: `store:${day}:${sf.business.id}`, p_limit: STORE_DAILY_LIMIT });
    if (!storeAllowed) return fallback(429);
    const facts = await storeFacts(admin, sf.business.id);
    if (!facts) return fallback(503);
    instructions = storeAssistantInstructions(sf.business.name, facts, sf.business.is_demo);
  }

  const ai = await workersAI([{ role: "system", content: instructions }, ...messages], { maxTokens: 500, stream: true });
  if (!ai?.body) return fallback(503);

  // Wait for the first words, so a failure (daily allowance used up, outage) becomes the ready-made answer.
  const text = answerText(ai.body);
  const first = await text.next().catch(() => ({ done: true as const, value: undefined }));
  if (first.done) {
    console.error("[assistant] no answer text in the AI's reply");
    return fallback(503);
  }
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start: (c) => c.enqueue(encoder.encode(first.value)),
    pull: async (c) => {
      const next = await text.next();
      if (next.done) c.close(); else c.enqueue(encoder.encode(next.value));
    },
    cancel: () => void text.return(undefined),
  }), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
