import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/account", "/api", "/auth", "/notifications", "/register", "/login", "/signup", "/*/book"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
