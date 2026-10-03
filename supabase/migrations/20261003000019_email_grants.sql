-- Let the server (and tests) check which addresses are ever emailed.
grant execute on function public.is_deliverable_email(text) to service_role;
