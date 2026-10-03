-- Support mail goes to the operator's existing inbox.
update public.platform_settings set value = '"support@air-rally.com"'::jsonb where key = 'support_email';
