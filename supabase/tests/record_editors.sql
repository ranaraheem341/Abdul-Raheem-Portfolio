-- Owner-run AFTER migrations 001–003 and actual admin provisioning.
-- Synthetic test-only records and all changes roll back; no accounts created.
begin;
do $$ begin
  if not exists(select 1 from private.portfolio_admin) then raise exception 'Configure the actual admin first'; end if;
end $$;
select set_config('test.portfolio_admin_id',(select user_id::text from private.portfolio_admin),true);
set local role anon;
do $$ begin
  begin
    perform public.write_record_editor('skills',gen_random_uuid(),'{}',0,'save');
    raise exception 'Anonymous execution allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',case when current_setting('test.portfolio_admin_id')<>'00000000-0000-4000-8000-000000000001' then '00000000-0000-4000-8000-000000000001' else '00000000-0000-4000-8000-000000000002' end,true);
set local role authenticated;
do $$ declare action text; begin
  if exists(select 1 from public.record_drafts) then raise exception 'Non-admin draft read allowed'; end if;
  foreach action in array array['save','publish','archive','delete'] loop
    begin
      perform public.write_record_editor('skills',gen_random_uuid(),'{}',0,action);
      raise exception 'Non-admin write allowed';
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.portfolio_admin_id'),true);
set local role authenticated;
do $$
declare
  table_kind text; content jsonb; test_id uuid; result public.record_drafts; published jsonb; saved jsonb; affected integer;
begin
  for table_kind,content in select * from (values
    ('experience','{"role":"Integration test only","company":"Test only","start_date":"2020-02-29","end_date":null,"highlights":["Test only"],"sort_order":2}'::jsonb),
    ('skills','{"name":"Integration test only","category":"Test only","sort_order":2}'::jsonb),
    ('education','{"institution":"Integration test only","qualification":"Test only","start_date":null,"end_date":null,"description":"","sort_order":2}'::jsonb),
    ('certifications','{"name":"Integration test only","issuer":"Test only","issued_on":null,"expires_on":null,"credential_url":"https://example.test/credential","sort_order":2}'::jsonb)
  ) as samples(kind,payload) loop
    test_id := gen_random_uuid();
    select * into result from public.write_record_editor(table_kind,test_id,content,0,'save');
    if result.revision<>1 or result.published_revision is not null then raise exception 'Draft metadata incorrect'; end if;
    execute format('select to_jsonb(t) from public.%I t where id=$1',table_kind) into published using test_id;
    if published is not null then raise exception 'Draft was published'; end if;
    select * into result from public.write_record_editor(table_kind,test_id,content,1,'publish');
    execute format('select to_jsonb(t) from public.%I t where id=$1',table_kind) into published using test_id;
    if published-'id'-'archived' is distinct from content or result.published_revision<>2 then raise exception 'Publish failed'; end if;
    select * into result from public.write_record_editor(table_kind,test_id,content || '{"sort_order":0}',2,'save');
    execute format('select to_jsonb(t) from public.%I t where id=$1',table_kind) into saved using test_id;
    if saved is distinct from published then raise exception 'Draft changed published row'; end if;
    begin
      perform public.write_record_editor(table_kind,test_id,content,2,'delete');
      raise exception 'Stale deletion allowed';
    exception when serialization_failure then null; end;
    begin
      perform public.write_record_editor(table_kind,test_id,content || '{"sort_order":-1}',3,'publish');
      raise exception 'Invalid order allowed';
    exception when invalid_parameter_value then null; end;
    if (select revision from public.record_drafts where kind=table_kind and id=test_id)<>3 then raise exception 'Rejected write changed draft'; end if;
    select * into result from public.write_record_editor(table_kind,test_id,'{}',3,'archive');
    execute format('select to_jsonb(t) from public.%I t where id=$1',table_kind) into saved using test_id;
    if not result.archived or saved->>'archived'<>'true' or saved-'archived' is distinct from published-'archived' then raise exception 'Archive lost content'; end if;
    select * into result from public.write_record_editor(table_kind,test_id,content || '{"sort_order":0}',4,'publish');
    execute format('select to_jsonb(t) from public.%I t where id=$1',table_kind) into saved using test_id;
    if result.archived or result.published_revision<>5 or saved->>'archived'<>'false' or saved->>'sort_order'<>'0' then raise exception 'Restore/order publish failed'; end if;
    select * into result from public.write_record_editor(table_kind,test_id,'{}',5,'delete');
    execute format('select count(*) from public.%I where id=$1',table_kind) into affected using test_id;
    if affected<>0 or exists(select 1 from public.record_drafts where kind=table_kind and id=test_id) then raise exception 'Delete failed'; end if;
  end loop;
  begin
    perform public.write_record_editor('links',gen_random_uuid(),'{}',0,'publish');
    raise exception 'Non-allowlisted table allowed';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
rollback;
