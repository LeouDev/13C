-- Business plan follow-ups:
--  * Team members can only be added while the Business plan is paid up (it checked the plan name only,
--    so a lapsed Business plan could still add people).
--  * Fleet reminders: owners and managers hear when a car's registration, insurance or service comes due.

create or replace function public.add_business_member(p_business_id uuid, p_email text, p_role public.business_role)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if not public.has_business_role(p_business_id, 'OWNER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_role = 'OWNER' then raise exception 'INVALID_ROLE' using errcode = 'P0001'; end if;
  if not public.business_plan_active(p_business_id) then raise exception 'PLAN_STAFF_LIMIT' using errcode = 'P0001'; end if;
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

-- ─────────────────────────────── Fleet reminders ───────────────────────────────
-- Each item notifies once when it comes due soon (within 30 days or 1,000 km, the same thresholds as the
-- Fleet page in src/lib/fleet.ts) and once when it's due. Keyed by the due date/km, so a renewed date
-- starts over. Server-only: RLS on, no policies.
create table public.fleet_reminders (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  item text not null check (item in ('registration', 'insurance', 'service_date', 'service_km')),
  due text not null,
  stage text not null check (stage in ('soon', 'due')),
  sent_at timestamptz not null default now(),
  primary key (vehicle_id, item, due, stage)
);
alter table public.fleet_reminders enable row level security;

-- One notification per business per run (owners and managers), listing what newly came due. Business plan only.
create or replace function public.send_fleet_reminders()
returns int language sql security definer set search_path = '' as $$
  with due as (
    select v.business_id, v.id as vehicle_id, i.item, i.due,
           case when i.left_n <= 0 then 'due' else 'soon' end as stage,
           initcap(i.what) || ' · ' || concat_ws(' ', v.make, v.model, v.plate_number) || ' ('
             || case when i.left_n > 0 then i.soon_note when i.unit = 'day' and i.left_n = 0 then 'due today' else 'overdue' end
             || ')' as line
    from public.vehicle_fleet f
    join public.vehicles v on v.id = f.vehicle_id and v.deleted_at is null
    cross join lateral (values
      ('registration', 'registration', f.registration_expires_on::text, f.registration_expires_on - (now() at time zone 'Asia/Manila')::date, 30, 'day', 'due ' || to_char(f.registration_expires_on, 'Mon FMDD')),
      ('insurance', 'insurance', f.insurance_expires_on::text, f.insurance_expires_on - (now() at time zone 'Asia/Manila')::date, 30, 'day', 'due ' || to_char(f.insurance_expires_on, 'Mon FMDD')),
      ('service_date', 'service', f.next_service_on::text, f.next_service_on - (now() at time zone 'Asia/Manila')::date, 30, 'day', 'due ' || to_char(f.next_service_on, 'Mon FMDD')),
      ('service_km', 'service', f.next_service_km::text, f.next_service_km - f.odometer_km, 1000, 'km', 'due at ' || to_char(f.next_service_km, 'FM9,999,999') || ' km')
    ) as i(item, what, due, left_n, window_n, unit, soon_note)
    where i.left_n <= i.window_n and public.business_plan_active(v.business_id)
  ),
  fresh as (
    insert into public.fleet_reminders (vehicle_id, item, due, stage)
    select vehicle_id, item, due, stage from due
    on conflict do nothing
    returning vehicle_id, item, due, stage
  ),
  per_business as (
    select d.business_id, count(*) as n, string_agg(d.line, ', ' order by d.line) as body
    from due d join fresh using (vehicle_id, item, due, stage)
    group by d.business_id
  ),
  sent as (
    insert into public.notifications (user_id, type, title, body, link, business_id)
    select m.user_id, 'fleet_due', p.n || case when p.n = 1 then ' fleet item needs attention' else ' fleet items need attention' end,
           p.body, '/dashboard/fleet', p.business_id
    from per_business p
    join public.business_members m on m.business_id = p.business_id and public.role_rank(m.role) >= public.role_rank('MANAGER')
    returning 1
  )
  select count(*)::int from sent
$$;

revoke execute on function public.send_fleet_reminders() from public, anon, authenticated;
grant execute on function public.send_fleet_reminders() to service_role;

do $$
begin
  perform cron.schedule('13c-fleet-reminders', '0 0 * * *', 'select public.send_fleet_reminders()'); -- 8:00 AM Manila
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
