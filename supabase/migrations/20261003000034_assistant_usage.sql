-- For Business assistant: messages per visitor per day, so one visitor can't use up the free AI credit.
-- `key` is a keyed hash of the day and the visitor's IP (made by the API route), never the IP itself.
-- Server-only: RLS on, no policies. Rows older than yesterday are removed on each call.
create table public.assistant_usage (
  key text primary key,
  day date not null default (now() at time zone 'Asia/Manila')::date,
  count int not null default 0
);
alter table public.assistant_usage enable row level security;

-- Counts one message and says whether it's within the day's limit.
create function public.assistant_allow(p_key text, p_limit int)
returns boolean language sql security definer set search_path = '' as $$
  with old as (
    delete from public.assistant_usage where day < (now() at time zone 'Asia/Manila')::date - 1
  ), hit as (
    insert into public.assistant_usage (key, count) values (p_key, 1)
    on conflict (key) do update set count = public.assistant_usage.count + 1
    returning count
  )
  select count <= p_limit from hit
$$;

revoke execute on function public.assistant_allow(text, int) from public, anon, authenticated;
grant execute on function public.assistant_allow(text, int) to service_role;
