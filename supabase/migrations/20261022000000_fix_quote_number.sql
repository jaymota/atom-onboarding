-- Fix: the variable "fy" clashed with the column "fy" ("column reference is ambiguous").
create or replace function public.next_quote_number(on_date date default (now() at time zone 'Asia/Kolkata')::date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  start_year int := case when extract(month from on_date) >= 4 then extract(year from on_date)::int
                         else extract(year from on_date)::int - 1 end;
  v_fy text := start_year::text || '-' || lpad(((start_year + 1) % 100)::text, 2, '0');
  n int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not allowed';
  end if;
  insert into public.quote_counters as qc (fy, last) values (v_fy, 1)
  on conflict (fy) do update set last = qc.last + 1
  returning qc.last into n;
  return 'ATOM/Q/' || v_fy || '/' || lpad(n::text, 3, '0');
end;
$$;
