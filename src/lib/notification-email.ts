import "server-only";
import { PDFDocument } from "pdf-lib";
import { EMAILS, renderAppEmail, type EmailData, type EmailKey } from "@/emails";
import type { EmailTemplate } from "@/emails/templates";
import { dueKm, dueOn } from "@/lib/fleet";
import { formatDate, formatDateTime, formatPHP, labelize } from "@/lib/format";
import { emailEnabled, sendEmail } from "@/lib/mailer";
import { isValidSignatureImage } from "@/lib/signature";
import { mediaUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/** A notifications row as returned by claim_notification_emails(). */
export type OutboxRow = {
  id: string; user_id: string; business_id: string | null; type: string; title: string; body: string | null;
  link: string | null; email: string; full_name: string | null; attempts: number;
};

const BOOKING = /\/bookings\/([0-9a-f-]{36})/;
const CONVERSATION = /\/messages\/([0-9a-f-]{36})/;
const ADMIN_BUSINESS = /^\/admin\/businesses\/([0-9a-f-]{36})/;

/** Template for a notification. When a type has one template per audience, the link decides who it's for. */
export function templateFor(type: string, link: string | null): EmailKey | null {
  const audience = link?.startsWith("/admin") ? "Admin" : link?.startsWith("/dashboard") ? "Business" : "Renter";
  const all = EMAILS as Record<EmailKey, EmailTemplate>;
  const keys = (Object.keys(all) as EmailKey[]).filter((k) => all[k].notificationType === type);
  return keys.find((k) => all[k].audience === audience) ?? keys[0] ?? null;
}

type Vehicle = { year: number | null; make: string; model: string; variant: string | null } | null;
const vehicleName = (v: Vehicle) => (v ? [v.year, v.make, v.model, v.variant].filter(Boolean).join(" ") : undefined);
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function addBooking(d: EmailData, bookingId: string) {
  const admin = createAdminClient();
  const { data: b } = await admin.from("bookings")
    .select("id, reference, business_id, pickup_at, return_at, pickup_location, return_location, total_amount, security_deposit, payment_method, conversation_id, cancel_reason, down_payment_amount, down_payment_due_at, down_payment_reference, payments(amount), vehicles(year, make, model, variant), renter:profiles!bookings_renter_id_fkey(full_name), contracts(current_version, contract_versions(id, version)), booking_status_history(to_status, note, created_at)")
    .eq("id", bookingId).maybeSingle();
  if (!b) return;
  const current = b.contracts?.contract_versions.find((v) => v.version === b.contracts?.current_version);
  const lastNote = [...b.booking_status_history].sort((x, y) => y.created_at.localeCompare(x.created_at))
    .find((h) => h.note && (h.to_status === "REJECTED" || h.to_status === "CANCELLED"))?.note;
  Object.assign(d, {
    bookingId: b.id, reference: b.reference, vehicle: vehicleName(b.vehicles),
    pickup: formatDateTime(b.pickup_at), return: formatDateTime(b.return_at),
    pickupLocation: b.pickup_location ?? undefined, returnLocation: b.return_location ?? undefined,
    total: formatPHP(b.total_amount), deposit: Number(b.security_deposit) > 0 ? formatPHP(b.security_deposit) : undefined,
    paymentMethod: labelize(b.payment_method), conversationId: b.conversation_id ?? undefined,
    customerName: b.renter?.full_name ?? undefined, versionId: current?.id, version: current?.version,
    reason: b.cancel_reason ?? lastNote ?? undefined,
    downPayment: Number(b.down_payment_amount) > 0 ? formatPHP(b.down_payment_amount) : undefined,
    downPaymentDue: b.down_payment_due_at ? formatDateTime(b.down_payment_due_at) : undefined,
    downPaymentReference: b.down_payment_reference ?? undefined,
  } satisfies EmailData);

  const { data: pm } = await admin.from("payment_methods").select("account_name, account_number, instructions")
    .eq("business_id", b.business_id).eq("method", b.payment_method).eq("is_enabled", true).maybeSingle();
  const to = [pm?.account_number, pm?.account_name && `(${pm.account_name})`].filter(Boolean).join(" ");
  const extra = pm?.instructions ? ` ${pm.instructions}` : "";
  const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const owed = paid > 0 ? `the remaining ${formatPHP(Math.max(0, Number(b.total_amount) - paid))}` : d.total;
  d.paymentInstructions = paid >= Number(b.total_amount) ? "Paid in full."
    : b.payment_method === "CASH" ? `Pay ${owed} in cash at pickup.${extra}`
    : `Send ${owed} via ${d.paymentMethod}${to ? ` to ${to}` : ""} before pickup.${extra}`;
  if (d.downPayment) {
    d.downPaymentInstructions = b.payment_method === "CASH"
      ? `Pay ${d.downPayment} in cash to ${d.businessName ?? "the business"} by ${d.downPaymentDue}.${extra}`
      : `Send ${d.downPayment} via ${d.paymentMethod}${to ? ` to ${to}` : ""} by ${d.downPaymentDue}.${extra}`;
  }
}

async function addConversation(d: EmailData, conversationId: string, n: OutboxRow) {
  const { data: c } = await createAdminClient().from("conversations")
    .select("id, customer:profiles!conversations_customer_id_fkey(full_name), vehicles(year, make, model, variant)")
    .eq("id", conversationId).maybeSingle();
  d.conversationId = conversationId;
  d.customerName = c?.customer?.full_name ?? "A customer";
  d.vehicle ??= vehicleName(c?.vehicles ?? null);
  // Business-side bodies read "Name: message"; the template shows the name separately.
  const body = n.body ?? "";
  d.message = body.startsWith(`${d.customerName}: `) ? body.slice(d.customerName.length + 2) : body;
}

/** The signed agreement as an attachment, once the signing flow has stored it (it never renders a second copy). */
async function signedPdf(versionId: string | undefined, reference: string | undefined) {
  if (!versionId) return undefined;
  const admin = createAdminClient();
  for (let i = 0; i < 4; i++) {
    const { data: v } = await admin.from("contract_versions").select("status, version, pdf_path").eq("id", versionId).maybeSingle();
    if (v?.status !== "SIGNED") return undefined;
    if (v.pdf_path) {
      const { data: file } = await admin.storage.from("contracts").download(v.pdf_path);
      if (!file) return undefined;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pages = await PDFDocument.load(bytes, { updateMetadata: false }).then((p) => p.getPageCount(), () => undefined);
      return { filename: `${reference ?? "13C-agreement"}-v${v.version}-signed.pdf`, content: Buffer.from(bytes).toString("base64"), pages };
    }
    await pause(2000);
  }
  return undefined; // the email still links to the download
}

/** Everything due now or soon across the business's cars, overdue first (same rules as the Fleet page). */
async function addFleetItems(d: EmailData, businessId: string) {
  const { data } = await createAdminClient().from("vehicle_fleet")
    .select("registration_expires_on, insurance_expires_on, next_service_on, next_service_km, odometer_km, vehicles!inner(make, model, plate_number, deleted_at)")
    .eq("business_id", businessId).is("vehicles.deleted_at", null);
  d.fleetItems = (data ?? []).flatMap((f) => {
    const car = [f.vehicles.make, f.vehicles.model, f.vehicles.plate_number].filter(Boolean).join(" ");
    return ([["Registration", dueOn(f.registration_expires_on)], ["Insurance", dueOn(f.insurance_expires_on)],
      ["Service", dueOn(f.next_service_on)], ["Service", dueKm(f.next_service_km, f.odometer_km)]] as const)
      .flatMap(([what, due]) => (due?.urgent ? [{ due, row: [`${what} · ${car}`, due.label] as [string, string] }] : []));
  }).sort((a, b) => Number(b.due.tone === "danger") - Number(a.due.tone === "danger")).map((x) => x.row);
}

/** Template + data for one notification, ready to send. Null when no email exists for this type. */
export async function prepareNotificationEmail(n: OutboxRow) {
  const key = templateFor(n.type, n.link);
  if (!key) return null;
  const admin = createAdminClient();
  const d: EmailData = { name: n.full_name ?? undefined };

  if (n.business_id) {
    const { data: biz } = await admin.from("businesses").select("name, logo_path, business_storefronts(accent_color)").eq("id", n.business_id).maybeSingle();
    d.businessId = n.business_id;
    d.businessName = biz?.name;
    d.accent = biz?.business_storefronts?.accent_color ?? undefined;
    // Email clients handle PNG/JPEG everywhere; older WebP logos fall back to the name alone.
    if (biz?.logo_path && /\.(png|jpe?g)$/i.test(biz.logo_path)) d.logo = mediaUrl(biz.logo_path) ?? undefined;
  }
  const bookingId = n.link?.match(BOOKING)?.[1];
  if (bookingId) await addBooking(d, bookingId);
  const conversationId = n.link?.match(CONVERSATION)?.[1];
  if (conversationId) await addConversation(d, conversationId, n);

  if (n.type.startsWith("verification_") && n.type !== "verification_submitted") {
    d.note = n.body ?? undefined;
  }
  if (n.type === "verification_submitted") {
    d.businessId = n.link?.match(ADMIN_BUSINESS)?.[1];
    d.businessName = n.body ?? undefined;
  }
  if (n.type === "deletion_requested") d.email = n.body ?? undefined;
  if (n.type === "payment_details_changed") d.note = n.body ?? undefined;
  if (n.type === "site_errors") Object.assign(d, { reason: n.title, note: n.body ?? undefined });
  if (n.type === "report_submitted") Object.assign(d, { reason: n.title.replace(/^New report: /, ""), note: n.body ?? undefined });
  if (n.type === "team_added" && n.business_id) {
    const { data: m } = await admin.from("business_members").select("role").eq("business_id", n.business_id).eq("user_id", n.user_id).maybeSingle();
    d.role = m ? labelize(m.role) : undefined;
  }
  if (n.type === "review_received" && n.business_id) {
    const { data: r } = await admin.from("reviews").select("rating, comment, renter:profiles!reviews_renter_id_fkey(full_name)")
      .eq("business_id", n.business_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    Object.assign(d, { rating: r?.rating, comment: r?.comment ?? undefined, customerName: r?.renter?.full_name ?? "A renter" });
  }
  if (n.business_id && /^(trial_|subscription_|verification_verified|plan_changed)/.test(n.type)) {
    const { data: s } = await admin.from("subscriptions").select("plan, current_period_end").eq("business_id", n.business_id).maybeSingle();
    if (s) {
      d.plan = labelize(s.plan);
      if (s.current_period_end) Object.assign(d, { trialEnds: formatDate(s.current_period_end), periodEnd: formatDate(s.current_period_end), daysLeft: daysUntil(s.current_period_end) });
    }
  }
  if (n.type === "fleet_due" && n.business_id) {
    await addFleetItems(d, n.business_id);
    if (!d.fleetItems?.length) return null; // everything was renewed since the reminder
  }
  if (n.type === "subscription_paid" && n.business_id) {
    const { data: p } = await admin.from("subscription_payments").select("plan, amount_paid_centavos, payment_method, period_end")
      .eq("business_id", n.business_id).eq("status", "PAID").order("paid_at", { ascending: false }).limit(1).maybeSingle();
    if (p) Object.assign(d, { plan: labelize(p.plan), amount: formatPHP((p.amount_paid_centavos ?? 0) / 100, true), paymentMethod: p.payment_method ? labelize(p.payment_method) : "PayMongo", periodEnd: formatDate(p.period_end!) });
  }

  const pdf = key === "booking_confirmed" || key === "contract_signed" ? await signedPdf(d.versionId, d.reference) : undefined;
  const attachments: { filename: string; content: string; content_id?: string }[] = pdf ? [{ filename: pdf.filename, content: pdf.content }] : [];
  if (key === "booking_confirmed" && d.versionId) {
    // Both signatures as inline images (cid:), so they show without being hosted anywhere public.
    const { data: sigs } = await admin.from("contract_signatures").select("signer_role, signer_name, signature_data, signed_at").eq("contract_version_id", d.versionId);
    const at = (iso: string) => formatDate(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    d.signatures = (["PROVIDER", "RENTER"] as const).flatMap((role) => {
      const s = sigs?.find((x) => x.signer_role === role);
      if (!s) return [];
      const cid = `signature-${role.toLowerCase()}`;
      const image = isValidSignatureImage(s.signature_data) ? `cid:${cid}` : undefined;
      if (image) attachments.push({ filename: `${cid}.png`, content: s.signature_data!.split(",")[1]!, content_id: cid });
      return [{ role: role === "PROVIDER" ? "Rental provider" : "Renter", name: s.signer_name, signedAt: at(s.signed_at), image }];
    });
    if (pdf) Object.assign(d, { attachmentName: pdf.filename, attachmentPages: pdf.pages });
  }
  return { key, ...renderAppEmail(key, d), attachments: attachments.length ? attachments : undefined };
}

/** Sends every due notification email (claimed in batches, so parallel runs never double-send). */
export async function dispatchNotificationEmails(budgetMs = 45_000) {
  const stats = { sent: 0, skipped: 0, failed: 0 };
  if (!emailEnabled()) return stats;
  const admin = createAdminClient();
  const mark = (id: string, patch: { emailed_at?: string; email_error?: string | null; email_locked_until?: string | null }) =>
    admin.from("notifications").update(patch).eq("id", id);
  const started = Date.now();
  while (Date.now() - started < budgetMs) {
    const { data: rows, error } = await admin.rpc("claim_notification_emails", { p_limit: 10 });
    if (error) throw error;
    if (!rows?.length) break;
    for (const n of rows) {
      try {
        const mail = await prepareNotificationEmail(n);
        if (!mail) {
          await mark(n.id, { emailed_at: new Date().toISOString(), email_error: `no email for ${n.type}`, email_locked_until: null });
          stats.skipped++;
          continue;
        }
        await sendEmail({ to: n.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, idempotencyKey: `notification/${n.id}` });
        await mark(n.id, { emailed_at: new Date().toISOString(), email_error: null, email_locked_until: null });
        stats.sent++;
      } catch (e) {
        console.error("[email] notification", n.id, n.type, e);
        await mark(n.id, { email_error: String(e).slice(0, 500), email_locked_until: new Date(Date.now() + n.attempts * 5 * 60_000).toISOString() });
        stats.failed++;
      }
      await pause(550); // Resend allows 2 requests a second
    }
  }
  return stats;
}
