-- RPCs: every multi-step or privileged write. Each SECURITY DEFINER function re-checks authorization.
-- Errors are raised as stable codes (e.g. 'VEHICLE_UNAVAILABLE') and mapped to friendly copy in src/lib/errors.ts.

-- ═════════════════════════════ Businesses ═════════════════════════════════
create or replace function public.register_business(
  p_name text, p_slug text, p_city text, p_province text default 'Cebu',
  p_address text default null, p_phone text default null, p_email text default null,
  p_description text default null, p_representative_name text default null,
  p_representative_title text default null, p_registration_type text default null,
  p_registration_number text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if (select count(*) from public.businesses where owner_id = v_uid and deleted_at is null) >= 3 then
    raise exception 'BUSINESS_LIMIT' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.businesses where slug = lower(p_slug)) then
    raise exception 'SLUG_TAKEN' using errcode = 'P0001';
  end if;
  insert into public.businesses (owner_id, name, slug, city, province, address, phone, email, description,
    representative_name, representative_title, registration_type, registration_number, status)
  values (v_uid, btrim(p_name), lower(p_slug), btrim(p_city), coalesce(nullif(btrim(p_province), ''), 'Cebu'),
    p_address, p_phone, p_email, p_description, p_representative_name, p_representative_title,
    p_registration_type, p_registration_number, 'DRAFT')
  returning id into v_id;
  -- Sensible store defaults: pickup at the business city, cash accepted.
  update public.business_storefronts set pickup_locations = array[btrim(p_city)] where business_id = v_id;
  perform public.log_audit('business.registered', 'business', v_id, v_id, jsonb_build_object('name', p_name));
  return v_id;
end $$;

create or replace function public.is_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'
     and not public.is_reserved_slug(p_slug)
     and not exists (select 1 from public.businesses where slug = p_slug)
$$;

create or replace function public.submit_business_verification(p_business_id uuid, p_documents jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses;
begin
  if not public.has_business_role(p_business_id, 'OWNER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into b from public.businesses where id = p_business_id for update;
  if b.status not in ('DRAFT', 'CHANGES_REQUESTED', 'REJECTED') then
    raise exception 'VERIFICATION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) = 0 then
    raise exception 'DOCUMENTS_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_documents) d
             where coalesce(d ->> 'path', '') not like p_business_id::text || '/%') then
    raise exception 'INVALID_DOCUMENT' using errcode = 'P0001';
  end if;
  if b.representative_name is null or b.phone is null or b.address is null then
    raise exception 'BUSINESS_PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;
  insert into public.business_verifications (business_id, submitted_by, documents, submitter_note)
  values (p_business_id, (select auth.uid()), p_documents, p_note);
  update public.businesses set status = 'PENDING', status_note = null where id = p_business_id;
  perform public.notify_admins('verification_submitted', 'Business awaiting verification', b.name, '/admin/businesses/' || b.id);
  perform public.log_audit('business.verification_submitted', 'business', b.id, b.id, '{}'::jsonb);
end $$;

create or replace function public.admin_review_business(p_business_id uuid, p_decision public.business_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses;
  v_title text;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if p_decision not in ('UNDER_REVIEW', 'VERIFIED', 'CHANGES_REQUESTED', 'REJECTED', 'SUSPENDED') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;
  select * into b from public.businesses where id = p_business_id for update;
  if b.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_decision in ('CHANGES_REQUESTED', 'REJECTED', 'SUSPENDED') and coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED' using errcode = 'P0001';
  end if;

  update public.businesses set
    status = p_decision,
    status_note = p_note,
    verified_at = case when p_decision = 'VERIFIED' then coalesce(verified_at, now()) else verified_at end
  where id = p_business_id;

  if p_decision <> 'SUSPENDED' then
    update public.business_verifications set
      decision = case when p_decision = 'UNDER_REVIEW' then null else p_decision end,
      review_note = p_note, reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = (select id from public.business_verifications where business_id = p_business_id order by created_at desc limit 1);
  else
    update public.business_storefronts set is_published = false where business_id = p_business_id;
  end if;

  v_title := case p_decision
    when 'UNDER_REVIEW' then 'Your verification is under review'
    when 'VERIFIED' then 'Your business is verified 🎉'
    when 'CHANGES_REQUESTED' then 'Changes requested on your verification'
    when 'REJECTED' then 'Verification was not approved'
    when 'SUSPENDED' then 'Your business has been suspended' end;
  perform public.notify_business(p_business_id, 'verification_' || lower(p_decision::text), v_title,
    coalesce(p_note, case when p_decision = 'VERIFIED' then 'You can now publish your 13C store.' end),
    '/dashboard/profile', 'OWNER');
  perform public.log_audit('business.' || lower(p_decision::text), 'business', b.id, b.id,
    jsonb_build_object('note', p_note, 'from', b.status));
end $$;

create or replace function public.set_storefront_published(p_business_id uuid, p_publish boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses;
begin
  if not public.has_business_role(p_business_id, 'OWNER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into b from public.businesses where id = p_business_id;
  if p_publish then
    if b.status <> 'VERIFIED' then raise exception 'BUSINESS_NOT_VERIFIED' using errcode = 'P0001'; end if;
    if not exists (
      select 1 from public.vehicles v join public.vehicle_pricing p on p.vehicle_id = v.id
      where v.business_id = p_business_id and v.status = 'ACTIVE' and v.deleted_at is null
    ) then
      raise exception 'STORE_NEEDS_VEHICLE' using errcode = 'P0001';
    end if;
  end if;
  update public.business_storefronts set
    is_published = p_publish,
    published_at = case when p_publish then now() else published_at end
  where business_id = p_business_id;
  perform public.log_audit(case when p_publish then 'store.published' else 'store.unpublished' end,
    'business', p_business_id, p_business_id, '{}'::jsonb);
end $$;

create or replace function public.add_business_member(p_business_id uuid, p_email text, p_role public.business_role)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_plan public.subscription_plan;
begin
  if not public.has_business_role(p_business_id, 'OWNER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_role = 'OWNER' then raise exception 'INVALID_ROLE' using errcode = 'P0001'; end if;
  select plan into v_plan from public.subscriptions where business_id = p_business_id;
  if v_plan <> 'BUSINESS' then raise exception 'PLAN_STAFF_LIMIT' using errcode = 'P0001'; end if;
  select id into v_user from public.profiles where lower(email) = lower(btrim(p_email));
  if v_user is null then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;
  insert into public.business_members (business_id, user_id, role) values (p_business_id, v_user, p_role)
  on conflict (business_id, user_id) do update set role = excluded.role
  where public.business_members.role <> 'OWNER';
  perform public.notify_user(v_user, 'team_added', 'You were added to a business team',
    (select name from public.businesses where id = p_business_id), '/dashboard', p_business_id);
  perform public.log_audit('team.member_added', 'business', p_business_id, p_business_id,
    jsonb_build_object('user_id', v_user, 'role', p_role));
end $$;

create or replace function public.remove_business_member(p_business_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_business_role(p_business_id, 'OWNER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  delete from public.business_members where business_id = p_business_id and user_id = p_user_id and role <> 'OWNER';
  perform public.log_audit('team.member_removed', 'business', p_business_id, p_business_id, jsonb_build_object('user_id', p_user_id));
end $$;

create or replace function public.admin_set_plan(p_business_id uuid, p_plan public.subscription_plan, p_status public.subscription_status default 'ACTIVE')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  update public.subscriptions set plan = p_plan, status = p_status where business_id = p_business_id;
  perform public.log_audit('subscription.changed', 'business', p_business_id, p_business_id, jsonb_build_object('plan', p_plan, 'status', p_status));
end $$;

-- Public: accepted payment methods only (account details are for members / renters with bookings).
create or replace function public.get_public_payment_methods(p_business_id uuid)
returns setof public.payment_method_type language sql stable security definer set search_path = '' as $$
  select method from public.payment_methods
  where business_id = p_business_id and is_enabled and public.is_business_public(p_business_id)
  order by method
$$;

-- ═════════════════════════════ Vehicles ═══════════════════════════════════
-- SECURITY INVOKER: RLS on vehicles / vehicle_pricing does the authorization; this just makes it atomic.
create or replace function public.save_vehicle(p_business_id uuid, p_vehicle_id uuid, p_vehicle jsonb, p_pricing jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := p_vehicle_id;
  v_base text;
  v_slug text;
  n int := 1;
begin
  if not public.has_business_role(p_business_id, 'MANAGER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_id is null then
    v_base := coalesce(nullif(public.slugify(concat_ws(' ', p_vehicle ->> 'make', p_vehicle ->> 'model', p_vehicle ->> 'variant')), ''), 'vehicle');
    v_slug := v_base;
    while exists (select 1 from public.vehicles where business_id = p_business_id and slug = v_slug and deleted_at is null) loop
      n := n + 1;
      v_slug := v_base || '-' || n;
    end loop;
    insert into public.vehicles (business_id, slug, make, model, variant, year, category_slug, transmission, fuel_type,
      seats, color, plate_number, description, status, self_drive, with_driver, delivery_available, pickup_location, city, min_rental_days)
    values (p_business_id, v_slug, btrim(p_vehicle ->> 'make'), btrim(p_vehicle ->> 'model'), nullif(btrim(p_vehicle ->> 'variant'), ''),
      (p_vehicle ->> 'year')::smallint, p_vehicle ->> 'category_slug', (p_vehicle ->> 'transmission')::public.transmission_type,
      (p_vehicle ->> 'fuel_type')::public.fuel_type, (p_vehicle ->> 'seats')::smallint, nullif(p_vehicle ->> 'color', ''),
      nullif(p_vehicle ->> 'plate_number', ''), nullif(p_vehicle ->> 'description', ''),
      coalesce((p_vehicle ->> 'status')::public.vehicle_status, 'ACTIVE'),
      coalesce((p_vehicle ->> 'self_drive')::boolean, true), coalesce((p_vehicle ->> 'with_driver')::boolean, false),
      coalesce((p_vehicle ->> 'delivery_available')::boolean, false), nullif(p_vehicle ->> 'pickup_location', ''),
      btrim(p_vehicle ->> 'city'), coalesce((p_vehicle ->> 'min_rental_days')::smallint, 1))
    returning id into v_id;
  else
    update public.vehicles set
      make = btrim(p_vehicle ->> 'make'), model = btrim(p_vehicle ->> 'model'), variant = nullif(btrim(p_vehicle ->> 'variant'), ''),
      year = (p_vehicle ->> 'year')::smallint, category_slug = p_vehicle ->> 'category_slug',
      transmission = (p_vehicle ->> 'transmission')::public.transmission_type, fuel_type = (p_vehicle ->> 'fuel_type')::public.fuel_type,
      seats = (p_vehicle ->> 'seats')::smallint, color = nullif(p_vehicle ->> 'color', ''), plate_number = nullif(p_vehicle ->> 'plate_number', ''),
      description = nullif(p_vehicle ->> 'description', ''), status = coalesce((p_vehicle ->> 'status')::public.vehicle_status, status),
      self_drive = coalesce((p_vehicle ->> 'self_drive')::boolean, self_drive), with_driver = coalesce((p_vehicle ->> 'with_driver')::boolean, with_driver),
      delivery_available = coalesce((p_vehicle ->> 'delivery_available')::boolean, delivery_available),
      pickup_location = nullif(p_vehicle ->> 'pickup_location', ''), city = btrim(p_vehicle ->> 'city'),
      min_rental_days = coalesce((p_vehicle ->> 'min_rental_days')::smallint, min_rental_days)
    where id = v_id and business_id = p_business_id and deleted_at is null;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  end if;

  insert into public.vehicle_pricing (vehicle_id, daily_rate, weekly_rate, monthly_rate, security_deposit,
    mileage_limit_km, excess_km_fee, delivery_fee, driver_fee_per_day)
  values (v_id, (p_pricing ->> 'daily_rate')::numeric, nullif(p_pricing ->> 'weekly_rate', '')::numeric,
    nullif(p_pricing ->> 'monthly_rate', '')::numeric, coalesce(nullif(p_pricing ->> 'security_deposit', '')::numeric, 0),
    nullif(p_pricing ->> 'mileage_limit_km', '')::int, nullif(p_pricing ->> 'excess_km_fee', '')::numeric,
    coalesce(nullif(p_pricing ->> 'delivery_fee', '')::numeric, 0), coalesce(nullif(p_pricing ->> 'driver_fee_per_day', '')::numeric, 0))
  on conflict (vehicle_id) do update set
    daily_rate = excluded.daily_rate, weekly_rate = excluded.weekly_rate, monthly_rate = excluded.monthly_rate,
    security_deposit = excluded.security_deposit, mileage_limit_km = excluded.mileage_limit_km,
    excess_km_fee = excluded.excess_km_fee, delivery_fee = excluded.delivery_fee, driver_fee_per_day = excluded.driver_fee_per_day;
  return v_id;
end $$;

create or replace function public.archive_vehicle(p_vehicle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.vehicles;
begin
  select * into v from public.vehicles where id = p_vehicle_id;
  if v.id is null or not public.has_business_role(v.business_id, 'MANAGER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if exists (select 1 from public.bookings b where b.vehicle_id = p_vehicle_id
             and b.status in ('PENDING_OWNER_APPROVAL', 'BOOKING_REQUESTED', 'APPROVED', 'CONTRACT_DRAFT', 'CONTRACT_SENT',
                              'AWAITING_SIGNATURE', 'SIGNED', 'CONFIRMED', 'ACTIVE')) then
    raise exception 'VEHICLE_HAS_BOOKINGS' using errcode = 'P0001';
  end if;
  update public.vehicles set deleted_at = now(), status = 'INACTIVE' where id = p_vehicle_id;
  update public.business_storefronts set featured_vehicle_ids = array_remove(featured_vehicle_ids, p_vehicle_id)
  where business_id = v.business_id;
end $$;

-- Ranges a vehicle cannot be booked — no renter details exposed.
create or replace function public.vehicle_unavailable_ranges(p_vehicle_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, kind text)
language sql stable security definer set search_path = '' as $$
  select b.pickup_at, b.return_at, 'BOOKED'
  from public.bookings b
  join public.vehicles v on v.id = b.vehicle_id
  where b.vehicle_id = p_vehicle_id and b.status = any (public.blocking_statuses())
    and b.period && tstzrange(p_from, p_to, '[)')
    and (public.is_business_public(v.business_id) or public.has_business_role(v.business_id))
  union all
  select d.starts_at, d.ends_at, d.reason::text
  from public.vehicle_blocked_dates d
  where d.vehicle_id = p_vehicle_id and d.period && tstzrange(p_from, p_to, '[)')
    and (public.is_business_public(d.business_id) or public.has_business_role(d.business_id))
  order by 1
$$;

-- ═════════════════════════════ Pricing ════════════════════════════════════
-- The single price calculator (previews + stored snapshots). Days = ceil(hours / 24).
create or replace function public.quote_booking(
  p_vehicle_id uuid, p_pickup_at timestamptz, p_return_at timestamptz,
  p_with_driver boolean default false, p_delivery boolean default false
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v public.vehicles;
  p public.vehicle_pricing;
  v_days int;
  v_base numeric;
  v_rate_note text := 'daily';
  v_driver numeric := 0;
  v_delivery numeric := 0;
begin
  select * into v from public.vehicles where id = p_vehicle_id and deleted_at is null;
  if v.id is null or not (public.is_business_public(v.business_id) or public.has_business_role(v.business_id)
                          or exists (select 1 from public.bookings b where b.vehicle_id = v.id and b.renter_id = (select auth.uid()))) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into p from public.vehicle_pricing where vehicle_id = v.id;
  if p.vehicle_id is null then raise exception 'NO_PRICING' using errcode = 'P0001'; end if;
  if p_return_at <= p_pickup_at then raise exception 'INVALID_DATES' using errcode = 'P0001'; end if;
  if p_return_at - p_pickup_at > interval '90 days' then raise exception 'RENTAL_TOO_LONG' using errcode = 'P0001'; end if;
  if p_with_driver and not v.with_driver then raise exception 'DRIVER_NOT_OFFERED' using errcode = 'P0001'; end if;
  if not p_with_driver and not v.self_drive then raise exception 'SELF_DRIVE_NOT_OFFERED' using errcode = 'P0001'; end if;
  if p_delivery and not v.delivery_available then raise exception 'DELIVERY_NOT_OFFERED' using errcode = 'P0001'; end if;

  v_days := greatest(1, ceil(extract(epoch from (p_return_at - p_pickup_at)) / 86400.0)::int);
  if v_days < v.min_rental_days then
    raise exception 'MIN_RENTAL_DAYS' using errcode = 'P0001', detail = v.min_rental_days::text;
  end if;

  v_base := v_days * p.daily_rate;
  if p.monthly_rate is not null and v_days >= 30 then
    if least(floor(v_days / 30.0) * p.monthly_rate + mod(v_days, 30) * p.daily_rate, ceil(v_days / 30.0) * p.monthly_rate) < v_base then
      v_base := least(floor(v_days / 30.0) * p.monthly_rate + mod(v_days, 30) * p.daily_rate, ceil(v_days / 30.0) * p.monthly_rate);
      v_rate_note := 'monthly';
    end if;
  elsif p.weekly_rate is not null and v_days >= 7 then
    if least(floor(v_days / 7.0) * p.weekly_rate + mod(v_days, 7) * p.daily_rate, ceil(v_days / 7.0) * p.weekly_rate) < v_base then
      v_base := least(floor(v_days / 7.0) * p.weekly_rate + mod(v_days, 7) * p.daily_rate, ceil(v_days / 7.0) * p.weekly_rate);
      v_rate_note := 'weekly';
    end if;
  end if;
  if p_with_driver then v_driver := v_days * p.driver_fee_per_day; end if;
  if p_delivery then v_delivery := p.delivery_fee; end if;

  return jsonb_build_object(
    'rental_days', v_days, 'daily_rate', p.daily_rate, 'rate_applied', v_rate_note,
    'base_amount', v_base, 'driver_fee', v_driver, 'delivery_fee', v_delivery,
    'total_amount', v_base + v_driver + v_delivery, 'security_deposit', p.security_deposit,
    'mileage_limit_km', p.mileage_limit_km, 'excess_km_fee', p.excess_km_fee, 'currency', p.currency
  );
end $$;

create or replace function public.is_vehicle_available(p_vehicle_id uuid, p_from timestamptz, p_to timestamptz, p_ignore_booking uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.bookings b
    where b.vehicle_id = p_vehicle_id and b.status = any (public.blocking_statuses())
      and b.period && tstzrange(p_from, p_to, '[)') and b.id is distinct from p_ignore_booking
  ) and not exists (
    select 1 from public.vehicle_blocked_dates d
    where d.vehicle_id = p_vehicle_id and d.period && tstzrange(p_from, p_to, '[)')
  )
$$;

-- ═════════════════════════════ Messaging ══════════════════════════════════
create or replace function public.start_conversation(p_business_id uuid, p_vehicle_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if not public.is_business_public(p_business_id) then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if public.member_has_role(p_business_id, v_uid) then raise exception 'OWN_BUSINESS' using errcode = 'P0001'; end if;
  if p_vehicle_id is not null and not exists (select 1 from public.vehicles where id = p_vehicle_id and business_id = p_business_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.conversations (business_id, customer_id, vehicle_id)
  values (p_business_id, v_uid, p_vehicle_id)
  on conflict (business_id, customer_id, vehicle_id) do update set business_id = excluded.business_id
  returning id into v_id;
  if coalesce(btrim(p_body), '') <> '' then
    insert into public.messages (conversation_id, sender_id, sender_role, body) values (v_id, v_uid, 'CUSTOMER', p_body);
  end if;
  return v_id;
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  v_uid uuid := (select auth.uid());
begin
  select * into c from public.conversations where id = p_conversation_id;
  if c.customer_id = v_uid then
    update public.conversations set customer_last_read_at = now() where id = c.id;
    update public.notifications set read_at = now()
      where user_id = v_uid and link = '/account/messages/' || c.id and read_at is null;
  elsif public.has_business_role(c.business_id) then
    update public.conversations set business_last_read_at = now() where id = c.id;
    update public.notifications set read_at = now()
      where user_id = v_uid and link = '/dashboard/messages/' || c.id and read_at is null;
  end if;
end $$;

create or replace function public.post_system_message(p_conversation_id uuid, p_body text, p_booking_id uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.messages (conversation_id, sender_id, sender_role, body, booking_id)
  select p_conversation_id, null, 'SYSTEM', p_body, p_booking_id where p_conversation_id is not null
$$;

-- ═════════════════════════════ Bookings ═══════════════════════════════════
create or replace function public.apply_booking_status(p_booking_id uuid, p_to public.booking_status, p_actor uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);
  perform set_config('app.status_note', coalesce(p_note, ''), true);
  update public.bookings set status = p_to,
    cancel_reason = case when p_to in ('CANCELLED', 'REJECTED') then p_note else cancel_reason end,
    cancelled_by = case when p_to in ('CANCELLED', 'REJECTED') then p_actor else cancelled_by end
  where id = p_booking_id;
  perform set_config('app.status_note', '', true);
end $$;

create or replace function public.assert_renter_ready(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles pr join public.renters r on r.user_id = pr.id
    where pr.id = p_user and not pr.is_suspended
      and coalesce(btrim(coalesce(r.legal_name, pr.full_name)), '') <> ''
      and coalesce(btrim(pr.phone), '') <> '' and coalesce(btrim(r.address), '') <> ''
      and coalesce(btrim(r.license_number), '') <> ''
  ) then
    raise exception 'RENTER_PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.request_booking(
  p_vehicle_id uuid, p_pickup_at timestamptz, p_return_at timestamptz,
  p_pickup_location text, p_return_location text, p_payment_method public.payment_method_type,
  p_with_driver boolean default false, p_delivery boolean default false,
  p_drivers_count int default 1, p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v public.vehicles;
  q jsonb;
  v_conv uuid;
  v_id uuid;
  v_ref text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  perform public.assert_renter_ready(v_uid);
  select * into v from public.vehicles where id = p_vehicle_id and deleted_at is null and status = 'ACTIVE';
  if v.id is null or not public.is_business_public(v.business_id) then
    raise exception 'VEHICLE_NOT_BOOKABLE' using errcode = 'P0001';
  end if;
  if public.member_has_role(v.business_id, v_uid) then raise exception 'OWN_BUSINESS' using errcode = 'P0001'; end if;
  if p_pickup_at < now() + interval '1 hour' then raise exception 'PICKUP_IN_PAST' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.payment_methods where business_id = v.business_id and method = p_payment_method and is_enabled) then
    raise exception 'PAYMENT_METHOD_NOT_ACCEPTED' using errcode = 'P0001';
  end if;
  if not public.is_vehicle_available(v.id, p_pickup_at, p_return_at) then
    raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bookings b where b.vehicle_id = v.id and b.renter_id = v_uid
             and b.status in ('PENDING_OWNER_APPROVAL', 'BOOKING_REQUESTED')
             and b.period && tstzrange(p_pickup_at, p_return_at, '[)')) then
    raise exception 'DUPLICATE_REQUEST' using errcode = 'P0001';
  end if;

  q := public.quote_booking(v.id, p_pickup_at, p_return_at, p_with_driver, p_delivery);

  insert into public.conversations (business_id, customer_id, vehicle_id) values (v.business_id, v_uid, v.id)
  on conflict (business_id, customer_id, vehicle_id) do update set business_id = excluded.business_id
  returning id into v_conv;

  insert into public.bookings (business_id, vehicle_id, renter_id, conversation_id, status, pickup_at, return_at,
    pickup_location, return_location, with_driver, delivery, drivers_count, notes, payment_method,
    rental_days, daily_rate, base_amount, delivery_fee, driver_fee, total_amount, security_deposit,
    mileage_limit_km, excess_km_fee, created_by)
  values (v.business_id, v.id, v_uid, v_conv, 'PENDING_OWNER_APPROVAL', p_pickup_at, p_return_at,
    btrim(p_pickup_location), btrim(p_return_location), p_with_driver, p_delivery, greatest(1, least(p_drivers_count, 5)),
    nullif(btrim(p_notes), ''), p_payment_method,
    (q ->> 'rental_days')::int, (q ->> 'daily_rate')::numeric, (q ->> 'base_amount')::numeric,
    (q ->> 'delivery_fee')::numeric, (q ->> 'driver_fee')::numeric, (q ->> 'total_amount')::numeric,
    (q ->> 'security_deposit')::numeric, (q ->> 'mileage_limit_km')::int, (q ->> 'excess_km_fee')::numeric, v_uid)
  returning id, reference into v_id, v_ref;

  perform public.post_system_message(v_conv,
    'Booking request ' || v_ref || ' submitted: ' || public.fmt_ts(p_pickup_at) || ' → ' || public.fmt_ts(p_return_at)
    || ' · ' || public.fmt_money((q ->> 'total_amount')::numeric), v_id);
  return v_id;
end $$;

-- Business turns a conversation into a proposal; the renter accepts it (→ APPROVED → contract).
create or replace function public.propose_booking(
  p_conversation_id uuid, p_vehicle_id uuid, p_pickup_at timestamptz, p_return_at timestamptz,
  p_pickup_location text, p_return_location text, p_with_driver boolean default false,
  p_delivery boolean default false, p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  c public.conversations;
  v public.vehicles;
  q jsonb;
  v_method public.payment_method_type;
  v_id uuid;
  v_ref text;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null or not public.has_business_role(c.business_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into v from public.vehicles where id = p_vehicle_id and business_id = c.business_id and deleted_at is null and status = 'ACTIVE';
  if v.id is null then raise exception 'VEHICLE_NOT_BOOKABLE' using errcode = 'P0001'; end if;
  if p_pickup_at < now() then raise exception 'PICKUP_IN_PAST' using errcode = 'P0001'; end if;
  if not public.is_vehicle_available(v.id, p_pickup_at, p_return_at) then
    raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select method into v_method from public.payment_methods where business_id = c.business_id and is_enabled order by method limit 1;
  if v_method is null then raise exception 'NO_PAYMENT_METHODS' using errcode = 'P0001'; end if;
  q := public.quote_booking(v.id, p_pickup_at, p_return_at, p_with_driver, p_delivery);

  insert into public.bookings (business_id, vehicle_id, renter_id, conversation_id, status, pickup_at, return_at,
    pickup_location, return_location, with_driver, delivery, notes, payment_method,
    rental_days, daily_rate, base_amount, delivery_fee, driver_fee, total_amount, security_deposit,
    mileage_limit_km, excess_km_fee, created_by)
  values (c.business_id, v.id, c.customer_id, c.id, 'BOOKING_REQUESTED', p_pickup_at, p_return_at,
    btrim(p_pickup_location), btrim(p_return_location), p_with_driver, p_delivery, nullif(btrim(p_notes), ''), v_method,
    (q ->> 'rental_days')::int, (q ->> 'daily_rate')::numeric, (q ->> 'base_amount')::numeric,
    (q ->> 'delivery_fee')::numeric, (q ->> 'driver_fee')::numeric, (q ->> 'total_amount')::numeric,
    (q ->> 'security_deposit')::numeric, (q ->> 'mileage_limit_km')::int, (q ->> 'excess_km_fee')::numeric, v_uid)
  returning id, reference into v_id, v_ref;

  perform public.post_system_message(c.id, 'Booking proposal ' || v_ref || ': ' || public.fmt_ts(p_pickup_at) || ' → '
    || public.fmt_ts(p_return_at) || ' · ' || public.fmt_money((q ->> 'total_amount')::numeric) || '. Review and accept it in your bookings.', v_id);
  return v_id;
end $$;

-- ═════════════════════════════ Contracts ══════════════════════════════════
create or replace function public.render_template(p_text text, p_vars jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare
  r record;
  v_out text := p_text;
begin
  for r in select key, value from jsonb_each_text(p_vars) loop
    v_out := replace(v_out, '{{' || r.key || '}}', coalesce(r.value, '—'));
  end loop;
  return regexp_replace(v_out, '\{\{[a-z_]+\}\}', '—', 'g');
end $$;

create or replace function public.label_enum(p text)
returns text language sql immutable set search_path = '' as $$
  select case p
    when 'GCASH' then 'GCash' when 'MAYA' then 'Maya' when 'BANK_TRANSFER' then 'Bank Transfer'
    when 'PAYMENT_ON_PICKUP' then 'Payment on pickup' when 'PARTIALLY_PAID' then 'Partially paid'
    else initcap(replace(lower(p), '_', ' ')) end
$$;

create or replace function public.contract_vars(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  b public.bookings;
  biz public.businesses;
  sf public.business_storefronts;
  pr public.profiles;
  r public.renters;
  v public.vehicles;
  pol jsonb;
  v_mileage text;
begin
  select * into b from public.bookings where id = p_booking_id;
  select * into biz from public.businesses where id = b.business_id;
  select * into sf from public.business_storefronts where business_id = b.business_id;
  select * into pr from public.profiles where id = b.renter_id;
  select * into r from public.renters where user_id = b.renter_id;
  select * into v from public.vehicles where id = b.vehicle_id;
  pol := coalesce(sf.policies, '{}'::jsonb);

  v_mileage := case when b.mileage_limit_km is null then 'Unlimited mileage is included.'
    else b.mileage_limit_km || ' km per rental day is included (' || (b.mileage_limit_km * b.rental_days) || ' km total). Excess distance is charged at '
         || public.fmt_money(coalesce(b.excess_km_fee, 0)) || ' per km.' end
    || coalesce(' ' || nullif(btrim(pol ->> 'mileage'), ''), '');

  return jsonb_build_object(
    'agreement_date', public.fmt_date(now()),
    'booking_reference', b.reference,
    'provider_name', biz.name,
    'provider_registration', coalesce(nullif(concat_ws(' No. ', biz.registration_type, biz.registration_number), ''), 'registration on file with 13C'),
    'provider_address', concat_ws(', ', nullif(biz.address, ''), biz.city, biz.province),
    'provider_city', biz.city,
    'provider_phone', coalesce(biz.phone, '—'),
    'provider_email', coalesce(biz.email, '—'),
    'provider_representative', coalesce(nullif(concat_ws(', ', biz.representative_name, biz.representative_title), ''), '—'),
    'renter_name', coalesce(nullif(btrim(r.legal_name), ''), pr.full_name),
    'renter_address', concat_ws(', ', nullif(r.address, ''), nullif(r.city, '')),
    'renter_phone', coalesce(pr.phone, '—'),
    'renter_email', coalesce(pr.email, '—'),
    'renter_license', coalesce(r.license_number, '—') || coalesce(' (valid until ' || to_char(r.license_expiry, 'Mon DD, YYYY') || ')', ''),
    'vehicle_name', concat_ws(' ', v.year, v.make, v.model, v.variant),
    'vehicle_plate', coalesce(v.plate_number, 'to be confirmed at pickup'),
    'vehicle_color', coalesce(v.color, '—'),
    'vehicle_transmission', public.label_enum(v.transmission::text),
    'vehicle_fuel', public.label_enum(v.fuel_type::text),
    'vehicle_seats', v.seats::text,
    'service_type', case when b.with_driver then 'With driver provided by the Rental Provider' else 'Self-drive' end,
    'pickup_at', public.fmt_ts(b.pickup_at),
    'return_at', public.fmt_ts(b.return_at),
    'pickup_location', b.pickup_location,
    'return_location', b.return_location,
    'rental_days', b.rental_days::text,
    'drivers_count', b.drivers_count::text,
    'daily_rate', public.fmt_money(b.daily_rate),
    'base_amount', public.fmt_money(b.base_amount),
    'delivery_fee', public.fmt_money(b.delivery_fee),
    'driver_fee', public.fmt_money(b.driver_fee),
    'other_fees', public.fmt_money(b.other_fees),
    'discount', public.fmt_money(b.discount),
    'total_amount', public.fmt_money(b.total_amount),
    'security_deposit', public.fmt_money(b.security_deposit),
    'payment_method', public.label_enum(b.payment_method::text),
    'payment_status', public.label_enum(b.payment_status::text),
    'mileage_policy', v_mileage,
    'fuel_policy', coalesce(nullif(btrim(pol ->> 'fuel'), ''), 'The Vehicle is released with a recorded fuel level and must be returned with the same level. Missing fuel is charged at prevailing pump prices plus a reasonable refuelling fee.'),
    'late_return_policy', coalesce(nullif(btrim(pol ->> 'late_return'), ''), 'A grace period of one (1) hour applies. Beyond that, each additional hour is charged at one-tenth (1/10) of the daily rate, and returns more than six (6) hours late are charged one (1) full additional day, subject to availability.'),
    'cancellation_policy', coalesce(nullif(btrim(pol ->> 'cancellation'), ''), 'Cancellations made at least 48 hours before pickup are free of charge. Cancellations within 48 hours of pickup may forfeit any reservation deposit paid. No-shows are charged one (1) rental day.'),
    'deposit_policy', coalesce(nullif(btrim(pol ->> 'deposit'), ''), 'The security deposit is refunded within seven (7) days after return, less any amounts lawfully due under this Agreement.'),
    'requirements_policy', coalesce(nullif(btrim(pol ->> 'requirements'), ''), 'A valid Philippine or international driver''s license and one (1) valid government-issued ID must be presented at pickup.'),
    'prohibited_use_extra', coalesce(nullif(btrim(pol ->> 'prohibited'), ''), 'None.'),
    'other_terms', coalesce(nullif(btrim(pol ->> 'other'), ''), 'None.'),
    'platform_name', '13C'
  );
end $$;

-- Renders the active template for a booking and moves it to CONTRACT_DRAFT.
-- Creates v1, or a new version when revising/amending (signed versions are never touched).
create or replace function public.generate_contract(p_booking_id uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  t public.contract_templates;
  c public.contracts;
  v_vars jsonb;
  v_sections jsonb;
  v_version int;
  v_version_id uuid;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  select * into t from public.contract_templates where is_active;
  if t.id is null then raise exception 'NO_ACTIVE_TEMPLATE' using errcode = 'P0001'; end if;

  v_vars := public.contract_vars(p_booking_id);
  select jsonb_agg(jsonb_build_object('key', s ->> 'key', 'title', s ->> 'title',
           'body', public.render_template(s ->> 'body', v_vars)) order by ord)
    into v_sections
  from jsonb_array_elements(t.sections) with ordinality as x(s, ord);

  select * into c from public.contracts where booking_id = p_booking_id for update;
  if c.id is null then
    insert into public.contracts (booking_id, business_id, renter_id, status, current_version)
    values (b.id, b.business_id, b.renter_id, 'DRAFT', 1) returning * into c;
    v_version := 1;
  else
    update public.contract_versions set status = 'SUPERSEDED'
      where contract_id = c.id and status in ('DRAFT', 'SENT');
    v_version := c.current_version + 1;
    update public.contracts set current_version = v_version, status = 'DRAFT' where id = c.id;
  end if;

  insert into public.contract_versions (contract_id, booking_id, version, template_id, status, data, sections, content_hash, created_by)
  values (c.id, b.id, v_version, t.id, 'DRAFT', v_vars, v_sections,
          encode(sha256(convert_to(v_sections::text, 'UTF8')), 'hex'), p_actor)
  returning id into v_version_id;

  if b.status <> 'CONTRACT_DRAFT' then
    perform public.apply_booking_status(b.id, 'CONTRACT_DRAFT', p_actor, 'Contract v' || v_version || ' generated');
  end if;
  perform public.log_audit(case when v_version = 1 then 'contract.created' else 'contract.modified' end,
    'contract', c.id, b.business_id, jsonb_build_object('version', v_version, 'booking', b.reference), p_actor);
  return v_version_id;
end $$;

-- Central transition entry point for renters/businesses/admins.
create or replace function public.transition_booking(p_booking_id uuid, p_to public.booking_status, p_note text default null)
returns public.booking_status language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  b public.bookings;
  v_actor text;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if public.is_admin() then v_actor := 'ADMIN';
  elsif b.renter_id = v_uid then v_actor := 'RENTER';
  elsif public.has_business_role(b.business_id) then v_actor := 'BUSINESS';
  else raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.booking_transitions t
    where t.from_status = b.status and t.to_status = p_to
      and (t.actor = v_actor or (v_actor = 'ADMIN' and t.actor <> 'SYSTEM'))
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001', detail = b.status || ' -> ' || p_to;
  end if;
  if p_to in ('REJECTED') and coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED' using errcode = 'P0001';
  end if;
  if p_to = 'APPROVED' then
    perform public.assert_renter_ready(b.renter_id);
  end if;

  perform public.apply_booking_status(b.id, p_to, v_uid, p_note);

  if p_to = 'APPROVED' then
    perform public.generate_contract(b.id, v_uid);
  elsif p_to in ('CANCELLED', 'REJECTED', 'EXPIRED') then
    update public.contract_versions set status = 'CANCELLED'
      where booking_id = b.id and status in ('DRAFT', 'SENT');
    update public.contracts set status = 'CANCELLED' where booking_id = b.id and status <> 'SIGNED';
    perform public.log_audit('contract.cancelled', 'booking', b.id, b.business_id, '{}'::jsonb, v_uid);
  end if;

  if b.conversation_id is not null and p_to in ('APPROVED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'RETURNED', 'COMPLETED') then
    perform public.post_system_message(b.conversation_id,
      'Booking ' || b.reference || ' · ' || public.label_enum(p_to::text) || coalesce(' — ' || nullif(btrim(p_note), ''), ''), b.id);
  end if;

  return (select status from public.bookings where id = b.id);
end $$;

create or replace function public.accept_booking_proposal(p_booking_id uuid, p_payment_method public.payment_method_type)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or b.renter_id <> (select auth.uid()) then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if b.status <> 'BOOKING_REQUESTED' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.payment_methods where business_id = b.business_id and method = p_payment_method and is_enabled) then
    raise exception 'PAYMENT_METHOD_NOT_ACCEPTED' using errcode = 'P0001';
  end if;
  update public.bookings set payment_method = p_payment_method where id = b.id;
  perform public.transition_booking(b.id, 'APPROVED', 'Proposal accepted by renter');
end $$;

-- Business revises the agreement (refresh draft, or amend a sent/signed one → new version to re-sign).
create or replace function public.regenerate_contract(p_booking_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null or not public.has_business_role(b.business_id, 'MANAGER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if b.status not in ('CONTRACT_DRAFT', 'CONTRACT_SENT', 'AWAITING_SIGNATURE', 'SIGNED', 'CONFIRMED') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if b.status in ('SIGNED', 'CONFIRMED') then
    perform public.notify_user(b.renter_id, 'contract_amended', 'Your rental agreement is being updated',
      b.reference || ' · you will be asked to sign the new version', '/account/bookings/' || b.id, b.business_id);
  end if;
  return public.generate_contract(b.id, (select auth.uid()));
end $$;

-- Business adjusts dates/fees before pickup. Re-quotes, and refreshes the contract if one exists.
create or replace function public.update_booking_terms(
  p_booking_id uuid, p_pickup_at timestamptz, p_return_at timestamptz,
  p_pickup_location text, p_return_location text,
  p_other_fees numeric default 0, p_discount numeric default 0, p_security_deposit numeric default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  q jsonb;
  v_total numeric;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or not public.has_business_role(b.business_id, 'MANAGER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if b.status not in ('BOOKING_REQUESTED', 'PENDING_OWNER_APPROVAL', 'CONTRACT_DRAFT', 'CONTRACT_SENT', 'AWAITING_SIGNATURE', 'SIGNED', 'CONFIRMED') then
    raise exception 'BOOKING_LOCKED' using errcode = 'P0001';
  end if;
  if not public.is_vehicle_available(b.vehicle_id, p_pickup_at, p_return_at, b.id) then
    raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  q := public.quote_booking(b.vehicle_id, p_pickup_at, p_return_at, b.with_driver, b.delivery);
  v_total := (q ->> 'total_amount')::numeric + coalesce(p_other_fees, 0) - coalesce(p_discount, 0);
  if v_total < 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  update public.bookings set
    pickup_at = p_pickup_at, return_at = p_return_at,
    pickup_location = btrim(p_pickup_location), return_location = btrim(p_return_location),
    rental_days = (q ->> 'rental_days')::int, daily_rate = (q ->> 'daily_rate')::numeric,
    base_amount = (q ->> 'base_amount')::numeric, delivery_fee = (q ->> 'delivery_fee')::numeric,
    driver_fee = (q ->> 'driver_fee')::numeric, other_fees = coalesce(p_other_fees, 0), discount = coalesce(p_discount, 0),
    total_amount = v_total, security_deposit = coalesce(p_security_deposit, security_deposit)
  where id = b.id;
  perform public.log_audit('booking.terms_updated', 'booking', b.id, b.business_id,
    jsonb_build_object('reference', b.reference, 'total', v_total));
  if b.status in ('CONTRACT_DRAFT', 'CONTRACT_SENT', 'AWAITING_SIGNATURE', 'SIGNED', 'CONFIRMED') then
    perform public.regenerate_contract(b.id);
  end if;
end $$;

-- Called by the server (secret key) so IP/user-agent come from the request, not the client.
create or replace function public.send_contract(p_actor_id uuid, p_contract_id uuid, p_signer_name text, p_ip inet, p_user_agent text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.contracts;
  cv public.contract_versions;
  b public.bookings;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if c.id is null or not public.member_has_role(c.business_id, p_actor_id, 'MANAGER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into cv from public.contract_versions where contract_id = c.id and version = c.current_version for update;
  select * into b from public.bookings where id = c.booking_id;
  if cv.status <> 'DRAFT' or b.status <> 'CONTRACT_DRAFT' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_signer_name, ''))) < 2 then raise exception 'SIGNATURE_REQUIRED' using errcode = 'P0001'; end if;

  insert into public.contract_signatures (contract_version_id, booking_id, signer_id, signer_role, signer_name, signature_type, content_hash, ip_address, user_agent)
  values (cv.id, b.id, p_actor_id, 'PROVIDER', btrim(p_signer_name), 'TYPED', cv.content_hash, p_ip, left(p_user_agent, 400));
  update public.contract_versions set status = 'SENT', sent_at = now(), sent_by = p_actor_id where id = cv.id;
  update public.contracts set status = 'SENT' where id = c.id;
  perform public.apply_booking_status(b.id, 'CONTRACT_SENT', p_actor_id, 'Contract v' || cv.version || ' sent');
  perform public.post_system_message(b.conversation_id, 'Rental agreement v' || cv.version || ' for ' || b.reference || ' was sent for signature.', b.id);
  perform public.log_audit('contract.sent', 'contract', c.id, c.business_id, jsonb_build_object('version', cv.version), p_actor_id);
end $$;

create or replace function public.mark_contract_viewed(p_contract_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.contracts;
  b public.bookings;
begin
  select * into c from public.contracts where id = p_contract_id;
  if c.id is null or c.renter_id <> (select auth.uid()) then return; end if;
  select * into b from public.bookings where id = c.booking_id;
  if b.status = 'CONTRACT_SENT' then
    perform public.apply_booking_status(b.id, 'AWAITING_SIGNATURE', (select auth.uid()), 'Renter opened the contract');
  end if;
end $$;

create or replace function public.sign_contract(
  p_actor_id uuid, p_version_id uuid, p_signature_type public.signature_type, p_signer_name text,
  p_signature_data text, p_content_hash text, p_agreed boolean, p_ip inet, p_user_agent text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  cv public.contract_versions;
  c public.contracts;
  b public.bookings;
begin
  select * into cv from public.contract_versions where id = p_version_id for update;
  if cv.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into c from public.contracts where id = cv.contract_id for update;
  select * into b from public.bookings where id = cv.booking_id for update;
  if b.renter_id <> p_actor_id then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if cv.version <> c.current_version or cv.status <> 'SENT' or b.status not in ('CONTRACT_SENT', 'AWAITING_SIGNATURE') then
    raise exception 'CONTRACT_NOT_SIGNABLE' using errcode = 'P0001';
  end if;
  if not coalesce(p_agreed, false) then raise exception 'AGREEMENT_REQUIRED' using errcode = 'P0001'; end if;
  if p_content_hash is distinct from cv.content_hash then raise exception 'CONTRACT_CHANGED' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_signer_name, ''))) < 2 then raise exception 'SIGNATURE_REQUIRED' using errcode = 'P0001'; end if;
  if p_signature_type = 'DRAWN' and coalesce(p_signature_data, '') not like 'data:image/png;base64,%' then
    raise exception 'SIGNATURE_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.contract_signatures (contract_version_id, booking_id, signer_id, signer_role, signer_name, signature_type, signature_data, content_hash, ip_address, user_agent)
  values (cv.id, b.id, p_actor_id, 'RENTER', btrim(p_signer_name), p_signature_type,
          case when p_signature_type = 'DRAWN' then p_signature_data end, cv.content_hash, p_ip, left(p_user_agent, 400));
  update public.contract_versions set status = 'SIGNED', signed_at = now() where id = cv.id;
  update public.contracts set status = 'SIGNED' where id = c.id;
  perform public.apply_booking_status(b.id, 'SIGNED', p_actor_id, 'Contract v' || cv.version || ' signed');
  perform public.apply_booking_status(b.id, 'CONFIRMED', p_actor_id, 'Booking confirmed');
  perform public.post_system_message(b.conversation_id, 'Rental agreement v' || cv.version || ' was signed. Booking ' || b.reference || ' is confirmed.', b.id);
  perform public.log_audit('contract.signed', 'contract', c.id, c.business_id, jsonb_build_object('version', cv.version), p_actor_id);
end $$;

create or replace function public.attach_contract_pdf(p_version_id uuid, p_path text, p_sha256 text)
returns void language sql security definer set search_path = '' as $$
  update public.contract_versions set pdf_path = p_path, pdf_sha256 = p_sha256
  where id = p_version_id and status = 'SIGNED' and pdf_path is null
$$;

create or replace function public.admin_save_contract_template(p_name text, p_sections jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_version int;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) = 0 then
    raise exception 'INVALID_TEMPLATE' using errcode = 'P0001';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.contract_templates where name = p_name;
  update public.contract_templates set is_active = false where is_active;
  insert into public.contract_templates (name, version, sections, is_active, created_by)
  values (p_name, v_version, p_sections, true, (select auth.uid())) returning id into v_id;
  perform public.log_audit('contract_template.published', 'contract_template', v_id, null, jsonb_build_object('version', v_version));
  return v_id;
end $$;

-- ═════════════════════════════ Reviews & reports ══════════════════════════
create or replace function public.create_review(p_booking_id uuid, p_rating int, p_vehicle_rating int, p_business_rating int, p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v_id uuid;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null or b.renter_id <> (select auth.uid()) then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if b.status <> 'COMPLETED' then raise exception 'REVIEW_NOT_ALLOWED' using errcode = 'P0001'; end if;
  insert into public.reviews (booking_id, business_id, vehicle_id, renter_id, rating, vehicle_rating, business_rating, comment)
  values (b.id, b.business_id, b.vehicle_id, b.renter_id, p_rating, p_vehicle_rating, p_business_rating, nullif(btrim(p_comment), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_to_review(p_review_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  rv public.reviews;
begin
  select * into rv from public.reviews where id = p_review_id;
  if rv.id is null or not public.has_business_role(rv.business_id, 'MANAGER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  update public.reviews set business_response = nullif(btrim(p_response), ''), responded_at = now() where id = rv.id;
end $$;

create or replace function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  update public.reviews set is_hidden = p_hidden where id = p_review_id;
  perform public.log_audit(case when p_hidden then 'review.hidden' else 'review.unhidden' end, 'review', p_review_id);
end $$;

create or replace function public.admin_resolve_report(p_report_id uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  update public.reports set status = p_status, resolution_note = p_note,
    resolved_by = case when p_status in ('RESOLVED', 'DISMISSED') then (select auth.uid()) end,
    resolved_at = case when p_status in ('RESOLVED', 'DISMISSED') then now() end
  where id = p_report_id;
end $$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if p_user_id = (select auth.uid()) then raise exception 'INVALID_TARGET' using errcode = 'P0001'; end if;
  update public.profiles set is_suspended = p_suspended where id = p_user_id;
  perform public.log_audit(case when p_suspended then 'user.suspended' else 'user.reinstated' end, 'user', p_user_id);
end $$;

create or replace function public.admin_set_kyc_status(p_user_id uuid, p_status public.kyc_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  update public.renters set kyc_status = p_status, kyc_note = p_note where user_id = p_user_id;
  perform public.log_audit('user.kyc_' || lower(p_status::text), 'user', p_user_id);
end $$;

create or replace function public.request_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set deletion_requested_at = now() where id = (select auth.uid());
  perform public.notify_admins('deletion_requested', 'Account deletion requested',
    (select email from public.profiles where id = (select auth.uid())), '/admin/users');
end $$;

-- Data Privacy Act: erase personal data but keep legally required booking/contract records.
create or replace function public.admin_anonymize_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  update public.profiles set full_name = 'Deleted user', phone = null, avatar_path = null, email = null,
    is_suspended = true, marketing_opt_in = false where id = p_user_id;
  update public.renters set legal_name = null, date_of_birth = null, address = null, city = null,
    license_number = null, license_expiry = null, kyc_status = 'UNVERIFIED' where user_id = p_user_id;
  delete from public.driver_documents where user_id = p_user_id;
  delete from public.favorites where user_id = p_user_id;
  perform public.log_audit('user.anonymized', 'user', p_user_id);
end $$;

-- ═════════════════════════════ Public reads ═══════════════════════════════
create or replace function public.track_view(p_business_id uuid, p_vehicle_id uuid, p_viewer_hash text)
returns void language sql security definer set search_path = '' as $$
  insert into public.page_views (business_id, vehicle_id, viewer_hash)
  select p_business_id, p_vehicle_id, left(p_viewer_hash, 128)
  where public.is_business_public(p_business_id) and char_length(p_viewer_hash) >= 8
    and not public.has_business_role(p_business_id)
  on conflict do nothing
$$;

create or replace function public.business_public_stats(p_ids uuid[])
returns table (business_id uuid, vehicle_count bigint, rating numeric, review_count bigint, response_minutes int, completed_rentals bigint)
language sql stable security definer set search_path = '' as $$
  select b.id,
    (select count(*) from public.vehicles v where v.business_id = b.id and v.deleted_at is null and v.status = 'ACTIVE'),
    (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.business_id = b.id and not r.is_hidden),
    (select count(*) from public.reviews r where r.business_id = b.id and not r.is_hidden),
    (select round(percentile_cont(0.5) within group (order by extract(epoch from (fb.t - fc.t)) / 60))::int
       from public.conversations c
       cross join lateral (select min(m.created_at) t from public.messages m where m.conversation_id = c.id and m.sender_role = 'CUSTOMER') fc
       cross join lateral (select min(m.created_at) t from public.messages m where m.conversation_id = c.id and m.sender_role = 'BUSINESS' and m.created_at > fc.t) fb
       where c.business_id = b.id and fb.t is not null and c.created_at > now() - interval '90 days'),
    (select count(*) from public.bookings bk where bk.business_id = b.id and bk.status = 'COMPLETED')
  from public.businesses b
  where b.id = any (p_ids) and (public.is_business_public(b.id) or public.has_business_role(b.id) or public.is_admin())
$$;

create or replace function public.public_reviews(p_business_id uuid, p_vehicle_id uuid default null, p_limit int default 20)
returns table (id uuid, rating smallint, vehicle_rating smallint, business_rating smallint, comment text,
               business_response text, responded_at timestamptz, created_at timestamptz, reviewer_name text, vehicle_name text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.vehicle_rating, r.business_rating, r.comment, r.business_response, r.responded_at, r.created_at,
    coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Renter')
      || coalesce(' ' || nullif(left(split_part(btrim(p.full_name), ' ', 2), 1), '') || '.', ''),
    concat_ws(' ', v.make, v.model)
  from public.reviews r
  join public.profiles p on p.id = r.renter_id
  join public.vehicles v on v.id = r.vehicle_id
  where r.business_id = p_business_id and not r.is_hidden
    and (p_vehicle_id is null or r.vehicle_id = p_vehicle_id)
    and (public.is_business_public(p_business_id) or public.has_business_role(p_business_id))
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- Marketplace search. Returns only public data (verified + published businesses, active vehicles).
create or replace function public.search_vehicles(
  p_cities text[] default null, p_q text default null, p_category text default null,
  p_transmission public.transmission_type default null, p_min_seats int default null,
  p_min_price numeric default null, p_max_price numeric default null,
  p_self_drive boolean default null, p_with_driver boolean default null, p_delivery boolean default null,
  p_min_rating numeric default null, p_business_id uuid default null,
  p_start timestamptz default null, p_end timestamptz default null,
  p_sort text default 'recommended', p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, slug text, make text, model text, variant text, year smallint, category_slug text,
  transmission public.transmission_type, fuel_type public.fuel_type, seats smallint, city text,
  self_drive boolean, with_driver boolean, delivery_available boolean, daily_rate numeric, weekly_rate numeric,
  business_id uuid, business_name text, business_slug text, business_logo_path text, accent_color text,
  image_path text, rating numeric, review_count bigint, created_at timestamptz, total_count bigint
) language sql stable security definer set search_path = '' as $$
  with base as (
    select v.*, p.daily_rate, p.weekly_rate, b.name as business_name, b.slug as business_slug, b.logo_path as business_logo_path,
      s.accent_color, s.delivery_areas,
      (select i.storage_path from public.vehicle_images i where i.vehicle_id = v.id order by i.position, i.created_at limit 1) as image_path,
      rt.rating, coalesce(rt.review_count, 0) as review_count
    from public.vehicles v
    join public.vehicle_pricing p on p.vehicle_id = v.id
    join public.businesses b on b.id = v.business_id
    join public.business_storefronts s on s.business_id = b.id
    left join lateral (
      select round(avg(r.rating)::numeric, 1) as rating, count(*) as review_count
      from public.reviews r where r.vehicle_id = v.id and not r.is_hidden
    ) rt on true
    where v.deleted_at is null and v.status = 'ACTIVE'
      and b.status = 'VERIFIED' and b.deleted_at is null and s.is_published
      and (p_business_id is null or v.business_id = p_business_id)
      and (p_cities is null or cardinality(p_cities) = 0
           or lower(v.city) = any (select lower(x) from unnest(p_cities) x)
           or (v.delivery_available and exists (select 1 from unnest(s.delivery_areas) a, unnest(p_cities) x where lower(a) = lower(x))))
      and (p_q is null or btrim(p_q) = '' or v.search @@ plainto_tsquery('simple', p_q)
           or (v.make || ' ' || v.model) ilike '%' || p_q || '%' or b.name ilike '%' || p_q || '%')
      and (p_category is null or v.category_slug = p_category)
      and (p_transmission is null or v.transmission = p_transmission)
      and (p_min_seats is null or v.seats >= p_min_seats)
      and (p_min_price is null or p.daily_rate >= p_min_price)
      and (p_max_price is null or p.daily_rate <= p_max_price)
      and (p_self_drive is null or not p_self_drive or v.self_drive)
      and (p_with_driver is null or not p_with_driver or v.with_driver)
      and (p_delivery is null or not p_delivery or v.delivery_available)
      and (p_start is null or p_end is null or p_end <= p_start or public.is_vehicle_available(v.id, p_start, p_end))
  )
  select id, slug, make, model, variant, year, category_slug, transmission, fuel_type, seats, city,
    self_drive, with_driver, delivery_available, daily_rate, weekly_rate, business_id, business_name, business_slug,
    business_logo_path, accent_color, image_path, rating, review_count, created_at, count(*) over () as total_count
  from base
  where p_min_rating is null or coalesce(rating, 0) >= p_min_rating
  order by
    case when p_sort = 'price_asc' then daily_rate end asc,
    case when p_sort = 'price_desc' then daily_rate end desc,
    case when p_sort = 'newest' then created_at end desc,
    rating desc nulls last, review_count desc, created_at desc
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
$$;

-- ═════════════════════════════ Analytics ══════════════════════════════════
create or replace function public.business_analytics(p_business_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  v_requests bigint;
  v_confirmed bigint;
begin
  if not (public.has_business_role(p_business_id) or public.is_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select count(*) into v_requests from public.bookings where business_id = p_business_id and created_at >= v_from;
  select count(*) into v_confirmed from public.bookings where business_id = p_business_id and created_at >= v_from
    and status in ('CONFIRMED', 'ACTIVE', 'RETURNED', 'COMPLETED');
  return jsonb_build_object(
    'store_views', (select count(*) from public.page_views where business_id = p_business_id and vehicle_id is null and created_at >= v_from),
    'vehicle_views', (select count(*) from public.page_views where business_id = p_business_id and vehicle_id is not null and created_at >= v_from),
    'inquiries', (select count(*) from public.conversations where business_id = p_business_id and created_at >= v_from),
    'booking_requests', v_requests,
    'confirmed_bookings', v_confirmed,
    'completed_bookings', (select count(*) from public.bookings where business_id = p_business_id and created_at >= v_from and status = 'COMPLETED'),
    'conversion_rate', case when v_requests = 0 then 0 else round(v_confirmed::numeric * 100 / v_requests, 1) end,
    'revenue', (select coalesce(sum(total_amount), 0) from public.bookings where business_id = p_business_id and created_at >= v_from
                and status in ('CONFIRMED', 'ACTIVE', 'RETURNED', 'COMPLETED')),
    'daily', (select coalesce(jsonb_agg(d order by d ->> 'day'), '[]'::jsonb) from (
        select jsonb_build_object('day', g::date,
          'views', (select count(*) from public.page_views pv where pv.business_id = p_business_id and pv.viewed_on = g::date),
          'requests', (select count(*) from public.bookings bk where bk.business_id = p_business_id
                       and (bk.created_at at time zone 'Asia/Manila')::date = g::date)) d
        from generate_series((v_from at time zone 'Asia/Manila')::date, (now() at time zone 'Asia/Manila')::date, interval '1 day') g) x),
    'top_vehicles', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select v.id, concat_ws(' ', v.make, v.model) as name, count(pv.id) as views,
          (select count(*) from public.bookings bk where bk.vehicle_id = v.id and bk.created_at >= v_from) as requests
        from public.vehicles v left join public.page_views pv on pv.vehicle_id = v.id and pv.created_at >= v_from
        where v.business_id = p_business_id and v.deleted_at is null
        group by v.id order by views desc, requests desc limit 5) t),
    'top_dates', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select (pickup_at at time zone 'Asia/Manila')::date as day, count(*) as requests
        from public.bookings where business_id = p_business_id and created_at >= v_from
        group by 1 order by 2 desc, 1 limit 5) t)
  );
end $$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  return jsonb_build_object(
    'businesses', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.businesses where deleted_at is null group by status) x),
    'published_stores', (select count(*) from public.business_storefronts where is_published),
    'vehicles', (select count(*) from public.vehicles where deleted_at is null),
    'users', (select count(*) from public.profiles),
    'bookings', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.bookings group by status) x),
    'gmv', (select coalesce(sum(total_amount), 0) from public.bookings where status in ('CONFIRMED', 'ACTIVE', 'RETURNED', 'COMPLETED')),
    'conversations', (select count(*) from public.conversations),
    'open_reports', (select count(*) from public.reports where status in ('OPEN', 'REVIEWING')),
    'pending_verifications', (select count(*) from public.businesses where status in ('PENDING', 'UNDER_REVIEW')),
    'top_locations', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select v.city, count(b.id) as bookings from public.bookings b join public.vehicles v on v.id = b.vehicle_id
        group by v.city order by 2 desc limit 5) t),
    'top_businesses', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select bz.id, bz.name, bz.slug, count(b.id) as bookings, coalesce(sum(b.total_amount) filter (where b.status in ('CONFIRMED','ACTIVE','RETURNED','COMPLETED')), 0) as gmv
        from public.businesses bz left join public.bookings b on b.business_id = bz.id
        where bz.deleted_at is null group by bz.id order by bookings desc limit 5) t)
  );
end $$;

-- ═════════════════════════════ Scheduled ══════════════════════════════════
create or replace function public.expire_stale_bookings()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select id from public.bookings
           where status in ('PENDING_OWNER_APPROVAL', 'BOOKING_REQUESTED', 'INQUIRY', 'NEGOTIATING') and pickup_at < now()
           for update skip locked loop
    perform public.apply_booking_status(r.id, 'EXPIRED', null, 'Pickup time passed without approval');
    n := n + 1;
  end loop;
  return n;
end $$;
