-- Fleet reminders can be run for a single business, so the test suite never notifies real businesses.
-- Replaces the zero-argument version; the daily job's `select public.send_fleet_reminders()` still checks all.
drop function public.send_fleet_reminders();

-- One notification per business per run (owners and managers), listing what newly came due. Business plan only.
-- The daily job checks every business; p_business_id limits a run to one (tests run against the live project).
create function public.send_fleet_reminders(p_business_id uuid default null)
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
      and (p_business_id is null or v.business_id = p_business_id)
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

revoke execute on function public.send_fleet_reminders(uuid) from public, anon, authenticated;
grant execute on function public.send_fleet_reminders(uuid) to service_role;
