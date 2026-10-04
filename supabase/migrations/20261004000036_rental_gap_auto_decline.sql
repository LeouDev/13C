-- Double-booking protection, two additions:
-- 1. Gap between rentals: hours a business needs between one rental's return and the next pickup (cleaning,
--    inspection). Renters can't book inside it, approvals that would break it are refused, and renters' calendars
--    show it as booked. 0 = back to back (the default; bookings_no_overlap still refuses any direct overlap).
-- 2. Approving a request declines the other requests and proposals for the same car that now conflict (gap
--    included), with a note; their renters get the usual notification, email and chat message.

alter table public.businesses add column turnaround_hours smallint not null default 0 check (turnaround_hours between 0 and 48);
grant update (turnaround_hours) on public.businesses to authenticated; -- managers and owners, per "businesses: managers update"

create function public.rental_gap(p_business_id uuid)
returns interval language sql stable security definer set search_path = '' as $$
  select make_interval(hours => coalesce((select turnaround_hours from public.businesses where id = p_business_id), 0)::int)
$$;
revoke execute on function public.rental_gap(uuid) from public, anon, authenticated;

-- A new booking [from, to) conflicts with an existing one [pickup, return) when it overlaps [pickup - gap, return + gap).
create or replace function public.is_vehicle_available(p_vehicle_id uuid, p_from timestamptz, p_to timestamptz, p_ignore_booking uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.bookings b
    where b.vehicle_id = p_vehicle_id and b.status = any (public.blocking_statuses())
      and tstzrange(b.pickup_at - public.rental_gap(b.business_id), b.return_at + public.rental_gap(b.business_id), '[)')
          && tstzrange(p_from, p_to, '[)')
      and b.id is distinct from p_ignore_booking
  ) and not exists (
    select 1 from public.vehicle_blocked_dates d
    where d.vehicle_id = p_vehicle_id and d.period && tstzrange(p_from, p_to, '[)')
  )
$$;

-- Ranges a vehicle cannot be booked (bookings widened by the gap) — no renter details exposed.
create or replace function public.vehicle_unavailable_ranges(p_vehicle_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, kind text)
language sql stable security definer set search_path = '' as $$
  select b.pickup_at - g.gap, b.return_at + g.gap, 'BOOKED'
  from public.bookings b
  join public.vehicles v on v.id = b.vehicle_id
  cross join lateral (select public.rental_gap(v.business_id) as gap) g
  where b.vehicle_id = p_vehicle_id and b.status = any (public.blocking_statuses())
    and tstzrange(b.pickup_at - g.gap, b.return_at + g.gap, '[)') && tstzrange(p_from, p_to, '[)')
    and (public.is_business_public(v.business_id) or public.has_business_role(v.business_id))
  union all
  select d.starts_at, d.ends_at, d.reason::text
  from public.vehicle_blocked_dates d
  where d.vehicle_id = p_vehicle_id and d.period && tstzrange(p_from, p_to, '[)')
    and (public.is_business_public(d.business_id) or public.has_business_role(d.business_id))
  order by 1
$$;

-- Same guard as before, plus the gap. It uses pickup_at/return_at rather than the generated `period`, which isn't
-- computed yet in a BEFORE trigger. Locking the vehicle row serializes availability changes per car.
create or replace function public.guard_booking_availability()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_business uuid;
  v_gap interval;
  v_period tstzrange := tstzrange(new.pickup_at, new.return_at, '[)');
  v_moved boolean := tg_op = 'UPDATE' and (old.pickup_at is distinct from new.pickup_at or old.return_at is distinct from new.return_at);
begin
  select business_id into v_business from public.vehicles where id = new.vehicle_id for update;
  if v_business is null or v_business <> new.business_id then
    raise exception 'VEHICLE_BUSINESS_MISMATCH' using errcode = 'P0001';
  end if;
  if new.status = any (public.blocking_statuses()) then
    if (tg_op = 'INSERT' or old.status is distinct from new.status or v_moved)
       and exists (select 1 from public.vehicle_blocked_dates d where d.vehicle_id = new.vehicle_id and d.period && v_period) then
      raise exception 'VEHICLE_BLOCKED' using errcode = 'P0001';
    end if;
    -- Only when the booking starts holding the car or its times change, so a later change of the setting
    -- never blocks bookings that were already approved.
    if tg_op = 'INSERT' or not (old.status = any (public.blocking_statuses())) or v_moved then
      v_gap := public.rental_gap(new.business_id);
      if exists (
        select 1 from public.bookings o
        where o.vehicle_id = new.vehicle_id and o.id <> new.id and o.status = any (public.blocking_statuses())
          and tstzrange(o.pickup_at - v_gap, o.return_at + v_gap, '[)') && v_period
      ) then
        raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;

-- After an approval: decline the other requests (and cancel the business's open proposals) for the same car whose
-- times now conflict, gap included. Returns how many.
create function public.decline_conflicting_requests(p_booking_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  o record;
  v_gap interval;
  v_to public.booking_status;
  v_note constant text := 'Those dates were just booked by another renter. Please choose different dates.';
  n int := 0;
begin
  select * into b from public.bookings where id = p_booking_id;
  v_gap := public.rental_gap(b.business_id);
  for o in
    select id, status, conversation_id, reference from public.bookings
    where vehicle_id = b.vehicle_id and id <> b.id and status in ('PENDING_OWNER_APPROVAL', 'BOOKING_REQUESTED')
      and tstzrange(pickup_at - v_gap, return_at + v_gap, '[)') && tstzrange(b.pickup_at, b.return_at, '[)')
    order by created_at
    for update
  loop
    v_to := case when o.status = 'PENDING_OWNER_APPROVAL' then 'REJECTED' else 'CANCELLED' end;
    perform public.apply_booking_status(o.id, v_to, null, v_note);
    if o.conversation_id is not null then
      perform public.post_system_message(o.conversation_id,
        'Booking ' || o.reference || ' · ' || public.label_enum(v_to::text) || ' — ' || v_note, o.id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.decline_conflicting_requests(uuid) from public, anon, authenticated;

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
    perform public.decline_conflicting_requests(b.id);
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
