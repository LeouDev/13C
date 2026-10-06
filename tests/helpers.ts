import { createHmac } from "node:crypto";
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

export const makeUser = (tag: string) => makeUserWithEmail(tag, `${tag}-${crypto.randomUUID().slice(0, 8)}@13c.test`);

/** Only for tests that make Supabase Auth itself send an email: use Resend's test inbox (delivered+…@resend.dev), and delete the user afterwards. */
export async function makeUserWithEmail(tag: string, email: string) {
  const password = `T3st-${crypto.randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `Test ${tag}` },
  });
  if (error) throw error;
  // Sign in with the secret key, which Supabase exempts from the sign-in bot check (CAPTCHA), then hand the session
  // to an ordinary client so the test acts as this user.
  const signIn = await createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, opts).auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const client = anon();
  const session = await client.auth.setSession(signIn.data.session);
  if (session.error) throw session.error;
  return { id: data.user!.id, email, password, client };
}

/** A fresh password sign-in for the user, as its own client (with two-step sign-in on, this session is only aal1). */
export async function signInAgain(u: { email: string; password: string }) {
  const signIn = await createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, opts).auth.signInWithPassword({ email: u.email, password: u.password });
  if (signIn.error) throw signIn.error;
  const client = anon();
  const session = await client.auth.setSession(signIn.data.session);
  if (session.error) throw session.error;
  return client;
}

/** The authenticator app's current 6-digit code for a base32 TOTP secret (RFC 6238: SHA-1, 30 seconds). */
export function totp(secret: string, at = Date.now()) {
  const bits = [...secret.replace(/=+$/, "").toUpperCase()].map((c) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const offset = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
export type TestUser = Awaited<ReturnType<typeof makeUserWithEmail>>;

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

export const RENTER_DOCS = ["DRIVERS_LICENSE_FRONT", "DRIVERS_LICENSE_BACK", "GOVERNMENT_ID"] as const;

/** Profile details and, unless `documents: false`, the license (front/back) and ID records booking requires. */
export async function completeRenterProfile(u: TestUser, { documents = true } = {}) {
  must(await u.client.from("profiles").update({ phone: "+63 917 000 0000", full_name: "Juan Dela Cruz" }).eq("id", u.id));
  must(await u.client.from("renters").update({
    legal_name: "Juan Dela Cruz", address: "123 Osmeña Blvd, Cebu City", license_number: "G01-23-456789",
  }).eq("user_id", u.id));
  if (!documents) return;
  const have = new Set(must(await u.client.from("driver_documents").select("doc_type").eq("user_id", u.id)).map((d) => d.doc_type));
  const missing = RENTER_DOCS.filter((t) => !have.has(t)).map((doc_type) => ({ user_id: u.id, doc_type, storage_path: `${u.id}/${doc_type.toLowerCase()}.png` }));
  if (missing.length) must(await u.client.from("driver_documents").insert(missing).select("id"));
}

/** 1×1 PNG as a signature image (what the signature pad sends). */
export const SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
