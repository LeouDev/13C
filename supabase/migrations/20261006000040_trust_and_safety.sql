-- Trust and safety:
--   down payment: a renter who said "I've paid" is never cancelled just because the business didn't check in time;
--     the business can answer "Not received" (reject_down_payment); either way an unresolved payment becomes a report for 13C
--   reports: renters and businesses can report a booking (a bad renter, a no-show, a request to pay elsewhere)
--   payment details: owners are told whenever they change (an account takeover can't quietly redirect payments), the change
--     is dated so renters see when it happened after they booked, and GCash/Maya can carry a QR image
--   renters can request a booking before uploading their license and ID (they're still needed before approval); the
--     business hears when they arrive, and requests waiting 2 hours get one reminder

-- ═════════════════════════════ Reports on bookings ═════════════════════════════
alter table public.reports drop constraint reports_entity_type_check,
  add constraint reports_entity_type_check check (entity_type in ('BUSINESS', 'VEHICLE', 'REVIEW', 'USER', 'BOOKING'));

-- A booking can only be reported by its renter or the business (and admins): the bookings policies decide who sees it.
drop policy "reports: create" on public.reports;
create policy "reports: create" on public.reports for insert to authenticated with check (
  reporter_id = (select auth.uid())
  and (entity_type <> 'BOOKING' or exists (select 1 from public.bookings b where b.id = reports.entity_id))
);

create or replace function public.after_report_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_what text := case when new.entity_type = 'BOOKING' then (select 'Booking ' || reference from public.bookings where id = new.entity_id) end;
begin
  perform public.notify_admins('report_submitted', 'New report: ' || new.reason,
    concat_ws(' · ', v_what, coalesce(left(new.details, 200), initcap(new.entity_type) || ' reported')), '/admin/reports');
  return new;
end $$;

-- ═════════════════════════════ Down payment disputes ═════════════════════════════
-- Every 15 minutes, approved bookings still owing their down payment past the deadline:
--   the renter said they paid → held until pickup and the business is asked to confirm (once)
--   otherwise, or still unconfirmed at pickup → cancelled and the dates freed; a reported payment also files a report for 13C
create or replace function public.cancel_unpaid_down_payments(p_booking_id uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select id, business_id, renter_id, reference, conversation_id, pickup_at, down_payment_amount, down_payment_due_at,
                  down_payment_reported_at, down_payment_reference, payment_method
           from public.bookings
           where status = 'APPROVED' and down_payment_amount > 0 and down_payment_due_at < now()
             and (p_booking_id is null or id = p_booking_id)
           for update skip locked loop
    continue when not public.down_payment_pending(r.id);

    if r.down_payment_reported_at is not null and r.down_payment_due_at < r.pickup_at then
      update public.bookings set down_payment_due_at = pickup_at where id = r.id;
      perform public.notify_business(r.business_id, 'down_payment_unconfirmed', 'Please confirm the down payment',
        r.reference || ' · the renter says they sent ' || public.fmt_money(r.down_payment_amount)
          || '. Mark it received, or tap Not received if it never arrived.',
        '/dashboard/bookings/' || r.id);
      perform public.post_system_message(r.conversation_id, 'The renter says they sent the down payment for ' || r.reference
        || ', so the booking stays on hold until pickup while the business checks.', r.id);
      continue;
    end if;

    if r.down_payment_reported_at is not null then
      perform public.apply_booking_status(r.id, 'CANCELLED', null,
        'The business didn''t confirm your down payment before pickup. 13C has been told and will follow up with you both.');
      insert into public.reports (reporter_id, entity_type, entity_id, reason, details)
      values (r.renter_id, 'BOOKING', r.id, 'Down payment not confirmed',
        'The renter reported sending ' || public.fmt_money(r.down_payment_amount) || ' via ' || public.label_enum(r.payment_method::text)
          || coalesce(' (reference ' || r.down_payment_reference || ')', '')
          || ', but the business never confirmed or rejected it. 13C cancelled the booking at pickup time.');
      perform public.notify_business(r.business_id, 'down_payment_missed', 'Booking cancelled: down payment not confirmed',
        r.reference || ' · the renter says they paid; 13C will follow up', '/dashboard/bookings/' || r.id);
    else
      perform public.apply_booking_status(r.id, 'CANCELLED', null, 'The down payment wasn''t received by ' || public.fmt_ts(r.down_payment_due_at) || '.');
      perform public.notify_business(r.business_id, 'down_payment_missed', 'Booking cancelled: no down payment',
        r.reference || ' · the dates are open again', '/dashboard/bookings/' || r.id);
    end if;
    perform public.post_system_message(r.conversation_id, 'Booking ' || r.reference || ' was cancelled because the down payment wasn''t confirmed in time.', r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- The business's "Not received": only after the renter said they paid. Cancels the booking (the dates open again) and files
-- a report so 13C can help sort out who's right.
create function public.reject_down_payment(p_booking_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v_note text := left(nullif(btrim(p_note), ''), 300);
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or not public.has_business_role(b.business_id, 'MANAGER') then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if b.status <> 'APPROVED' or b.down_payment_reported_at is null or not public.down_payment_pending(b.id) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  perform public.apply_booking_status(b.id, 'CANCELLED', (select auth.uid()),
    'The business says your down payment didn''t arrive' || coalesce(' (' || v_note || ')', '') || '. 13C has been told and will follow up.');
  insert into public.reports (entity_type, entity_id, reason, details)
  values ('BOOKING', b.id, 'Down payment dispute',
    'The renter reported sending ' || public.fmt_money(b.down_payment_amount) || ' via ' || public.label_enum(b.payment_method::text)
      || coalesce(' (reference ' || b.down_payment_reference || ')', '') || '; the business says it wasn''t received.'
      || coalesce(' Note: ' || v_note, ''));
  perform public.post_system_message(b.conversation_id, 'Booking ' || b.reference
    || ' was cancelled: the business says the down payment didn''t arrive. 13C has been told and will follow up.', b.id);
end $$;
revoke execute on function public.reject_down_payment(uuid, text) from public, anon;
grant execute on function public.reject_down_payment(uuid, text) to authenticated;

-- ═════════════════════════════ Payment details ═════════════════════════════
-- qr_path: a GCash/Maya QR image in the public media bucket (b/<business>/pay/...), shown to renters with the account.
-- details_changed_at: when the account, name, instructions or QR last changed (renters are warned if it's after they booked).
alter table public.payment_methods
  add column qr_path text check (char_length(qr_path) <= 300),
  add column details_changed_at timestamptz,
  add constraint payment_methods_qr_path_scope check (qr_path is null or qr_path like 'b/' || business_id::text || '/pay/%');
grant insert (qr_path), update (qr_path) on public.payment_methods to authenticated;

-- Owners hear about every change once the business has bookings (setting up a new store stays quiet).
create function public.on_payment_details_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.account_name, new.account_number, new.instructions, new.qr_path)
         is not distinct from (old.account_name, old.account_number, old.instructions, old.qr_path) then
      return new;
    end if;
  end if;
  new.details_changed_at := now();
  if exists (select 1 from public.bookings where business_id = new.business_id) then
    perform public.notify_business(new.business_id, 'payment_details_changed', 'Your payment details changed',
      public.label_enum(new.method::text) || coalesce(' · ' || nullif(btrim(new.account_number), ''), '')
        || coalesce(' (' || nullif(btrim(new.account_name), '') || ')', ''),
      '/dashboard/payments', 'OWNER');
  end if;
  return new;
end $$;
revoke execute on function public.on_payment_details_changed() from public, anon, authenticated;
create trigger payment_details_changed before insert or update on public.payment_methods
  for each row execute function public.on_payment_details_changed();

-- ═════════════════════════════ Renter documents ═════════════════════════════
-- Requesting needs a complete profile; the license (front and back) and a government ID are needed before approval
-- (transition_booking and accepting a proposal still call assert_renter_ready).
create function public.renter_has_documents(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(distinct doc_type) from public.driver_documents
          where user_id = p_user and doc_type in ('DRIVERS_LICENSE_FRONT', 'DRIVERS_LICENSE_BACK', 'GOVERNMENT_ID')) = 3
$$;
revoke execute on function public.renter_has_documents(uuid) from public, anon, authenticated;

create function public.assert_renter_profile(p_user uuid)
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
revoke execute on function public.assert_renter_profile(uuid) from public, anon, authenticated;

create or replace function public.assert_renter_ready(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_renter_profile(p_user);
  if not public.renter_has_documents(p_user) then
    raise exception 'RENTER_DOCUMENTS_MISSING' using errcode = 'P0001';
  end if;
end $$;

-- Same as before (20261003000003_rpc.sql), except it checks the profile only.
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
  perform public.assert_renter_profile(v_uid);
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

-- The renter's documents are all in: tell each business with a request waiting on them (once per request).
create function public.on_driver_document_added()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  if not public.renter_has_documents(new.user_id) then return null; end if;
  for r in select b.id, b.business_id, b.reference, p.full_name from public.bookings b join public.profiles p on p.id = b.renter_id
           where b.renter_id = new.user_id and b.status = 'PENDING_OWNER_APPROVAL'
             and not exists (select 1 from public.notifications n where n.type = 'renter_documents_ready' and n.link = '/dashboard/bookings/' || b.id) loop
    perform public.notify_business(r.business_id, 'renter_documents_ready', 'Documents in: ready to approve',
      r.reference || ' · ' || coalesce(r.full_name, 'The renter') || ' uploaded their license and ID', '/dashboard/bookings/' || r.id);
  end loop;
  return null;
end $$;
revoke execute on function public.on_driver_document_added() from public, anon, authenticated;
create trigger driver_document_added after insert on public.driver_documents
  for each row execute function public.on_driver_document_added();

-- ═════════════════════════════ Request reminders ═════════════════════════════
-- A request still waiting 2 hours later gets one nudge: to the business when it can approve, otherwise to the renter
-- to add their documents. p_booking_id limits it to one booking (tests).
alter table public.bookings add column request_reminded_at timestamptz;

create function public.send_request_reminders(p_booking_id uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select b.id, b.business_id, b.renter_id, b.reference, b.pickup_at, concat_ws(' ', v.make, v.model) as vehicle, bz.name as business
           from public.bookings b join public.vehicles v on v.id = b.vehicle_id join public.businesses bz on bz.id = b.business_id
           where b.status = 'PENDING_OWNER_APPROVAL' and b.request_reminded_at is null
             and b.created_at < now() - interval '2 hours' and b.pickup_at > now()
             and (p_booking_id is null or b.id = p_booking_id)
           for update of b skip locked loop
    if public.renter_has_documents(r.renter_id) then
      perform public.notify_business(r.business_id, 'booking_request_reminder', 'A booking request is waiting',
        r.reference || ' · ' || r.vehicle || ' · ' || public.fmt_ts(r.pickup_at) || ' · approve or decline it', '/dashboard/bookings/' || r.id);
    else
      perform public.notify_user(r.renter_id, 'documents_needed', 'Add your documents to get approved',
        r.business || ' can approve ' || r.reference || ' once your driver''s license and ID are uploaded', '/account/bookings/' || r.id, r.business_id);
    end if;
    update public.bookings set request_reminded_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.send_request_reminders(uuid) from public, anon, authenticated;
grant execute on function public.send_request_reminders(uuid) to service_role;

do $$
begin
  perform cron.schedule('13c-request-reminders', '*/15 * * * *', 'select public.send_request_reminders()');
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
