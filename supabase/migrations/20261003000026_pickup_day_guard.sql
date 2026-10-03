-- A booking can go on rent only from its pickup day (Manila time). Handing the car over earlier
-- means changing the booking dates first, so the agreement and calendar stay accurate.
create or replace function public.guard_pickup_day()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'ACTIVE' and old.status is distinct from 'ACTIVE'
     and now() < (date_trunc('day', new.pickup_at at time zone 'Asia/Manila') at time zone 'Asia/Manila') then
    raise exception 'PICKUP_NOT_YET' using errcode = 'P0001', detail = public.fmt_date(new.pickup_at);
  end if;
  return new;
end $$;
create trigger guard_pickup_day before update of status on public.bookings
  for each row execute function public.guard_pickup_day();
revoke execute on function public.guard_pickup_day() from public, anon, authenticated;
