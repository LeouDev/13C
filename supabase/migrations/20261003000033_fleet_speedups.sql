-- Speed-ups the Supabase advisor suggested for the fleet tables. Who can do what is unchanged.
--  * Index the foreign keys it found uncovered.
--  * Split each "business write" FOR ALL policy into insert/update/delete, so reading goes through one
--    policy ("members read") instead of two.

create index vehicle_fleet_business on public.vehicle_fleet (business_id);
create index vehicle_service_logs_business on public.vehicle_service_logs (business_id);
create index vehicle_service_logs_created_by on public.vehicle_service_logs (created_by);

drop policy "fleet: business write" on public.vehicle_fleet;
create policy "fleet: business insert" on public.vehicle_fleet for insert to authenticated
  with check (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));
create policy "fleet: business update" on public.vehicle_fleet for update to authenticated
  using (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id))
  with check (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));
create policy "fleet: business delete" on public.vehicle_fleet for delete to authenticated
  using (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));

drop policy "service logs: business write" on public.vehicle_service_logs;
create policy "service logs: business insert" on public.vehicle_service_logs for insert to authenticated
  with check (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));
create policy "service logs: business update" on public.vehicle_service_logs for update to authenticated
  using (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id))
  with check (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));
create policy "service logs: business delete" on public.vehicle_service_logs for delete to authenticated
  using (public.has_business_role(business_id, 'MANAGER') and public.business_plan_active(business_id));
