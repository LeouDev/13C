import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation / magic-link / password-reset landing (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // Opened in another browser/device: Supabase already confirmed the email, but the PKCE
  // verifier cookie lives where the user signed up — so ask them to sign in here.
  return NextResponse.redirect(`${origin}/login?confirmed=1&next=${encodeURIComponent(next)}`);
}
