-- Storage buckets. Public: media only. Private: verification docs, KYC, signed contracts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('business-docs', 'business-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('kyc', 'kyc', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- media: b/<business_id>/... (logos, covers, vehicle photos) and u/<user_id>/... (avatars)
create policy "media: write own scope" on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and (
    ((storage.foldername(name))[1] = 'b' and public.has_business_role(public.try_uuid((storage.foldername(name))[2]), 'MANAGER'))
    or ((storage.foldername(name))[1] = 'u' and (storage.foldername(name))[2] = (select auth.uid())::text)
  )
);
create policy "media: read own scope" on storage.objects for select to authenticated using (
  bucket_id = 'media' and (
    ((storage.foldername(name))[1] = 'b' and public.has_business_role(public.try_uuid((storage.foldername(name))[2]), 'MANAGER'))
    or ((storage.foldername(name))[1] = 'u' and (storage.foldername(name))[2] = (select auth.uid())::text)
  )
);
create policy "media: delete own scope" on storage.objects for delete to authenticated using (
  bucket_id = 'media' and (
    ((storage.foldername(name))[1] = 'b' and public.has_business_role(public.try_uuid((storage.foldername(name))[2]), 'MANAGER'))
    or ((storage.foldername(name))[1] = 'u' and (storage.foldername(name))[2] = (select auth.uid())::text)
  )
);

-- business-docs: <business_id>/...
create policy "business-docs: owner upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'business-docs' and public.has_business_role(public.try_uuid((storage.foldername(name))[1]), 'OWNER')
);
create policy "business-docs: owner or admin read" on storage.objects for select to authenticated using (
  bucket_id = 'business-docs' and (public.has_business_role(public.try_uuid((storage.foldername(name))[1]), 'OWNER') or public.is_admin())
);
create policy "business-docs: owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'business-docs' and public.has_business_role(public.try_uuid((storage.foldername(name))[1]), 'OWNER')
);

-- kyc: <user_id>/...  — renter, admin, and businesses holding an approved booking from that renter
create policy "kyc: own upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'kyc' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "kyc: read" on storage.objects for select to authenticated using (
  bucket_id = 'kyc' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()
    or exists (select 1 from public.bookings b
               where b.renter_id = public.try_uuid((storage.foldername(name))[1]) and public.has_business_role(b.business_id)
                 and b.status in ('APPROVED','CONTRACT_DRAFT','CONTRACT_SENT','AWAITING_SIGNATURE','SIGNED','CONFIRMED','ACTIVE','RETURNED'))
  )
);
create policy "kyc: own delete" on storage.objects for delete to authenticated using (
  bucket_id = 'kyc' and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- contracts: <business_id>/<booking_id>/<version_id>.pdf — written only by the server (secret key)
create policy "contracts: parties read" on storage.objects for select to authenticated using (
  bucket_id = 'contracts' and (
    public.is_admin()
    or exists (select 1 from public.bookings b
               where b.id = public.try_uuid((storage.foldername(name))[2])
                 and (b.renter_id = (select auth.uid()) or public.has_business_role(b.business_id)))
  )
);
