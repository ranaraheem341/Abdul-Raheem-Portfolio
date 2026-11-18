begin;
alter table public.projects add column archived boolean not null default false;
alter table public.record_drafts drop constraint record_drafts_kind_check;
alter table public.record_drafts add constraint record_drafts_kind_check check (kind in ('experience','skills','education','certifications','projects'));
insert into public.record_drafts(kind,id,payload,revision,published_revision)
select 'projects',id,to_jsonb(p)-'id'-'archived',1,1 from public.projects p;

-- Existing metadata remains untouched and admin-only. New uploads have explicit roles.
alter table public.media add column purpose text not null default 'legacy' check (purpose in ('legacy','photo','cv','screenshot'));
alter table public.media add column draft_project_id uuid;
alter table public.media add column project_kind text not null default 'projects' check (project_kind='projects');
alter table public.media add column deleting boolean not null default false;
alter table public.media add column published boolean not null default false;
alter table public.media add column revision integer not null default 1 check (revision>0);
alter table public.media add foreign key (project_kind,draft_project_id) references public.record_drafts(kind,id);
alter table public.media add check ((purpose='screenshot' and draft_project_id is not null) or (purpose<>'screenshot' and draft_project_id is null));
create unique index media_single_published on public.media(purpose) where published and purpose in ('photo','cv');
-- No bucket/public-read policy changes: foundation migration's private RLS remains in force.
create or replace function public.write_record_editor(record_kind text, record_id uuid, content jsonb, expected_revision integer, operation text)
returns setof public.record_drafts
language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.record_drafts;
  field_name text; field_type text; field_limit integer; field_required boolean; field_value text;
  fields jsonb; columns_sql text; updates_sql text; start_value text; end_value text;
begin
  if not coalesce(public.is_portfolio_admin(),false) then raise exception 'Not authorized' using errcode='42501'; end if;
  if record_kind is null or record_kind not in ('experience','skills','education','certifications','projects')
     or record_id is null or expected_revision is null or expected_revision not between 0 and 999999999
     or operation is null or operation not in ('save','publish','archive','delete') then
    raise exception 'Invalid input' using errcode='22023';
  end if;
  -- Serialize even first writes and deletes for the same kind/ID across sessions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(record_kind || record_id::text,0));
  select * into current_row from public.record_drafts d where d.kind=record_kind and d.id=record_id for update;
  if coalesce(current_row.revision,0) <> expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  if operation in ('archive','delete') and current_row.id is null then raise exception 'Missing record' using errcode='22023'; end if;

  if operation in ('save','publish') then
    fields := case record_kind
      when 'projects' then '{"title":["text",200,true],"description":["text",5000,true],"technologies":["array",60,false],"project_url":["url",2048,false],"source_url":["url",2048,false]}'::jsonb
      when 'experience' then '{"role":["text",160,true],"company":["text",160,true],"start_date":["date",10,true],"end_date":["date",10,false],"highlights":["array",500,false]}'::jsonb
      when 'skills' then '{"name":["text",120,true],"category":["text",120,true]}'::jsonb
      when 'education' then '{"institution":["text",200,true],"qualification":["text",200,true],"start_date":["date",10,false],"end_date":["date",10,false],"description":["text",3000,false]}'::jsonb
      when 'certifications' then '{"name":["text",200,true],"issuer":["text",200,true],"issued_on":["date",10,false],"expires_on":["date",10,false],"credential_url":["url",2048,false]}'::jsonb end;
    if content is null or jsonb_typeof(content) <> 'object' then raise exception 'Invalid content' using errcode='22023'; end if;
    if (select count(*) from jsonb_object_keys(content)) <> (select count(*)+1 from jsonb_object_keys(fields)) then raise exception 'Invalid fields' using errcode='22023'; end if;
    if jsonb_typeof(content->'sort_order') is distinct from 'number' or (content->>'sort_order') !~ '^(0|[1-9][0-9]{0,5})$' then raise exception 'Invalid order' using errcode='22023'; end if;
    for field_name in select jsonb_object_keys(fields) loop
      field_type := fields->field_name->>0; field_limit := (fields->field_name->>1)::integer; field_required := (fields->field_name->>2)::boolean;
      field_value := content->>field_name;
      if not (content ? field_name) then raise exception 'Missing field' using errcode='22023'; end if;
      if field_type = 'array' then
        if jsonb_typeof(content->field_name) is distinct from 'array' then raise exception 'Invalid highlights' using errcode='22023'; end if;
        if jsonb_array_length(content->field_name)>20 or exists(select 1 from jsonb_array_elements(content->field_name) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>field_limit or btrim(v#>>'{}')='') then raise exception 'Invalid highlights' using errcode='22023'; end if;
      else
        if field_value is null then
          if field_required or field_type='text' then raise exception 'Required field' using errcode='22023'; end if;
        else
          if jsonb_typeof(content->field_name)<>'string' or length(field_value)>field_limit or (field_required and btrim(field_value)='') then raise exception 'Invalid field' using errcode='22023'; end if;
          if field_type='date' then
            if field_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or field_value<'0001-01-01' or to_char(field_value::date,'YYYY-MM-DD')<>field_value then raise exception 'Invalid date' using errcode='22023'; end if;
          end if;
          if field_type='url' and field_value !~ '^https://[A-Za-z0-9.-]+(/[^[:space:]\\]*)?$' then raise exception 'Invalid URL' using errcode='22023'; end if;
        end if;
      end if;
      if field_value is not null and field_value ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid control character' using errcode='22023'; end if;
    end loop;
    start_value := coalesce(content->>'start_date',content->>'issued_on'); end_value := coalesce(content->>'end_date',content->>'expires_on');
    if start_value is not null and end_value is not null and end_value<start_value then raise exception 'Invalid date range' using errcode='22023'; end if;
    insert into public.record_drafts as d(kind,id,payload,revision,published_revision,archived)
    values(record_kind,record_id,content,expected_revision+1,case when operation='publish' then expected_revision+1 end,false)
    on conflict(kind,id) do update set payload=excluded.payload,revision=excluded.revision,
      published_revision=case when operation='publish' then excluded.revision else d.published_revision end,
      archived=case when operation='publish' then false else d.archived end;
    if operation='publish' then
      -- Table and column names come exclusively from the fixed allowlist above.
      select string_agg(format('%I',key),','),string_agg(format('%I=excluded.%I',key,key),',') into columns_sql,updates_sql from jsonb_object_keys(fields || '{"sort_order":[]}'::jsonb) key;
      execute format('insert into public.%1$I(id,archived,%2$s) select $1,false,%2$s from jsonb_populate_record(null::public.%1$I,$2) on conflict(id) do update set archived=false,%3$s',record_kind,columns_sql,updates_sql) using record_id,content;
    end if;
  elsif operation='archive' then
    if record_kind='projects' then update public.media set published=false,revision=revision+1 where draft_project_id=record_id; end if;
    execute format('update public.%I set archived=true where id=$1',record_kind) using record_id;
    update public.record_drafts d set archived=true,revision=expected_revision+1 where d.kind=record_kind and d.id=record_id;
  else
    if record_kind='projects' and exists(select 1 from public.media where draft_project_id=record_id) then raise exception 'Remove project screenshots first' using errcode='23503'; end if;
    execute format('delete from public.%I where id=$1',record_kind) using record_id;
    delete from public.record_drafts d where d.kind=record_kind and d.id=record_id;
    current_row.revision := expected_revision+1;
    return next current_row;
    return;
  end if;
  return query select * from public.record_drafts d where d.kind=record_kind and d.id=record_id;
end $$;

create function public.write_media_editor(media_id uuid, expected_revision integer, operation text, metadata jsonb)
returns setof public.media language plpgsql security invoker set search_path='' as $$
declare item public.media; project_uuid uuid; role_name text; mime text; object_name text;
begin
  if not coalesce(public.is_portfolio_admin(),false) then raise exception 'Not authorized' using errcode='42501'; end if;
  if media_id is null or expected_revision is null or expected_revision not between 0 and 999999999 or operation is null or operation not in ('register','publish','unpublish','begin_delete','delete') then raise exception 'Invalid request' using errcode='22023'; end if;
  if operation='register' then project_uuid := (metadata->>'draft_project_id')::uuid;
  else select draft_project_id into project_uuid from public.media where id=media_id; end if;
  -- Same lock order as project lifecycle writes, then serialize file publication/replacement.
  if project_uuid is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('projects'||project_uuid::text,0)); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portfolio-media',0));
  select * into item from public.media where id=media_id for update;
  if coalesce(item.revision,0)<>expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  if operation='register' then
    role_name := metadata->>'purpose'; mime := metadata->>'mime_type'; object_name := metadata->>'object_path';
    if item.id is not null or role_name is null or role_name not in ('photo','cv','screenshot') or mime is null or mime not in ('image/png','image/jpeg','image/webp','application/pdf')
      or (role_name='cv')<>(mime='application/pdf') or (role_name='screenshot')<>(project_uuid is not null)
      or object_name is distinct from (
  role_name || '/' || media_id::text ||
  (jsonb_build_object(
    'image/png', '.png',
    'image/jpeg', '.jpg',
    'image/webp', '.webp',
    'application/pdf', '.pdf'
  ) ->> mime)
)
      or jsonb_typeof(metadata->'size_bytes') is distinct from 'number' or (metadata->>'size_bytes')!~'^[1-9][0-9]{0,6}$' or (metadata->>'size_bytes')::bigint>5242880
      or jsonb_typeof(metadata->'alt_text') is distinct from 'string' or length(metadata->>'alt_text')>300 or (role_name<>'cv' and btrim(metadata->>'alt_text')='')
      or (metadata->>'alt_text') ~ '[\x01-\x1F\x7F]' then raise exception 'Invalid metadata' using errcode='22023'; end if;
    if not exists(select 1 from storage.objects where bucket_id='portfolio-media' and name=object_name) then raise exception 'Missing object' using errcode='22023'; end if;
    insert into public.media(id,object_path,purpose,draft_project_id,mime_type,size_bytes,alt_text)
      values(media_id,object_name,role_name,project_uuid,mime,(metadata->>'size_bytes')::bigint,metadata->>'alt_text');
  else
    if item.id is null or item.purpose='legacy' then raise exception 'Missing managed file' using errcode='22023'; end if;
    if operation='publish' then
      if item.deleting then raise exception 'File removal pending' using errcode='22023'; end if;
      if item.purpose='screenshot' and not exists(select 1 from public.record_drafts where kind='projects' and id=item.draft_project_id and published_revision is not null and not archived) then raise exception 'Publish project first' using errcode='22023'; end if;
      if item.purpose in ('photo','cv') then update public.media set published=false,revision=revision+1 where purpose=item.purpose and published and id<>media_id; end if;
      update public.media set published=true,revision=revision+1 where id=media_id;
    elsif operation='unpublish' then
      update public.media set published=false,revision=revision+1 where id=media_id;
    elsif operation='begin_delete' then
      update public.media set deleting=true,published=false,revision=revision+1 where id=media_id;
    else
      if not item.deleting then raise exception 'Begin removal first' using errcode='22023'; end if;
      delete from public.media where id=media_id;
      item.revision := expected_revision+1; return next item; return;
    end if;
  end if;
  return query select * from public.media where id=media_id;
end $$;
revoke all on function public.write_media_editor(uuid,integer,text,jsonb) from public, anon;
grant execute on function public.write_media_editor(uuid,integer,text,jsonb) to authenticated;
commit;
