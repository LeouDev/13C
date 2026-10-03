-- Removes all data created by integration tests (users with @13c.test emails).
-- Foreign-key cascades stay ON (never use session_replication_role here: it disables them and
-- leaves orphans). Only the contract-immutability guards are lifted, inside this transaction.
-- Storage files are removed beforehand through the Storage API (tests/global-setup.ts).
begin;
create temp table t_users on commit drop as select id from auth.users where email like '%@13c.test';
create temp table t_biz on commit drop as select id from public.businesses where owner_id in (select id from t_users);
create temp table t_book on commit drop as
  select id from public.bookings where business_id in (select id from t_biz) or renter_id in (select id from t_users);

alter table public.contract_versions disable trigger guard_contract_version;
alter table public.contract_signatures disable trigger guard_contract_signature;
delete from public.contract_signatures where booking_id in (select id from t_book);
delete from public.contract_versions where booking_id in (select id from t_book);
delete from public.contracts where booking_id in (select id from t_book);
alter table public.contract_versions enable trigger guard_contract_version;
alter table public.contract_signatures enable trigger guard_contract_signature;

delete from public.reviews where booking_id in (select id from t_book);
delete from public.bookings where id in (select id from t_book);                       -- cascades history, payments
delete from public.conversations where business_id in (select id from t_biz) or customer_id in (select id from t_users);
delete from public.businesses where id in (select id from t_biz);                       -- cascades members, storefront, fleet, …
delete from auth.users where id in (select id from t_users);                            -- cascades profiles, renters, notifications, …
commit;

-- Must both be 0.
select
  (select count(*) from auth.users where email like '%@13c.test') as remaining_test_users,
  (select count(*) from public.profiles where id not in (select id from auth.users))
    + (select count(*) from public.vehicles where business_id not in (select id from public.businesses))
    + (select count(*) from public.conversations where business_id not in (select id from public.businesses))
    + (select count(*) from public.business_storefronts where business_id not in (select id from public.businesses)) as orphans;
