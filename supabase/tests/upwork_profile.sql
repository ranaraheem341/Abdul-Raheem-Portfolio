-- Owner-run AFTER migration 006 and actual admin provisioning. All writes roll back.
-- Synthetic test URLs below are fixtures, never production profile destinations.
begin;
do $$ begin
  if not exists(select 1 from private.portfolio_admin) then raise exception 'Configure actual admin first'; end if;
end $$;
select set_config('test.upwork_admin_id',(select user_id::text from private.portfolio_admin),true);
update public.profile_draft set published_revision=null;
set local role anon;
do $$ begin
  if exists(select 1 from public.links) then raise exception 'Unapproved links leaked'; end if;
  begin perform * from public.profile_draft; raise exception 'Draft read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.write_profile_editor('{}',0,false); raise exception 'Anon write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',case
  when current_setting('test.upwork_admin_id') <> '00000000-0000-4000-8000-000000000001'
  then '00000000-0000-4000-8000-000000000001' else '00000000-0000-4000-8000-000000000002' end,true);
set local role authenticated;
do $$ begin
  begin perform public.write_profile_editor('{}',0,false); raise exception 'Non-admin write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.upwork_admin_id'),true);
set local role authenticated;
do $$
declare
  content jsonb := '{"full_name":"UPWORK TEST","headline":"TEST","biography":"TEST BIO","professional_summary":"TEST SUMMARY","linkedin":"https://linkedin.com/in/test","fiverr":"https://fiverr.com/test","github":"","public_email":"test@example.test","upwork":"https://www.upwork.com/freelancers/published-test"}';
  original_links jsonb; original_profile jsonb; previous_revision integer; saved record; invalid_url text;
begin
  select coalesce(max(d.revision),0) into previous_revision from public.profile_draft d;
  select jsonb_agg(l order by l.id) into original_links from public.links l;
  select jsonb_agg(p) into original_profile from public.profile p;
  select * into saved from public.write_profile_editor(content,previous_revision,false);
  if saved.revision <> previous_revision+1 then raise exception 'Save revision incorrect'; end if;
  if (select jsonb_agg(l order by l.id) from public.links l) is distinct from original_links
    or (select jsonb_agg(p) from public.profile p) is distinct from original_profile then raise exception 'Draft changed publication'; end if;
  foreach invalid_url in array array['http://upwork.com/test','https://upwork.com.evil.test/test',
    'https://user:pass@upwork.com/test','https://upwork.com:444/test','https://support.upwork.com/test',
    'https://upwork.com/test path',E'https://upwork.com/\\test'] loop
    begin
      perform public.write_profile_editor(content || jsonb_build_object('upwork',invalid_url),saved.revision,true);
      raise exception 'Invalid Upwork URL accepted: %',invalid_url;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin perform public.write_profile_editor(content,previous_revision,true); raise exception 'Stale revision accepted'; exception when serialization_failure then null; end;
  select * into saved from public.write_profile_editor(content,saved.revision,true);
  if saved.published_revision <> saved.revision then raise exception 'Publish revision incorrect'; end if;
  -- Legacy eight-field callers preserve the saved Upwork value on publish.
  select * into saved from public.write_profile_editor(content - 'upwork',saved.revision,true);
  if not exists(select 1 from public.links where label='Upwork' and url=content->>'upwork') then raise exception 'Legacy caller removed Upwork'; end if;
  -- A newer draft must leave the earlier publication visible to anonymous users.
  perform public.write_profile_editor(content || '{"upwork":"https://upwork.com/freelancers/private-draft"}',saved.revision,false);
end $$;
reset role;
set local role anon;
do $$ begin
  if not exists(select 1 from public.links where label='Upwork' and url='https://www.upwork.com/freelancers/published-test') then raise exception 'Published Upwork invisible'; end if;
  if exists(select 1 from public.links where url like '%private-draft%') then raise exception 'Draft URL leaked'; end if;
  if not exists(select 1 from public.links where label='LinkedIn' and url='https://linkedin.com/in/test')
    or not exists(select 1 from public.links where label='Fiverr' and url='https://fiverr.com/test')
    or not exists(select 1 from public.links where label='Public email' and url='mailto:test@example.test')
    or exists(select 1 from public.links where label='GitHub') then raise exception 'Earlier social publication changed'; end if;
  begin perform * from public.profile_draft; raise exception 'Draft read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ declare saved public.profile_draft; begin
  select * into saved from public.profile_draft where id;
  perform public.write_profile_editor(saved.payload || '{"upwork":""}',saved.revision,true);
end $$;
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.links where label='Upwork') then raise exception 'Blank Upwork still public'; end if;
  if not exists(select 1 from public.links where label='LinkedIn') then raise exception 'Removing Upwork removed other links'; end if;
end $$;
reset role;
rollback;
