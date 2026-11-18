begin;

-- Empty or omitted alternative text represents a decorative image.
-- Keep the invoker RPC, metadata limits and media lifecycle security intact.
-- The existing NOT NULL DEFAULT '' column already permits empty strings.
create or replace function public.write_media_editor(media_id uuid, expected_revision integer, operation text, metadata jsonb)
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
      or jsonb_typeof(coalesce(metadata->'alt_text','""'::jsonb)) is distinct from 'string' or length(metadata->>'alt_text')>300
      or (metadata->>'alt_text') ~ '[\x01-\x1F\x7F]' then raise exception 'Invalid metadata' using errcode='22023'; end if;
    if not exists(select 1 from storage.objects where bucket_id='portfolio-media' and name=object_name) then raise exception 'Missing object' using errcode='22023'; end if;
    insert into public.media(id,object_path,purpose,draft_project_id,mime_type,size_bytes,alt_text)
      values(media_id,object_name,role_name,project_uuid,mime,(metadata->>'size_bytes')::bigint,coalesce(metadata->>'alt_text',''));
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
