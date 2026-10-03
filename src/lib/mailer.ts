import "server-only";

/** Sender for every 13C email (replies land in the support inbox). */
// ponytail: back to air-rally.com until 13c.online is verified in the Resend team that owns RESEND_API_KEY.
export const EMAIL_FROM = "13C <support@air-rally.com>";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; content_id?: string }[]; // content: base64; content_id = inline image (cid:)
  idempotencyKey?: string; // `<type>/<id>`; Resend dedupes the same key for 24 hours
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
  const json = (await res.json().catch(() => null)) as { id?: string; name?: string; message?: string } | null;
  // Same key, different payload (e.g. a retry that now has the PDF): the first send already went out.
  if (res.status === 409 && json?.name === "invalid_idempotent_request") return null;
  if (!res.ok) throw new Error(`Resend ${res.status} ${json?.name ?? ""}: ${json?.message ?? res.statusText}`);
  return json?.id ?? null;
}
