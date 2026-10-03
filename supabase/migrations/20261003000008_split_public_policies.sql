-- anon can't read bookings/conversations/favorites, so policies that reference them must not apply to anon.
-- Split each into a public policy (anon + authenticated) and a related-party policy (authenticated).
drop policy "businesses: public or related" on public.businesses;
create policy "businesses: public" on public.businesses for select to anon, authenticated
  using (public.is_business_public(id));
create policy "businesses: related" on public.businesses for select to authenticated using (
  public.has_business_role(id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.business_id = businesses.id and b.renter_id = (select auth.uid()))
  or exists (select 1 from public.conversations c where c.business_id = businesses.id and c.customer_id = (select auth.uid()))
);

drop policy "storefronts: public or members" on public.business_storefronts;
create policy "storefronts: public" on public.business_storefronts for select to anon, authenticated
  using (public.is_business_public(business_id));
create policy "storefronts: related" on public.business_storefronts for select to authenticated using (
  public.has_business_role(business_id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.business_id = business_storefronts.business_id and b.renter_id = (select auth.uid()))
);

drop policy "vehicles: public or related" on public.vehicles;
create policy "vehicles: public" on public.vehicles for select to anon, authenticated
  using (deleted_at is null and status = 'ACTIVE' and public.is_business_public(business_id));
create policy "vehicles: related" on public.vehicles for select to authenticated using (
  public.has_business_role(business_id) or public.is_admin()
  or exists (select 1 from public.bookings b where b.vehicle_id = vehicles.id and b.renter_id = (select auth.uid()))
  or exists (select 1 from public.favorites f where f.vehicle_id = vehicles.id and f.user_id = (select auth.uid()))
);
