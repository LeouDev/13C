# 13C — Database Schema

Source of truth: `supabase/migrations/*.sql` (Postgres 17 on Supabase). Types: `src/types/database.ts` (`supabase gen types typescript --linked`).

Conventions: UUID PKs (`gen_random_uuid()`), `created_at`/`updated_at` (trigger-maintained), FKs everywhere, `CHECK` constraints for lengths/ranges/formats, enums for closed sets, soft delete (`deleted_at`) on businesses and vehicles, RLS enabled on **every** table.

## Entity map

```
auth.users 1─1 profiles 1─1 renters
                   │ 1─n driver_documents (kyc bucket)
                   │
                   ├─n business_members n─1 businesses 1─1 business_storefronts
                   │                          │ 1─1 subscriptions
                   │                          │ 1─n business_verifications (business-docs bucket)
                   │                          │ 1─n payment_methods
                   │                          │ 1─n vehicles 1─1 vehicle_pricing
                   │                          │        │ 1─n vehicle_images (media bucket)
                   │                          │        │ 1─n vehicle_blocked_dates
                   │                          │ 1─n conversations 1─n messages
                   │                          │ 1─n bookings 1─n booking_status_history
                   │                          │        │ 1─n payments
                   │                          │        │ 1─1 contracts 1─n contract_versions 1─n contract_signatures
                   │                          │        │ 1─1 reviews
                   │                          │ 1─n page_views, audit_logs, gps_*
                   ├─n favorites, notifications, reports
contract_templates (admin) · vehicle_categories (admin) · booking_transitions (state machine) · platform_settings
```

## Tables

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | Public extension of `auth.users` | `is_admin`, `is_suspended` not user-updatable (column grants). Created by trigger on signup. |
| `renters` | KYC details (legal name, DOB, address, license) | `kyc_status` admin-only. Visible to a business only if the renter booked with it. |
| `driver_documents` | Metadata for license/ID files | Files in private `kyc` bucket. |
| `businesses` | Rental provider identity | `slug` unique, regex + reserved-word check. `status`: DRAFT → PENDING → UNDER_REVIEW → VERIFIED / CHANGES_REQUESTED / REJECTED / SUSPENDED. |
| `business_members` | Team + roles | OWNER / MANAGER / STAFF. Owner row created by trigger. |
| `business_storefronts` | Storefront presentation & settings | Merges the spec's `business_storefronts` + `business_storefront_settings` (1:1). `is_published` only via `set_storefront_published()`. FAQs/policies/hours as JSONB documents. `subdomain`, `custom_domain` reserved for future routing. |
| `business_verifications` | Verification submissions + decisions | Docs JSON `[{type,path,name}]`, paths must be under the business folder. |
| `payment_methods` | Methods the business accepts | Public sees method names only (`get_public_payment_methods`). |
| `subscriptions` | Plan per business | FREE on creation. Limits enforced by trigger/RPC. |
| `vehicle_categories` | Admin-managed vehicle types | |
| `vehicles` | Fleet | `slug` unique per business (among non-deleted), `status`, `self_drive OR with_driver`, generated `search tsvector`. |
| `vehicle_pricing` | Rates & fees (1:1) | daily/weekly/monthly, deposit, mileage limit, excess km fee, delivery fee, driver fee. |
| `vehicle_images` | Ordered photos | `position` 0 = main image. |
| `vehicle_blocked_dates` | Manual blocks / maintenance | Generated `period tstzrange`. Together with bookings this is availability (spec's `vehicle_availability`). |
| `favorites` | Saved vehicles | |
| `conversations` | Customer ↔ business thread, optionally about a vehicle | One per (business, customer, vehicle). A conversation without a booking is an **inquiry** (spec's `inquiries`); participants are derived (spec's `conversation_participants`), read pointers are columns. |
| `messages` | Chat messages | `sender_role` is set by trigger from the caller — never trusted from the client. |
| `bookings` | Requests and bookings | Spec's `booking_requests` are bookings in `BOOKING_REQUESTED`/`PENDING_OWNER_APPROVAL`. Price snapshot columns, `period tstzrange`, `payment_method`, `payment_status`. |
| `booking_status_history` | Every transition with actor + note | Trigger-written. |
| `booking_transitions` | The state machine (from, to, actor) | Actor ∈ RENTER / BUSINESS / SYSTEM. |
| `payments` | Manual payment ledger | Trigger recomputes `bookings.payment_status`. |
| `contract_templates` | Admin-managed, versioned, one active | Sections JSON with `{{placeholders}}`. |
| `contracts` | One per booking | `current_version`. |
| `contract_versions` | Rendered content snapshot | `data` (variables), `sections` (rendered), `content_hash` (SHA-256), `pdf_path`. Immutable once SIGNED. |
| `contract_signatures` | Provider + renter signatures | Insert-only. IP, UA, hash, timestamp, signature data. |
| `reviews` | One per completed booking | Overall + vehicle + business ratings, business response, admin hide. |
| `notifications` | In-app notification center | Inserted only by DB functions; Realtime-enabled. |
| `audit_logs` | Important events | Minimal metadata, no sensitive payloads. |
| `reports` | User reports of listings/reviews | Admin resolves. |
| `page_views` | Store/vehicle views, deduped per viewer per day | Inserted via `track_view()`. |
| `platform_settings` | Key/value admin settings | |
| `gps_integrations`, `gps_devices`, `gps_events` | Future GPS provider integration | No UI in MVP. |

Spec tables `users` → `auth.users`; `inquiries`, `booking_requests`, `conversation_participants`, `vehicle_availability`, `business_storefront_settings` are modeled as described above to avoid duplicated state.

## Integrity guarantees

| Guarantee | Implementation |
|---|---|
| No double booking | `bookings_no_overlap`: `EXCLUDE USING gist (vehicle_id WITH =, period WITH &&) WHERE status IN (APPROVED … ACTIVE)` |
| Bookings vs blocks | `guard_booking_availability` / `guard_blocked_dates` triggers, both `SELECT … FOR UPDATE` the vehicle row |
| Valid transitions only | `guard_booking_status` trigger checks `booking_transitions`; actor checks in `transition_booking()` |
| Signed contracts immutable | `guard_contract_version` (only one-time PDF attach after signing), `guard_contract_signature` (no update/delete), FKs `ON DELETE RESTRICT` |
| Signature covers what was read | `sign_contract()` requires the client's `content_hash` to equal the version's hash |
| Plan limits | `enforce_vehicle_limit` trigger; `add_business_member()` requires BUSINESS plan |
| Verified before public | `set_storefront_published()` requires `VERIFIED` + an active priced vehicle; public RLS requires `VERIFIED AND is_published` |
| Reviews only after completion | `create_review()` requires `COMPLETED` booking owned by caller; `booking_id` unique |

## Key functions (RPC)

| Function | Caller | Does |
|---|---|---|
| `register_business` | user | Creates DRAFT business (+ owner, storefront, FREE plan via trigger) |
| `submit_business_verification` | owner | Docs → PENDING, notifies admins |
| `admin_review_business` | admin | UNDER_REVIEW / VERIFIED / CHANGES_REQUESTED / REJECTED / SUSPENDED |
| `set_storefront_published` | owner | Publish/unpublish |
| `save_vehicle` | manager | Atomic vehicle + pricing upsert, slug generation (security invoker) |
| `quote_booking` | anyone | The only price calculator |
| `search_vehicles` | anyone | Marketplace search incl. date availability |
| `vehicle_unavailable_ranges` | anyone | Calendar ranges without renter data |
| `start_conversation` / `mark_conversation_read` | customer / party | Messaging |
| `request_booking` | renter | Validates profile, availability, payment method → PENDING_OWNER_APPROVAL |
| `propose_booking` / `accept_booking_proposal` | business / renter | Conversation → proposal → APPROVED |
| `transition_booking` | party/admin | Central state changes; APPROVED triggers `generate_contract` |
| `update_booking_terms` | manager | Re-quote dates/fees; regenerates contract (new version) |
| `regenerate_contract` | manager | Revise draft or amend signed (v2) |
| `send_contract` | **server only** | Provider signature + CONTRACT_SENT |
| `mark_contract_viewed` | renter | CONTRACT_SENT → AWAITING_SIGNATURE |
| `sign_contract` | **server only** | Renter signature → SIGNED → CONFIRMED |
| `attach_contract_pdf` | **server only** | One-time PDF path + hash |
| `create_review` / `respond_to_review` | renter / manager | Reviews |
| `business_analytics` / `admin_overview` | members / admin | Aggregates |
| `expire_stale_bookings` | pg_cron hourly | Requests past pickup → EXPIRED |

## Storage buckets

See `docs/13c-architecture.md#storage`. Bucket-level MIME/size limits: media 8 MB images; business-docs/kyc 10 MB PDF/images; contracts 10 MB PDF.

## Migrations

| File | Content |
|---|---|
| `…0001_foundation.sql` | Extensions, enums, tables, indexes, constraints |
| `…0002_helpers_triggers.sql` | Auth helpers, notifications/audit helpers, triggers |
| `…0003_rpc.sql` | Business logic RPCs |
| `…0004_rls.sql` | Grants (explicit) + RLS policies |
| `…0005_storage.sql` | Buckets + storage policies |
| `…0006_seed.sql` | Categories, transitions, contract template v1, settings, realtime, cron |
| `…0007_tighten.sql` | Revokes `member_has_role` from API roles |

Apply: `supabase db push --linked`. Regenerate types after schema changes.
