-- Run as the database owner AFTER migration + actual admin allowlist setup.
-- Uses JWT subject settings; creates no Auth accounts. All writes roll back.
begin;
do $$
begin
  if not exists (select 1 from private.portfolio_admin) then
    raise exception 'Configure the actual admin before running RLS integration tests';
  end if;
end $$;
select set_config('test.portfolio_admin_id', (select user_id::text from private.portfolio_admin), true);

create function pg_temp.expect_denied(statement text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then return;
  end;
  raise exception 'Expected permission denial for: %', statement;
end $$;

-- Owner inserts a rollback-only sentinel to distinguish RLS filtering from empty tables.
insert into public.skills (name, category) values ('__rls_test__', '__rls_test__');
set local role anon;
-- After migration 005, published rows are intentionally readable by anon.
do $$ begin
  if not exists(select 1 from public.skills where category='__rls_test__') then raise exception 'Published skill read denied'; end if;
end $$;
select pg_temp.expect_denied('select * from public.record_drafts');
select pg_temp.expect_denied($sql$insert into public.skills(name,category) values('bad','bad')$sql$);
select pg_temp.expect_denied('select * from private.portfolio_admin');
select pg_temp.expect_denied('select public.is_portfolio_admin()');
reset role;

-- A signed-in subject different from the actual admin; not an account creation.
select set_config('request.jwt.claim.sub', case
  when current_setting('test.portfolio_admin_id') <> '00000000-0000-4000-8000-000000000001'
  then '00000000-0000-4000-8000-000000000001'
  else '00000000-0000-4000-8000-000000000002' end, true);
set local role authenticated;
do $$
begin
  if public.is_portfolio_admin() then raise exception 'Non-admin authorized'; end if;
  if exists (select 1 from public.skills) then raise exception 'Non-admin read allowed'; end if;
  update public.skills set name = '__unauthorized__';
  if found then raise exception 'Non-admin update allowed'; end if;
  delete from public.skills;
  if found then raise exception 'Non-admin delete allowed'; end if;
end $$;
select pg_temp.expect_denied($sql$insert into public.skills (name, category) values ('bad', 'bad')$sql$);
select pg_temp.expect_denied('select * from private.portfolio_admin');
reset role;

select set_config('request.jwt.claim.sub', current_setting('test.portfolio_admin_id'), true);
set local role authenticated;
do $$
declare test_id uuid;
begin
  if not public.is_portfolio_admin() then raise exception 'Admin denied'; end if;
  if not exists (select 1 from public.skills where category = '__rls_test__') then raise exception 'Admin read denied'; end if;
  insert into public.skills (name, category) values ('__admin_insert__', '__rls_test__') returning id into test_id;
  update public.skills set name = '__admin_update__' where id = test_id;
  if not found then raise exception 'Admin update denied'; end if;
  delete from public.skills where id = test_id;
  if not found then raise exception 'Admin delete denied'; end if;
end $$;
select pg_temp.expect_denied('delete from private.portfolio_admin');
reset role;

delete from private.portfolio_admin;
set local role authenticated;
do $$
begin
  if public.is_portfolio_admin() or exists (select 1 from public.skills) then
    raise exception 'Revoked admin retained access';
  end if;
end $$;
reset role;
rollback;
