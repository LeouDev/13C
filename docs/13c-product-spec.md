# 13C — Product Spec

> **Customers:** Find and book cars from local Cebu rental businesses.
> **Businesses:** Your car rental business, online.

13C is two connected products on one platform:

| Product | Who | What they get |
|---|---|---|
| **13C Marketplace** | Renters | Search cars across verified Cebu rental businesses, message owners, request bookings, review and e-sign rental agreements, track rentals. |
| **13C Business SaaS** | Rental businesses | A branded storefront at `13c.online/<slug>`, fleet + availability management, inquiries, bookings, auto-generated contracts with e-signature, customers, analytics. |

The rental business is always the **Rental Provider**. 13C is the **Marketplace/SaaS Platform** — it never owns, operates or insures vehicles and does not process payments in the MVP.

## Core differentiator — the storefront

Every verified business gets a public storefront that feels like *its own website*, not a profile:

- Business-branded header (logo, name, accent color) instead of 13C's navigation.
- Large cover hero, rating, verification badge, fleet size, response time, city.
- Sections: Fleet, About, Pickup & Delivery, Rental Policies, Reviews, FAQ, Contact.
- Vehicle pages live **inside** the storefront: `13c.online/<business>/<vehicle>`.
- 13C branding is limited to a subtle "Powered by 13C" footer.
- Customization is bounded: logo, cover, accent color, copy, FAQ, policies, locations, featured vehicles, section visibility. The layout stays 13C-quality.

## Personas

- **Renter (customer)** — tourist or local, mostly on a phone, wants a trustworthy car fast.
- **Owner** — runs 1–30 cars, today uses Facebook + Messenger + paper contracts.
- **Staff / Manager** — handles bookings and messages for an owner.
- **Platform admin** — verifies businesses, moderates, manages templates and plans.

## Key flows (MVP success criteria)

The MVP is done when this 35-step flow works end-to-end:

1. **Business**: register → submit verification → admin approves → customize storefront (logo, cover) → add Toyota Vios with photos, ₱1,500/day, availability → publish.
2. **Customer**: open 13C → search Cebu → find the Vios → open vehicle → open storefront → message business → business replies → request Oct 10–11.
3. **Business**: receive request → review → approve → contract auto-generated → review contract → send (provider signs).
4. **Customer**: open contract → review → sign (typed or drawn) → submit.
5. **System**: contract `SIGNED` → signed PDF generated and stored privately → business notified → booking `CONFIRMED` → both parties can download.

## Feature inventory

### Public / marketplace
- Home: hero search (location, pickup/return date, vehicle type), featured cars, popular locations, featured businesses, how-it-works, business CTA.
- `/explore` and `/explore/<city>`: filters for location, dates (true availability), price, type, transmission, seats, self-drive, with driver, delivery, rating, verified.
- Vehicle page: gallery, specs tiles, pricing (daily/weekly/monthly, deposit, mileage, delivery), live quote, availability calendar, business card, *Message Owner*, *Request Booking*.
- Storefront (see above). Favorites. Report listing.

### Customer account
- Profile + renter details (legal name, DOB, address, license) + private document upload (license, government ID).
- Bookings list/detail with status timeline; contract review, signing, PDF download.
- Messages (realtime), notifications center, favorites, reviews after completion.

### Business dashboard
Dashboard · My Store · Vehicles · Calendar · Bookings · Inquiries · Messages · Customers · Contracts · Reviews · Analytics · Business Profile · Payment Settings · Subscription · Settings (team, policies).

- Onboarding checklist with progress until the store is published.
- Vehicles: add/edit, photos (multi-upload, drag ordering, main image), pricing, status (Active/Inactive/Maintenance/Unavailable), availability blocks.
- Calendar: month view across fleet — confirmed bookings, pending requests, blocks, maintenance.
- Bookings: approve/reject, contract review + send, pickup/return/complete, record payments, cancel.
- Inquiries: conversations without a booking (derived status *Inquiry* / *Negotiating*); convert to booking proposal.
- Customers: renters who booked or messaged, with booking history (sensitive data only when a booking requires it).

### Admin
Overview · Businesses/Verification · Vehicles · Users · Bookings · Contracts · Reviews · Reports · Subscriptions · Settings (contract templates, vehicle categories, platform settings).

## Statuses

**Business**: `DRAFT → PENDING → UNDER_REVIEW → VERIFIED` (or `CHANGES_REQUESTED`, `REJECTED`, `SUSPENDED`). Storefront: `DRAFT | PUBLISHED`. Public = `VERIFIED` **and** `PUBLISHED`. "Verified Business" only after admin approval.

**Booking** (centralized state machine, enforced in Postgres):

```
INQUIRY → NEGOTIATING → BOOKING_REQUESTED → PENDING_OWNER_APPROVAL → APPROVED
→ CONTRACT_DRAFT → CONTRACT_SENT → AWAITING_SIGNATURE → SIGNED → CONFIRMED
→ ACTIVE → RETURNED → COMPLETED          (+ CANCELLED, REJECTED, EXPIRED)
```

`INQUIRY`/`NEGOTIATING` describe conversations before a booking row exists. A customer request starts at `PENDING_OWNER_APPROVAL`; a business-created proposal starts at `BOOKING_REQUESTED` and becomes `APPROVED` when the customer accepts it.

**Payment** (recorded, never processed): method `CASH | GCASH | MAYA | BANK_TRANSFER | CARD | OTHER`; status `UNPAID | PARTIALLY_PAID | PAID | PAYMENT_ON_PICKUP`. Selecting GCash never implies payment.

## Contracts

- Generated automatically on approval from the active admin-managed template + booking/business/renter/vehicle data + the business's policies.
- 19 sections (Parties … Electronic Signatures). Parties are labelled **Rental Provider**, **Renter**, **Technology Platform (13C)**, with explicit language that 13C is not a party to the rental.
- Provider signs (typed) when sending; renter signs (typed or drawn) after ticking *I have read and agree…*.
- Captured per signature: user id, timestamp, IP, user agent, contract version, content SHA-256, signature data, booking id.
- Signed versions are immutable (DB trigger). Changes create **v2** which must be signed again; history is preserved.
- Signed PDF stored in a private bucket; downloads via short-lived signed URLs for the two parties only.
- ⚠️ Templates must be reviewed by qualified Philippine legal counsel before production use.

## Plans (billing not implemented)

| | FREE ₱0 · 25-day trial | PRO ₱499/mo | BUSINESS ₱1,500/mo |
|---|---|---|---|
| Vehicles | 10 (trial) | 10 | Unlimited |
| Team members | Owner only | Owner only | Multiple staff |
| Storefront, inquiries, bookings, contracts | ✓ | ✓ | ✓ |
| Analytics, notifications | basic | ✓ | advanced |
| GPS integrations, custom contracts, priority support | — | — | future |

The free trial starts when 13C verifies the business and lasts 25 days; when it ends without a paid plan the store is hidden from customers and no vehicles can be added (existing bookings and contracts continue). Vehicle and staff limits are enforced in the database. Owners pay for Pro or Business monthly through PayMongo (GCash, Maya, cards, QR Ph). Each payment adds a month, with no auto-renewal. Admins can also grant plans. Marketplace commission (5–10%) is explicitly **not** in the MVP.

## Privacy (PH Data Privacy Act)

- Government IDs, licenses, contracts and signatures live in private buckets; never public URLs.
- Businesses see renter details only for their own bookings.
- Consent captured at signup; Privacy Policy and Terms pages; account deletion request workflow; audit logs avoid sensitive payloads.

## Out of scope for MVP

GPS hardware/telematics (tables exist for future provider integrations), payment processing/wallets, dynamic pricing, insurance claims, native apps, multi-country, crypto, loyalty, custom domains (routing designed for them).
