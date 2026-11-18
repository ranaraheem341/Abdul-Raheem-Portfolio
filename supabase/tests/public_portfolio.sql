-- Owner-run AFTER migrations 001-005 and actual admin provisioning. All writes roll back.
-- Does not create accounts or Storage objects; test actual file delivery separately.
begin;
select set_config('test.portfolio_admin_id',(select user_id::text from private.portfolio_admin),true);
do $$ begin
  if current_setting('test.portfolio_admin_id',true) is null then raise exception 'Configure actual admin first'; end if;
end $$;
select set_config('test.public_skill_id',gen_random_uuid()::text,true);
select set_config('test.public_project_id',gen_random_uuid()::text,true);
select set_config('test.public_media_id',gen_random_uuid()::text,true);
-- Suppress any earlier profile approval within this rollback-only transaction.
update public.profile_draft set published_revision=null;
set local role anon;
do $$ begin
  if exists(select 1 from public.profile) or exists(select 1 from public.links) then raise exception 'Unapproved profile/links leaked'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.portfolio_admin_id'),true);
set local role authenticated;
select * from public.write_profile_editor(
  '{"full_name":"PUBLIC PROFILE TEST","headline":"TEST","biography":"PUBLIC BIO","professional_summary":"PUBLIC SUMMARY","linkedin":"","fiverr":"","github":"https://github.com/test","public_email":""}',
  coalesce((select revision from public.profile_draft where id),0),true);
select * from public.write_profile_editor(
  '{"full_name":"PRIVATE PROFILE EDIT","headline":"TEST","biography":"PRIVATE BIO","professional_summary":"PRIVATE SUMMARY","linkedin":"","fiverr":"","github":"","public_email":""}',
  (select revision from public.profile_draft where id),false);
select * from public.write_record_editor('skills',current_setting('test.public_skill_id')::uuid,
  '{"name":"PUBLIC TEST","category":"TEST","sort_order":0}',0,'save');
reset role;
set local role anon;
do $$ begin
  if not exists(select 1 from public.profile where full_name='PUBLIC PROFILE TEST' and biography='PUBLIC BIO') then raise exception 'Published profile snapshot lost'; end if;
  if not exists(select 1 from public.links where label='GitHub' and url='https://github.com/test') then raise exception 'Published link snapshot lost'; end if;
  if exists(select 1 from public.skills where id=current_setting('test.public_skill_id')::uuid) then raise exception 'Draft leaked'; end if;
  begin perform * from public.record_drafts; raise exception 'Draft read allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.profile_draft; raise exception 'Profile draft read allowed'; exception when insufficient_privilege then null; end;
  begin perform location from public.profile; raise exception 'Unmanaged profile location exposed'; exception when insufficient_privilege then null; end;
  begin perform public.write_record_editor('skills',gen_random_uuid(),'{}',0,'save'); raise exception 'Anon write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select * from public.write_record_editor('skills',current_setting('test.public_skill_id')::uuid,
  '{"name":"PUBLIC TEST","category":"TEST","sort_order":0}',1,'publish');
select * from public.write_record_editor('skills',current_setting('test.public_skill_id')::uuid,
  '{"name":"PRIVATE EDIT","category":"TEST","sort_order":0}',2,'save');
select * from public.write_record_editor('projects',current_setting('test.public_project_id')::uuid,
  '{"title":"TEST","description":"TEST","technologies":[],"project_url":null,"source_url":null,"sort_order":0}',0,'publish');
reset role;
-- Owner seeds rollback-only metadata; registration correctly requires actual Storage bytes.
insert into public.media(id,purpose,draft_project_id,object_path,mime_type,size_bytes,alt_text)
values(current_setting('test.public_media_id')::uuid,'screenshot',current_setting('test.public_project_id')::uuid,
  'screenshot/'||current_setting('test.public_media_id')||'.png','image/png',3,'TEST');
set local role anon;
do $$ begin
  if not exists(select 1 from public.skills where id=current_setting('test.public_skill_id')::uuid and name='PUBLIC TEST') then raise exception 'Published snapshot lost'; end if;
  if exists(select 1 from public.media where id=current_setting('test.public_media_id')::uuid) then raise exception 'Draft media leaked'; end if;
end $$;
reset role;
set local role authenticated;
select * from public.write_media_editor(current_setting('test.public_media_id')::uuid,1,'publish','{}');
reset role;
set local role anon;
do $$ begin
  if not exists(select 1 from public.media where id=current_setting('test.public_media_id')::uuid) then raise exception 'Published screenshot missing'; end if;
  if exists(select 1 from storage.objects where bucket_id='portfolio-media') then raise exception 'Direct private object read allowed'; end if;
end $$;
reset role;
set local role authenticated;
select * from public.write_record_editor('projects',current_setting('test.public_project_id')::uuid,'{}',1,'archive');
select * from public.write_record_editor('skills',current_setting('test.public_skill_id')::uuid,'{}',3,'archive');
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.skills where id=current_setting('test.public_skill_id')::uuid) then raise exception 'Archived skill leaked'; end if;
  if exists(select 1 from public.projects where id=current_setting('test.public_project_id')::uuid) then raise exception 'Archived project leaked'; end if;
  if exists(select 1 from public.media where id=current_setting('test.public_media_id')::uuid) then raise exception 'Archived screenshot leaked'; end if;
end $$;
reset role;
rollback;
