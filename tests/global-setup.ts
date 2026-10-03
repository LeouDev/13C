import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

/** Recursively removes every file under `prefix` via the Storage API (folders have no id). */
async function removePrefix(storage: ReturnType<typeof createClient>["storage"], bucket: string, prefix: string) {
  const { data } = await storage.from(bucket).list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) files.push(path);
    else await removePrefix(storage, bucket, path);
  }
  if (files.length) await storage.from(bucket).remove(files);
}

/**
 * Integration tests run against the linked Supabase project with throwaway users (`*@13c.test`).
 * Teardown deletes their files through the Storage API, then their rows via tests/cleanup.sql
 * (run by the Supabase CLI as postgres, because signed contracts are immutable for every API role).
 */
export async function teardown() {
  if (process.env.KEEP_TEST_DATA) return;
  try {
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    const { data: users } = await service.from("profiles").select("id").like("email", "%@13c.test");
    const userIds = (users ?? []).map((u) => u.id as string);
    const { data: biz } = userIds.length ? await service.from("businesses").select("id").in("owner_id", userIds) : { data: [] };
    for (const { id } of (biz ?? []) as { id: string }[]) {
      await removePrefix(service.storage, "media", `b/${id}`);
      await removePrefix(service.storage, "business-docs", id);
      await removePrefix(service.storage, "contracts", id);
    }
    for (const id of userIds) {
      await removePrefix(service.storage, "kyc", id);
      await removePrefix(service.storage, "media", `u/${id}`);
    }
    const out = execFileSync("supabase", ["db", "query", "--linked", "-f", "tests/cleanup.sql"], {
      stdio: "pipe", env: { ...process.env, SUPABASE_NO_UPDATE_CHECK: "1" },
    }).toString();
    if (!/"orphans":\s*0/.test(out) || !/"remaining_test_users":\s*0/.test(out)) {
      console.warn("Test cleanup left data behind:\n", out);
    }
  } catch (e) {
    console.warn("Test cleanup failed — run `npm run db:cleanup-tests`", (e as Error).message);
  }
}
