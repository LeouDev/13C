-- Amounts in contracts and system messages use the peso sign (the contract PDF now embeds a font with ₱).
-- Signed contract versions are immutable and keep the text they were signed with.
create or replace function public.fmt_money(p numeric)
returns text language sql immutable set search_path = '' as $$
  select '₱' || to_char(coalesce(p, 0), 'FM999,999,999,990.00')
$$;
