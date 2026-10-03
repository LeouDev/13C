-- 13C's own domain is live: support moves to support@13c.online (privacy requests go to privacy@13c.online).
update public.platform_settings set value = '"support@13c.online"'::jsonb
 where key = 'support_email' and value = '"support@air-rally.com"'::jsonb;
