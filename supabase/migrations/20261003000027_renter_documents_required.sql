-- Renters need their driver's license (front and back) and a government ID uploaded before they can
-- request a booking or accept a proposal. A business can view them as soon as the renter requests a
-- booking with it (not only after approving), so it can decide knowingly. Still never public.
create or replace function public.assert_renter_ready(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles pr join public.renters r on r.user_id = pr.id
    where pr.id = p_user and not pr.is_suspended
      and coalesce(btrim(coalesce(r.legal_name, pr.full_name)), '') <> ''
      and coalesce(btrim(pr.phone), '') <> '' and coalesce(btrim(r.address), '') <> ''
      and coalesce(btrim(r.license_number), '') <> ''
  ) then
    raise exception 'RENTER_PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;
  if (select count(distinct doc_type) from public.driver_documents
      where user_id = p_user and doc_type in ('DRIVERS_LICENSE_FRONT', 'DRIVERS_LICENSE_BACK', 'GOVERNMENT_ID')) < 3 then
    raise exception 'RENTER_DOCUMENTS_MISSING' using errcode = 'P0001';
  end if;
end $$;

-- Can the signed-in user (a business member) view this renter's license and ID?
create or replace function public.can_view_renter_documents(p_renter uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
    where b.renter_id = p_renter and public.has_business_role(b.business_id)
      and b.status in ('PENDING_OWNER_APPROVAL', 'APPROVED', 'CONTRACT_DRAFT', 'CONTRACT_SENT', 'AWAITING_SIGNATURE',
                       'SIGNED', 'CONFIRMED', 'ACTIVE', 'RETURNED')
  )
$$;
revoke execute on function public.can_view_renter_documents(uuid) from public, anon;
grant execute on function public.can_view_renter_documents(uuid) to authenticated;

drop policy "driver_documents: read" on public.driver_documents;
create policy "driver_documents: read" on public.driver_documents for select to authenticated using (
  user_id = (select auth.uid()) or public.is_admin() or public.can_view_renter_documents(user_id)
);

drop policy "kyc: read" on storage.objects;
create policy "kyc: read" on storage.objects for select to authenticated using (
  bucket_id = 'kyc' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()
    or public.can_view_renter_documents(public.try_uuid((storage.foldername(name))[1]))
  )
);
