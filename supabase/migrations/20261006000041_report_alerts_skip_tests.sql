-- Reports filed for a test-domain account don't alert admins, like other test actions (20261003000020_admin_notify_skip_tests.sql).
-- notify_admins can't tell on its own here: 13C files down payment disputes for the renter from a scheduled job, with no signed-in user.
create or replace function public.after_report_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_what text := case when new.entity_type = 'BOOKING' then (select 'Booking ' || reference from public.bookings where id = new.entity_id) end;
begin
  if public.is_deliverable_email((select email from public.profiles where id = new.reporter_id)) then
    perform public.notify_admins('report_submitted', 'New report: ' || new.reason,
      concat_ws(' · ', v_what, coalesce(left(new.details, 200), initcap(new.entity_type) || ' reported')), '/admin/reports');
  end if;
  return new;
end $$;
