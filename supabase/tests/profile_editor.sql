-- Owner-run integration test AFTER migrations 001/002 and actual admin setup.
-- No accounts created. All profile/link/draft changes roll back.
begin;
do $$ begin
  if not exists (select 1 from private.portfolio_admin) then
    raise exception 'Configure the actual admin first';
  end if;
end $$;
select set_config('test.portfolio_admin_id', (select user_id::text from private.portfolio_admin), true);
set local role anon;
do $$ begin
  begin
    perform public.write_profile_editor('{}'::jsonb, 0, false);
    raise exception 'Anonymous execution allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', case
  when current_setting('test.portfolio_admin_id') <> '00000000-0000-4000-8000-000000000001'
  then '00000000-0000-4000-8000-000000000001'
  else '00000000-0000-4000-8000-000000000002' end, true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.profile_draft) then raise exception 'Non-admin draft read allowed'; end if;
  begin
    perform public.write_profile_editor('{}'::jsonb, 0, false);
    raise exception 'Non-admin write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('test.portfolio_admin_id'), true);
set local role authenticated;
do $$
declare
  content jsonb := '{"full_name":"Editor integration test","headline":"Test","biography":"Draft biography","professional_summary":"Test summary","linkedin":"","fiverr":"","github":"https://github.com/test","public_email":"test@example.test"}';
  previous_profile jsonb;
  previous_links jsonb;
  previous_revision integer;
  result record;
begin
  select coalesce(max(d.revision), 0) into previous_revision from public.profile_draft d;
  select jsonb_agg(p) into previous_profile from public.profile p;
  select jsonb_agg(l order by l.id) into previous_links from public.links l;
  select * into result from public.write_profile_editor(content, previous_revision, false);
  if result.revision <> previous_revision + 1 then raise exception 'Draft revision incorrect'; end if;
  if (select jsonb_agg(p) from public.profile p) is distinct from previous_profile
    or (select jsonb_agg(l order by l.id) from public.links l) is distinct from previous_links then
    raise exception 'Draft changed published data';
  end if;
  begin
    perform public.write_profile_editor(content, previous_revision, true);
    raise exception 'Stale revision accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.write_profile_editor(content || '{"full_name":""}'::jsonb, previous_revision + 1, true);
    raise exception 'Invalid name accepted';
  exception when invalid_parameter_value then null;
  end;
  select * into result from public.write_profile_editor(content, previous_revision + 1, true);
  if result.revision <> previous_revision + 2 or result.published_revision <> result.revision then
    raise exception 'Publish revision incorrect';
  end if;
  if not exists (select 1 from public.profile where full_name = 'Editor integration test' and professional_summary = 'Test summary')
     or not exists (select 1 from public.links where label = 'Public email' and url = 'mailto:test@example.test')
     or exists (select 1 from public.links where label in ('LinkedIn','Fiverr')) then
    raise exception 'Published content incorrect';
  end if;
end $$;
reset role;
rollback;
