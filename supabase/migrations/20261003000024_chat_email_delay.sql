-- Chat emails only reach people who are away: a message notification is emailed if it's still unread
-- 5 minutes after the latest message. (The per-conversation notification is refreshed on every new
-- message, so a burst sends one email; reading the chat in the app cancels it.)
create or replace function public.notification_email_due(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select n.emailed_at is null and n.email_attempts < 5
      and (n.email_locked_until is null or n.email_locked_until < now())
      and n.created_at > now() - interval '2 days'
      and (n.type <> 'message' or (n.read_at is null and n.created_at < now() - interval '5 minutes'))
      and public.is_deliverable_email(p.email)
    from public.notifications n join public.profiles p on p.id = n.user_id
    where n.id = p_id
  ), false)
$$;

create or replace function public.claim_notification_emails(p_limit int default 20)
returns table (id uuid, user_id uuid, business_id uuid, type text, title text, body text, link text, email text, full_name text, attempts int)
language sql security definer set search_path = '' as $$
  with picked as (
    select n.id from public.notifications n
    where n.emailed_at is null and n.created_at > now() - interval '2 days' and public.notification_email_due(n.id)
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

-- Chat notifications wait for the sweep, so inserting them doesn't need an immediate dispatch.
create or replace function public.after_notifications_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from inserted i join public.profiles p on p.id = i.user_id
             where i.type <> 'message' and public.is_deliverable_email(p.email)) then
    perform public.request_email_dispatch();
  end if;
  return null;
end $$;

revoke execute on function public.notification_email_due(uuid) from public, anon, authenticated;
grant execute on function public.notification_email_due(uuid) to service_role;

do $$
begin
  perform cron.schedule('13c-email-dispatch', '*/5 * * * *', $job$
    select public.request_email_dispatch()
    where exists (
      select 1 from public.notifications n
      where n.emailed_at is null and n.created_at > now() - interval '2 days' and public.notification_email_due(n.id))
  $job$);
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
