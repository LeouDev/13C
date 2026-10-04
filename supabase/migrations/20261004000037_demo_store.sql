-- A sample store rental owners can browse (13c.online/demo) to see what they'd get. It stays out of renters'
-- search, the homepage, the sitemap and Google, and nobody can book or message it. Only the server can set the flag.
alter table public.businesses add column is_demo boolean not null default false;

create function public.refuse_demo_store()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.businesses where id = new.business_id and is_demo) then
    raise exception 'DEMO_STORE' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.refuse_demo_store() from public, anon, authenticated;

create trigger refuse_demo_store before insert on public.bookings
  for each row execute function public.refuse_demo_store();
create trigger refuse_demo_store before insert on public.conversations
  for each row execute function public.refuse_demo_store();

-- Marketplace search: as before, plus the demo rule.
create or replace function public.search_vehicles(
  p_cities text[] default null, p_q text default null, p_category text default null,
  p_transmission public.transmission_type default null, p_min_seats int default null,
  p_min_price numeric default null, p_max_price numeric default null,
  p_self_drive boolean default null, p_with_driver boolean default null, p_delivery boolean default null,
  p_min_rating numeric default null, p_business_id uuid default null,
  p_start timestamptz default null, p_end timestamptz default null,
  p_sort text default 'recommended', p_limit int default 24, p_offset int default 0
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
