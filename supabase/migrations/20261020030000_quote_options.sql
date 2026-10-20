-- Quotes can now hold several options; the client accepts one of them.
alter table public.quotes add column if not exists bundle jsonb;
alter table public.quotes add column if not exists accepted_option text;
alter table public.quote_versions add column if not exists bundle jsonb;
