import "server-only";

/** Sender for every 13C email (replies land in the support inbox). */
export const EMAIL_FROM = "13C <support@air-rally.com>";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string }[]; // content: base64
  idempotencyKey?: string; // Resend dedupes the same key for 24 hours
};

/** Sends through Resend's REST API. Throws on failure so callers can retry. */
export async function sendEmail(m: Mail) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text, attachments: m.attachments }),
  });
  const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok) throw new Error(`Resend ${res.status}: ${json?.message ?? res.statusText}`);
  return json?.id ?? null;
}
