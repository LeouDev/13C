-- "Rental starting soon" / "Rental ending soon" notifications (spec §54), sent once per booking.
create or replace function public.send_rental_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select b.id, b.renter_id, b.business_id, b.reference, b.pickup_at, b.return_at, b.status, concat_ws(' ', v.make, v.model) as vehicle
    from public.bookings b join public.vehicles v on v.id = b.vehicle_id
    where (b.status = 'CONFIRMED' and b.pickup_at between now() and now() + interval '24 hours')
       or (b.status = 'ACTIVE' and b.return_at between now() and now() + interval '24 hours')
  loop
    if r.status = 'CONFIRMED' and not exists (select 1 from public.notifications where type = 'rental_starting' and link = '/account/bookings/' || r.id) then
      perform public.notify_user(r.renter_id, 'rental_starting', 'Your rental starts soon', r.vehicle || ' · pickup ' || public.fmt_ts(r.pickup_at), '/account/bookings/' || r.id, r.business_id);
      perform public.notify_business(r.business_id, 'rental_starting', 'Pickup within 24 hours', r.reference || ' · ' || public.fmt_ts(r.pickup_at), '/dashboard/bookings/' || r.id);
      n := n + 1;
    elsif r.status = 'ACTIVE' and not exists (select 1 from public.notifications where type = 'rental_ending' and link = '/account/bookings/' || r.id) then
      perform public.notify_user(r.renter_id, 'rental_ending', 'Your rental ends soon', 'Return the ' || r.vehicle || ' by ' || public.fmt_ts(r.return_at), '/account/bookings/' || r.id, r.business_id);
      perform public.notify_business(r.business_id, 'rental_ending', 'Return within 24 hours', r.reference || ' · ' || public.fmt_ts(r.return_at), '/dashboard/bookings/' || r.id);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke execute on function public.send_rental_reminders() from public, anon, authenticated;
grant execute on function public.send_rental_reminders() to service_role;

do $$
begin
  perform cron.schedule('13c-rental-reminders', '17 * * * *', 'select public.send_rental_reminders()');
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
