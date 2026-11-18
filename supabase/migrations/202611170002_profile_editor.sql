begin;
alter table public.profile add column professional_summary text not null default '';
create table public.profile_draft (
  id boolean primary key default true check (id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  published_revision integer check (published_revision between 1 and revision)
);
alter table public.profile_draft enable row level security;
alter table public.profile_draft force row level security;
revoke all on public.profile_draft from public, anon, authenticated;
grant select, insert, update on public.profile_draft to authenticated;
create policy portfolio_admin_only on public.profile_draft for all to authenticated
using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));

-- Invoker rights preserve existing RLS. One transaction prevents partial publish.
create function public.write_profile_editor(content jsonb, expected_revision integer, publish_now boolean)
returns table(revision integer, published_revision integer)
language plpgsql security invoker set search_path = '' as $$
declare current_revision integer; field_name text; max_length integer;
begin
  if not coalesce(public.is_portfolio_admin(), false) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0 or publish_now is null
     or content is null or jsonb_typeof(content) <> 'object' then
    raise exception 'Invalid input' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(content)) <> 8 then
    raise exception 'Invalid fields' using errcode = '22023';
  end if;
  for field_name, max_length in select * from (values
    ('full_name',120),('headline',240),('biography',10000),('professional_summary',3000),
    ('linkedin',2048),('fiverr',2048),('github',2048),('public_email',254)
  ) as fields(name, max_chars) loop
    if jsonb_typeof(content -> field_name) is distinct from 'string'
       or length(content ->> field_name) > max_length then
      raise exception 'Invalid field' using errcode = '22023';
    end if;
  end loop;
  if length(btrim(content ->> 'full_name')) = 0
     or ((content ->> 'linkedin') <> '' and (content ->> 'linkedin') !~ '^https://(www\.)?linkedin\.com(/|$)')
     or ((content ->> 'fiverr') <> '' and (content ->> 'fiverr') !~ '^https://(www\.)?fiverr\.com(/|$)')
     or ((content ->> 'github') <> '' and (content ->> 'github') !~ '^https://(www\.)?github\.com(/|$)')
     or ((content ->> 'public_email') <> '' and (content ->> 'public_email') !~ '^[^[:space:]@?&#]+@[^[:space:]@?&#]+\.[^[:space:]@?&#]+$') then
    raise exception 'Invalid content' using errcode = '22023';
  end if;
  insert into public.profile_draft(id, payload) values (true, content) on conflict (id) do nothing;
  select d.revision into current_revision from public.profile_draft d where d.id = true for update;
  if current_revision is distinct from expected_revision then
    raise exception 'Revision conflict' using errcode = '40001';
  end if;
  update public.profile_draft d set payload = content, revision = current_revision + 1,
    published_revision = case when publish_now then current_revision + 1 else d.published_revision end where d.id = true;
  if publish_now then
    insert into public.profile(id,full_name,headline,biography,professional_summary)
    values(true,content->>'full_name',content->>'headline',content->>'biography',content->>'professional_summary')
    on conflict (id) do update set full_name=excluded.full_name, headline=excluded.headline,
      biography=excluded.biography, professional_summary=excluded.professional_summary;
    -- Replace only these four editor-owned labels; preserve all other links/location.
    delete from public.links where label in ('LinkedIn','Fiverr','GitHub','Public email');
    insert into public.links(label,url,sort_order)
    select label, case when key = 'public_email' then 'mailto:' || (content->>key) else content->>key end, position
    from (values ('LinkedIn','linkedin',0),('Fiverr','fiverr',1),('GitHub','github',2),('Public email','public_email',3)) as links(label,key,position)
    where content->>key <> '';
  end if;
  return query select d.revision,d.published_revision from public.profile_draft d where d.id = true;
end $$;
revoke all on function public.write_profile_editor(jsonb,integer,boolean) from public, anon;
grant execute on function public.write_profile_editor(jsonb,integer,boolean) to authenticated;
commit;
