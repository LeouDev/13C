import type { MetadataRoute } from "next";

/** Name and icons for "Add to Home Screen" / installing 13C (icons made from public/brand/13c-badge.webp). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "13C",
    short_name: "13C",
    description: "Find and book cars from local Cebu rental businesses.",
    start_url: "/",
    display: "standalone",
    background_color: "#121f3d",
    theme_color: "#ffffff", // status bar in app mode, like the header
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
