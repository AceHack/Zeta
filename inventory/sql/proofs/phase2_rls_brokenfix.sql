-- =============================================================================
-- Inventory — Phase 2 proof (a), broken-vs-fixed (SQL editor / owner)
-- Run AFTER phase1.sql, in the Supabase SQL editor. Runs in ONE transaction and
-- ROLLS BACK -> no artifacts, least-privilege restored.
--
-- Demonstrates that the least-privilege items UPDATE policy (editor/admin only)
-- is what refuses a Viewer's edit at the DATABASE — not hidden UI:
--   FIXED  (real policy)         : Viewer UPDATE affects 0 rows  (refused)
--   BROKEN (add USING(true))     : Viewer UPDATE affects 1 row   (the breach)
--   ROLLBACK                     : permissive policy dropped, least-privilege back
--
-- OUTPUT: a 2-row RESULTS TABLE (read the grid, not Messages). Expected:
--   1  FIXED  (least-privilege items_update)  viewer UPDATE affected 0 row(s)  -> expect 0 = refused
--   2  BROKEN (added USING(true) policy)      viewer UPDATE affected 1 row(s)  -> 1 = breach prevented
--
-- Uses the throwaway Viewer test user (test2@test.com). If you used a different
-- email, edit the lookup below.
--
-- NOTE: relies on `set local role authenticated` + request.jwt.claims (the
-- standard Supabase RLS-as-a-role testing pattern). Row counts are stashed in a
-- transaction-local GUC so they survive the role switch and land in the grid.
-- =============================================================================

begin;

create temporary table _p2_results (seq int, step text, result text) on commit drop;

-- Simulate the Viewer's session: auth.uid() -> the viewer; role -> authenticated
-- (so RLS is enforced; the owner would otherwise bypass it).
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',  (select id::text from auth.users where lower(email) = lower('test2@test.com')),
    'role', 'authenticated'
  )::text,
  true   -- is_local: reset at transaction end
);

-- ---- FIXED: least-privilege policy in force -> Viewer UPDATE must affect 0 rows
set local role authenticated;
do $$
declare n int;
begin
  update public.items set notes = 'p2 brokenfix (fixed)'
   where id = (select min(id) from public.items);
  get diagnostics n = row_count;
  perform set_config('p2proof.fixed', n::text, true);  -- stash across the role switch
end $$;
reset role;
insert into _p2_results values
  (1, 'FIXED  (least-privilege items_update)',
      'viewer UPDATE affected ' || current_setting('p2proof.fixed') || ' row(s)  -> expect 0 = refused');

-- ---- BROKEN: add a permissive policy (the classic breach) -> Viewer UPDATE succeeds
create policy _tmp_permissive_update on public.items
  for update to authenticated using (true) with check (true);

set local role authenticated;
do $$
declare n int;
begin
  update public.items set notes = 'p2 brokenfix (broken)'
   where id = (select min(id) from public.items);
  get diagnostics n = row_count;
  perform set_config('p2proof.broken', n::text, true);
end $$;
reset role;
insert into _p2_results values
  (2, 'BROKEN (added USING(true) policy)',
      'viewer UPDATE affected ' || current_setting('p2proof.broken') || ' row(s)  -> 1 = the breach least-privilege prevents');

-- THE EVIDENCE (read this grid):
select seq, step, result from _p2_results order by seq;

rollback;  -- drops _tmp_permissive_update + reverts the notes; least-privilege restored

-- Sanity after running this script (run separately; expect ZERO rows -> the
-- permissive policy did NOT persist):
--   select policyname from pg_policies
--   where schemaname='public' and tablename='items' and policyname='_tmp_permissive_update';
