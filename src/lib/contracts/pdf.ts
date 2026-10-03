import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { groupFingerprint, isValidSignatureImage } from "@/lib/signature";

export type ContractSection = { key: string; title: string; body: string };
export type ContractSignature = {
  signer_role: "RENTER" | "PROVIDER"; signer_name: string; signature_type: "TYPED" | "DRAWN";
  signature_data: string | null; signed_at: string; ip_address: unknown; content_hash: string;
  signer_email?: string | null; user_agent?: string | null;
};
export type ContractPdfInput = {
  documentId: string; title: string; version: number; reference: string; sections: ContractSection[];
  signatures: ContractSignature[]; contentHash: string; providerName: string; renterName: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "SUPERSEDED" | "CANCELLED";
  /** The rental business's logo for the letterhead (PNG or JPEG only; WebP logos are skipped). */
  providerLogo?: { bytes: Uint8Array; kind: "png" | "jpg" } | null;
  // Signature-certificate evidence (recorded by the server).
  sentAt?: string | null; sentTo?: string | null; viewedAt?: string | null; viewedIp?: string | null; viewedUserAgent?: string | null;
};

const NAVY = rgb(0.07, 0.12, 0.23);
const GRAY = rgb(0.38, 0.42, 0.5);
const RED = rgb(0.88, 0.19, 0.17);
const A4 = { w: 595.28, h: 841.89 };
const M = 56;

/** pdf-lib's standard fonts are WinAnsi: normalise typography and drop anything else. */
export function toWinAnsi(s: string) {
  return s
    .replace(/₱/g, "PHP ").replace(/[‐‑‒–—―]/g, "-").replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[•·]/g, "-").replace(/→/g, "->").replace(/…/g, "...").replace(/ /g, " ").replace(/★/g, "*")
    .replace(/[^\x09\x0a\x0d\x20-\x7e¡-ÿ]/g, "?");
}

// Body text font with the ₱ glyph (listed in outputFileTracingIncludes so it ships with the server code).
const GEIST = path.join(process.cwd(), "src/lib/contracts/fonts/Geist-Regular.ttf");
let geistBytes: Promise<Buffer> | undefined;

const charsets = new WeakMap<PDFFont, Set<number> | null>();
/** Text a font can draw: standard fonts get WinAnsi normalisation; embedded fonts swap unknown glyphs for "?". */
function fit(s: string, font: PDFFont) {
  if (!charsets.has(font)) charsets.set(font, font.name.includes("Geist") ? new Set(font.getCharacterSet()) : null);
  const set = charsets.get(font);
  if (!set) return toWinAnsi(s);
  return Array.from(s.replace(/★/g, "*"), (ch) => (ch === "\n" || set.has(ch.codePointAt(0)!) ? ch : "?")).join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const para of fit(text, font).split("\n")) {
    if (!para.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else { if (line) lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

const fmt = (iso: string, timeStyle: "short" | "medium" = "short") =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle }).format(new Date(iso)) + " (PHT)";

export async function renderContractPdf(c: ContractPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${c.title} — ${c.reference} v${c.version}`);
  pdf.setAuthor(c.providerName);
  pdf.setCreator("13C (technology platform)");
  pdf.setSubject(`Vehicle rental agreement between ${c.providerName} and ${c.renterName}`);
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(await (geistBytes ??= readFile(GEIST)), { subset: true });
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const width = A4.w - M * 2;
  const newPage = () => { page = pdf.addPage([A4.w, A4.h]); y = A4.h - M; };
  const ensure = (h: number) => { if (y - h < M + 24) newPage(); };
  const text = (s: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) => {
    const font = opts.font ?? regular, size = opts.size ?? 9.5, lh = size * 1.45;
    for (const line of wrap(s, font, size, width - (opts.indent ?? 0))) {
      ensure(lh);
      page.drawText(line, { x: M + (opts.indent ?? 0), y: y - size, size, font, color: opts.color ?? NAVY });
      y -= lh;
    }
    y -= opts.gap ?? 0;
  };

  // Header: the rental business's logo as a letterhead, then the title
  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: NAVY });
  if (c.providerLogo) {
    try {
      const img = c.providerLogo.kind === "png" ? await pdf.embedPng(c.providerLogo.bytes) : await pdf.embedJpg(c.providerLogo.bytes);
      const scale = Math.min(140 / img.width, 48 / img.height);
      page.drawImage(img, { x: M, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
      y -= img.height * scale + 16;
    } catch {
      // unreadable image: the agreement is still valid without a letterhead
    }
  }
  text(c.title, { font: bold, size: 18, gap: 2 });
  text(`Booking ${c.reference}  ·  Version ${c.version}  ·  ${c.status === "SIGNED" ? "Signed" : "Not signed"}`, { size: 9, color: GRAY, gap: 10 });
  if (c.status !== "SIGNED") text("DRAFT FOR REVIEW — NOT A SIGNED AGREEMENT", { font: bold, size: 10, color: RED, gap: 8 });

  // Parties box
  const boxTop = y;
  const rows: [string, string][] = [["Rental Provider", c.providerName], ["Renter", c.renterName], ["Technology Platform", "13C — marketplace/SaaS platform; not a party to the rental"]];
  ensure(rows.length * 16 + 16);
  page.drawRectangle({ x: M, y: y - rows.length * 16 - 10, width, height: rows.length * 16 + 10, color: rgb(0.95, 0.96, 0.98) });
  y -= 6;
  for (const [k, v] of rows) {
    page.drawText(k.toUpperCase(), { x: M + 10, y: y - 10, size: 7.5, font: bold, color: GRAY });
    page.drawText(fit(v, regular), { x: M + 130, y: y - 10, size: 9.5, font: regular, color: NAVY });
    y -= 16;
  }
  y = Math.min(y, boxTop - rows.length * 16 - 10) - 16;

  for (const s of c.sections) {
    ensure(40);
    text(s.title, { font: bold, size: 11, gap: 3 });
    text(s.body, { gap: 10 });
  }

  // Signatures
  ensure(160);
  y -= 6;
  text("SIGNATURES", { font: bold, size: 12, gap: 6 });
  for (const role of ["PROVIDER", "RENTER"] as const) {
    const sig = c.signatures.find((x) => x.signer_role === role);
    ensure(110);
    const label = role === "PROVIDER" ? `Rental Provider — ${c.providerName}` : `Renter — ${c.renterName}`;
    text(label, { font: bold, size: 9.5, gap: 4 });
    if (!sig) { text("Not yet signed.", { color: GRAY, gap: 12 }); continue; }
    if (isValidSignatureImage(sig.signature_data)) {
      const png = await pdf.embedPng(Buffer.from(sig.signature_data.split(",")[1]!, "base64"));
      const scale = Math.min(180 / png.width, 50 / png.height);
      ensure(png.height * scale + 6);
      page.drawImage(png, { x: M, y: y - png.height * scale, width: png.width * scale, height: png.height * scale });
      y -= png.height * scale + 4;
    } else {
      ensure(30);
      page.drawText(toWinAnsi(sig.signer_name), { x: M, y: y - 22, size: 22, font: italic, color: NAVY });
      y -= 30;
    }
    page.drawLine({ start: { x: M, y }, end: { x: M + 220, y }, thickness: 0.6, color: GRAY });
    y -= 4;
    text(`${sig.signer_name} · ${sig.signature_type === "DRAWN" ? "drawn" : "typed"} electronic signature · ${fmt(sig.signed_at)}${sig.ip_address ? ` · IP ${String(sig.ip_address)}` : ""}`, { size: 8, color: GRAY, gap: 12 });
  }
  text(`Document fingerprint (SHA-256 of the agreement content): ${c.contentHash}`, { size: 7.5, color: GRAY, gap: 2 });
  text("Executed electronically under Republic Act No. 8792 (Electronic Commerce Act of 2000). Any change requires a new version signed by both parties.", { size: 7.5, color: GRAY });

  // Signature certificate: the audit trail of this exact version.
  if (c.status === "SIGNED") {
    newPage();
    page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: NAVY });
    text("Signature certificate", { font: bold, size: 18, gap: 2 });
    text(`${c.title}  ·  Booking ${c.reference}  ·  Version ${c.version}`, { size: 9, color: GRAY });
    text(`Document ID ${c.documentId}`, { size: 9, color: GRAY, gap: 14 });
    text("DOCUMENT FINGERPRINT (SHA-256 OF THE AGREEMENT TEXT)", { font: bold, size: 7.5, color: GRAY, gap: 3 });
    text(groupFingerprint(c.contentHash), { font: mono, size: 10, gap: 16 });

    const row = (label: string, lines: string[]) => {
      ensure(48);
      page.drawText(label.toUpperCase(), { x: M, y: y - 9, size: 7.5, font: bold, color: GRAY });
      for (const l of lines) text(l, { size: 9, indent: 150 });
      y -= 12;
    };
    const who = (s: ContractSignature) => `${s.signer_name}${s.signer_email ? ` · ${s.signer_email}` : ""}`;
    const where = (at: string, ip: unknown) => `${fmt(at, "medium")}${ip ? ` · IP ${String(ip)}` : ""}`;
    const browser = (ua?: string | null) => (ua ? [`Browser: ${ua}`] : []);
    const provider = c.signatures.find((s) => s.signer_role === "PROVIDER");
    const renter = c.signatures.find((s) => s.signer_role === "RENTER");

    if (provider) row("Signed by Rental Provider", [who(provider), where(provider.signed_at, provider.ip_address), `${provider.signature_type === "DRAWN" ? "Drawn" : "Typed"} signature`, ...browser(provider.user_agent)]);
    if (c.sentAt) row("Sent for signature", [`To ${c.sentTo ?? c.renterName}`, fmt(c.sentAt, "medium")]);
    if (c.viewedAt) row("Opened by Renter", [where(c.viewedAt, c.viewedIp), ...browser(c.viewedUserAgent)]);
    if (renter) row("Signed by Renter", [who(renter), where(renter.signed_at, renter.ip_address), `${renter.signature_type === "DRAWN" ? "Drawn" : "Typed"} signature`, ...browser(renter.user_agent)]);

    y -= 6;
    text("All times are Philippine Standard Time (UTC+8). IP addresses and browsers were recorded by the server from each request, not entered by the signers. Both signatures apply to the fingerprint above; any change to the agreement produces a different fingerprint and needs a new version signed by both parties.", { size: 7.5, color: GRAY });
  }

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(fit(`${c.reference} v${c.version}  ·  Prepared via 13C  ·  Page ${i + 1} of ${pages.length}`, regular), { x: M, y: 28, size: 7.5, font: regular, color: GRAY });
  });
  return pdf.save();
}
