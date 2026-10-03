-- Phone numbers are stored as +63 followed by the national number (forms now show a fixed +63 prefix).
-- Only values that convert cleanly to 9–10 national digits are changed.
update public.profiles p set phone = '+63' || x.local
from (select id, regexp_replace(regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^63', ''), '^0', '') as local
      from public.profiles where coalesce(phone, '') <> '') x
where p.id = x.id and x.local ~ '^\d{9,10}$' and p.phone is distinct from '+63' || x.local;

update public.businesses b set phone = '+63' || x.local
from (select id, regexp_replace(regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^63', ''), '^0', '') as local
      from public.businesses where coalesce(phone, '') <> '') x
where b.id = x.id and x.local ~ '^\d{9,10}$' and b.phone is distinct from '+63' || x.local;
