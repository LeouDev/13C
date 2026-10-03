import { ImageResponse } from "next/og";
import { DOT, SWASH, WORDMARK } from "@/components/brand/logo-paths";

export const dynamic = "force-static";

/** 13C wordmark on navy as a PNG — email clients don't render SVG. Displayed at 132×58 (4× density). */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#121f3b" }}>
        <svg viewBox="-385 -152 790 350" width="528" height="234">
          <path d={WORDMARK} fill="#f2eee6" />
          <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="#e0312b" />
          <path d={SWASH} fill="#e0312b" />
        </svg>
      </div>
    ),
    { width: 528, height: 234, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
