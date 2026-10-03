-- Signature certificate evidence + stricter signature images.
--  * contract_versions: who it was sent to, when/where the renter first opened it
--  * contract_signatures: signer email snapshot; every signature is a validated PNG
--    (typed signatures are now rendered to an image in the browser too)
--  * "opened" is recorded by the server (request IP/UA), not by a client-callable RPC

alter table public.contract_versions
  add column sent_to_email text,
  add column viewed_at timestamptz,
  add column viewed_ip inet,
  add column viewed_user_agent text;

alter table public.contract_signatures add column signer_email text;

alter table public.contract_signatures drop constraint contract_signatures_check;
alter table public.contract_signatures drop constraint contract_signatures_signature_data_check;
alter table public.contract_signatures add constraint contract_signatures_signature_png check (
  signature_data is not null
  and char_length(signature_data) <= 400000
  and signature_data ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
);

-- Opening the agreement: first view only, evidence captured from the request by the server.
create or replace function public.record_contract_view(p_actor_id uuid, p_contract_id uuid, p_ip inet, p_user_agent text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.contracts;
  b public.bookings;
begin
  select * into c from public.contracts where id = p_contract_id;
  if c.id is null or c.renter_id <> p_actor_id then return; end if;
  update public.contract_versions
     set viewed_at = now(), viewed_ip = p_ip, viewed_user_agent = left(p_user_agent, 400)
   where contract_id = c.id and version = c.current_version and status = 'SENT' and viewed_at is null;
  select * into b from public.bookings where id = c.booking_id;
  if b.status = 'CONTRACT_SENT' then
    perform public.apply_booking_status(b.id, 'AWAITING_SIGNATURE', p_actor_id, 'Renter opened the contract');
  end if;
end $$;
revoke execute on function public.record_contract_view(uuid, uuid, inet, text) from public, anon, authenticated;
grant execute on function public.record_contract_view(uuid, uuid, inet, text) to service_role;

-- The old client-callable version can't capture a trustworthy IP.
revoke execute on function public.mark_contract_viewed(uuid) from authenticated;

-- Provider signs (drawn or typed → PNG) and sends.
drop function public.send_contract(uuid, uuid, text, inet, text);
create function public.send_contract(
  p_actor_id uuid, p_contract_id uuid, p_signer_name text, p_signature_type public.signature_type,
  p_signature_data text, p_ip inet, p_user_agent text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.contracts;
  cv public.contract_versions;
  b public.bookings;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if c.id is null or not public.member_has_role(c.business_id, p_actor_id, 'MANAGER') then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into cv from public.contract_versions where contract_id = c.id and version = c.current_version for update;
  select * into b from public.bookings where id = c.booking_id;
  if cv.status <> 'DRAFT' or b.status <> 'CONTRACT_DRAFT' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_signer_name, ''))) < 2 then raise exception 'SIGNATURE_REQUIRED' using errcode = 'P0001'; end if;

  insert into public.contract_signatures (contract_version_id, booking_id, signer_id, signer_role, signer_name, signer_email,
    signature_type, signature_data, content_hash, ip_address, user_agent)
  values (cv.id, b.id, p_actor_id, 'PROVIDER', btrim(p_signer_name), (select email from public.profiles where id = p_actor_id),
    p_signature_type, p_signature_data, cv.content_hash, p_ip, left(p_user_agent, 400));
  update public.contract_versions set status = 'SENT', sent_at = now(), sent_by = p_actor_id,
    sent_to_email = (select email from public.profiles where id = c.renter_id)
  where id = cv.id;
  update public.contracts set status = 'SENT' where id = c.id;
  perform public.apply_booking_status(b.id, 'CONTRACT_SENT', p_actor_id, 'Contract v' || cv.version || ' sent');
  perform public.post_system_message(b.conversation_id, 'Rental agreement v' || cv.version || ' for ' || b.reference || ' was sent for signature.', b.id);
  perform public.log_audit('contract.sent', 'contract', c.id, c.business_id, jsonb_build_object('version', cv.version), p_actor_id);
end $$;
revoke execute on function public.send_contract(uuid, uuid, text, public.signature_type, text, inet, text) from public, anon, authenticated;
grant execute on function public.send_contract(uuid, uuid, text, public.signature_type, text, inet, text) to service_role;

-- Renter signs: the image is now stored for typed signatures too, plus the signer's email.
create or replace function public.sign_contract(
  p_actor_id uuid, p_version_id uuid, p_signature_type public.signature_type, p_signer_name text,
  p_signature_data text, p_content_hash text, p_agreed boolean, p_ip inet, p_user_agent text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  cv public.contract_versions;
  c public.contracts;
  b public.bookings;
begin
  select * into cv from public.contract_versions where id = p_version_id for update;
  if cv.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into c from public.contracts where id = cv.contract_id for update;
  select * into b from public.bookings where id = cv.booking_id for update;
  if b.renter_id <> p_actor_id then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if cv.version <> c.current_version or cv.status <> 'SENT' or b.status not in ('CONTRACT_SENT', 'AWAITING_SIGNATURE') then
    raise exception 'CONTRACT_NOT_SIGNABLE' using errcode = 'P0001';
  end if;
  if not coalesce(p_agreed, false) then raise exception 'AGREEMENT_REQUIRED' using errcode = 'P0001'; end if;
  if p_content_hash is distinct from cv.content_hash
     or encode(sha256(convert_to(cv.sections::text, 'UTF8')), 'hex') <> cv.content_hash then
    raise exception 'CONTRACT_CHANGED' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_signer_name, ''))) < 2 then raise exception 'SIGNATURE_REQUIRED' using errcode = 'P0001'; end if;

  insert into public.contract_signatures (contract_version_id, booking_id, signer_id, signer_role, signer_name, signer_email,
    signature_type, signature_data, content_hash, ip_address, user_agent)
  values (cv.id, b.id, p_actor_id, 'RENTER', btrim(p_signer_name), (select email from public.profiles where id = p_actor_id),
    p_signature_type, p_signature_data, cv.content_hash, p_ip, left(p_user_agent, 400));
  update public.contract_versions set status = 'SIGNED', signed_at = now() where id = cv.id;
  update public.contracts set status = 'SIGNED' where id = c.id;
  perform public.apply_booking_status(b.id, 'SIGNED', p_actor_id, 'Contract v' || cv.version || ' signed');
  perform public.apply_booking_status(b.id, 'CONFIRMED', p_actor_id, 'Booking confirmed');
  perform public.post_system_message(b.conversation_id, 'Rental agreement v' || cv.version || ' was signed. Booking ' || b.reference || ' is confirmed.', b.id);
  perform public.log_audit('contract.signed', 'contract', c.id, c.business_id, jsonb_build_object('version', cv.version), p_actor_id);
end $$;
