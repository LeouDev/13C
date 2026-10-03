-- Pro (and the free trial, which gives everything in Pro) covers up to 5 vehicles; bigger fleets need Business.
-- Businesses already above 5 keep their vehicles: the limit applies when adding a vehicle or paying for Pro.
create or replace function public.plan_vehicle_limit(p public.subscription_plan)
returns int language sql immutable set search_path = '' as $$
  select case p when 'FREE' then 5 when 'PRO' then 5 else null end
$$;
