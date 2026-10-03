import { execFileSync } from "node:child_process";

/**
 * Integration tests run against the linked Supabase project with throwaway users
 * (`*@13c.test`). Signed contracts are immutable by design, so teardown removes the
 * test data with triggers disabled via the Supabase CLI (postgres role).
 */
export function teardown() {
  if (process.env.KEEP_TEST_DATA) return;
  try {
    execFileSync("supabase", ["db", "query", "--linked", "-f", "tests/cleanup.sql"], {
      stdio: "pipe",
      env: { ...process.env, SUPABASE_NO_UPDATE_CHECK: "1" },
    });
  } catch (e) {
    console.warn("Test cleanup failed — run `supabase db query --linked -f tests/cleanup.sql`", (e as Error).message);
  }
}
