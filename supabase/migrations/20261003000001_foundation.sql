-- 13C foundation: extensions, enums, tables, constraints, indexes.
-- Business rules live in 0002 (triggers/helpers) and 0003 (RPCs); access control in 0004.

create extension if not exists btree_gist with schema extensions;

-- ─── Enums ────────────────────────────────────────────────────────────────
create type public.business_role as enum ('OWNER', 'MANAGER', 'STAFF');
create type public.business_status as enum ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VERIFIED', 'REJECTED', 'SUSPENDED');
create type public.vehicle_status as enum ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'UNAVAILABLE');
create type public.transmission_type as enum ('AUTOMATIC', 'MANUAL');
create type public.fuel_type as enum ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC');
create type public.payment_method_type as enum ('CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'CARD', 'OTHER');
create type public.payment_status as enum ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'PAYMENT_ON_PICKUP');
create type public.booking_status as enum (
  'INQUIRY', 'NEGOTIATING', 'BOOKING_REQUESTED', 'PENDING_OWNER_APPROVAL', 'APPROVED',
  'CONTRACT_DRAFT', 'CONTRACT_SENT', 'AWAITING_SIGNATURE', 'SIGNED', 'CONFIRMED',
  'ACTIVE', 'RETURNED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'
);
create type public.contract_status as enum ('DRAFT', 'SENT', 'SIGNED', 'SUPERSEDED', 'CANCELLED');
create type public.signature_type as enum ('TYPED', 'DRAWN');
create type public.signer_role as enum ('RENTER', 'PROVIDER');
create type public.kyc_status as enum ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
create type public.driver_document_type as enum ('DRIVERS_LICENSE_FRONT', 'DRIVERS_LICENSE_BACK', 'GOVERNMENT_ID');
create type public.block_reason as enum ('BLOCKED', 'MAINTENANCE');
create type public.subscription_plan as enum ('FREE', 'PRO', 'BUSINESS');
create type public.subscription_status as enum ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED');
create type public.report_status as enum ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');
create type public.message_sender_role as enum ('CUSTOMER', 'BUSINESS', 'SYSTEM');

-- ─── Pure helpers needed by constraints ──────────────────────────────────
create or replace function public.is_reserved_slug(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p = any (array[
    'explore','register','login','signup','logout','dashboard','admin','account','api','auth',
    'about','privacy','terms','help','support','for-business','business','businesses','search',
    'cars','vehicles','pricing','contact','settings','notifications','messages','bookings','new',
    'edit','www','app','mail','blog','13c','static','assets','images','favicon.ico','robots.txt',
    'sitemap.xml','_next','opengraph-image','icon','manifest.webmanifest'
  ])
$$;

create or replace function public.slugify(p text)
returns text language sql immutable set search_path = '' as $$
  select left(trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g')), 60)
$$;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ─── Identity ─────────────────────────────────────────────────────────────
-- auth.users is the "users" table; profiles is its public extension.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 30),
  avatar_path text,
  is_admin boolean not null default false,
  is_suspended boolean not null default false,
  marketing_opt_in boolean not null default false,
  terms_accepted_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.renters (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  legal_name text check (char_length(legal_name) <= 120),
  date_of_birth date check (date_of_birth > date '1900-01-01'),
  address text check (char_length(address) <= 300),
  city text check (char_length(city) <= 80),
  license_number text check (char_length(license_number) <= 40),
  license_expiry date,
  kyc_status public.kyc_status not null default 'UNVERIFIED',
  kyc_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  doc_type public.driver_document_type not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id, doc_type)
);

-- ─── Businesses ──────────────────────────────────────────────────────────
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' and not public.is_reserved_slug(slug)),
  description text check (char_length(description) <= 600),
  address text check (char_length(address) <= 300),
  city text not null check (char_length(city) between 2 and 80),
  province text not null default 'Cebu',
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 120),
  representative_name text check (char_length(representative_name) <= 120),
  representative_title text check (char_length(representative_title) <= 80),
  registration_type text check (registration_type in ('DTI', 'SEC', 'CDA', 'MAYORS_PERMIT', 'OTHER')),
  registration_number text check (char_length(registration_number) <= 60),
  logo_path text,
  status public.business_status not null default 'DRAFT',
  status_note text,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index businesses_slug_key on public.businesses (slug);
create index businesses_owner_idx on public.businesses (owner_id);
create index businesses_status_idx on public.businesses (status) where deleted_at is null;

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.business_role not null default 'STAFF',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

-- Storefront presentation + settings (spec: business_storefronts + business_storefront_settings, merged 1:1).
create table public.business_storefronts (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  is_published boolean not null default false,
  published_at timestamptz,
  tagline text check (char_length(tagline) <= 140),
  about text check (char_length(about) <= 5000),
  cover_path text,
  accent_color text not null default '#2F6BFF' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  business_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(business_hours) = 'array'),
  social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
  pickup_locations text[] not null default '{}',
  delivery_areas text[] not null default '{}',
  featured_vehicle_ids uuid[] not null default '{}',
  faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array'),
  policies jsonb not null default '{}'::jsonb check (jsonb_typeof(policies) = 'object'),
  hidden_sections text[] not null default '{}',
  -- Future host routing (see docs/13c-architecture.md)
  subdomain text unique check (subdomain ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  custom_domain text unique check (custom_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_verifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id),
  documents jsonb not null default '[]'::jsonb check (jsonb_typeof(documents) = 'array'),
  submitter_note text check (char_length(submitter_note) <= 2000),
  decision public.business_status,
  review_note text check (char_length(review_note) <= 2000),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index business_verifications_business_idx on public.business_verifications (business_id, created_at desc);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  method public.payment_method_type not null,
  account_name text check (char_length(account_name) <= 120),
  account_number text check (char_length(account_number) <= 60),
  instructions text check (char_length(instructions) <= 500),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, method)
);

create table public.subscriptions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  plan public.subscription_plan not null default 'FREE',
  status public.subscription_status not null default 'ACTIVE',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Fleet ────────────────────────────────────────────────────────────────
create table public.vehicle_categories (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  label text not null check (char_length(label) between 2 and 40),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'),
  make text not null check (char_length(make) between 1 and 40),
  model text not null check (char_length(model) between 1 and 60),
  variant text check (char_length(variant) <= 60),
  year smallint not null check (year between 1980 and 2100),
  category_slug text not null references public.vehicle_categories (slug) on update cascade,
  transmission public.transmission_type not null,
  fuel_type public.fuel_type not null,
  seats smallint not null check (seats between 1 and 30),
  color text check (char_length(color) <= 40),
  plate_number text check (char_length(plate_number) <= 20),
  description text check (char_length(description) <= 5000),
  status public.vehicle_status not null default 'ACTIVE',
  self_drive boolean not null default true,
  with_driver boolean not null default false,
  delivery_available boolean not null default false,
  pickup_location text check (char_length(pickup_location) <= 200),
  city text not null check (char_length(city) between 2 and 80),
  min_rental_days smallint not null default 1 check (min_rental_days between 1 and 90),
  search tsvector generated always as (
    to_tsvector('simple'::regconfig,
      coalesce(make, '') || ' ' || coalesce(model, '') || ' ' || coalesce(variant, '') || ' ' ||
      coalesce(category_slug, '') || ' ' || coalesce(city, '') || ' ' || coalesce(color, ''))
  ) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (self_drive or with_driver)
);
create unique index vehicles_business_slug_key on public.vehicles (business_id, slug) where deleted_at is null;
create index vehicles_business_idx on public.vehicles (business_id);
create index vehicles_search_idx on public.vehicles using gin (search);
create index vehicles_public_idx on public.vehicles (city, category_slug) where deleted_at is null and status = 'ACTIVE';

create table public.vehicle_pricing (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  daily_rate numeric(12, 2) not null check (daily_rate > 0),
  weekly_rate numeric(12, 2) check (weekly_rate > 0),
  monthly_rate numeric(12, 2) check (monthly_rate > 0),
  security_deposit numeric(12, 2) not null default 0 check (security_deposit >= 0),
  mileage_limit_km integer check (mileage_limit_km > 0), -- per day; null = unlimited
  excess_km_fee numeric(12, 2) check (excess_km_fee >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  driver_fee_per_day numeric(12, 2) not null default 0 check (driver_fee_per_day >= 0),
  currency char(3) not null default 'PHP',
  updated_at timestamptz not null default now()
);
create index vehicle_pricing_daily_idx on public.vehicle_pricing (daily_rate);

create table public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index vehicle_images_vehicle_idx on public.vehicle_images (vehicle_id, position);

-- Availability is "open unless booked or blocked": blocks + bookings are the source of truth
-- (spec: vehicle_availability / vehicle_blocked_dates). Public reads go through vehicle_unavailable_ranges().
create table public.vehicle_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  period tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  reason public.block_reason not null default 'BLOCKED',
  note text check (char_length(note) <= 300),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index vehicle_blocked_dates_period_idx on public.vehicle_blocked_dates using gist (vehicle_id, period);
create index vehicle_blocked_dates_business_idx on public.vehicle_blocked_dates (business_id);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vehicle_id)
);

-- ─── Conversations (inquiries) ───────────────────────────────────────────
-- A conversation without a booking IS an inquiry (spec: inquiries + conversations + participants).
-- Participants are derived: the customer + the business's members.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  last_sender_role public.message_sender_role,
  business_replied boolean not null default false,
  customer_last_read_at timestamptz,
  business_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique nulls not distinct (business_id, customer_id, vehicle_id)
);
create index conversations_business_idx on public.conversations (business_id, last_message_at desc);
create index conversations_customer_idx on public.conversations (customer_id, last_message_at desc);

-- ─── Bookings ─────────────────────────────────────────────────────────────
create or replace function public.generate_booking_reference()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return '13C-' || result;
end $$;

-- Booking requests are bookings in BOOKING_REQUESTED / PENDING_OWNER_APPROVAL (spec: booking_requests + bookings).
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.generate_booking_reference(),
  business_id uuid not null references public.businesses (id),
  vehicle_id uuid not null references public.vehicles (id),
  renter_id uuid not null references public.profiles (id),
  conversation_id uuid references public.conversations (id) on delete set null,
  status public.booking_status not null,
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  period tstzrange generated always as (tstzrange(pickup_at, return_at, '[)')) stored,
  pickup_location text not null check (char_length(pickup_location) between 2 and 200),
  return_location text not null check (char_length(return_location) between 2 and 200),
  with_driver boolean not null default false,
  delivery boolean not null default false,
  drivers_count smallint not null default 1 check (drivers_count between 1 and 5),
  notes text check (char_length(notes) <= 2000),
  payment_method public.payment_method_type not null,
  payment_status public.payment_status not null default 'UNPAID',
  rental_days integer not null check (rental_days >= 1),
  daily_rate numeric(12, 2) not null check (daily_rate >= 0),
  base_amount numeric(12, 2) not null check (base_amount >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  driver_fee numeric(12, 2) not null default 0 check (driver_fee >= 0),
  other_fees numeric(12, 2) not null default 0 check (other_fees >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  security_deposit numeric(12, 2) not null default 0 check (security_deposit >= 0),
  mileage_limit_km integer,
  excess_km_fee numeric(12, 2),
  currency char(3) not null default 'PHP',
  created_by uuid references public.profiles (id),
  approved_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancel_reason text check (char_length(cancel_reason) <= 500),
  picked_up_at timestamptz,
  returned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (return_at > pickup_at),
  -- The database-level double-booking guard.
  constraint bookings_no_overlap exclude using gist (vehicle_id with =, period with &&)
    where (status in ('APPROVED', 'CONTRACT_DRAFT', 'CONTRACT_SENT', 'AWAITING_SIGNATURE', 'SIGNED', 'CONFIRMED', 'ACTIVE'))
);
create index bookings_business_idx on public.bookings (business_id, pickup_at desc);
create index bookings_renter_idx on public.bookings (renter_id, pickup_at desc);
create index bookings_vehicle_period_idx on public.bookings using gist (vehicle_id, period);
create index bookings_status_idx on public.bookings (status);

create table public.booking_status_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_id uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index booking_status_history_booking_idx on public.booking_status_history (booking_id, created_at);

-- The state machine. Mirrored in src/lib/bookings/status.ts (a test keeps them identical).
create table public.booking_transitions (
  from_status public.booking_status not null,
  to_status public.booking_status not null,
  actor text not null check (actor in ('RENTER', 'BUSINESS', 'SYSTEM')),
  primary key (from_status, to_status, actor)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid default auth.uid() references public.profiles (id) on delete set null,
  sender_role public.message_sender_role not null default 'CUSTOMER',
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  business_id uuid not null references public.businesses (id),
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method_type not null,
  reference text check (char_length(reference) <= 120),
  note text check (char_length(note) <= 500),
  paid_at timestamptz not null default now(),
  recorded_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);

-- ─── Contracts ────────────────────────────────────────────────────────────
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null,
  sections jsonb not null check (jsonb_typeof(sections) = 'array'),
  is_active boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (name, version)
);
create unique index contract_templates_one_active on public.contract_templates ((true)) where is_active;

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  business_id uuid not null references public.businesses (id),
  renter_id uuid not null references public.profiles (id),
  status public.contract_status not null default 'DRAFT',
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contracts_business_idx on public.contracts (business_id);
create index contracts_renter_idx on public.contracts (renter_id);

create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  version integer not null check (version >= 1),
  template_id uuid references public.contract_templates (id),
  status public.contract_status not null default 'DRAFT',
  title text not null default 'VEHICLE RENTAL AGREEMENT',
  data jsonb not null,
  sections jsonb not null,
  content_hash text not null,
  sent_at timestamptz,
  sent_by uuid references public.profiles (id),
  signed_at timestamptz,
  pdf_path text,
  pdf_sha256 text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (contract_id, version)
);

create table public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.contract_versions (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  signer_id uuid not null references public.profiles (id),
  signer_role public.signer_role not null,
  signer_name text not null check (char_length(signer_name) between 2 and 120),
  signature_type public.signature_type not null,
  signature_data text check (signature_data is null or char_length(signature_data) <= 500000),
  content_hash text not null,
  ip_address inet,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (contract_version_id, signer_role),
  check (signature_type = 'TYPED' or signature_data like 'data:image/png;base64,%')
);

-- ─── Reviews, notifications, audit, reports, analytics, settings ─────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id),
  business_id uuid not null references public.businesses (id),
  vehicle_id uuid not null references public.vehicles (id),
  renter_id uuid not null references public.profiles (id),
  rating smallint not null check (rating between 1 and 5),
  vehicle_rating smallint check (vehicle_rating between 1 and 5),
  business_rating smallint check (business_rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  business_response text check (char_length(business_response) <= 2000),
  responded_at timestamptz,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_business_idx on public.reviews (business_id, created_at desc);
create index reviews_vehicle_idx on public.reviews (vehicle_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  business_id uuid references public.businesses (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('BUSINESS', 'VEHICLE', 'REVIEW', 'USER')),
  entity_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 120),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'OPEN',
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

create table public.page_views (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  viewer_hash text not null check (char_length(viewer_hash) between 8 and 128),
  viewed_on date not null default ((now() at time zone 'Asia/Manila')::date),
  created_at timestamptz not null default now(),
  unique nulls not distinct (business_id, vehicle_id, viewer_hash, viewed_on)
);
create index page_views_business_idx on public.page_views (business_id, viewed_on);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ─── GPS (future; no UI in MVP) ──────────────────────────────────────────
create table public.gps_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null,
  status text not null default 'DISCONNECTED' check (status in ('DISCONNECTED', 'CONNECTED', 'ERROR')),
  settings jsonb not null default '{}'::jsonb, -- never store secrets here; use Vault
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gps_devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  integration_id uuid not null references public.gps_integrations (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  external_id text not null,
  label text,
  status text not null default 'UNKNOWN',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (integration_id, external_id)
);

create table public.gps_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  device_id uuid not null references public.gps_devices (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  event_type text not null, -- POSITION | GEOFENCE_EXIT | RENTAL_EXPIRED | UNAUTHORIZED_MOVEMENT | TRACKER_OFFLINE
  lat double precision,
  lng double precision,
  speed_kph real,
  payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index gps_events_vehicle_idx on public.gps_events (vehicle_id, recorded_at desc);

-- RLS on for every table; policies in 0004.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
