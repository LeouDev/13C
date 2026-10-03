# 13C — Your car rental business, online.

13C gives every car-rental business in Cebu its own branded storefront (`13c.online/<business>`) plus a marketplace where customers search, message, book, and **e-sign rental agreements** — with the rental business always the Rental Provider and 13C only the technology platform.

- **Customers:** search Cebu (Cebu City, Mactan, Lapu-Lapu, Mandaue, Talisay…), compare cars, message businesses, request bookings, review & sign contracts, download signed PDFs.
- **Businesses:** registration + verification, storefront customization, fleet/photos/pricing/availability, inquiries & realtime chat, bookings with a DB-enforced state machine, auto-generated contracts, payments ledger, customers, reviews, analytics, team roles.
- **Admins:** verification queue, businesses, users (KYC, suspension, DPA anonymization), bookings, contracts, reviews, reports, plans, contract-template editor, categories, settings.

Docs: [product spec](docs/13c-product-spec.md) · [architecture](docs/13c-architecture.md) · [database schema](docs/13c-database-schema.md) · [MVP roadmap](docs/13c-mvp-roadmap.md)

## Stack

Next.js 16 (App Router, React 19, TypeScript) · Tailwind CSS v4 · shadcn/ui (Base UI) · Supabase (Postgres 17, Auth, Storage, Realtime, pg_cron) · pdf-lib · zod · Vitest.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values (see below)
supabase link --project-ref <your-project-ref>
npm run db:push              # applies supabase/migrations/*
npm run db:types             # regenerates src/types/database.ts
npm run dev
```

`.env.local`:

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server (RLS applies) |
| `SUPABASE_SECRET_KEY` | **server only** — contract signing with request IP, signed-PDF storage |
| `NEXT_PUBLIC_SITE_URL` | auth redirects, canonical URLs, sitemap |
| `NEXT_PUBLIC_ROOT_DOMAIN` | displayed store URLs (`13c.online/<slug>`) and future subdomains |
| `STOREFRONT_SUBDOMAINS` | optional, `1` enables `<slug>.<root-domain>` routing in `src/proxy.ts` |
| `PAYMONGO_SECRET_KEY` | **server only**: creates and reads checkout sessions (`sk_test_…` = test mode) |
| `PAYMONGO_WEBHOOK_SECRET` | **server only**: verifies the `Paymongo-Signature` header on `/api/webhooks/paymongo` |
| `RESEND_API_KEY` | **server only**: sends app emails (added by the Vercel Resend integration) |
| `EMAIL_DISPATCH_SECRET` | **server only**: shared with the database (Vault) to call `/api/email/dispatch` |
| `PAYMONGO_PAYMENT_METHODS` | optional, default `gcash,paymaya,card,qrph` (each must be enabled on the PayMongo account) |

**First admin:** sign up, then in the Supabase SQL editor run
`update public.profiles set is_admin = true where email = 'you@example.com';`

## Scripts

| Command | Does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | route typegen + `tsc` |
| `npm run lint` | ESLint (incl. React Compiler rules) |
| `npm test` | unit tests + database integration tests + the 35-step MVP end-to-end flow (against the linked project, with throwaway `@13c.test` users that are cleaned up afterwards) |
| `npm run db:push` / `db:types` / `db:cleanup-tests` | Supabase helpers |

## Where things live

```
supabase/migrations/   schema, constraints, triggers, RPCs, RLS, storage, seed
src/proxy.ts           session refresh, route guards, storefront host routing
src/app/(site)/        13C-branded pages (home, explore, auth, account, legal)
src/app/[business]/    storefront-branded pages (store, vehicle, booking request)
src/app/dashboard/     business dashboard          src/app/admin/  platform admin
src/app/actions/       server actions (validated with zod, friendly errors)
src/lib/               supabase clients, auth, state machine, contracts (PDF), formatting
tests/                 unit, db (RLS/integrity), e2e-flow (spec §62)
```

## Emails

All 47 emails share one branded layout (`src/emails/`): 8 Supabase Auth/security emails and 39 app emails (15 renter, 21 business, 3 admin), each with HTML and plain text. Preview them at **Admin → Emails** (`/admin/emails`). Everything is sent through **Resend**, from `13C <support@13c.online>`.

- **Auth emails** (confirm sign-up, reset password, change email, magic link, invite, re-auth, password/email changed) go through Supabase Auth's custom SMTP, which points at Resend. They render to `supabase/templates/*.html` via `npm run emails:build`, and the template block in `supabase/config.toml` uploads them with `supabase config push`.
- **App emails:** every row in `notifications` is also an outbox entry.
  1. Inserting notifications makes Postgres (`pg_net`) call `POST /api/email/dispatch` with a bearer secret.
  2. The endpoint claims due rows (`claim_notification_emails`, so parallel runs never double-send), picks the template for the notification type and the recipient's side, and fills it from the booking, conversation, business or subscription.
  3. It sends through Resend with an idempotency key. Booking-confirmed and contract-signed emails attach the signed PDF.
  4. A `pg_cron` sweep every 5 minutes retries failures, up to 5 attempts within 2 days.
- **Configuration:**
  - `RESEND_API_KEY` and `EMAIL_DISPATCH_SECRET` are in Vercel.
  - Vault holds `email_dispatch_url` and `email_dispatch_secret`. Without them, nothing is called, so local and test databases never send.
- **Safety:** addresses on reserved test domains (`@*.test`, `.example`, `.invalid`, `.localhost`) are never emailed, and the test suite only uses `@13c.test`.

## Contract signing

The provider and the renter each draw or type a signature; both become a PNG in the browser (typed names use a handwriting font). The database accepts only `data:image/png;base64,…` up to 400 KB. Signing and "opened" events run on the server with the secret key, so the IP address and browser come from the request, not the client. Every signed PDF ends with a **signature certificate** page listing: the SHA-256 fingerprint; provider name, email, time, IP and browser; who it was sent to and when; when and from where the renter opened it; and the renter's name, email, time, IP and browser. All times are in PHT.

## Subscription payments (PayMongo)

Owners pay for Pro or Business on PayMongo's hosted checkout (GCash, Maya, cards and QR Ph). Each payment buys one month. Plans are prepaid and don't renew automatically:

- Paying during the trial, or for the current plan, adds the month after the current period ends.
- Switching between paid plans starts right away. Unused days carry over at the new plan's price.
- When a period ends, the store is hidden until the owner pays again. Reminders go out 3 days before the end and when the plan lapses.
- A paid plan an admin sets has no end date until it's changed.

The amount always comes from the plan in the database, never from the browser. Payments are settled by `apply_subscription_payment`. It can run more than once safely, from both of these places:
- the webhook at `POST /api/webhooks/paymongo`, which is signature-verified and subscribed to `checkout_session.payment.paid`;
- the success page, which re-reads the checkout session in case the webhook is slow or misconfigured.

Owners see their payment history under **Subscription**. Admins see recent payments under **Admin → Subscriptions**.

## Pending — do these when the email provider and domain are ready

**Email:** done. Resend (Vercel integration, free plan, 100 emails/day) sends from `support@13c.online`. The domain is verified in Resend (region Tokyo), and `air-rally.com` stays verified as a fallback:
- Supabase Auth uses Resend through custom SMTP, with the branded templates pushed from `config.toml`.
- App emails go through the notifications outbox; see **Emails** above.
- Upgrade Resend when volume passes about 100 a day.

**Domain (13c.online):** live since Oct 4, 2026. It's registered at Cloudflare Registrar, with DNS in Cloudflare: `A @` → `216.198.79.1` and `64.29.17.1`, `CNAME www` → Vercel, all set to "DNS only". The apex 308-redirects to `www`.
- Done:
  - Vercel domains.
  - `NEXT_PUBLIC_SITE_URL=https://www.13c.online` and `NEXT_PUBLIC_ROOT_DOMAIN=13c.online`.
  - The Vault `email_dispatch_url`.
  - The Supabase `site_url` and redirect URLs. The old `13-c.vercel.app` URLs stay allowed, so links in emails sent earlier still work.
- Cloudflare Email Routing forwards `support@`, `privacy@` and `owner@13c.online` to the owner's inbox.
- To do:
  1. In PayMongo, change the webhook URL to `https://www.13c.online/api/webhooks/paymongo`. Use the `www` address, because webhooks don't follow the redirect from the apex.
  2. In Supabase (Authentication → SMTP Settings), set the sender email to `support@13c.online`. App emails, the site and the legal pages already use `support@` and `privacy@13c.online`.
  3. Optional: storefront subdomains (`STOREFRONT_SUBDOMAINS=1` plus a wildcard domain).

**Also before launch**
1. Have the contract template (Admin → Settings), Terms and Privacy Policy reviewed by Philippine legal counsel.
2. Upgrade Vercel to Pro, because Hobby is for non-commercial use.
3. Turn on leaked-password protection in Supabase Auth.
4. Keep the secret key server-only. It is only ever read in server code.
