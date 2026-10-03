# 13C — MVP Roadmap

Status legend: ✅ done · 🚧 in progress · ⏭️ deferred (designed for, not built)

## Phase 1 — Foundation
- ✅ Next.js 16 + TS + Tailwind v4 + shadcn/ui (Base UI)
- ✅ Supabase project linked; migrations for schema, constraints, triggers, RPCs, RLS, storage, seed
- ✅ Auth (email/password, SSR cookies via `@supabase/ssr`, proxy session refresh)
- ✅ Roles: renter, business OWNER/MANAGER/STAFF, platform admin
- ✅ Design system: tokens, brand logo, shared components (empty/error/loading states, status badges, photo uploader, signature pad, calendar)

## Phase 2 — Business
- ✅ Registration wizard (`/register/business`): profile → branding → verification docs + payment methods
- ✅ Admin verification (approve / request changes / reject / suspend)
- ✅ Dashboard shell + home (today's activity, KPIs, onboarding checklist)
- ✅ My Store: preview, copy link, customize (logo, cover, accent, copy, FAQ, policies, locations, hours, socials, featured vehicles, sections), publish

## Phase 3 — Vehicles
- ✅ Create/edit, status, archive; plan vehicle limits
- ✅ Photos: multi-upload, client-side resize to WebP, drag ordering, main image
- ✅ Pricing (daily/weekly/monthly, deposit, mileage, delivery, driver)
- ✅ Availability blocks / maintenance; DB-enforced conflicts
- ✅ Vehicle page inside the storefront

## Phase 4 — Marketplace
- ✅ Home (search hero, featured cars/businesses, locations, how it works, business CTA)
- ✅ `/explore` + `/explore/[city]` with filters + date availability
- ✅ Storefronts `/[business]`, vehicle pages `/[business]/[vehicle]`

## Phase 5 — Communication
- ✅ Messaging (realtime) for customers and businesses, inquiries view
- ✅ Notification center (realtime badge)
- ⏭️ Email/SMS dispatch (notifications are rows; add DB webhook → Edge Function + provider)

## Phase 6 — Bookings
- ✅ Booking request with live quote; business proposals from conversations
- ✅ Approve/reject/cancel/pickup/return/complete via central state machine
- ✅ Fleet calendar
- ✅ Payment method + manual payment ledger/status

## Phase 7 — Contracts
- ✅ Admin-managed versioned template, auto-population from DB
- ✅ Business review + provider signature + send
- ✅ Renter review + typed/drawn signature + consent checkbox
- ✅ Signed PDF (pdf-lib) in private storage, signed-URL downloads for both parties
- ✅ Immutability, amendments as v2, audit trail

## Phase 8 — Polish
- ✅ Reviews + business responses + admin moderation
- ✅ Business analytics + admin overview
- ✅ SEO: metadata, OG images, JSON-LD, sitemap, robots
- ✅ Mobile-first layouts, image optimization, lazy loading
- ✅ Privacy policy, terms, consent, deletion request + admin anonymization

## Verification status

| Check | Result |
|---|---|
| Unit tests (`tests/unit.test.ts`) — state machine, error mapping, Manila time, validation, PDF rendering | ✅ 11/11 |
| DB integration (`tests/db.test.ts`) — RLS isolation, double-booking exclusion, plan limits, TS↔DB state machine parity, contract immutability, server-only signing, private PDFs, reviews | ✅ 28/28 |
| **MVP workflow (`tests/e2e-flow.test.ts`) — all 35 steps of spec §62** | ✅ 5/5 stages |
| Authenticated page smoke test (owner, customer, admin; 50 routes) | ✅ no runtime errors |
| Public pages at 375 px — no horizontal overflow | ✅ |
| Supabase security advisors | ✅ no RLS gaps (only intended "definer RPC is callable" notices) |

Not yet verified by a human click-through in a browser while signed in (requires a real account): dashboard and signing UI interactions. See README for creating the first admin.

## Before production launch (owner actions)
1. **Legal review** of the contract template, Terms and Privacy Policy by Philippine counsel.
2. **Custom SMTP** in Supabase Auth (built-in email only reaches project members and is rate-limited). Email confirmation is already on — keep it on.
3. Set `NEXT_PUBLIC_SITE_URL` and Supabase Auth Site URL / redirect URLs to the production domain.
4. Register with the National Privacy Commission if thresholds apply; appoint a DPO.
5. Create the first admin: `update profiles set is_admin = true where email = '…';`

## Post-MVP (designed, not built)
- ⏭️ PayMongo / GCash / Maya payments (ledger + webhook)
- ⏭️ Subscription billing + invoices (plan limits already enforced)
- ⏭️ Storefront subdomains `<slug>.13c.ph` (proxy flag) and custom domains (lookup + Vercel Domains API)
- ⏭️ GPS provider integrations (tables exist)
- ⏭️ Maps (pickup geocoding), multi-city expansion beyond Cebu
- ⏭️ Marketplace commission (5–10%) — explicitly not in MVP
- ⏭️ Native apps
