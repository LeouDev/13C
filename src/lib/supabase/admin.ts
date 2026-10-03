import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Secret-key client. Bypasses RLS — only for actions that the database restricts to the
 * server (contract signatures with request IP, signed PDF storage). Always verify the
 * caller with auth.getUser() first and pass their id explicitly.
 */
export function createAdminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
