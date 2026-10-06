-- Applying for verification needs three things (src/lib/constants.ts VERIFICATION_GROUPS lists the same): the
-- representative's government ID, one business document (DTI/SEC/CDA registration, Mayor's or business permit, barangay
-- business clearance or BIR 2303), and a photo of one of the cars with its plate and a paper showing the business name and
-- the date. Replaces "any one document". Businesses already verified aren't affected.
create or replace function public.submit_business_verification(p_business_id uuid, p_documents jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses;
begin
  if not public.has_business_role(p_business_id, 'OWNER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into b from public.businesses where id = p_business_id for update;
  if b.status not in ('DRAFT', 'CHANGES_REQUESTED', 'REJECTED') then
    raise exception 'VERIFICATION_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) = 0 then
    raise exception 'DOCUMENTS_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_documents) d
             where coalesce(d ->> 'path', '') not like p_business_id::text || '/%') then
    raise exception 'INVALID_DOCUMENT' using errcode = 'P0001';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_documents) d where d ->> 'type' = 'REPRESENTATIVE_ID')
     or not exists (select 1 from jsonb_array_elements(p_documents) d where d ->> 'type' in ('REGISTRATION', 'MAYORS_PERMIT', 'BARANGAY_CLEARANCE', 'BIR'))
     or not exists (select 1 from jsonb_array_elements(p_documents) d where d ->> 'type' = 'CAR_PHOTO') then
    raise exception 'VERIFICATION_DOCS_INCOMPLETE' using errcode = 'P0001';
  end if;
  if b.representative_name is null or b.phone is null or b.address is null then
    raise exception 'BUSINESS_PROFILE_INCOMPLETE' using errcode = 'P0001';
  end if;
  insert into public.business_verifications (business_id, submitted_by, documents, submitter_note)
  values (p_business_id, (select auth.uid()), p_documents, p_note);
  update public.businesses set status = 'PENDING', status_note = null where id = p_business_id;
  perform public.notify_admins('verification_submitted', 'Business awaiting verification', b.name, '/admin/businesses/' || b.id);
  perform public.log_audit('business.verification_submitted', 'business', b.id, b.id, '{}'::jsonb);
end $$;
