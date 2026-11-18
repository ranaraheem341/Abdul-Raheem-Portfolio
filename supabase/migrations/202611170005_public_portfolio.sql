begin;

-- A boolean publication check reveals no draft payload. Older profile rows must
-- be explicitly published in the editor before they become public.
create function public.has_published_profile()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profile_draft where id and published_revision is not null); $$;
revoke all on function public.has_published_profile() from public, authenticated;
grant execute on function public.has_published_profile() to anon;

grant select (id,full_name,headline,biography,professional_summary) on public.profile to anon;
grant select on public.links, public.experience, public.skills,
  public.education, public.certifications, public.projects, public.media to anon;
create policy published_profile on public.profile for select to anon
using ((select public.has_published_profile()));
create policy published_links on public.links for select to anon
using (label in ('LinkedIn','Fiverr','GitHub','Public email') and (select public.has_published_profile()));
do $$ declare table_name text; begin
  foreach table_name in array array['experience','skills','education','certifications','projects'] loop
    execute format('create policy published_records on public.%I for select to anon using (not archived)', table_name);
  end loop;
end $$;
create policy published_media on public.media for select to anon
using (published and not deleting and (
  purpose in ('photo','cv') or (purpose='screenshot' and exists(
    select 1 from public.projects p where p.id=media.draft_project_id and not p.archived
  ))
));

-- No draft privileges, RPC privileges, public bucket or Storage read grants.
-- File delivery rechecks anonymous metadata before using a server-only secret.
commit;
