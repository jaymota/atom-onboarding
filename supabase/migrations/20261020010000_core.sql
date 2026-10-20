-- Core tables for the onboarding platform.
-- Every table has Row Level Security ON. The public (anon) role gets NO access to
-- any table; public actions (intake form, quote page) go through Edge Functions.

-- ---------------------------------------------------------------- admins
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- True only for a logged-in admin whose login session is younger than 7 days.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and coalesce((
       select s.created_at > now() - interval '7 days'
       from auth.sessions s
       where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
     ), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "admins read admins" on public.admins for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- settings
create table public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "admin all settings" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new_enquiry' check (status in (
    'new_enquiry', 'quote_draft', 'quote_sent', 'changes_requested', 'quote_accepted',
    'mou_draft', 'mou_sent', 'signed_by_client', 'fully_signed', 'project_started', 'lost')),
  lost_reason text,
  source text not null default 'form' check (source in ('form', 'manual', 'import')),
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  brand text not null default '',
  answers jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb
);
alter table public.clients enable row level security;
create policy "admin all clients" on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create index clients_created_idx on public.clients (created_at desc);

-- ---------------------------------------------------------------- quotes
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  number text unique,
  version int not null default 1,
  status text not null default 'draft' check (status in (
    'draft', 'approved', 'sent', 'changes_requested', 'accepted', 'superseded', 'revoked')),
  input jsonb not null,
  doc jsonb,                       -- frozen copy of the document when approved
  share_token text unique,         -- long random token for the client link
  expires_at timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  view_count int not null default 0,
  accepted_at timestamptz,
  accepted_by text,
  client_comment text,
  pdf_path text
);
alter table public.quotes enable row level security;
create policy "admin all quotes" on public.quotes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create index quotes_client_idx on public.quotes (client_id);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  version int not null,
  input jsonb not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (quote_id, version)
);
alter table public.quote_versions enable row level security;
create policy "admin all quote_versions" on public.quote_versions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- MOUs
create table public.mous (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  status text not null default 'draft' check (status in (
    'draft', 'approved', 'sent_for_signature', 'signed_by_client', 'signed')),
  input jsonb not null,
  approved_at timestamptz,
  sent_at timestamptz,
  signed_at timestamptz,
  pdf_path text,
  signed_pdf_path text,
  details_token text unique,       -- "complete your details" link for the client
  details_token_expires timestamptz
);
alter table public.mous enable row level security;
create policy "admin all mous" on public.mous for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.mou_versions (
  id uuid primary key default gen_random_uuid(),
  mou_id uuid not null references public.mous (id) on delete cascade,
  version int not null,
  input jsonb not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (mou_id, version)
);
alter table public.mou_versions enable row level security;
create policy "admin all mou_versions" on public.mou_versions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- activity log
create table public.events (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients (id) on delete cascade,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "admin all events" on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create index events_client_idx on public.events (client_id, created_at desc);

-- ---------------------------------------------------------------- quote numbers
create table public.quote_counters (
  fy text primary key,
  last int not null default 0
);
alter table public.quote_counters enable row level security;

-- ATOM/Q/2026-27/001 — numbered per Indian financial year (April–March).
create or replace function public.next_quote_number(on_date date default (now() at time zone 'Asia/Kolkata')::date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  start_year int := case when extract(month from on_date) >= 4 then extract(year from on_date)::int
                         else extract(year from on_date)::int - 1 end;
  fy text := start_year::text || '-' || lpad(((start_year + 1) % 100)::text, 2, '0');
  n int;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not allowed';
  end if;
  insert into public.quote_counters (fy, last) values (fy, 1)
  on conflict (fy) do update set last = public.quote_counters.last + 1
  returning last into n;
  return 'ATOM/Q/' || fy || '/' || lpad(n::text, 3, '0');
end;
$$;
revoke all on function public.next_quote_number(date) from public;
grant execute on function public.next_quote_number(date) to authenticated, service_role;

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();
create trigger mous_touch before update on public.mous for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- PIN login (server-only tables)
-- No policies for most of these: only the Edge Functions (service role) can touch them.
create table public.admin_security (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text,
  pin_set_at timestamptz,
  failed_count int not null default 0,
  lock_level int not null default 0,
  locked_until timestamptz
);
alter table public.admin_security enable row level security;

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_hash text not null unique,
  label text not null default '',
  ip text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
alter table public.trusted_devices enable row level security;
create policy "admin reads devices" on public.trusted_devices for select to authenticated using (public.is_admin());
create policy "admin removes devices" on public.trusted_devices for delete to authenticated using (public.is_admin());

create table public.auth_codes (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('device', 'setup', 'reset')),
  code_hash text not null,
  device_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  ip text,
  created_at timestamptz not null default now()
);
alter table public.auth_codes enable row level security;

create table public.login_events (
  id bigint generated always as identity primary key,
  kind text not null,
  ip text,
  user_agent text,
  location text,
  created_at timestamptz not null default now()
);
alter table public.login_events enable row level security;
create policy "admin reads login events" on public.login_events for select to authenticated using (public.is_admin());

create table public.ip_limits (
  ip text primary key,
  fails int not null default 0,
  lock_level int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.ip_limits enable row level security;

-- Simple rate limiting for public actions (e.g. form submissions per IP).
create table public.rate_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);
alter table public.rate_hits enable row level security;
create index rate_hits_idx on public.rate_hits (bucket, created_at desc);

-- ---------------------------------------------------------------- file storage
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "admin reads documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_admin());
create policy "admin uploads documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());
create policy "admin updates documents" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_admin());
create policy "admin deletes documents" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());

-- The old heartbeat ping is the only thing anon may call.
revoke all on all tables in schema public from anon;
