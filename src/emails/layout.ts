/**
 * One email layout for every message 13C sends: table-based HTML with inline styles
 * (Gmail/Outlook/Apple Mail), a preheader, a bulletproof CTA, dark-mode hints and a
 * plain-text twin. Every dynamic value is HTML-escaped.
 */

export type Tone = "info" | "success" | "warning" | "danger";

export type Block =
  | { p: string } // paragraph — **bold** allowed
  | { details: [label: string, value: string | undefined][] }
  | { note: string; tone?: Tone }
  | { quote: string; by?: string }
  | { code: string }
  | { list: string[] }
  | { provider: string };

export type Email = {
  subject: string;
  preheader: string;
  heading: string;
  blocks: Block[];
  cta?: { label: string; url: string };
  secondary?: { label: string; url: string };
  /** CTA color — e.g. the rental business's storefront accent */
  accent?: string;
  footer?: "account" | "auth" | "admin";
  /** e.g. who the rental provider is */
  disclaimer?: string;
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const NAVY = "#121f3b";
const TEXT = "#334155";
const MUTED = "#64748b";
const RULE = "#e3e7ee";
const ELECTRIC = "#2f6bff";

const TONES: Record<Tone, [bg: string, fg: string]> = {
  info: ["#eef4ff", "#1e3a8a"],
  success: ["#ecfdf5", "#065f46"],
  warning: ["#fffbeb", "#92400e"],
  danger: ["#fef2f2", "#991b1b"],
};

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Escape, then allow **bold** (navy on the card; inherits inside colored notes). */
const rich = (s: string, inherit = false) =>
  esc(s).replace(/\*\*(.+?)\*\*/g, inherit ? "<strong>$1</strong>" : `<strong class="strong" style="color:${NAVY}">$1</strong>`);
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");

/** Relative app paths become absolute; Supabase template variables ({{ … }}) pass through untouched. */
const abs = (url: string, base: string) => (url.startsWith("/") ? `${base}${url}` : url);

function blockHtml(b: Block): string {
  if ("p" in b) return `<p class="text" style="margin:0 0 16px;font:15px/1.6 ${FONT};color:${TEXT};">${rich(b.p)}</p>`;
  if ("details" in b) {
    const rows = b.details.filter((r): r is [string, string] => !!r[1]);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" style="margin:0 0 20px;border:1px solid ${RULE};border-radius:12px;background:#f8fafc;border-collapse:separate;">${rows
      .map(([k, v], i) => {
        const top = i ? `border-top:1px solid ${RULE};` : "";
        return `<tr><td class="muted rule" style="${top}padding:10px 16px;font:13px/1.4 ${FONT};color:${MUTED};vertical-align:top;">${esc(k)}</td><td align="right" class="value rule" style="${top}padding:10px 16px;font:600 14px/1.4 ${FONT};color:${NAVY};text-align:right;">${esc(v)}</td></tr>`;
      })
      .join("")}</table>`;
  }
  if ("note" in b) {
    const [bg, fg] = TONES[b.tone ?? "info"];
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="padding:12px 16px;background:${bg};border-radius:12px;font:14px/1.55 ${FONT};color:${fg};">${rich(b.note, true)}</td></tr></table>`;
  }
  if ("quote" in b) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td class="text" style="border-left:3px solid ${ELECTRIC};padding:4px 0 4px 14px;font:italic 15px/1.6 ${FONT};color:${TEXT};">“${esc(b.quote)}”${b.by ? `<br><span class="muted" style="font:normal 13px/1.6 ${FONT};color:${MUTED};">— ${esc(b.by)}</span>` : ""}</td></tr></table>`;
  }
  if ("code" in b) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td align="center" class="panel" style="padding:18px;background:#f8fafc;border:1px solid ${RULE};border-radius:12px;font:700 30px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:8px;color:${NAVY};">${esc(b.code)}</td></tr></table>`;
  }
  if ("list" in b) {
    return `<ul class="text" style="margin:0 0 16px;padding-left:20px;font:15px/1.6 ${FONT};color:${TEXT};">${b.list.map((i) => `<li style="margin:0 0 6px;">${rich(i)}</li>`).join("")}</ul>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td class="panel" style="padding:12px 16px;border:1px solid ${RULE};border-radius:12px;font:13px/1.4 ${FONT};color:${MUTED};">Rental provider<br><span class="value" style="font:700 16px/1.4 ${FONT};color:${NAVY};">${esc(b.provider)}</span></td></tr></table>`;
}

function blockText(b: Block): string {
  if ("p" in b) return plain(b.p);
  if ("details" in b) return b.details.filter((r) => r[1]).map(([k, v]) => `${k}: ${v}`).join("\n");
  if ("note" in b) return plain(b.note);
  if ("quote" in b) return `"${b.quote}"${b.by ? ` — ${b.by}` : ""}`;
  if ("code" in b) return b.code;
  if ("list" in b) return b.list.map((i) => `- ${plain(i)}`).join("\n");
  return `Rental provider: ${b.provider}`;
}

function footerLines(e: Email, base: string): string[] {
  const lines =
    e.footer === "auth"
      ? ["You received this email because this address was used with 13C. If that wasn't you, you can safely ignore it."]
      : e.footer === "admin"
        ? ["Sent to 13C platform admins."]
        : ["You're receiving this because of activity on your 13C account. Questions? support@air-rally.com"];
  if (e.disclaimer) lines.unshift(e.disclaimer);
  lines.push(e.footer === "auth" ? "13C · Cebu, Philippines" : `13C · Cebu, Philippines · ${base.replace(/^https?:\/\//, "")}`);
  return lines;
}

export function renderEmail(e: Email, opts: { base: string }): { subject: string; html: string; text: string } {
  const { base } = opts;
  const accent = e.accent && /^#[0-9a-f]{6}$/i.test(e.accent) ? e.accent : NAVY;
  const cta = e.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 ${e.footer === "auth" ? 16 : 24}px;"><tr><td align="center" bgcolor="${accent}" style="border-radius:999px;background:${accent};"><a href="${esc(abs(e.cta.url, base))}" target="_blank" style="display:inline-block;padding:14px 28px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px;">${esc(e.cta.label)}</a></td></tr></table>`
    : "";
  const fallback =
    e.cta && e.footer === "auth"
      ? `<p class="muted" style="margin:0 0 16px;font:12px/1.5 ${FONT};color:${MUTED};">Button not working? Copy this link into your browser:<br><a href="${esc(abs(e.cta.url, base))}" style="color:${ELECTRIC};word-break:break-all;">${esc(abs(e.cta.url, base))}</a></p>`
      : "";
  const secondary = e.secondary
    ? `<p class="text" style="margin:0 0 8px;font:14px/1.6 ${FONT};color:${TEXT};"><a href="${esc(abs(e.secondary.url, base))}" target="_blank" style="color:${ELECTRIC};font-weight:600;text-decoration:none;">${esc(e.secondary.label)} →</a></p>`
    : "";
  const footer = footerLines(e, base).map((l) => `<p style="margin:0 0 6px;">${esc(l)}</p>`).join("");

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(e.subject)}</title>
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
img{border:0;outline:none;text-decoration:none;}
@media (max-width:620px){.container{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:22px!important}}
@media (prefers-color-scheme:dark){.bg{background:#0a1430!important}.card{background:#121f3b!important}.text,.h1,.value,.strong{color:#f2eee6!important}.muted{color:#aab3c5!important}.panel{background:#1b2b4f!important;border-color:#273b69!important}.rule{border-color:#273b69!important}}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#eef0f4;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(e.preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#eef0f4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td class="px" bgcolor="${NAVY}" style="background:${NAVY};border-radius:16px 16px 0 0;padding:20px 32px;"><a href="${esc(base)}" target="_blank"><img src="${esc(base)}/assets/email-logo.png" width="96" height="43" alt="13C" style="display:block;width:96px;height:43px;"></a></td></tr>
<tr><td bgcolor="#e0312b" style="background:#e0312b;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td class="card px" bgcolor="#ffffff" style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;">
<h1 class="h1" style="margin:0 0 16px;font:700 24px/1.25 ${FONT};color:${NAVY};">${esc(e.heading)}</h1>
${e.blocks.map(blockHtml).join("\n")}
${cta}${fallback}${secondary}
</td></tr>
<tr><td class="px muted" style="padding:20px 32px;font:12px/1.6 ${FONT};color:${MUTED};">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  const text = [
    e.heading,
    ...e.blocks.map(blockText),
    e.cta ? `${e.cta.label}: ${abs(e.cta.url, base)}` : "",
    e.secondary ? `${e.secondary.label}: ${abs(e.secondary.url, base)}` : "",
    "—",
    ...footerLines(e, base),
  ].filter(Boolean).join("\n\n");

  return { subject: e.subject, html, text };
}
