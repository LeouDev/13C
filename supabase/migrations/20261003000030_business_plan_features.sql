-- Business plan features: advanced analytics, fleet records and custom contract terms.
-- Enforced here, not only in the UI: each one needs an active Business subscription.

create or replace function public.business_plan_active(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.plan = 'BUSINESS' from public.subscriptions s where s.business_id = p_business), false)
     and public.subscription_is_active(p_business)
$$;

-- ─────────────────────────── Fleet records (private to the business) ───────────────────────────
create table public.vehicle_fleet (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  registration_expires_on date,
  insurance_expires_on date,
  odometer_km int check (odometer_km between 0 and 2000000),
  next_service_on date,
  next_service_km int check (next_service_km between 0 and 2000000),
  updated_at timestamptz not null default now()
);

create table public.vehicle_service_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  serviced_on date not null,
  kind text not null check (char_length(btrim(kind)) between 2 and 80),
  odometer_km int check (odometer_km between 0 and 2000000),
  cost numeric(12, 2) check (cost >= 0),
  note text check (char_length(note) <= 1000),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index vehicle_service_logs_vehicle on public.vehicle_service_logs (vehicle_id, serviced_on desc);

-- business_id always comes from the vehicle, so a row can't be filed under another business.
create or replace function public.set_fleet_business()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select business_id into new.business_id from public.vehicles where id = new.vehicle_id and deleted_at is null;
  if new.business_id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger vehicle_fleet_business before insert or update on public.vehicle_fleet
  for each row execute function public.set_fleet_business();
create trigger vehicle_service_logs_business before insert or update on public.vehicle_service_logs
  for each row execute function public.set_fleet_business();
create trigger set_updated_at before update on public.vehicle_fleet
  for each row execute function public.set_updated_at();

alter table public.vehicle_fleet enable row level security;
alter table public.vehicle_service_logs enable row level security;
revoke all on public.vehicle_fleet, public.vehicle_service_logs from anon;
grant select, insert, update, delete on public.vehicle_fleet, public.vehicle_service_logs to authenticated;

-- Everyone on the team can read; managers and owners on an active Business plan can write.
create policy "fleet: members read" on public.vehicle_fleet for select to authenticated
  using (public.has_business_role(business_id));
create policy "fleet: business write" on public.vehicle_fleet for all to authenticated
  using (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id))
  with check (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));
create policy "service logs: members read" on public.vehicle_service_logs for select to authenticated
  using (public.has_business_role(business_id));
create policy "service logs: business write" on public.vehicle_service_logs for all to authenticated
  using (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id))
  with check (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));

-- ─────────────────────────── Custom contract terms ───────────────────────────
-- Shown to renters inside the agreement, so not secret. Written only through save_contract_terms().
alter table public.businesses add column contract_terms jsonb not null default '[]'::jsonb
  check (jsonb_typeof(contract_terms) = 'array' and jsonb_array_length(contract_terms) <= 10);

create or replace function public.save_contract_terms(p_business_id uuid, p_terms jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  t jsonb;
  v_clean jsonb := '[]'::jsonb;
begin
  if not public.has_business_role(p_business_id, 'MANAGER') then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if not public.business_plan_active(p_business_id) then raise exception 'PLAN_BUSINESS_REQUIRED' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_terms) <> 'array' or jsonb_array_length(p_terms) > 10 then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  for t in select * from jsonb_array_elements(p_terms) loop
    if char_length(btrim(coalesce(t ->> 'title', ''))) not between 2 and 80
       or char_length(btrim(coalesce(t ->> 'body', ''))) not between 2 and 2000 then
      raise exception 'INVALID_INPUT' using errcode = 'P0001';
    end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object('title', btrim(t ->> 'title'), 'body', btrim(t ->> 'body')));
  end loop;
  update public.businesses set contract_terms = v_clean where id = p_business_id;
  perform public.log_audit('contract.terms_updated', 'business', p_business_id, p_business_id,
    jsonb_build_object('count', jsonb_array_length(v_clean)));
end $$;

-- Agreements now end with the provider's own terms (Business plan), numbered after the template's sections.
create or replace function public.generate_contract(p_booking_id uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
  t public.contract_templates;
  c public.contracts;
  v_vars jsonb;
  v_sections jsonb;
  v_terms jsonb;
  v_count int;
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

  select contract_terms into v_terms from public.businesses where id = b.business_id;
  if public.business_plan_active(b.business_id) and jsonb_array_length(coalesce(v_terms, '[]'::jsonb)) > 0 then
    v_count := jsonb_array_length(v_sections);
    v_sections := v_sections || jsonb_build_array(jsonb_build_object(
      'key', 'provider_terms',
      'title', (v_count + 1) || '. Additional Terms of the Rental Provider',
      'body', 'The Rental Provider sets the following additional terms. They form part of this Agreement; if any of them conflicts with Sections 1 to '
        || v_count || ', those Sections prevail.' || E'\n\n'
        || (select string_agg(format('(%s) %s: %s', chr(96 + ord::int), x.term ->> 'title', x.term ->> 'body'), E'\n\n' order by ord)
            from jsonb_array_elements(v_terms) with ordinality as x(term, ord))));
  end if;

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

-- ─────────────────────────── Advanced analytics ───────────────────────────
create or replace function public.business_analytics_advanced(p_business_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := greatest(1, least(p_days, 365));
  v_to timestamptz := now();
  v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  v_ok constant public.booking_status[] := array['CONFIRMED', 'ACTIVE', 'RETURNED', 'COMPLETED']::public.booking_status[];
begin
  if not (public.has_business_role(p_business_id) or public.is_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not (public.business_plan_active(p_business_id) or public.is_admin()) then
    raise exception 'PLAN_BUSINESS_REQUIRED' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    -- Per car: booked days overlapping the period (utilization), and revenue from bookings made in it.
    'vehicles', (select coalesce(jsonb_agg(x order by (x ->> 'revenue')::numeric desc, x ->> 'name'), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', v.id, 'name', concat_ws(' ', v.year, v.make, v.model), 'plate', v.plate_number,
          'views', (select count(*) from public.page_views pv where pv.vehicle_id = v.id and pv.created_at >= v_from),
          'requests', (select count(*) from public.bookings bk where bk.vehicle_id = v.id and bk.created_at >= v_from),
          'bookings', (select count(*) from public.bookings bk where bk.vehicle_id = v.id and bk.created_at >= v_from and bk.status = any (v_ok)),
          'booked_days', round(coalesce((select sum(extract(epoch from least(bk.return_at, v_to) - greatest(bk.pickup_at, v_from)) / 86400)
              from public.bookings bk where bk.vehicle_id = v.id and bk.status = any (v_ok) and bk.pickup_at < v_to and bk.return_at > v_from), 0)::numeric, 1),
          'revenue', coalesce((select sum(bk.total_amount) from public.bookings bk
              where bk.vehicle_id = v.id and bk.created_at >= v_from and bk.status = any (v_ok)), 0)) x
        from public.vehicles v
        where v.business_id = p_business_id and v.deleted_at is null) t),
    'period_days', v_days,
    -- Last 12 months, by the month the booking was made (Manila time).
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(g, 'YYYY-MM'), 'bookings', n, 'revenue', r) order by g), '[]'::jsonb) from (
        select g, count(bk.id) as n, coalesce(sum(bk.total_amount), 0) as r
        from generate_series(date_trunc('month', now() at time zone 'Asia/Manila') - interval '11 months',
                             date_trunc('month', now() at time zone 'Asia/Manila'), interval '1 month') g
        left join public.bookings bk on bk.business_id = p_business_id and bk.status = any (v_ok)
          and date_trunc('month', bk.created_at at time zone 'Asia/Manila') = g
        group by g) m),
    'customers', (select jsonb_build_object(
        'renters', count(distinct bk.renter_id),
        'returning', count(distinct bk.renter_id) filter (where exists (
          select 1 from public.bookings prev where prev.business_id = p_business_id and prev.renter_id = bk.renter_id
            and prev.status = any (v_ok) and prev.created_at < v_from)),
        'avg_rental_days', coalesce(round(avg(bk.rental_days)::numeric, 1), 0),
        'avg_lead_days', coalesce(round(avg(extract(epoch from bk.pickup_at - bk.created_at) / 86400)::numeric, 1), 0),
        'avg_booking_value', coalesce(round(avg(bk.total_amount)::numeric, 2), 0))
      from public.bookings bk where bk.business_id = p_business_id and bk.created_at >= v_from and bk.status = any (v_ok)),
    'repeat_rate', (select coalesce(round(100.0 * count(*) filter (where n > 1) / nullif(count(*), 0), 1), 0) from (
        select count(*) as n from public.bookings
        where business_id = p_business_id and status = any (v_ok) group by renter_id) r),
    'top_customers', (select coalesce(jsonb_agg(x order by (x ->> 'revenue')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('name', coalesce(p.full_name, 'Renter'), 'bookings', count(*), 'revenue', sum(bk.total_amount)) x
        from public.bookings bk left join public.profiles p on p.id = bk.renter_id
        where bk.business_id = p_business_id and bk.created_at >= v_from and bk.status = any (v_ok)
        group by bk.renter_id, p.full_name order by sum(bk.total_amount) desc limit 5) t),
    -- What happened to the requests made in the period.
    'outcomes', (select jsonb_build_object(
        'requests', count(*),
        'confirmed', count(*) filter (where status = any (v_ok)),
        'cancelled', count(*) filter (where status = 'CANCELLED'),
        'declined', count(*) filter (where status = 'REJECTED'),
        'expired', count(*) filter (where status = 'EXPIRED'),
        'open', count(*) filter (where not (status = any (v_ok)) and status not in ('CANCELLED', 'REJECTED', 'EXPIRED')))
      from public.bookings where business_id = p_business_id and created_at >= v_from)
  );
end $$;

revoke execute on function public.business_plan_active(uuid), public.set_fleet_business(),
  public.save_contract_terms(uuid, jsonb), public.business_analytics_advanced(uuid, int)
from public, anon;
revoke execute on function public.set_fleet_business() from authenticated;
grant execute on function public.business_plan_active(uuid), public.save_contract_terms(uuid, jsonb),
  public.business_analytics_advanced(uuid, int) to authenticated;
