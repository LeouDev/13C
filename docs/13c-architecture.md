# 13C — Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web | **Next.js 16 App Router**, React 19, TypeScript | SSR + dynamic metadata for indexable storefronts; Server Actions as the server-side trust boundary. |
| UI | Tailwind CSS v4, shadcn/ui (Base UI), lucide icons | Accessible primitives, tokens in `globals.css`. |
| Data | **Supabase** Postgres 17, Auth, Storage, Realtime, pg_cron | RLS everywhere; business rules in SQL functions. |
| Validation | zod (server actions) + Postgres constraints/triggers | Never trust the client. |
| PDF | pdf-lib (server) | Signed contract rendering. |
| Tests | Vitest (unit + integration against the Supabase project) | |

No Edge Functions are needed for the MVP: privileged server work runs in Next.js server actions/route handlers (Node runtime) with the secret key, which never reaches the browser.

## Repository layout

```
docs/                      product, architecture, schema, roadmap
supabase/migrations/       SQL migrations (schema, RLS, functions, storage, seed)
src/proxy.ts               session refresh, route guards, storefront host routing
src/app/
  (site)/                  13C-branded pages: home, explore, auth, register, legal, account
  dashboard/               business dashboard (sidebar layout)
  admin/                   platform admin (sidebar layout)
  [business]/              storefront-branded pages: store, vehicle, booking request
  api/                     route handlers (contract PDF download)
src/components/
  ui/                      shadcn primitives
  brand/ common/ marketplace/ storefront/ booking/ contract/ chat/ dashboard/
src/lib/
  supabase/                server, browser, admin (secret) clients
  auth.ts                  getUser / requireUser / requireBusiness / requireAdmin
  bookings/status.ts       booking state machine (UI side)
  contracts/pdf.ts         signed PDF renderer
  errors.ts                Postgres/Supabase error → friendly message
  format.ts, constants.ts, validation/
src/types/database.ts      generated Supabase types
tests/                     vitest unit + integration
```

## Request flow & trust boundaries

```
Browser ──(RSC/Server Action, cookies)──▶ Next.js server ──(user JWT)──▶ PostgREST ──▶ Postgres (RLS)
                                               │
                                               └─(secret key, server only)──▶ sign_contract / PDF upload
```

1. **Reads** run in Server Components with the user's session (RLS applies). Public pages use the same client as `anon`.
2. **Writes** go through Server Actions → zod validation → Supabase with the user's JWT → RLS + constraints + `SECURITY DEFINER` RPCs that re-check authorization.
3. **Privileged writes** (contract signatures with IP capture, signed PDF storage) use the secret-key client only after `auth.getUser()` verifies the caller; the SQL function still validates that the caller is the renter/provider.
4. Browser-side Supabase is used only for Storage uploads (RLS-scoped paths) and Realtime subscriptions.

Every rule that matters is enforced in Postgres, so a malicious client calling PostgREST directly gets the same answer as the UI.

## Business logic in the database

| Concern | Mechanism |
|---|---|
| Double booking | `EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)` over blocking statuses + triggers that lock the vehicle row and check `vehicle_blocked_dates` both ways. |
| Booking state machine | `booking_transitions` table (from, to, actor) + `transition_booking()` RPC + trigger that rejects any status change not in the table. TS mirror in `src/lib/bookings/status.ts`; a test asserts they match. |
| Pricing | `quote_booking()` is the single price calculator (used for previews and stored snapshots). |
| Contracts | `generate_contract()` renders the active template from authoritative DB data; immutability trigger on signed versions; signatures are insert-only. |
| Plan limits | Trigger on `vehicles` (vehicle cap) and `add_business_member()` (staff). |
| Notifications / audit | Written by triggers and RPCs (`notify_*`, `log_audit`) — clients cannot insert them. |
| Expiry | `expire_stale_bookings()` scheduled hourly with pg_cron. |

## Authorization model

- `profiles.is_admin` → platform admin (`is_admin()` helper).
- `business_members(role OWNER > MANAGER > STAFF)` → `has_business_role(business_id, min_role)`.
  - STAFF: bookings, messages, calendar, payments.
  - MANAGER: + vehicles, storefront, availability, contracts.
  - OWNER: + verification, payment settings, team, publishing.
- Renters own their profile, renter details, documents, bookings, conversations, reviews.
- Helpers are `SECURITY DEFINER STABLE` with `search_path = ''`; policies call `(select auth.uid())` for plan caching.
- Table privileges are granted explicitly (no blanket grants); sensitive columns (`is_admin`, `status`, `kyc_status`, `is_published`) are excluded from column-level `UPDATE` grants.

## Storage

| Bucket | Public | Path | Who writes | Who reads |
|---|---|---|---|---|
| `media` | yes | `b/<business>/…`, `u/<user>/…` | business MANAGER+, user | anyone (logos, covers, vehicle photos) |
| `business-docs` | no | `<business>/…` | OWNER | OWNER, admin |
| `kyc` | no | `<user>/…` | user | user, businesses with an approved booking for that user, admin |
| `contracts` | no | `<business>/<booking>/<version>.pdf` | server (secret key) | renter + business members, admin — via signed URLs (60 s) |

Uploads are type/size-restricted at the bucket level and validated client-side; images are downscaled to ≤ 2000 px WebP in the browser before upload and served through `next/image`.

## Routing

| Path | Rendered as |
|---|---|
| `/`, `/explore`, `/explore/<city>`, `/for-business`, `/login`, `/signup`, `/register/business`, `/account/**`, `/privacy`, `/terms` | 13C site chrome |
| `/<business-slug>` and `/<business-slug>/<vehicle-slug>` | Storefront chrome (business branding, "Powered by 13C") |
| `/dashboard/**` | Business app |
| `/admin/**` | Admin app |

Business slugs cannot collide with app routes — a reserved-word list is enforced by a DB check constraint and zod.

### Future hosts (designed, not enabled)

`src/proxy.ts` resolves the storefront slug from the host before routing:

- `cebu-xyz.13c.ph` → rewrite to `/cebu-xyz/...` (subdomain = `business_storefronts.subdomain`), enabled with `STOREFRONT_SUBDOMAINS=1`.
- `www.cebu-xyz-rentals.com` → lookup `business_storefronts.custom_domain` → rewrite. Requires Vercel domain API + cache; stub left in `resolveStorefrontHost()`.

## Realtime

`messages`, `conversations` and `notifications` are in the `supabase_realtime` publication; postgres_changes respects RLS, so subscribers only receive rows they can select.

## SEO

- `generateMetadata` per storefront / vehicle / city page: title, description, canonical, Open Graph image (cover / main photo).
- JSON-LD: `AutoRental` (LocalBusiness) on storefronts, `Product`+`Offer` on vehicles.
- `sitemap.ts` lists published storefronts, their vehicles and city pages; `robots.ts` disallows `/dashboard`, `/admin`, `/account`, `/api`.
- Private pages set `robots: noindex`.

## Error handling

`src/lib/errors.ts` maps Postgres codes/constraint names and RPC `RAISE` messages to friendly copy (e.g. `bookings_no_overlap` → "This vehicle is already booked for the selected dates."). Raw errors are logged server-side only. Every action returns `{ ok, error?, fieldErrors? }` and the UI renders toasts or inline errors — never silent failures.

## Future integrations (hooks in place)

- **Payments** (PayMongo/GCash/Maya): `payments` ledger + `bookings.payment_status` already exist; add a provider webhook that inserts into `payments`.
- **Subscriptions billing**: `subscriptions` table drives limits; add invoices + webhook.
- **GPS**: `gps_integrations → gps_devices → gps_events` keyed to vehicle/booking; provider adapters will run as scheduled jobs/webhooks.
- **Email/SMS/WhatsApp**: notifications are rows; a dispatcher (DB webhook → Edge Function) can fan out without touching business logic.
- **Maps**: pickup locations are text today; add `geography` columns when a maps provider is chosen.
