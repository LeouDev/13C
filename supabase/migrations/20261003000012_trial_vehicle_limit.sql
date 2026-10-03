-- The 25-day free trial allows up to 10 vehicles (same as Pro) so owners can try the full product.
create or replace function public.plan_vehicle_limit(p public.subscription_plan)
returns int language sql immutable set search_path = '' as $$
  select case p when 'FREE' then 10 when 'PRO' then 10 else null end
$$;
