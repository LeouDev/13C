-- Removes all data created by integration tests (users with @13c.test emails).
set session_replication_role = replica;
create temp table t_users as select id from auth.users where email like '%@13c.test';
create temp table t_biz as select id from public.businesses where owner_id in (select id from t_users);
create temp table t_book as select id from public.bookings where business_id in (select id from t_biz) or renter_id in (select id from t_users);
delete from storage.objects where bucket_id = 'contracts' and (storage.foldername(name))[1] in (select id::text from t_biz);
delete from storage.objects where bucket_id in ('media', 'business-docs', 'kyc') and (
  (storage.foldername(name))[1] in (select id::text from t_biz union select id::text from t_users)
  or (storage.foldername(name))[2] in (select id::text from t_biz union select id::text from t_users));
delete from public.contract_signatures where booking_id in (select id from t_book);
delete from public.contract_versions where booking_id in (select id from t_book);
delete from public.contracts where booking_id in (select id from t_book);
delete from public.reviews where booking_id in (select id from t_book);
delete from public.payments where booking_id in (select id from t_book);
delete from public.booking_status_history where booking_id in (select id from t_book);
delete from public.messages where booking_id in (select id from t_book);
delete from public.bookings where id in (select id from t_book);
delete from public.audit_logs where business_id in (select id from t_biz) or actor_id in (select id from t_users);
delete from public.businesses where id in (select id from t_biz);
delete from public.reports where reporter_id in (select id from t_users);
delete from auth.users where id in (select id from t_users);
set session_replication_role = origin;
select count(*) as remaining_test_users from auth.users where email like '%@13c.test';
