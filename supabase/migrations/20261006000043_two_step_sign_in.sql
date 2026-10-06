-- Two-step sign-in (an authenticator app code, Supabase TOTP). Once a user turns it on, a session that hasn't passed the code
-- step (aal1) can't touch payment details, the team, the business or license and ID records, even through the API.
-- The app sends such sessions to the code step first (src/lib/auth.ts requireUser).
create function public.passed_two_step()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
$$;
revoke execute on function public.passed_two_step() from public, anon;
grant execute on function public.passed_two_step() to authenticated;

create policy "payment_methods: two-step sign-in" on public.payment_methods as restrictive for all to authenticated
  using ((select public.passed_two_step())) with check ((select public.passed_two_step()));
create policy "business_members: two-step sign-in" on public.business_members as restrictive for all to authenticated
  using ((select public.passed_two_step())) with check ((select public.passed_two_step()));
create policy "driver_documents: two-step sign-in" on public.driver_documents as restrictive for all to authenticated
  using ((select public.passed_two_step())) with check ((select public.passed_two_step()));
-- Stores are read on public pages by signed-in people too, so only changes are restricted here.
create policy "businesses: two-step sign-in" on public.businesses as restrictive for update to authenticated
  using ((select public.passed_two_step())) with check ((select public.passed_two_step()));

-- Businesses no longer download renters' license and ID files directly: /api/renter-documents/[id] serves them with a
-- watermark naming the business (after checking driver_documents access as the viewer). Renters and admins still can.
drop policy "kyc: read" on storage.objects;
create policy "kyc: read" on storage.objects for select to authenticated using (
  bucket_id = 'kyc' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
);
