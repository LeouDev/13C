-- Pricing v2: Free = 25-day trial (up to 3 vehicles) · Pro ₱499 (up to 10) · Business ₱1,500 (unlimited).
-- The trial clock starts when 13C verifies the business. When it ends without a paid plan, the store is
-- hidden from the public and no vehicles can be added; existing bookings and contracts keep working.

create or replace function public.plan_vehicle_limit(p public.subscription_plan)
returns int language sql immutable set search_path = '' as $$
  select case p when 'FREE' then 3 when 'PRO' then 10 else null end
$$;

create or replace function public.trial_days()
returns int language sql immutable set search_path = '' as $$ select 25 $$;

alter table public.subscriptions alter column status set default 'TRIALING';

-- Can the business operate publicly right now? (paid & not cancelled, or free trial not yet expired)
create or replace function public.subscription_is_active(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when s.status = 'CANCELLED' then false
      when s.plan = 'FREE' then s.current_period_end is null or s.current_period_end > now()
      else true
    end
    from public.subscriptions s where s.business_id = p_business
  ), false)
$$;
revoke execute on function public.subscription_is_active(uuid) from public, anon, authenticated;

create or replace function public.is_business_public(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses b
    join public.business_storefronts s on s.business_id = b.id
    where b.id = p_business and b.status = 'VERIFIED' and s.is_published and b.deleted_at is null
      and public.subscription_is_active(b.id)
  )
$$;

-- Start the trial on (first) verification.
create or replace function public.start_trial_on_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'VERIFIED' and old.status is distinct from 'VERIFIED' then
    update public.subscriptions
       set status = 'TRIALING', current_period_end = now() + make_interval(days => public.trial_days())
     where business_id = new.id and plan = 'FREE' and current_period_end is null;
  end if;
  return new;
end $$;

create trigger start_trial_on_verification after update of status on public.businesses
  for each row execute function public.start_trial_on_verification();

create or replace function public.enforce_vehicle_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  v_count int;
begin
  if not public.subscription_is_active(new.business_id) then
    raise exception 'TRIAL_ENDED' using errcode = 'P0001';
  end if;
  select public.plan_vehicle_limit(s.plan) into v_limit from public.subscriptions s where s.business_id = new.business_id;
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.vehicles where business_id = new.business_id and deleted_at is null;
  if v_count >= v_limit then
    raise exception 'PLAN_VEHICLE_LIMIT' using errcode = 'P0001', detail = v_limit::text;
  end if;
  return new;
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
    if not public.subscription_is_active(p_business_id) then raise exception 'TRIAL_ENDED' using errcode = 'P0001'; end if;
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

-- Owners hear about it 3 days before and when it ends (once each).
create or replace function public.send_trial_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.business_id, s.current_period_end from public.subscriptions s
    join public.businesses b on b.id = s.business_id and b.deleted_at is null
    where s.plan = 'FREE' and s.status <> 'CANCELLED' and s.current_period_end is not null
      and s.current_period_end < now() + interval '3 days'
  loop
    if r.current_period_end > now() and not exists (select 1 from public.notifications where business_id = r.business_id and type = 'trial_ending') then
      perform public.notify_business(r.business_id, 'trial_ending', 'Your free trial ends soon',
        'Ends ' || public.fmt_date(r.current_period_end) || '. Upgrade to keep your store live.', '/dashboard/subscription', 'OWNER');
      n := n + 1;
    elsif r.current_period_end <= now() and not exists (select 1 from public.notifications where business_id = r.business_id and type = 'trial_ended') then
      perform public.notify_business(r.business_id, 'trial_ended', 'Your free trial has ended',
        'Your store is hidden from customers. Upgrade to Pro or Business to go live again.', '/dashboard/subscription', 'OWNER');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.send_trial_reminders() from public, anon, authenticated;
grant execute on function public.send_trial_reminders() to service_role;

do $$
begin
  perform cron.schedule('13c-trial-reminders', '27 * * * *', 'select public.send_trial_reminders()');
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;

-- Backfill: free plans are trials; verified ones started on their verification date.
update public.subscriptions s set status = 'TRIALING' where s.plan = 'FREE' and s.status = 'ACTIVE';
update public.subscriptions s
   set current_period_end = coalesce(b.verified_at, now()) + make_interval(days => public.trial_days())
  from public.businesses b
 where b.id = s.business_id and s.plan = 'FREE' and s.current_period_end is null and b.status = 'VERIFIED';
