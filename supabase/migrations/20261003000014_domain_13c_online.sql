-- The platform domain is 13c.online.
update public.platform_settings set value = '"support@13c.online"'::jsonb
 where key = 'support_email' and value = '"support@13c.ph"'::jsonb;
