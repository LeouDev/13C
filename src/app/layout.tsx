import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, Kanit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/constants";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});
const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "13C — Find and book cars from local Cebu rental businesses", template: "%s · 13C" },
  description:
    "Discover trusted local rental businesses in Cebu, compare vehicles, and book directly. Self-drive and with-driver cars in Cebu City, Mactan, Lapu-Lapu, Mandaue and Talisay.",
  applicationName: "13C",
  openGraph: { siteName: "13C", type: "website", locale: "en_PH" }, // image: app/opengraph-image.tsx
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#121f3b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${kanit.variable} ${barlow.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
