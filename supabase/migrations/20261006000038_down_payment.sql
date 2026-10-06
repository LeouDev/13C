-- Down payment: a business can ask renters for a share of the total (a %) within a set time after approval, so a
-- booking that won't show up doesn't hold the car. With a percent set:
--   approve (or the renter accepts a proposal) → APPROVED: the car is held, the agreement waits, the renter is asked to pay
--   the business directly by down_payment_due_at, and can tap "I've paid" (report_down_payment)
--   the business records the payment (sync_payment_status) or waives it (waive_down_payment) → agreement generated → usual flow
--   still unpaid at the deadline → cancel_unpaid_down_payments() cancels it and frees the dates (every 15 minutes)
-- Without one (0%), nothing changes: the agreement is generated on approval.

alter table public.businesses
  add column down_payment_percent smallint not null default 0 check (down_payment_percent between 0 and 100),
  add column down_payment_hours smallint not null default 24 check (down_payment_hours between 1 and 168);
grant update (down_payment_percent, down_payment_hours) on public.businesses to authenticated; -- managers and owners, per "businesses: managers update"

-- Clients can't change these (bookings only grants update on payment_status); the functions below do.
alter table public.bookings
  add column down_payment_percent smallint not null default 0 check (down_payment_percent between 0 and 100),
  add column down_payment_amount numeric(12, 2) generated always as (round(total_amount * down_payment_percent / 100.0)) stored,
  add column down_payment_due_at timestamptz,
  add column down_payment_reported_at timestamptz,
  add column down_payment_reference text check (char_length(down_payment_reference) <= 120);

-- True while some of the down payment is still owed (false when none was asked, it was waived, or it's paid).
create function public.down_payment_pending(p_booking_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select b.down_payment_amount > coalesce((select sum(p.amount) from public.payments p where p.booking_id = b.id), 0)
    from public.bookings b where b.id = p_booking_id
  ), false)
$$;
revoke execute on function public.down_payment_pending(uuid) from public, anon, authenticated;

-- Approval takes the business's down payment (due a set time later, never after pickup) and holds off the agreement until it's paid.
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
    update public.bookings bk set down_payment_percent = bz.down_payment_percent,
      down_payment_due_at = case when bz.down_payment_percent > 0 then least(now() + make_interval(hours => bz.down_payment_hours), bk.pickup_at) end
    from public.businesses bz where bk.id = b.id and bz.id = bk.business_id;
  end if;

  perform public.apply_booking_status(b.id, p_to, v_uid, p_note);

  if p_to = 'APPROVED' then
    if not public.down_payment_pending(b.id) then
      perform public.generate_contract(b.id, v_uid);
    end if;
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

-- Same as before, plus: an approval with a down payment tells the renter what to pay and by when, and tells the business
-- when it was the renter who accepted (no agreement is generated yet, so the usual "contract ready" notice doesn't come).
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
      if new.down_payment_amount > 0 then
        perform public.notify_user(new.renter_id, 'booking_approved', 'Booking approved: down payment needed',
          v_vehicle || ' · pay ' || public.fmt_money(new.down_payment_amount) || ' by ' || public.fmt_ts(new.down_payment_due_at) || ' to hold the car',
          v_renter_link, new.business_id);
        if v_actor = new.renter_id then
          perform public.notify_business(new.business_id, 'proposal_accepted', 'Proposal accepted',
            new.reference || ' · waiting for the ' || public.fmt_money(new.down_payment_amount) || ' down payment', v_biz_link);
        end if;
      else
        perform public.notify_user(new.renter_id, 'booking_approved', 'Booking approved',
          v_vehicle || ' · your rental agreement is being prepared', v_renter_link, new.business_id);
      end if;
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

-- Same as before, plus: the payment that covers an approved booking's down payment prepares the agreement.
create or replace function public.sync_payment_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_booking uuid := coalesce(new.booking_id, old.booking_id);
  v_paid numeric;
  v_total numeric;
  v_current public.payment_status;
  b public.bookings;
begin
  select coalesce(sum(amount), 0) into v_paid from public.payments where booking_id = v_booking;
  select total_amount, payment_status into v_total, v_current from public.bookings where id = v_booking;
  update public.bookings set payment_status = case
      when v_paid >= v_total and v_total > 0 then 'PAID'::public.payment_status
      when v_paid > 0 then 'PARTIALLY_PAID'::public.payment_status
      when v_current = 'PAYMENT_ON_PICKUP' then 'PAYMENT_ON_PICKUP'::public.payment_status
      else 'UNPAID'::public.payment_status end
  where id = v_booking;

  if tg_op = 'INSERT' then
    select * into b from public.bookings where id = v_booking;
    if b.status = 'APPROVED' and b.down_payment_amount > 0 and not public.down_payment_pending(b.id) then
      perform public.notify_user(b.renter_id, 'down_payment_received', 'Down payment received',
        public.fmt_money(b.down_payment_amount) || ' · ' || b.reference || ' · your rental agreement is being prepared',
        '/account/bookings/' || b.id, b.business_id);
      perform public.post_system_message(b.conversation_id, 'Down payment received for ' || b.reference || '. The rental agreement is being prepared.', b.id);
      perform public.generate_contract(b.id, (select auth.uid()));
    end if;
  end if;
  return null;
end $$;

-- The renter's "I've paid": tells the business to check its account and record the payment. Can be sent again (new reference).
create function public.report_down_payment(p_booking_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  v_ref text := left(nullif(btrim(p_reference), ''), 120);
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or b.renter_id is distinct from (select auth.uid()) then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if b.status <> 'APPROVED' or not public.down_payment_pending(b.id) then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  update public.bookings set down_payment_reported_at = now(), down_payment_reference = v_ref where id = b.id;
  perform public.notify_business(b.business_id, 'down_payment_reported', 'Down payment sent: please check',
    b.reference || ' · ' || public.fmt_money(b.down_payment_amount) || ' via ' || public.label_enum(b.payment_method::text) || coalesce(' · ref ' || v_ref, ''),
    '/dashboard/bookings/' || b.id);
  perform public.post_system_message(b.conversation_id, 'The renter says they sent the ' || public.fmt_money(b.down_payment_amount)
    || ' down payment for ' || b.reference || coalesce(' (reference ' || v_ref || ')', '') || '.', b.id);
end $$;
revoke execute on function public.report_down_payment(uuid, text) from public, anon;
grant execute on function public.report_down_payment(uuid, text) to authenticated;

-- The business skips the down payment for this booking (a renter they trust, cash at pickup): the agreement is prepared now.
create function public.waive_down_payment(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or not public.has_business_role(b.business_id, 'MANAGER') then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if b.status <> 'APPROVED' or not public.down_payment_pending(b.id) then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  update public.bookings set down_payment_percent = 0, down_payment_due_at = null where id = b.id;
  perform public.post_system_message(b.conversation_id, 'The down payment for ' || b.reference || ' was waived. The rental agreement is being prepared.', b.id);
  perform public.generate_contract(b.id, (select auth.uid()));
end $$;
revoke execute on function public.waive_down_payment(uuid) from public, anon;
grant execute on function public.waive_down_payment(uuid) to authenticated;

-- Every 15 minutes: approved bookings still owing their down payment past the deadline are cancelled and the dates freed.
-- The status trigger tells the renter (with the reason); the business is told here. p_booking_id limits it to one booking (tests).
create function public.cancel_unpaid_down_payments(p_booking_id uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in select id, business_id, reference, conversation_id, down_payment_due_at from public.bookings
           where status = 'APPROVED' and down_payment_amount > 0 and down_payment_due_at < now()
             and (p_booking_id is null or id = p_booking_id)
           for update skip locked loop
    continue when not public.down_payment_pending(r.id);
    perform public.apply_booking_status(r.id, 'CANCELLED', null, 'The down payment wasn''t received by ' || public.fmt_ts(r.down_payment_due_at) || '.');
    perform public.notify_business(r.business_id, 'down_payment_missed', 'Booking cancelled: no down payment',
      r.reference || ' · the dates are open again', '/dashboard/bookings/' || r.id);
    perform public.post_system_message(r.conversation_id, 'Booking ' || r.reference || ' was cancelled because the down payment wasn''t received in time.', r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.cancel_unpaid_down_payments(uuid) from public, anon, authenticated;
grant execute on function public.cancel_unpaid_down_payments(uuid) to service_role;

do $$
begin
  perform cron.schedule('13c-down-payment-deadlines', '*/15 * * * *', 'select public.cancel_unpaid_down_payments()');
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
