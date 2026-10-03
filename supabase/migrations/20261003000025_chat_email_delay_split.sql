-- Same rules as before, with "is it time to email?" separate from "is this a real inbox?" (testable on its own).
create or replace function public.notification_email_due(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select n.emailed_at is null and n.email_attempts < 5
      and (n.email_locked_until is null or n.email_locked_until < now())
      and n.created_at > now() - interval '2 days'
      and (n.type <> 'message' or (n.read_at is null and n.created_at < now() - interval '5 minutes'))
    from public.notifications n where n.id = p_id
  ), false)
$$;

create or replace function public.claim_notification_emails(p_limit int default 20)
returns table (id uuid, user_id uuid, business_id uuid, type text, title text, body text, link text, email text, full_name text, attempts int)
language sql security definer set search_path = '' as $$
  with picked as (
    select n.id from public.notifications n
    join public.profiles p on p.id = n.user_id
    where n.emailed_at is null and n.created_at > now() - interval '2 days'
      and public.notification_email_due(n.id) and public.is_deliverable_email(p.email)
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

do $$
begin
  perform cron.schedule('13c-email-dispatch', '*/5 * * * *', $job$
    select public.request_email_dispatch()
    where exists (
      select 1 from public.notifications n join public.profiles p on p.id = n.user_id
      where n.emailed_at is null and n.created_at > now() - interval '2 days'
        and public.notification_email_due(n.id) and public.is_deliverable_email(p.email))
  $job$);
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
