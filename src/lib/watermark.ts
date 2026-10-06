import "server-only";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { toWinAnsi } from "@/lib/contracts/pdf";

/** The file's kind, by its first bytes (not its name). */
export function sniff(bytes: Uint8Array) {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

/**
 * A license or ID as a PDF with `text` repeated diagonally across every page (a photo becomes a one-page PDF), so a copy
 * is no use for anything else. Null for other kinds of files (renters' photos are uploaded as JPEG: lib/upload.ts).
 */
export async function watermark(bytes: Uint8Array, text: string): Promise<Uint8Array | null> {
  const kind = sniff(bytes);
  if (!kind) return null;
  const pdf = kind === "pdf" ? await PDFDocument.load(bytes, { ignoreEncryption: true }) : await PDFDocument.create();
  if (kind !== "pdf") {
    const img = kind === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    pdf.addPage([img.width, img.height]).drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tile = `${toWinAnsi(text)}     `;
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(9, Math.min(width, height) / 28);
    const line = tile.repeat(Math.ceil((2 * (width + height)) / font.widthOfTextAtSize(tile, size)));
    // Rows climbing at 30° from well left of the page, close enough together that no part of the document is left clear.
    for (let y = -(width + height); y < height; y += size * 4) {
      page.drawText(line, { x: -height, y, size, font, color: rgb(0.78, 0.1, 0.1), opacity: 0.35, rotate: degrees(30) });
    }
  }
  return pdf.save();
}
