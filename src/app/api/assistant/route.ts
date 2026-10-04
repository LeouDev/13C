import { createHmac } from "node:crypto";
import { streamText } from "ai";
import { z } from "zod";
import { ASSISTANT_INSTRUCTIONS, faqAnswer } from "@/lib/assistant";
import { createAdminClient } from "@/lib/supabase/admin";

const MODEL = "anthropic/claude-haiku-4.5"; // via Vercel AI Gateway (OIDC on Vercel; free monthly credit)
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

  const result = streamText({
    model: MODEL,
    instructions: { role: "system", content: ASSISTANT_INSTRUCTIONS, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages,
    maxOutputTokens: 500,
    timeout: 30_000,
    onError: ({ error }) => console.error("[assistant]", error),
  });

  // Wait for the first words, so a failure (no credit left, gateway down) becomes the ready-made answer.
  const text = result.textStream[Symbol.asyncIterator]();
  const first = await text.next().catch(() => ({ done: true as const, value: undefined }));
  if (first.done) return fallback(question, 503);
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start: (c) => c.enqueue(encoder.encode(first.value)),
    pull: async (c) => {
      const next = await text.next();
      if (next.done) c.close(); else c.enqueue(encoder.encode(next.value));
    },
    cancel: () => void text.return?.(),
  }), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
