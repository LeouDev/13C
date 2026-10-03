-- Email for notifications: every notification row is also an outbox entry.
--  * Inserting notifications pings POST <email_dispatch_url> (pg_net, after commit); the app claims due rows,
--    renders the matching template and sends through Resend. A 5-minute sweep retries failures.
--  * The URL and bearer secret live in Vault (email_dispatch_url / email_dispatch_secret), not in this file.
--    Without them nothing is called, so local and test databases never send.
--  * Reserved test domains (@*.test etc.) are never emailed.

create extension if not exists pg_net with schema extensions;

alter table public.notifications
  add column emailed_at timestamptz,
  add column email_attempts int not null default 0,
  add column email_locked_until timestamptz,
  add column email_error text;

-- Notifications from before email went live count as handled.
update public.notifications set emailed_at = created_at where emailed_at is null;

create or replace function public.is_deliverable_email(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p is not null and p ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and p !~* '\.(test|example|invalid|localhost)$'
$$;

-- Claim up to p_limit due emails. Rows stay locked for 5 minutes so parallel dispatches never double-send.
create or replace function public.claim_notification_emails(p_limit int default 20)
returns table (id uuid, user_id uuid, business_id uuid, type text, title text, body text, link text, email text, full_name text, attempts int)
language sql security definer set search_path = '' as $$
  with picked as (
    select n.id from public.notifications n
    join public.profiles p on p.id = n.user_id
    where n.emailed_at is null and n.email_attempts < 5
      and (n.email_locked_until is null or n.email_locked_until < now())
      and n.created_at > now() - interval '2 days'
      and public.is_deliverable_email(p.email)
    order by n.created_at
    limit p_limit
    for update of n skip locked
  )
  update public.notifications n
     set email_attempts = n.email_attempts + 1, email_locked_until = now() + interval '5 minutes'
    from picked, public.profiles p
   where n.id = picked.id and p.id = n.user_id
  returning n.id, n.user_id, n.business_id, n.type, n.title, n.body, n.link, p.email, p.full_name, n.email_attempts
$$;

create or replace function public.request_email_dispatch()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'email_dispatch_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'email_dispatch_secret');
begin
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 10000
  );
end $$;

create or replace function public.after_notifications_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from inserted i join public.profiles p on p.id = i.user_id where public.is_deliverable_email(p.email)) then
    perform public.request_email_dispatch();
  end if;
  return null;
end $$;

create trigger notifications_email after insert on public.notifications
  referencing new table as inserted for each statement execute function public.after_notifications_insert();

revoke execute on function public.is_deliverable_email(text), public.claim_notification_emails(int),
  public.request_email_dispatch(), public.after_notifications_insert()
from public, anon, authenticated;
grant execute on function public.claim_notification_emails(int), public.request_email_dispatch() to service_role;

-- Retry sweep: only calls out when something is actually waiting.
do $$
begin
  perform cron.schedule('13c-email-dispatch', '*/5 * * * *', $job$
    select public.request_email_dispatch()
    where exists (
      select 1 from public.notifications n join public.profiles p on p.id = n.user_id
      where n.emailed_at is null and n.email_attempts < 5 and n.created_at > now() - interval '2 days'
        and (n.email_locked_until is null or n.email_locked_until < now())
        and public.is_deliverable_email(p.email))
  $job$);
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
