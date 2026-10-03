import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DOT, SPEED_LINES, SWASH, WORDMARK } from "@/components/brand/logo-paths";
import { SITE_URL } from "@/lib/constants";

// Share images are PNG: Messenger, Viber and LinkedIn previews don't reliably show WebP.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const NAVY = "#121f3b";
const NAVY_DEEP = "#0a1430";
const CREAM = "#f2eee6";
const RED = "#e0312b";
const CYAN = "#22d3ee";

// Geist ships with the contract PDFs (traced into every route by next.config) and has the ₱ sign.
const geist = readFile(join(process.cwd(), "src/lib/contracts/fonts/Geist-Regular.ttf"));

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * An uploaded image as a data URL next/og can draw. It can't decode WebP (every uploaded photo is WebP), so the
 * image goes through the image optimizer, which answers a client that doesn't take WebP with JPEG.
 * Null when that fails or is slow; the card then goes without it.
 */
async function drawable(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(`${SITE_URL}/_next/image?url=${encodeURIComponent(url)}&w=828&q=75`, {
      headers: { Accept: "image/jpeg,image/png" },
      signal: AbortSignal.timeout(6000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

function Mark({ width }: { width: number }) {
  return (
    <svg width={width} height={Math.round((width * 340) / 1100)} viewBox="-700 -170 1100 340">
      {SPEED_LINES.map((s) => <rect key={s.y} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.h / 2} fill={s.accent ? RED : CREAM} />)}
      <path d={WORDMARK} fill={CREAM} />
      <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill={RED} />
      <path d={SWASH} fill={RED} />
    </svg>
  );
}

function LogoTile({ src, size }: { src: string; size: number }) {
  return (
    <div style={{ display: "flex", width: size, height: size, borderRadius: size / 4, background: "#ffffff", padding: size / 13 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og, not the browser */}
      <img src={src} alt="" width={size - (2 * size) / 13} height={size - (2 * size) / 13} style={{ objectFit: "contain", borderRadius: size / 5 }} />
    </div>
  );
}

/**
 * A 1200×630 share card: the 13C mark, a title, detail lines and the page's address, with the photo on the right
 * (a car's main photo, a store's cover) and the store's logo when there is one.
 */
export async function shareCard({ title, lines = [], address, photo, logo }: {
  title: string; lines?: string[]; address: string; photo?: string | null; logo?: string | null;
}) {
  const [photoSrc, logoSrc] = await Promise.all([drawable(photo), drawable(logo)]);
  const wide = !photoSrc;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`, color: CREAM, fontFamily: "Geist" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: wide ? "56px 64px 64px" : "56px 40px 64px 64px", width: wide ? 1200 : 640 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Mark width={wide ? 380 : 320} />
            {wide && logoSrc && <LogoTile src={logoSrc} size={132} />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: wide ? 64 : 56, lineHeight: 1.08, letterSpacing: -1 }}>{clip(title, wide ? 70 : 40)}</div>
            {lines.map((l) => <div key={l} style={{ fontSize: wide ? 30 : 28, color: "rgba(242,238,230,0.75)" }}>{clip(l, wide ? 64 : 36)}</div>)}
          </div>
          <div style={{ fontSize: wide ? 28 : 26, color: CYAN }}>{clip(address, wide ? 60 : 40)}</div>
        </div>
        {photoSrc && (
          <div style={{ display: "flex", position: "relative", width: 560, height: 630 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og, not the browser */}
            <img src={photoSrc} alt="" width={560} height={630} style={{ objectFit: "cover" }} />
            <div style={{ position: "absolute", top: 0, left: 0, width: 140, height: 630, background: `linear-gradient(90deg, ${NAVY_DEEP}, rgba(10,20,48,0))` }} />
            {logoSrc && <div style={{ display: "flex", position: "absolute", top: 40, right: 40 }}><LogoTile src={logoSrc} size={104} /></div>}
          </div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: RED }} />
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: "Geist", data: await geist, weight: 400, style: "normal" }] },
  );
}
