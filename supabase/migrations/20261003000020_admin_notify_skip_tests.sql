-- Actions by reserved test-domain accounts (the test suite's @13c.test users) don't notify admins,
-- so running the tests never emails or clutters real admins. System actions (no auth.uid()) still notify.
create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link from public.profiles
  where is_admin
    and ((select auth.uid()) is null
      or public.is_deliverable_email((select email from public.profiles where id = (select auth.uid()))))
$$;

-- Remove admin notifications left behind by test runs (their businesses/users are gone).
delete from public.notifications n
 where n.type = 'verification_submitted'
   and not exists (select 1 from public.businesses b where n.link = '/admin/businesses/' || b.id);
delete from public.notifications n
 where n.type = 'deletion_requested' and not public.is_deliverable_email(n.body);
