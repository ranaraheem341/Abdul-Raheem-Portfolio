begin;

-- Not exposed through the Data API. Only the database owner configures this row.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.portfolio_admin (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table private.portfolio_admin enable row level security;
revoke all on private.portfolio_admin from public, anon, authenticated;

create function public.is_portfolio_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.portfolio_admin where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_portfolio_admin() from public, anon;
grant execute on function public.is_portfolio_admin() to authenticated;

create table public.profile (
  id boolean primary key default true check (id),
  full_name text not null,
  headline text not null default '',
  biography text not null default '',
  location text not null default ''
);
create table public.links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null check (url ~ '^https://' or url ~ '^mailto:'),
  sort_order integer not null default 0
);
create table public.experience (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  company text not null,
  start_date date not null,
  end_date date check (end_date >= start_date),
  highlights text[] not null default '{}',
  sort_order integer not null default 0
);
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  sort_order integer not null default 0
);
create table public.education (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  qualification text not null,
  start_date date,
  end_date date check (start_date is null or end_date >= start_date),
  description text not null default '',
  sort_order integer not null default 0
);
create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  issuer text not null,
  issued_on date,
  expires_on date check (issued_on is null or expires_on >= issued_on),
  credential_url text check (credential_url ~ '^https://'),
  sort_order integer not null default 0
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  technologies text[] not null default '{}',
  project_url text check (project_url ~ '^https://'),
  source_url text check (source_url ~ '^https://'),
  sort_order integer not null default 0
);
create table public.media (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null default 'portfolio-media' check (bucket_id = 'portfolio-media'),
  object_path text not null unique check (length(object_path) > 0),
  alt_text text not null default '',
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  project_id uuid references public.projects(id) on delete set null
);

-- No anonymous policy or privilege, and no ability to edit the admin configuration.
do $$
declare table_name text;
begin
  foreach table_name in array array['profile','links','experience','skills','education','certifications','projects','media'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy portfolio_admin_only on public.%I for all to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()))', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media', 'portfolio-media', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']);

-- Supabase manages storage.objects and enables RLS. Never manipulate objects by SQL.
create policy portfolio_media_admin_only on storage.objects
for all to authenticated
using (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()))
with check (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));

-- Protect this bucket even if a project already has a broader permissive policy.
create policy portfolio_media_authenticated_guard on storage.objects
as restrictive for all to authenticated
using (bucket_id <> 'portfolio-media' or (select public.is_portfolio_admin()))
with check (bucket_id <> 'portfolio-media' or (select public.is_portfolio_admin()));
create policy portfolio_media_anonymous_guard on storage.objects
as restrictive for all to anon
using (bucket_id <> 'portfolio-media')
with check (bucket_id <> 'portfolio-media');

-- Intentionally no accounts, allowlist row, portfolio content, or public reads seeded.
commit;
