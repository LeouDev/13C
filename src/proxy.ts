import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/admin", "/account", "/register/business"];
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "13c.ph";

/**
 * Storefront host routing (designed, off by default):
 *  - `cebu-xyz.13c.ph` → `/cebu-xyz/...` when STOREFRONT_SUBDOMAINS=1
 *  - custom domains → look up business_storefronts.custom_domain (future; needs a cached lookup)
 */
export function resolveStorefrontHost(host: string | null): string | null {
  if (!host || process.env.STOREFRONT_SUBDOMAINS !== "1") return null;
  const hostname = host.split(":")[0]!.toLowerCase();
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    if (sub && sub !== "www" && !sub.includes(".")) return sub;
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const storeSlug = resolveStorefrontHost(request.headers.get("host"));
  const makeResponse = () => {
    if (!storeSlug) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = `/${storeSlug}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url, { request });
  };
  let response = makeResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = makeResponse();
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refreshes the session cookie when needed. Optimistic gate only — pages re-check with getUser().
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|woff2)$).*)"],
};
