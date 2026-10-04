import { createAdminClient } from "@/lib/supabase/admin";

/**
 * For uptime monitors: 200 when the site and its database answer, 503 when the database doesn't.
 * The checks also keep the Supabase free plan from pausing the project for inactivity.
 */
export async function GET() {
  const { error } = await createAdminClient().from("businesses").select("id", { head: true }).limit(1);
  if (error) console.error("[health]", error.message);
  return Response.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
