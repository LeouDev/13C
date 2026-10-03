-- Notifications (and therefore emails) for the events that had an email template but no notification yet.

-- Renter: their booking request went out.
create or replace function public.after_booking_requested()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_user(new.renter_id, 'booking_request_sent', 'Booking request sent',
    (select concat_ws(' ', v.make, v.model) from public.vehicles v where v.id = new.vehicle_id)
      || ' · ' || public.fmt_date(new.pickup_at) || ' – ' || public.fmt_date(new.return_at),
    '/account/bookings/' || new.id, new.business_id);
  return new;
end $$;
create trigger after_booking_requested after insert on public.bookings
  for each row when (new.status = 'PENDING_OWNER_APPROVAL') execute function public.after_booking_requested();

-- New account confirmed its email.
create or replace function public.after_email_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = new.id) then
    perform public.notify_user(new.id, 'welcome', 'Welcome to 13C', 'Find and book cars from local Cebu rental businesses.', '/explore');
  end if;
  return new;
exception when others then
  raise warning 'welcome notification skipped: %', sqlerrm; -- never block confirming an email
  return new;
end $$;
create trigger on_auth_user_email_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.after_email_confirmed();

-- User asked to delete their account (admins are notified separately).
create or replace function public.after_deletion_requested()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_user(new.id, 'deletion_received', 'We received your deletion request',
    'We''ll process it within 30 days, as the Data Privacy Act requires.', '/account');
  return new;
end $$;
create trigger after_deletion_requested after update of deletion_requested_at on public.profiles
  for each row when (old.deletion_requested_at is null and new.deletion_requested_at is not null)
  execute function public.after_deletion_requested();

-- Owner submitted the business for verification.
create or replace function public.after_verification_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_business(new.business_id, 'business_submitted', 'Verification submitted',
    'We''re reviewing your business. This usually takes 1–2 business days.', '/dashboard/profile', 'OWNER');
  return new;
end $$;
create trigger after_verification_submitted after insert on public.business_verifications
  for each row execute function public.after_verification_submitted();

-- Someone reported a listing, business, review or user.
create or replace function public.after_report_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admins('report_submitted', 'New report: ' || new.reason,
    coalesce(left(new.details, 200), initcap(new.entity_type) || ' reported'), '/admin/reports');
  return new;
end $$;
create trigger after_report_submitted after insert on public.reports
  for each row execute function public.after_report_submitted();

-- Admin changed a business's plan: tell the owners.
create or replace function public.admin_set_plan(p_business_id uuid, p_plan public.subscription_plan, p_status public.subscription_status default 'ACTIVE')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old public.subscription_plan;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  select plan into v_old from public.subscriptions where business_id = p_business_id;
  update public.subscriptions set
    current_period_end = case
      when p_plan = plan then current_period_end
      when p_plan = 'FREE' then least(coalesce(current_period_end, now()), now())
      else null
    end,
    plan = p_plan, status = p_status
  where business_id = p_business_id;
  if v_old is distinct from p_plan then
    perform public.notify_business(p_business_id, 'plan_changed', 'Your plan changed',
      'You''re now on the ' || initcap(p_plan::text) || ' plan.', '/dashboard/subscription', 'OWNER');
  end if;
  perform public.log_audit('subscription.changed', 'business', p_business_id, p_business_id, jsonb_build_object('plan', p_plan, 'status', p_status));
end $$;

revoke execute on function public.after_booking_requested(), public.after_email_confirmed(), public.after_deletion_requested(),
  public.after_verification_submitted(), public.after_report_submitted()
from public, anon, authenticated;

-- Email plumbing must never roll back the action that created the notification.
create or replace function public.request_email_dispatch()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_dispatch_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'email dispatch not requested: %', sqlerrm; -- the 5-minute sweep retries
end $$;
