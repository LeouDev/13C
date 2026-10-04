-- Server errors, recorded by src/instrumentation.ts (Next.js onRequestError). Server-only: RLS on, no policies.
-- Paths are stored without their query string. Rows are removed after 30 days.
create table public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null,
  digest text,
  path text,
  method text,
  route text,
  notified_at timestamptz
);
create index app_errors_unnotified_idx on public.app_errors (id) where notified_at is null;
alter table public.app_errors enable row level security;

-- Hourly: one notification (emailed by the outbox) telling admins about the server errors since the last summary.
-- Nothing is sent when there were none, so admins get at most one email an hour.
-- p_user_id sends it to that one user instead and leaves the errors unmarked (tests).
create function public.send_error_summary(p_user_id uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_last bigint;
  v_total int;
  v_lines text;
  v_title text;
begin
  delete from public.app_errors where created_at < now() - interval '30 days';
  select max(id), count(*) into v_last, v_total from public.app_errors where notified_at is null;
  if v_total = 0 then return 0; end if;

  -- The most frequent first: "3× /path · message".
  select string_agg(g.n || '× ' || coalesce(g.path, '(unknown page)') || ' · ' || left(g.message, 200), e'\n' order by g.n desc, g.last_at desc)
    into v_lines
  from (
    select path, message, count(*) as n, max(created_at) as last_at
    from public.app_errors where notified_at is null and id <= v_last
    group by path, message
    order by count(*) desc, max(created_at) desc
    limit 8
  ) g;
  v_title := v_total || case when v_total = 1 then ' server error' else ' server errors' end || ' on 13C';

  if p_user_id is null then
    perform public.notify_admins('site_errors', v_title, v_lines, '/admin');
    update public.app_errors set notified_at = now() where notified_at is null and id <= v_last;
  else
    insert into public.notifications (user_id, type, title, body, link) values (p_user_id, 'site_errors', v_title, v_lines, '/admin');
  end if;
  return v_total;
end $$;

revoke execute on function public.send_error_summary(uuid) from public, anon, authenticated;
grant execute on function public.send_error_summary(uuid) to service_role;

do $$
begin
  perform cron.schedule('13c-error-summary', '45 * * * *', 'select public.send_error_summary()');
exception when others then
  raise notice 'pg_cron unavailable: %', sqlerrm;
end $$;
