-- KYC review queue (Admin → Users → KYC pending). A renter moves to Pending once their license (front and back) and
-- government ID are all in, and again whenever they replace one, since a new document needs a new check. Removing one
-- takes Pending or Verified back to Unverified; a rejection stays, with its note, until they upload again.
create function public.sync_kyc_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
begin
  if public.renter_has_documents(v_user) then
    if tg_op = 'INSERT' then
      update public.renters set kyc_status = 'PENDING', kyc_note = null where user_id = v_user;
    end if;
  else
    update public.renters set kyc_status = 'UNVERIFIED' where user_id = v_user and kyc_status in ('PENDING', 'VERIFIED');
  end if;
  return null;
end $$;
revoke execute on function public.sync_kyc_status() from public, anon, authenticated;
create trigger driver_documents_kyc after insert or delete on public.driver_documents
  for each row execute function public.sync_kyc_status();

-- Renters who already uploaded everything join the queue now (admin decisions are kept).
update public.renters r set kyc_status = 'PENDING' where kyc_status = 'UNVERIFIED' and public.renter_has_documents(r.user_id);
