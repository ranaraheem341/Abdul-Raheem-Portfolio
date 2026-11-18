-- Owner-run after migrations 001-004 and actual admin provisioning. ROLLBACK ONLY.
-- Tests metadata/RPC/RLS, not Storage bytes: never insert/delete storage.objects by SQL.
-- Synthetic media below deliberately have no real Storage objects; use API acceptance too.
begin;
do $$ begin
  if not exists(select 1 from private.portfolio_admin) then raise exception 'Configure actual admin first'; end if;
  if (select public from storage.buckets where id='portfolio-media') is distinct from false then raise exception 'Bucket must be private'; end if;
end $$;
select set_config('test.portfolio_admin_id',(select user_id::text from private.portfolio_admin),true);
set local role anon;
do $$ begin
  begin
    perform public.write_media_editor(gen_random_uuid(),0,'register','{}');
    raise exception 'Anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.media where not published or deleting or purpose='legacy') then
    raise exception 'Private metadata exposed';
  end if;
  if exists(select 1 from storage.objects where bucket_id='portfolio-media') then raise exception 'Anonymous object read allowed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',case when current_setting('test.portfolio_admin_id')<>'00000000-0000-4000-8000-000000000001' then '00000000-0000-4000-8000-000000000001' else '00000000-0000-4000-8000-000000000002' end,true);
set local role authenticated;
do $$ declare action text; begin
  if exists(select 1 from public.media) or exists(select 1 from public.projects) or exists(select 1 from storage.objects where bucket_id='portfolio-media') then raise exception 'Non-admin read allowed'; end if;
  foreach action in array array['register','publish','unpublish','begin_delete','delete'] loop
    begin
      perform public.write_media_editor(gen_random_uuid(),0,action,'{}');
      raise exception 'Non-admin RPC allowed';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    insert into public.media(object_path,mime_type,size_bytes) values('test-denied','image/png',1);
    raise exception 'Non-admin insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.portfolio_admin_id'),true);
set local role authenticated;
do $$
declare
  project_id uuid := gen_random_uuid(); screenshot uuid := gen_random_uuid(); photo_a uuid := gen_random_uuid(); photo_b uuid := gen_random_uuid();
  content jsonb := '{"title":"Synthetic project only","description":"Rollback-only acceptance fixture","technologies":["TypeScript"],"project_url":null,"source_url":null,"sort_order":1}';
  result public.record_drafts; file_result public.media;
begin
  select * into result from public.write_record_editor('projects',project_id,content,0,'save');
  if result.revision<>1 or exists(select 1 from public.projects where id=project_id) then raise exception 'Project draft isolation failed'; end if;
  insert into public.media(id,object_path,mime_type,size_bytes,purpose,draft_project_id,alt_text)
    values(screenshot,'test-only/'||screenshot||'.png','image/png',1,'screenshot',project_id,'Test fixture');
  begin
    perform public.write_media_editor(screenshot,1,'publish','{}');
    raise exception 'Draft project screenshot published';
  exception when invalid_parameter_value then null; end;
  perform public.write_record_editor('projects',project_id,content,1,'publish');
  perform public.write_media_editor(screenshot,1,'publish','{}');
  perform public.write_record_editor('projects',project_id,content||'{"title":"Changed draft"}',2,'save');
  if (select title from public.projects where id=project_id)<>'Synthetic project only' then raise exception 'Draft changed published project'; end if;
  begin
    perform public.write_record_editor('projects',project_id,content,2,'publish');
    raise exception 'Stale project write allowed';
  exception when serialization_failure then null; end;
  perform public.write_record_editor('projects',project_id,'{}',3,'archive');
  if (select published from public.media where id=screenshot) or not (select archived from public.projects where id=project_id) then raise exception 'Archive failed'; end if;
  perform public.write_record_editor('projects',project_id,content,4,'publish');
  perform public.write_media_editor(screenshot,3,'publish','{}');
  begin
    perform public.write_record_editor('projects',project_id,'{}',5,'delete');
    raise exception 'Project deleted with screenshots attached';
  exception when foreign_key_violation then null; end;
  perform public.write_media_editor(screenshot,4,'begin_delete','{}');
  if not (select deleting from public.media where id=screenshot) or (select published from public.media where id=screenshot) then raise exception 'Removal tombstone failed'; end if;
  begin
    perform public.write_media_editor(screenshot,5,'publish','{}');
    raise exception 'Pending deletion republished';
  exception when invalid_parameter_value then null; end;
  perform public.write_media_editor(screenshot,5,'delete','{}');
  perform public.write_record_editor('projects',project_id,'{}',5,'delete');
  if exists(select 1 from public.record_drafts where kind='projects' and id=project_id) or exists(select 1 from public.projects where id=project_id) or exists(select 1 from public.media where id=screenshot) then raise exception 'Deletion failed'; end if;

  insert into public.media(id,object_path,mime_type,size_bytes,purpose,alt_text) values
    (photo_a,'test-only/'||photo_a||'.png','image/png',1,'photo','Test A'),
    (photo_b,'test-only/'||photo_b||'.png','image/png',1,'photo','Test B');
  perform public.write_media_editor(photo_a,1,'publish','{}');
  perform public.write_media_editor(photo_b,1,'publish','{}');
  if (select published from public.media where id=photo_a) or not (select published from public.media where id=photo_b) then raise exception 'Replacement publication failed'; end if;
  begin
    perform public.write_media_editor(photo_a,2,'publish','{}');
    raise exception 'Stale media revision allowed';
  exception when serialization_failure then null; end;
  perform public.write_media_editor(photo_b,2,'unpublish','{}');
  begin
    perform public.write_media_editor(gen_random_uuid(),0,'register','{}');
    raise exception 'Invalid metadata registered';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
rollback;
