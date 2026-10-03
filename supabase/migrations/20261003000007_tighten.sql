-- member_has_role takes an arbitrary user id; only definer functions should call it.
revoke execute on function public.member_has_role(uuid, uuid, public.business_role) from anon, authenticated;
