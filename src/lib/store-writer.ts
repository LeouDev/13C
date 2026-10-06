import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_METHODS, POLICY_FIELDS } from "@/lib/constants";
import { formatPHP } from "@/lib/format";
import { workersAI } from "@/lib/workers-ai";
import type { Database } from "@/types/database";

// "Write with AI" in the store editor: drafts store text from what 13C knows about the business.
// Drafts go into the form unsaved, so the owner checks them before anything is published.

type PolicyKey = (typeof POLICY_FIELDS)[number]["key"];
export type StoreTextField = "tagline" | "about" | PolicyKey;
export type Faq = { q: string; a: string };
type Hours = { day: string; open: string; close: string; closed: boolean };

const RULES = `You write text for a car-rental business's own store page on 13C, a booking website for car-rental businesses in Cebu, Philippines. The owner checks your text before publishing it.

Rules:
- Use only the facts given. Never invent anything else: no years in business, awards, customer numbers, insurance, guarantees, discounts, prices, fees or times that aren't in the facts.
- Write as the business ("we", "us", "our"), never "the business". Don't mention 13C unless it's about the renter's 13C account.
- Always write in English, the language of the store and the rental agreement. If the owner's draft is in Tagalog, Cebuano or Taglish, translate it.
- Plain text only: no markdown, headings, bold, emoji, hashtags or quotation marks around the text. Reply with only the text asked for, without any introduction or notes.
- Write amounts like ₱1,500.`;

// What each policy covers, minus what the rental agreement's other sections already say (the template and contract_vars).
const POLICY_HINTS: Record<PolicyKey, string> = {
  requirements: "what renters must have or meet to rent, such as a valid driver's license, a government ID and a minimum age.",
  fuel: "the fuel level at pickup and return, and the charge when the car comes back with less fuel.",
  mileage: "general notes on mileage, such as how distance is measured (odometer readings at pickup and return). The agreement already states each car's own allowance and excess-km fee, so don't repeat those.",
  late_return: "the grace period and the charges for returning the car late.",
  cancellation: "what is refunded or charged when the renter cancels, depending on how long before pickup, and for no-shows.",
  deposit: "when and how the security deposit is returned. The agreement already says it's paid on or before pickup, states the amount and lists what may be deducted, so don't repeat or change those.",
  prohibited: "extra rules for using the car, such as no smoking, no pets or no eating inside. The agreement already forbids unlicensed drivers, drunk driving, racing, off-road use, leaving Cebu island without consent and sub-leasing, so don't repeat those.",
  other: "other practical terms, such as cleaning fees, lost keys or extending the rental. The agreement already covers the car's condition, damage, accidents, traffic violations, insurance and disputes, so don't write about those.",
};

function task(field: StoreTextField) {
  if (field === "tagline") return "Write a tagline for the store: one line under 70 characters that says what the business offers and where. Don't include the business name.";
  if (field === "about") return 'Write the store\'s "About us" text: 2 short paragraphs, 60 to 120 words in total. Introduce the business, what it rents (name a few of the car models, and say self-drive or with a driver) and where (pickup and delivery areas). End with one short sentence inviting renters to book online. Don\'t explain the booking steps or list every car or price.';
  const label = POLICY_FIELDS.find((p) => p.key === field)!.label;
  return `Write the store's "${label}" policy: ${POLICY_HINTS[field]} Use 1 to 3 short, clear sentences. It shows on the store and goes into the rental agreement for every car, so don't name specific cars or mention the agreement. If it needs an amount, time or age that isn't in the facts, write ___ in its place for the owner to fill in.`;
}

/**
 * What the AI may say about the business, from what its store shows (also used by the store's assistant for renters).
 * `skip` leaves out the field being written, so its saved text doesn't compete with the owner's draft.
 */
export async function storeFacts(supabase: SupabaseClient<Database>, businessId: string, skip?: StoreTextField | "faqs") {
  const [{ data: b }, { data: s }, { data: cars }, { data: methods }] = await Promise.all([
    supabase.from("businesses").select("name, city, province, description, turnaround_hours, down_payment_percent, down_payment_hours").eq("id", businessId).single(),
    supabase.from("business_storefronts").select("tagline, about, policies, faqs, pickup_locations, delivery_areas, business_hours").eq("business_id", businessId).single(),
    supabase.from("vehicles")
      .select("make, model, variant, year, status, vehicle_categories(label), seats, transmission, fuel_type, self_drive, with_driver, delivery_available, min_rental_days, vehicle_pricing(daily_rate, weekly_rate, monthly_rate, security_deposit, mileage_limit_km, excess_km_fee, delivery_fee, driver_fee_per_day)")
      .eq("business_id", businessId).is("deleted_at", null).neq("status", "INACTIVE").order("created_at").limit(30),
    supabase.from("payment_methods").select("method").eq("business_id", businessId).eq("is_enabled", true),
  ]);
  if (!b || !s) return null;

  const car = (c: NonNullable<typeof cars>[number]) => {
    const p = c.vehicle_pricing;
    return "- " + [
      `${c.year} ${c.make} ${c.model}${c.variant ? ` ${c.variant}` : ""} (${c.vehicle_categories?.label ?? "car"}, ${c.seats} seats, ${c.transmission.toLowerCase()}, ${c.fuel_type.toLowerCase()})`,
      p && [`${formatPHP(p.daily_rate)}/day`, p.weekly_rate && `${formatPHP(p.weekly_rate)}/week`, p.monthly_rate && `${formatPHP(p.monthly_rate)}/month`].filter(Boolean).join(", "),
      p && (p.security_deposit ? `security deposit ${formatPHP(p.security_deposit)}` : "no security deposit"),
      p && (p.mileage_limit_km ? `${p.mileage_limit_km} km/day included${p.excess_km_fee ? `, then ${formatPHP(p.excess_km_fee)}/km` : ""}` : "unlimited mileage"),
      [c.self_drive && "self-drive", c.with_driver && `with a driver${p?.driver_fee_per_day ? ` (${formatPHP(p.driver_fee_per_day)}/day)` : ""}`].filter(Boolean).join(" or "),
      c.delivery_available && (p?.delivery_fee ? `delivery ${formatPHP(p.delivery_fee)}` : "delivery available"),
      c.min_rental_days > 1 && `minimum ${c.min_rental_days} days`,
      c.status !== "ACTIVE" && "can't be booked right now",
    ].filter(Boolean).join("; ");
  };
  const policies = (s.policies ?? {}) as Record<string, string>;
  const written = POLICY_FIELDS.filter((f) => f.key !== skip && policies[f.key]?.trim()).map((f) => `- ${f.label}: ${policies[f.key]!.trim()}`);
  const faqs = skip === "faqs" ? [] : ((s.faqs ?? []) as Faq[]).map((f) => `- Q: ${f.q} A: ${f.a}`);
  const hours = ((s.business_hours ?? []) as Hours[]).map((h) => `${h.day} ${h.closed ? "closed" : `${h.open}–${h.close}`}`).join(", ");

  return [
    `Business name: ${b.name}`,
    `Based in: ${b.city}, ${b.province}`,
    b.description && `The owner's description of the business: ${b.description}`,
    skip !== "tagline" && s.tagline && `Store tagline: ${s.tagline}`,
    skip !== "about" && s.about && `Store "About us" text: ${s.about}`,
    cars?.length ? `Cars (${cars.length}):\n${cars.map(car).join("\n")}` : "Cars: none added yet.",
    s.pickup_locations.length > 0 && `Pickup locations: ${s.pickup_locations.join("; ")}`,
    s.delivery_areas.length > 0 && `Delivery areas: ${s.delivery_areas.join("; ")}`,
    hours && `Business hours: ${hours}`,
    methods?.length && `Payment methods: ${methods.map((m) => {
      const label = PAYMENT_METHODS.find((x) => x.value === m.method)?.label ?? m.method;
      return m.method === "GCASH" || m.method === "MAYA" ? label : label.toLowerCase(); // brand names keep their capitals
    }).join(", ")}`,
    b.turnaround_hours > 0 && `Time kept free between rentals for cleaning and checks: ${b.turnaround_hours} hours`,
    b.down_payment_percent > 0 && `Down payment: ${b.down_payment_percent}% of the total, sent to us within ${b.down_payment_hours} hours after we approve a booking (the rental agreement follows once we receive it); bookings without it are cancelled`,
    written.length > 0 && `Rental policies:\n${written.join("\n")}`,
    faqs.length > 0 && `FAQs on the store:\n${faqs.join("\n")}`,
    `How renting works (the same on every 13C store):
- Renters pick a car and dates and send a booking request, or message the business first.
- Before booking, renters upload their driver's license (front and back) and a government ID to their 13C account. Only the business they book with sees them.
- The business approves the request; the renter then signs the rental agreement online and gets the signed PDF by email.
- Renters pay the business directly, with the payment methods above.`,
  ].filter(Boolean).join("\n");
}

async function complete(prompt: string, maxTokens: number) {
  const res = await workersAI([{ role: "system", content: RULES }, { role: "user", content: prompt }], { maxTokens });
  const body: unknown = await res?.json().catch(() => null);
  const text = (body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text;
  if (res) console.error("[ai] no text in the reply", JSON.stringify(body)?.slice(0, 300));
  return null;
}

/** A draft for one field, or null when the AI couldn't write one. A non-empty `draft` (the owner's text so far) is improved, not replaced. */
export async function draftStoreText(supabase: SupabaseClient<Database>, businessId: string, field: StoreTextField, draft: string) {
  const facts = await storeFacts(supabase, businessId, field);
  if (!facts) return null;
  const ask = draft.trim()
    ? `${task(field)}\n\nThe owner has written this draft:\n"""\n${draft.trim()}\n"""\nImprove it: fix spelling and grammar and make it clear and friendly. Keep every fact, amount and rule in it, and don't add new ones.`
    : task(field);
  const text = await complete(`Facts:\n${facts}\n\n${ask}`, field === "tagline" ? 60 : field === "about" ? 400 : 250);
  return text && cleanText(text, field === "tagline" ? 140 : field === "about" ? 5000 : 1500, field === "tagline");
}

/** Up to 5 FAQs the store doesn't have yet, answered from the facts. null when the AI couldn't write them. */
export async function suggestFaqs(supabase: SupabaseClient<Database>, businessId: string, questions: string[]) {
  const facts = await storeFacts(supabase, businessId, "faqs");
  if (!facts) return null;
  const have = questions.filter((q) => q.trim()).map((q) => `- ${q.trim()}`).join("\n");
  const text = await complete(`Facts:\n${facts}

Write 5 questions renters often ask a car-rental business, each with this business's answer in 1 to 3 short sentences. Answer only from the facts, and skip questions the facts can't answer. Don't quote rates or fees: they change, and each car's page shows them.${have ? `\nThe store already has these questions, so don't repeat them:\n${have}` : ""}
Format each one exactly like this, with a blank line between them:
Q: the question
A: the answer`, 900);
  if (!text) return null;
  const seen = new Set(questions.map((q) => q.trim().toLowerCase()));
  return parseFaqs(text).filter((f) => !seen.has(f.q.toLowerCase())).slice(0, 5);
}

/** The AI's reply as field text: no bold markers or wrapping quotes, within the field's length (cut at a word). */
export function cleanText(text: string, max: number, oneLine = false) {
  let t = text.replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (oneLine) t = t.split("\n")[0]!.trim();
  if (/^["“][^"“”]*["”]$/.test(t)) t = t.slice(1, -1).trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") : t;
}

/** "Q: … / A: …" pairs from the AI's reply. Tolerates numbering, "Question:"/"Answer:" and answers over several lines. */
export function parseFaqs(text: string): Faq[] {
  const faqs: Faq[] = [];
  for (const raw of text.replace(/\*\*/g, "").split("\n")) {
    const line = raw.trim();
    const q = line.match(/^(?:\d+[.)]\s*)?(?:Q|Question)\s*\d*\s*[:.]\s*(.+)/i);
    const a = line.match(/^(?:A|Answer)\s*\d*\s*[:.]\s*(.+)/i);
    if (q) faqs.push({ q: q[1]!, a: "" });
    else if (a && faqs.length) faqs.at(-1)!.a = a[1]!;
    else if (line && faqs.at(-1)?.a) faqs.at(-1)!.a += ` ${line}`;
  }
  return faqs.filter((f) => f.q.length >= 3 && f.a).map((f) => ({ q: f.q.slice(0, 200), a: f.a.slice(0, 1500) }));
}
