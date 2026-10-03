# 13C — Your car rental business, online.

13C gives every car-rental business in Cebu its own branded storefront (`13c.ph/<business>`) plus a marketplace where customers search, message, book, and **e-sign rental agreements** — with the rental business always the Rental Provider and 13C only the technology platform.

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
| `NEXT_PUBLIC_ROOT_DOMAIN` | displayed store URLs (`13c.ph/<slug>`) and future subdomains |
| `STOREFRONT_SUBDOMAINS` | optional, `1` enables `<slug>.<root-domain>` routing in `src/proxy.ts` |

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

All 44 emails share one branded layout (`src/emails/`): 8 Supabase Auth/security emails and 36 app emails (15 renter, 18 business, 3 admin) for renters, businesses and admins, each with HTML + plain text. Preview them at **Admin → Emails** (`/admin/emails`).

- **Auth emails** (confirm sign-up, reset password, change email, magic link, invite, re-auth, password/email changed) render to `supabase/templates/*.html` via `npm run emails:build`. Supabase only accepts custom templates once **custom SMTP** is configured: then uncomment the template block in `supabase/config.toml` and run `supabase config push`.
- **App emails** render with `renderAppEmail(key, data)` → `{ subject, html, text }` for any provider. They map to the in-app notification types and go out once an email provider is connected.

## Before launch

1. Have the contract template (Admin → Settings), Terms and Privacy Policy reviewed by Philippine legal counsel.
2. Configure custom SMTP in Supabase Auth (the built-in sender only reaches project members) and keep email confirmation on.
3. Set the production Site URL / redirect URLs in Supabase Auth and `NEXT_PUBLIC_SITE_URL`.
4. Deploy (e.g. Vercel) with the env vars above; the secret key must never be exposed to the browser.
