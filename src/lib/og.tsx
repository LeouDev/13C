import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DOT, SPEED_LINES, SWASH, WORDMARK } from "@/components/brand/logo-paths";

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

/** next/og draws PNG and JPEG but not WebP (car photos and covers are WebP), so a card can carry the store's logo. */
const drawable = (url: string | null | undefined) => (url && /\.(png|jpe?g)$/i.test(url) ? url : null);

/** A 1200×630 share card: the 13C mark, a title, detail lines, the page's address, and the store's logo when it has one. */
export async function shareCard({ title, lines = [], address, logo }: {
  title: string; lines?: string[]; address: string; logo?: string | null;
}) {
  const logoUrl = drawable(logo);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px 64px", background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`, color: CREAM, fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Mark width={380} />
          {logoUrl && (
            <div style={{ display: "flex", width: 132, height: 132, borderRadius: 32, background: "#ffffff", padding: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og, not the browser */}
              <img src={logoUrl} alt="" width={112} height={112} style={{ width: 112, height: 112, objectFit: "contain", borderRadius: 24 }} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 1040 }}>
          <div style={{ fontSize: 64, lineHeight: 1.08, letterSpacing: -1 }}>{clip(title, 70)}</div>
          {lines.map((l) => <div key={l} style={{ fontSize: 30, color: "rgba(242,238,230,0.75)" }}>{clip(l, 64)}</div>)}
        </div>
        <div style={{ fontSize: 28, color: CYAN }}>{clip(address, 60)}</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: RED }} />
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: "Geist", data: await geist, weight: 400, style: "normal" }] },
  );
}
