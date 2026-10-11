-- Nationwide: businesses anywhere in the Philippines. The marketplace lists the places that actually have cars
-- (a car's province is its business's), search can filter by province, and the agreement and welcome text no longer assume Cebu.

-- Cities with public cars, by province. Case-insensitive per city; shows one spelling of it.
create function public.marketplace_locations()
returns table (province text, city text, cars bigint) language sql stable security definer set search_path = '' as $$
  select b.province, min(btrim(v.city)), count(*)
  from public.vehicles v
  join public.businesses b on b.id = v.business_id
  join public.business_storefronts s on s.business_id = b.id
  where v.deleted_at is null and v.status = 'ACTIVE'
    and b.status = 'VERIFIED' and b.deleted_at is null and s.is_published and not b.is_demo
    and public.subscription_is_active(b.id)
  group by b.province, lower(btrim(v.city))
$$;
grant execute on function public.marketplace_locations() to anon, authenticated;

-- Same search, plus p_province (the business's province), so same-named towns in different provinces stay apart.
drop function public.search_vehicles(text[], text, text, public.transmission_type, int, numeric, numeric, boolean, boolean, boolean, numeric, uuid, timestamptz, timestamptz, text, int, int);
create or replace function public.search_vehicles(
  p_cities text[] default null, p_q text default null, p_category text default null,
  p_transmission public.transmission_type default null, p_min_seats int default null,
  p_min_price numeric default null, p_max_price numeric default null,
  p_self_drive boolean default null, p_with_driver boolean default null, p_delivery boolean default null,
  p_min_rating numeric default null, p_business_id uuid default null,
  p_start timestamptz default null, p_end timestamptz default null,
  p_sort text default 'recommended', p_limit int default 24, p_offset int default 0, p_province text default null
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
      and public.subscription_is_active(b.id)
      and (p_business_id is null or v.business_id = p_business_id)
      and (p_province is null or lower(b.province) = lower(btrim(p_province)))
      and (p_business_id is not null or not b.is_demo) -- a sample store's cars show only on its own page
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
grant execute on function public.search_vehicles(text[], text, text, public.transmission_type, int, numeric, numeric, boolean, boolean, boolean, numeric, uuid, timestamptz, timestamptz, text, int, int, text) to anon, authenticated;

-- The agreement's travel rule: the island the car was picked up on, not Cebu. Published as a new template version;
-- agreements already generated keep their own text.
do $$
declare
  t public.contract_templates;
begin
  select * into t from public.contract_templates where is_active;
  if t.id is not null and t.sections::text like '%outside the island of Cebu%' then
    update public.contract_templates set is_active = false where id = t.id;
    insert into public.contract_templates (name, version, sections, is_active, created_by)
    values (t.name, (select max(version) + 1 from public.contract_templates where name = t.name),
      replace(t.sections::text, 'outside the island of Cebu', 'outside the island where it was picked up')::jsonb, true, t.created_by);
  end if;
end $$;

create or replace function public.after_email_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = new.id) then
    perform public.notify_user(new.id, 'welcome', 'Welcome to 13C', 'Find and book cars from local rental businesses across the Philippines.', '/explore');
  end if;
  return new;
exception when others then
  raise warning 'welcome notification skipped: %', sqlerrm; -- never block confirming an email
  return new;
end $$;
