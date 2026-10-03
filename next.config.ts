import type { NextConfig } from "next";

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co").hostname;
// Same fallback as SITE_URL in src/lib/constants.ts.
const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));

// Report-only for now: browsers report what this would block to /api/csp-report, nothing is blocked.
// Next's inline scripts need 'unsafe-inline' (nonces would make every page dynamic); dev also needs eval.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "frame-src 'self' https://challenges.cloudflare.com", // Turnstile bot check on the auth forms
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      // Share cards, served to link previews as JPEG (src/lib/share-card.ts).
      { protocol: site.protocol === "http:" ? "http" : "https", hostname: site.hostname, port: site.port, pathname: "/api/share-card/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Contract PDFs are rendered in API routes and server actions; ship the ₱-capable font with all of them.
  outputFileTracingIncludes: { "/*": ["src/lib/contracts/fonts/*.ttf"] },
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon.svg", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
          { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
        ],
      },
    ];
  },
};

export default nextConfig;
