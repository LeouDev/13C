-- Publishing needs the whole "Needed to go live" list (src/lib/dashboard.ts getStoreChecklist shows the same list):
-- verified, an active plan or trial, a car that's active, priced and has a photo, a payment method, the business details
-- the store and agreements use (address, phone, representative), and a cancellation policy.
-- Already-published stores aren't affected; the checks run when publishing.
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
    if not exists (
      select 1 from public.vehicles v join public.vehicle_pricing p on p.vehicle_id = v.id
      where v.business_id = p_business_id and v.status = 'ACTIVE' and v.deleted_at is null
        and exists (select 1 from public.vehicle_images i where i.vehicle_id = v.id)
    ) then
      raise exception 'STORE_NEEDS_PHOTOS' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.payment_methods m where m.business_id = p_business_id and m.is_enabled) then
      raise exception 'STORE_NEEDS_PAYMENT_METHOD' using errcode = 'P0001';
    end if;
    if coalesce(btrim(b.address), '') = '' or coalesce(btrim(b.phone), '') = '' or coalesce(btrim(b.representative_name), '') = '' then
      raise exception 'STORE_NEEDS_PROFILE' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.business_storefronts s
      where s.business_id = p_business_id and coalesce(btrim(s.policies ->> 'cancellation'), '') <> ''
    ) then
      raise exception 'STORE_NEEDS_CANCELLATION_POLICY' using errcode = 'P0001';
    end if;
  end if;
  update public.business_storefronts set
    is_published = p_publish,
    published_at = case when p_publish then now() else published_at end
  where business_id = p_business_id;
  perform public.log_audit(case when p_publish then 'store.published' else 'store.unpublished' end,
    'business', p_business_id, p_business_id, '{}'::jsonb);
end $$;
