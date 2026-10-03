-- Helpers used by RLS + triggers that enforce business rules.

-- ─── Authorization helpers ───────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function public.role_rank(p public.business_role)
returns int language sql immutable set search_path = '' as $$
  select case p when 'OWNER' then 3 when 'MANAGER' then 2 when 'STAFF' then 1 else 0 end
$$;

-- Explicit-user variant (for service-role calls where auth.uid() is null).
create or replace function public.member_has_role(p_business uuid, p_user uuid, p_min public.business_role default 'STAFF')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business and m.user_id = p_user
      and public.role_rank(m.role) >= public.role_rank(p_min)
  )
$$;

create or replace function public.has_business_role(p_business uuid, p_min public.business_role default 'STAFF')
returns boolean language sql stable security definer set search_path = '' as $$
  select public.member_has_role(p_business, (select auth.uid()), p_min)
$$;

create or replace function public.is_business_public(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses b
    join public.business_storefronts s on s.business_id = b.id
    where b.id = p_business and b.status = 'VERIFIED' and s.is_published and b.deleted_at is null
  )
$$;

create or replace function public.is_booking_party(p_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking
      and (b.renter_id = (select auth.uid()) or public.has_business_role(b.business_id))
  )
$$;

create or replace function public.blocking_statuses()
returns public.booking_status[] language sql immutable set search_path = '' as $$
  select array['APPROVED','CONTRACT_DRAFT','CONTRACT_SENT','AWAITING_SIGNATURE','SIGNED','CONFIRMED','ACTIVE']::public.booking_status[]
$$;

create or replace function public.plan_vehicle_limit(p public.subscription_plan)
returns int language sql immutable set search_path = '' as $$
  select case p when 'FREE' then 3 when 'PRO' then 20 else null end
$$;

-- ─── Formatting (contracts, messages) ────────────────────────────────────
create or replace function public.fmt_money(p numeric)
returns text language sql immutable set search_path = '' as $$
  select 'PHP ' || to_char(coalesce(p, 0), 'FM999,999,999,990.00')
$$;

create or replace function public.fmt_ts(p timestamptz)
returns text language sql stable set search_path = '' as $$
  select to_char(p at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM')
$$;

create or replace function public.fmt_date(p timestamptz)
returns text language sql stable set search_path = '' as $$
  select to_char(p at time zone 'Asia/Manila', 'Mon DD, YYYY')
$$;

-- ─── Notifications + audit (internal) ────────────────────────────────────
create or replace function public.notify_user(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_business uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link, business_id)
  values (p_user, p_type, p_title, p_body, p_link, p_business)
$$;

create or replace function public.notify_business(p_business uuid, p_type text, p_title text, p_body text, p_link text, p_min public.business_role default 'STAFF')
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link, business_id)
  select m.user_id, p_type, p_title, p_body, p_link, p_business
  from public.business_members m
  where m.business_id = p_business and public.role_rank(m.role) >= public.role_rank(p_min)
$$;

create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link from public.profiles where is_admin
$$;

create or replace function public.log_audit(p_action text, p_entity_type text, p_entity_id uuid, p_business uuid default null, p_metadata jsonb default '{}'::jsonb, p_actor uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, business_id, metadata)
  values (coalesce(p_actor, (select auth.uid()), public.try_uuid(nullif(current_setting('app.actor_id', true), ''))),
          p_action, p_entity_type, p_entity_id, p_business, coalesce(p_metadata, '{}'::jsonb))
$$;

-- ─── updated_at ───────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ─── New auth user → profile + renter ────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, phone, terms_accepted_at, marketing_opt_in)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30), ''),
    case when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now() end,
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in') = 'true', false)
  );
  insert into public.renters (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ─── New business → owner membership, storefront, FREE plan ─────────────
create or replace function public.handle_new_business()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.business_members (business_id, user_id, role) values (new.id, new.owner_id, 'OWNER');
  insert into public.business_storefronts (business_id) values (new.id);
  insert into public.subscriptions (business_id) values (new.id);
  return new;
end $$;

create trigger on_business_created after insert on public.businesses
  for each row execute function public.handle_new_business();

-- ─── Plan limit: vehicles ─────────────────────────────────────────────────
create or replace function public.enforce_vehicle_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  v_count int;
begin
  select public.plan_vehicle_limit(s.plan) into v_limit
  from public.subscriptions s where s.business_id = new.business_id;
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.vehicles
  where business_id = new.business_id and deleted_at is null;
  if v_count >= v_limit then
    raise exception 'PLAN_VEHICLE_LIMIT' using errcode = 'P0001', detail = v_limit::text;
  end if;
  return new;
end $$;

create trigger enforce_vehicle_limit before insert on public.vehicles
  for each row execute function public.enforce_vehicle_limit();

-- ─── Cross-table availability guards (bookings ↔ blocked dates) ──────────
-- Both triggers lock the vehicle row so concurrent inserts serialize per vehicle.
create or replace function public.guard_booking_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_business uuid;
begin
  select business_id into v_business from public.vehicles where id = new.vehicle_id for update;
  if v_business is null or v_business <> new.business_id then
    raise exception 'VEHICLE_BUSINESS_MISMATCH' using errcode = 'P0001';
  end if;
  if new.status = any (public.blocking_statuses())
     and (tg_op = 'INSERT' or old.status is distinct from new.status or old.period is distinct from new.period) then
    if exists (
      select 1 from public.vehicle_blocked_dates d
      where d.vehicle_id = new.vehicle_id and d.period && new.period
    ) then
      raise exception 'VEHICLE_BLOCKED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger guard_booking_availability before insert or update of status, pickup_at, return_at on public.bookings
  for each row execute function public.guard_booking_availability();

create or replace function public.guard_blocked_dates()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_business uuid;
begin
  select business_id into v_business from public.vehicles where id = new.vehicle_id for update;
  if v_business is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  new.business_id := v_business;
  if exists (
    select 1 from public.bookings b
    where b.vehicle_id = new.vehicle_id
      and b.status = any (public.blocking_statuses())
      and b.period && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger guard_blocked_dates before insert or update on public.vehicle_blocked_dates
  for each row execute function public.guard_blocked_dates();

-- ─── Booking state machine guard + history + notifications ───────────────
create or replace function public.guard_booking_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not exists (
      select 1 from public.booking_transitions t
      where t.from_status = old.status and t.to_status = new.status
    ) then
      raise exception 'INVALID_TRANSITION' using errcode = 'P0001', detail = old.status || ' -> ' || new.status;
    end if;
    case new.status
      when 'APPROVED' then new.approved_at := coalesce(new.approved_at, now());
      when 'ACTIVE' then new.picked_up_at := now();
      when 'RETURNED' then new.returned_at := now();
      when 'COMPLETED' then new.completed_at := now();
      when 'CANCELLED', 'REJECTED', 'EXPIRED' then new.cancelled_at := now();
      else null;
    end case;
  end if;
  return new;
end $$;

create trigger guard_booking_status before update of status on public.bookings
  for each row execute function public.guard_booking_status();

create or replace function public.on_booking_status_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := coalesce((select auth.uid()), public.try_uuid(nullif(current_setting('app.actor_id', true), '')));
  v_note text := nullif(current_setting('app.status_note', true), '');
  v_vehicle text;
  v_biz_link text := '/dashboard/bookings/' || new.id;
  v_renter_link text := '/account/bookings/' || new.id;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  insert into public.booking_status_history (booking_id, from_status, to_status, actor_id, note)
  values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, v_actor, v_note);

  select concat_ws(' ', v.make, v.model) into v_vehicle from public.vehicles v where v.id = new.vehicle_id;

  case new.status
    when 'PENDING_OWNER_APPROVAL' then
      perform public.notify_business(new.business_id, 'booking_request', 'New booking request',
        v_vehicle || ' · ' || public.fmt_date(new.pickup_at) || ' – ' || public.fmt_date(new.return_at), v_biz_link);
    when 'BOOKING_REQUESTED' then
      perform public.notify_user(new.renter_id, 'booking_proposal', 'Booking proposal received',
        v_vehicle || ' · review and accept to continue', v_renter_link, new.business_id);
    when 'APPROVED' then
      perform public.notify_user(new.renter_id, 'booking_approved', 'Booking approved',
        v_vehicle || ' · your rental agreement is being prepared', v_renter_link, new.business_id);
    when 'CONTRACT_DRAFT' then
      perform public.notify_business(new.business_id, 'contract_generated', 'Contract ready for review',
        new.reference || ' · review and send to the renter', v_biz_link, 'MANAGER');
    when 'CONTRACT_SENT' then
      perform public.notify_user(new.renter_id, 'contract_sent', 'Your rental agreement is ready to sign',
        v_vehicle || ' · ' || new.reference, '/account/bookings/' || new.id || '/contract', new.business_id);
    when 'CONFIRMED' then
      perform public.notify_business(new.business_id, 'contract_signed', 'Contract signed — booking confirmed',
        new.reference || ' · ' || v_vehicle, v_biz_link);
      perform public.notify_user(new.renter_id, 'booking_confirmed', 'Booking confirmed',
        v_vehicle || ' · ' || public.fmt_ts(new.pickup_at), v_renter_link, new.business_id);
    when 'REJECTED' then
      perform public.notify_user(new.renter_id, 'booking_rejected', 'Booking request declined',
        coalesce(v_note, v_vehicle), v_renter_link, new.business_id);
    when 'CANCELLED' then
      if v_actor = new.renter_id then
        perform public.notify_business(new.business_id, 'booking_cancelled', 'Booking cancelled by renter',
          new.reference || coalesce(' · ' || v_note, ''), v_biz_link);
      else
        perform public.notify_user(new.renter_id, 'booking_cancelled', 'Booking cancelled',
          new.reference || coalesce(' · ' || v_note, ''), v_renter_link, new.business_id);
      end if;
    when 'EXPIRED' then
      perform public.notify_user(new.renter_id, 'booking_expired', 'Booking request expired', new.reference, v_renter_link, new.business_id);
    when 'COMPLETED' then
      perform public.notify_user(new.renter_id, 'review_request', 'How was your rental?',
        'Leave a review for ' || v_vehicle, v_renter_link, new.business_id);
    else null;
  end case;

  if new.status in ('APPROVED', 'REJECTED', 'CANCELLED') then
    perform public.log_audit('booking.' || lower(new.status::text), 'booking', new.id, new.business_id,
      jsonb_build_object('reference', new.reference, 'from', case when tg_op = 'UPDATE' then old.status end), v_actor);
  elsif tg_op = 'INSERT' then
    perform public.log_audit('booking.created', 'booking', new.id, new.business_id,
      jsonb_build_object('reference', new.reference, 'status', new.status), v_actor);
  end if;
  return new;
end $$;

create trigger on_booking_status_changed after insert or update of status on public.bookings
  for each row execute function public.on_booking_status_changed();

-- ─── Messages: trusted sender role, conversation summary, notifications ──
create or replace function public.before_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  v_uid uuid := (select auth.uid());
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  -- Requests coming straight from PostgREST: derive the role, never trust the client.
  if v_uid is not null then
    new.sender_id := v_uid;
    if v_uid = c.customer_id then
      new.sender_role := 'CUSTOMER';
    elsif public.member_has_role(c.business_id, v_uid, 'STAFF') then
      new.sender_role := 'BUSINESS';
    else
      raise exception 'NOT_AUTHORIZED' using errcode = '42501';
    end if;
  end if;
  new.body := btrim(new.body);
  return new;
end $$;

create trigger before_message_insert before insert on public.messages
  for each row execute function public.before_message_insert();

create or replace function public.after_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  v_name text;
  v_preview text := left(new.body, 140);
  v_link text;
begin
  update public.conversations set
    last_message_at = new.created_at,
    last_message_preview = v_preview,
    last_sender_role = new.sender_role,
    business_replied = business_replied or new.sender_role = 'BUSINESS',
    customer_last_read_at = case when new.sender_role = 'CUSTOMER' then new.created_at else customer_last_read_at end,
    business_last_read_at = case when new.sender_role = 'BUSINESS' then new.created_at else business_last_read_at end
  where id = new.conversation_id
  returning * into c;

  if new.sender_role = 'CUSTOMER' then
    select coalesce(nullif(full_name, ''), 'A customer') into v_name from public.profiles where id = new.sender_id;
    v_link := '/dashboard/messages/' || c.id;
    -- collapse into one unread notification per conversation
    update public.notifications set body = v_name || ': ' || v_preview, created_at = now()
    where link = v_link and read_at is null and type = 'message';
    if not found then
      perform public.notify_business(c.business_id, 'message',
        case when c.business_replied then 'New message' else 'New inquiry' end,
        v_name || ': ' || v_preview, v_link);
    end if;
  elsif new.sender_role = 'BUSINESS' then
    select name into v_name from public.businesses where id = c.business_id;
    v_link := '/account/messages/' || c.id;
    update public.notifications set body = v_name || ': ' || v_preview, created_at = now()
    where user_id = c.customer_id and link = v_link and read_at is null and type = 'message';
    if not found then
      perform public.notify_user(c.customer_id, 'message', 'New message from ' || v_name, v_preview, v_link, c.business_id);
    end if;
  end if;
  return new;
end $$;

create trigger after_message_insert after insert on public.messages
  for each row execute function public.after_message_insert();

-- ─── Contracts: immutability ─────────────────────────────────────────────
create or replace function public.guard_contract_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CONTRACT_IMMUTABLE' using errcode = 'P0001';
  end if;
  if old.status = 'SIGNED' then
    -- Only the one-time attachment of the rendered PDF is allowed after signing.
    if old.pdf_path is null and new.pdf_path is not null
       and (to_jsonb(new) - 'pdf_path' - 'pdf_sha256') = (to_jsonb(old) - 'pdf_path' - 'pdf_sha256') then
      return new;
    end if;
    raise exception 'CONTRACT_IMMUTABLE' using errcode = 'P0001';
  end if;
  if old.status in ('SENT', 'SUPERSEDED', 'CANCELLED')
     and (new.sections is distinct from old.sections or new.data is distinct from old.data or new.content_hash is distinct from old.content_hash) then
    raise exception 'CONTRACT_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger guard_contract_version before update or delete on public.contract_versions
  for each row execute function public.guard_contract_version();

create or replace function public.guard_contract_signature()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'CONTRACT_IMMUTABLE' using errcode = 'P0001';
end $$;

create trigger guard_contract_signature before update or delete on public.contract_signatures
  for each row execute function public.guard_contract_signature();

-- ─── Payments → booking.payment_status ───────────────────────────────────
create or replace function public.sync_payment_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_booking uuid := coalesce(new.booking_id, old.booking_id);
  v_paid numeric;
  v_total numeric;
  v_current public.payment_status;
begin
  select coalesce(sum(amount), 0) into v_paid from public.payments where booking_id = v_booking;
  select total_amount, payment_status into v_total, v_current from public.bookings where id = v_booking;
  update public.bookings set payment_status = case
      when v_paid >= v_total and v_total > 0 then 'PAID'::public.payment_status
      when v_paid > 0 then 'PARTIALLY_PAID'::public.payment_status
      when v_current = 'PAYMENT_ON_PICKUP' then 'PAYMENT_ON_PICKUP'::public.payment_status
      else 'UNPAID'::public.payment_status end
  where id = v_booking;
  return null;
end $$;

create trigger sync_payment_status after insert or delete on public.payments
  for each row execute function public.sync_payment_status();

create or replace function public.guard_payment_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select business_id into new.business_id from public.bookings where id = new.booking_id;
  new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
  return new;
end $$;

create trigger guard_payment_insert before insert on public.payments
  for each row execute function public.guard_payment_insert();

-- ─── Reviews → notify business ───────────────────────────────────────────
create or replace function public.after_review_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_business(new.business_id, 'review_received', 'New ' || new.rating || '★ review',
    left(coalesce(new.comment, 'A renter rated their rental.'), 140), '/dashboard/reviews');
  return new;
end $$;

create trigger after_review_insert after insert on public.reviews
  for each row execute function public.after_review_insert();

-- ─── Vehicles: audit ─────────────────────────────────────────────────────
create or replace function public.audit_vehicle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('vehicle.created', 'vehicle', new.id, new.business_id,
      jsonb_build_object('name', concat_ws(' ', new.make, new.model)));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_audit('vehicle.archived', 'vehicle', new.id, new.business_id, '{}'::jsonb);
  else
    perform public.log_audit('vehicle.updated', 'vehicle', new.id, new.business_id,
      jsonb_build_object('status', new.status));
  end if;
  return new;
end $$;

create trigger audit_vehicle after insert or update on public.vehicles
  for each row execute function public.audit_vehicle();
