-- Booking/contract updates posted by the database stay SYSTEM messages even when a signed-in user's
-- action triggered them (they were being relabelled as that user's own chat message, which hid the
-- booking link and sent the other side a duplicate "new message" notification).
-- Safe: clients can only insert conversation_id and body, so 'SYSTEM' always comes from post_system_message().
create or replace function public.before_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  v_uid uuid := (select auth.uid());
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if new.sender_role = 'SYSTEM' then
    new.sender_id := null;
  elsif v_uid is not null then
    -- Requests coming straight from PostgREST: derive the role, never trust the client.
    new.sender_id := v_uid;
    if v_uid = c.customer_id then
      new.sender_role := 'CUSTOMER';
    elsif public.member_has_role(c.business_id, v_uid, 'STAFF') then
      new.sender_role := 'BUSINESS';
    else
      raise exception 'NOT_AUTHORIZED' using errcode = '42501';
    end if;
  end if;
  new.body := btrim(new.body);
  return new;
end $$;

-- Repair mislabelled ones (only post_system_message() sets booking_id).
update public.messages set sender_role = 'SYSTEM', sender_id = null
 where booking_id is not null and sender_role <> 'SYSTEM';
