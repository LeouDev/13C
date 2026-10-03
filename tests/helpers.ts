import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Secret-key client (bypasses RLS) — stands in for the Next.js server. */
export const service = createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, opts);
export const anon = () => createClient<Database>(url, publishable, opts);

export async function makeUser(tag: string) {
  const email = `${tag}-${crypto.randomUUID().slice(0, 8)}@13c.test`;
  const password = `T3st-${crypto.randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `Test ${tag}` },
  });
  if (error) throw error;
  const client = anon();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user!.id, email, client };
}
export type TestUser = Awaited<ReturnType<typeof makeUser>>;

export function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

/** `offset` days from now at `hour`:00 Manila time, as ISO. */
export function day(offset: number, hour = 10) {
  const d = new Date(Date.now() + offset * 86400000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
  return new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00+08:00`).toISOString();
}

export async function completeRenterProfile(u: TestUser) {
  must(await u.client.from("profiles").update({ phone: "+63 917 000 0000", full_name: "Juan Dela Cruz" }).eq("id", u.id));
  must(await u.client.from("renters").update({
    legal_name: "Juan Dela Cruz", address: "123 Osmeña Blvd, Cebu City", license_number: "G01-23-456789",
  }).eq("user_id", u.id));
}
