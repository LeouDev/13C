import { createHmac } from "node:crypto";
import { z } from "zod";
import { answerText, ASSISTANT_INSTRUCTIONS, faqAnswer } from "@/lib/assistant";
import { createAdminClient } from "@/lib/supabase/admin";

// Cloudflare Workers AI: a free daily allowance; past it, requests fail (never billed) and visitors get the ready-made answers.
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const DAILY_LIMIT = 40; // messages per visitor per day

const chat = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) })).min(1).max(20),
}).refine((c) => c.messages.at(-1)!.role === "user" && c.messages.at(-1)!.content.length <= 500);

/** Ready-made answer (no AI) as a non-2xx response, so the widget shows it and knows the AI isn't answering. */
const fallback = (question: string, status: number) => Response.json({ answer: faqAnswer(question) }, { status });

/** The For Business assistant: answers owners' questions about 13C, streamed as plain text. */
export async function POST(request: Request) {
  const parsed = chat.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid message." }, { status: 400 });
  const { messages } = parsed.data;
  const question = messages.at(-1)!.content;

  // A keyed hash of the day and IP: limits one visitor without storing their IP.
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = createHmac("sha256", process.env.SUPABASE_SECRET_KEY!).update(`${new Date().toISOString().slice(0, 10)}:${ip}`).digest("hex").slice(0, 40);
  const { data: allowed } = await createAdminClient().rpc("assistant_allow", { p_key: key, p_limit: DAILY_LIMIT });
  if (!allowed) return fallback(question, 429);

  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_AI_TOKEN: token } = process.env;
  if (!account || !token) return fallback(question, 503);
  const ai = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: ASSISTANT_INSTRUCTIONS }, ...messages], max_completion_tokens: 500, stream: true }),
    signal: AbortSignal.timeout(30_000),
  }).catch((error) => { console.error("[assistant]", error); return null; });
  if (!ai?.ok || !ai.body) {
    if (ai) console.error("[assistant]", ai.status, await ai.text().catch(() => ""));
    return fallback(question, 503);
  }

  // Wait for the first words, so a failure (daily allowance used up, outage) becomes the ready-made answer.
  const text = answerText(ai.body);
  const first = await text.next().catch(() => ({ done: true as const, value: undefined }));
  if (first.done) return fallback(question, 503);
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
