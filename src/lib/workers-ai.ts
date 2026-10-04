import "server-only";

// Cloudflare Workers AI, used by the For Business assistant and "Write with AI" in the store editor.
// The free daily allowance (10,000 neurons, about 300 answers) is shared by both; past it, requests fail and are never billed.
const MODEL = "@cf/google/gemma-4-26b-a4b-it";

type Message = { role: "system" | "user" | "assistant"; content: string };

/** An OpenAI-style chat completion. null when AI isn't set up, Cloudflare can't be reached or it refuses (logged). */
export async function workersAI(messages: Message[], { maxTokens, stream = false }: { maxTokens: number; stream?: boolean }) {
  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_AI_TOKEN: token } = process.env;
  if (!account || !token) return null;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, messages, max_completion_tokens: maxTokens, stream,
      chat_template_kwargs: { enable_thinking: false }, // thinking is on by default and can use up the token limit before any answer
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch((error) => { console.error("[ai]", error); return null; });
  if (res && !res.ok) {
    console.error("[ai]", res.status, await res.text().catch(() => ""));
    return null;
  }
  return res;
}
