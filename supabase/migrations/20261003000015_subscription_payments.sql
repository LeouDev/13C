-- Paid plans via PayMongo Hosted Checkout: each payment buys one month, prepaid, no auto-renew.
--  * Paid plans now run until subscriptions.current_period_end (null = granted by an admin, no expiry).
--  * Checkouts are created and settled only by the server (secret key); the amount comes from the plan.
--  * Settling is idempotent: the webhook and the success page may both report the same payment.

create or replace function public.plan_price_centavos(p public.subscription_plan)
returns int language sql immutable set search_path = '' as $$
  select case p when 'PRO' then 49900 when 'BUSINESS' then 150000 else 0 end
$$;

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  plan public.subscription_plan not null check (plan <> 'FREE'),
  amount_centavos int not null check (amount_centavos > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID')),
  checkout_session_id text unique,
  payment_id text unique,
  payment_method text,
  amount_paid_centavos int,
  livemode boolean,
  period_start timestamptz,
  period_end timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index subscription_payments_business_idx on public.subscription_payments (business_id, created_at desc);

alter table public.subscription_payments enable row level security;
revoke all on public.subscription_payments from anon, authenticated;
grant select on public.subscription_payments to authenticated;
create policy "subscription payments: members or admin" on public.subscription_payments for select to authenticated
  using (public.has_business_role(business_id) or public.is_admin());

-- Active = not cancelled and the current period (trial or paid) hasn't ended.
create or replace function public.subscription_is_active(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select s.status <> 'CANCELLED' and (s.current_period_end is null or s.current_period_end > now())
    from public.subscriptions s where s.business_id = p_business
  ), false)
$$;

-- Plans granted before online billing keep running until an admin changes them.
update public.subscriptions set current_period_end = null where plan <> 'FREE';

-- Admin-granted paid plans don't expire; moving back to Free ends any remaining time now.
create or replace function public.admin_set_plan(p_business_id uuid, p_plan public.subscription_plan, p_status public.subscription_status default 'ACTIVE')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  update public.subscriptions set
    current_period_end = case
      when p_plan = plan then current_period_end
      when p_plan = 'FREE' then least(coalesce(current_period_end, now()), now())
      else null
    end,
    plan = p_plan, status = p_status
  where business_id = p_business_id;
  perform public.log_audit('subscription.changed', 'business', p_business_id, p_business_id, jsonb_build_object('plan', p_plan, 'status', p_status));
end $$;

-- Owner starts a checkout. Returns the payment id used as the PayMongo reference.
create or replace function public.create_subscription_checkout(p_actor_id uuid, p_business_id uuid, p_plan public.subscription_plan)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses;
  v_limit int;
  v_id uuid;
begin
  if p_plan = 'FREE' then raise exception 'INVALID_PLAN' using errcode = 'P0001'; end if;
  if not public.member_has_role(p_business_id, p_actor_id, 'OWNER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into b from public.businesses where id = p_business_id;
  if b.status <> 'VERIFIED' then raise exception 'BUSINESS_NOT_VERIFIED' using errcode = 'P0001'; end if;
  v_limit := public.plan_vehicle_limit(p_plan);
  if v_limit is not null and (select count(*) from public.vehicles where business_id = p_business_id and deleted_at is null) > v_limit then
    raise exception 'PLAN_TOO_SMALL' using errcode = 'P0001', detail = v_limit::text;
  end if;
  insert into public.subscription_payments (business_id, plan, amount_centavos, created_by)
  values (p_business_id, p_plan, public.plan_price_centavos(p_plan), p_actor_id)
  returning id into v_id;
  return v_id;
end $$;

-- A paid checkout session: extend the plan by one month (once).
--  same plan or still on the trial → starts when the current period ends
--  switching paid plans             → unused time converts at the price ratio
--  lapsed                           → starts now
create or replace function public.apply_subscription_payment(
  p_checkout_session_id text, p_payment_id text, p_amount int, p_method text, p_livemode boolean
) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  sp public.subscription_payments;
  s public.subscriptions;
  v_start timestamptz;
  v_end timestamptz;
begin
  select * into sp from public.subscription_payments where checkout_session_id = p_checkout_session_id for update;
  if sp.id is null then raise exception 'UNKNOWN_CHECKOUT' using errcode = 'P0001'; end if;
  if sp.status = 'PAID' then return sp.period_end; end if;
  if coalesce(p_amount, 0) < sp.amount_centavos then raise exception 'AMOUNT_MISMATCH' using errcode = 'P0001'; end if;

  select * into s from public.subscriptions where business_id = sp.business_id for update;
  v_start := case
    when s.status = 'CANCELLED' or s.current_period_end is null or s.current_period_end <= now() then now()
    when s.plan = sp.plan or s.plan = 'FREE' then s.current_period_end
    else now() + (s.current_period_end - now()) * (public.plan_price_centavos(s.plan)::float8 / public.plan_price_centavos(sp.plan))
  end;
  v_end := v_start + interval '1 month';

  update public.subscriptions set plan = sp.plan, status = 'ACTIVE', current_period_end = v_end where business_id = sp.business_id;
  update public.subscription_payments set status = 'PAID', payment_id = p_payment_id, payment_method = p_method,
    amount_paid_centavos = p_amount, livemode = p_livemode, period_start = v_start, period_end = v_end, paid_at = now()
  where id = sp.id;
  perform public.notify_business(sp.business_id, 'subscription_paid', 'Payment received',
    initcap(sp.plan::text) || ' is active until ' || public.fmt_date(v_end) || '.', '/dashboard/subscription', 'OWNER');
  perform public.log_audit('subscription.paid', 'business', sp.business_id, sp.business_id,
    jsonb_build_object('plan', sp.plan, 'amount', p_amount, 'payment_id', p_payment_id, 'period_end', v_end), sp.created_by);
  return v_end;
end $$;

revoke execute on function public.plan_price_centavos(public.subscription_plan),
  public.create_subscription_checkout(uuid, uuid, public.subscription_plan),
  public.apply_subscription_payment(text, text, int, text, boolean)
from public, anon, authenticated;
grant execute on function public.plan_price_centavos(public.subscription_plan),
  public.create_subscription_checkout(uuid, uuid, public.subscription_plan),
  public.apply_subscription_payment(text, text, int, text, boolean)
to service_role;

-- Reminders (hourly cron): trial as before, plus paid plans 3 days before and when they lapse (once per period).
create or replace function public.send_trial_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.business_id, s.plan, s.current_period_end from public.subscriptions s
    join public.businesses b on b.id = s.business_id and b.deleted_at is null
    where s.status <> 'CANCELLED' and s.current_period_end is not null
      and s.current_period_end < now() + interval '3 days' and s.current_period_end > now() - interval '7 days'
  loop
    if r.plan = 'FREE' then
      if r.current_period_end > now() and not exists (select 1 from public.notifications where business_id = r.business_id and type = 'trial_ending') then
        perform public.notify_business(r.business_id, 'trial_ending', 'Your free trial ends soon',
          'Ends ' || public.fmt_date(r.current_period_end) || '. Upgrade to keep your store live.', '/dashboard/subscription', 'OWNER');
        n := n + 1;
      elsif r.current_period_end <= now() and not exists (select 1 from public.notifications where business_id = r.business_id and type = 'trial_ended') then
        perform public.notify_business(r.business_id, 'trial_ended', 'Your free trial has ended',
          'Your store is hidden from customers. Upgrade to Pro or Business to go live again.', '/dashboard/subscription', 'OWNER');
        n := n + 1;
      end if;
    elsif r.current_period_end > now() then
      if not exists (select 1 from public.notifications where business_id = r.business_id and type = 'subscription_ending'
                     and created_at > r.current_period_end - interval '4 days') then
        perform public.notify_business(r.business_id, 'subscription_ending', 'Your ' || initcap(r.plan::text) || ' plan ends soon',
          'Ends ' || public.fmt_date(r.current_period_end) || '. Pay for another month to keep your store live.', '/dashboard/subscription', 'OWNER');
        n := n + 1;
      end if;
    elsif not exists (select 1 from public.notifications where business_id = r.business_id and type = 'subscription_ended'
                      and created_at >= r.current_period_end) then
      perform public.notify_business(r.business_id, 'subscription_ended', 'Your ' || initcap(r.plan::text) || ' plan has ended',
        'Your store is hidden from customers. Pay for a month to go live again.', '/dashboard/subscription', 'OWNER');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.send_trial_reminders() from public, anon, authenticated;
grant execute on function public.send_trial_reminders() to service_role;
