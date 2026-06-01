-- =============================================================================
-- Inventory — Phase 4 proofs (SQL editor / privileged owner path)
-- Run AFTER inventory/sql/phase1.sql AND inventory/sql/phase4.sql, in the
-- Supabase SQL editor. Runs in ONE transaction that ROLLS BACK -> no artifacts.
--
-- Proves (privileged/owner path):
--   #1  The server bumps items.version on every UPDATE (1 -> 2 -> 3 ...),
--       and bumping version writes NO change_log row (audit trigger ignores it).
--   #2  Broken-vs-fixed optimistic lock:
--         FIXED  : UPDATE ... WHERE id=? AND version=<stale>  affects 0 rows  (rejected)
--         BROKEN : UPDATE ... WHERE id=?                       affects 1 row   (the silent
--                  overwrite the version guard exists to prevent)
--   #3  A normal field edit still writes the Phase-1 field-level audit row
--       (who/what/old->new) — confirming Phase 4 did not break the audit trail.
--   #4  No permissive items policy snuck in (qual/with_check are never `true`).
--
-- HOW TO READ: one results table; rows starting "PASSED" are satisfied assertions.
-- Any "FAILED" -> STOP, do not mark the gate passed.
-- =============================================================================

begin;

create temporary table _p4_results (seq int, step text, result text) on commit drop;

do $$
declare
  v_item    bigint;
  v_v0      int;
  v_v1      int;
  v_v2      int;
  n         int;
  v_logs_v  int;     -- change_log rows that mention "version" (must stay 0)
  v_audit   record;
begin
  -- SETUP: throwaway item. INSERT fires the audit trigger -> one INSERT log row.
  insert into public.items (name, status, notes)
  values ('__phase4_proof_item__', 'In Storage', 'orig')
  returning id, version into v_item, v_v0;
  insert into _p4_results values
    (0, 'setup', format('throwaway item id=%s created with version=%s', v_item, v_v0));

  -- ---- PROOF #1: server bumps version on UPDATE; no version row in change_log ----
  update public.items set notes = 'edit-1' where id = v_item;
  select version into v_v1 from public.items where id = v_item;
  update public.items set notes = 'edit-2' where id = v_item;
  select version into v_v2 from public.items where id = v_item;
  if v_v1 = v_v0 + 1 and v_v2 = v_v1 + 1 then
    insert into _p4_results values (1, '#1 server bumps version',
      format('PASSED: version %s -> %s -> %s on two UPDATEs (server-authoritative)', v_v0, v_v1, v_v2));
  else
    insert into _p4_results values (1, '#1 server bumps version',
      format('FAILED: expected %s -> %s -> %s, got %s -> %s -> %s',
             v_v0, v_v0+1, v_v0+2, v_v0, v_v1, v_v2));
  end if;

  select count(*) into v_logs_v
  from public.change_log where item_id = v_item and field = 'version';
  if v_logs_v = 0 then
    insert into _p4_results values (1, '#1b version NOT audited',
      'PASSED: change_log has 0 rows for field=version (audit trigger ignores it -> no noise)');
  else
    insert into _p4_results values (1, '#1b version NOT audited',
      format('FAILED: change_log unexpectedly logged version %s time(s)', v_logs_v));
  end if;

  -- ---- PROOF #2: broken-vs-fixed stale-version save ----------------------------
  -- The row is now at version v_v2. A client that loaded it at the STALE version
  -- v_v1 tries to save.
  --   FIXED  (guarded): WHERE id=? AND version=v_v1  -> 0 rows (rejected; no overwrite)
  update public.items set notes = 'stale-guarded'
   where id = v_item and version = v_v1;
  get diagnostics n = row_count;
  if n = 0 then
    insert into _p4_results values (2, '#2 FIXED (guarded, stale)',
      format('PASSED: WHERE version=%s (stale) affected 0 rows -> stale save REJECTED', v_v1));
  else
    insert into _p4_results values (2, '#2 FIXED (guarded, stale)',
      format('FAILED: stale guarded UPDATE affected %s row(s) -> would overwrite!', n));
  end if;

  --   BROKEN (no version guard): WHERE id=? -> 1 row (the silent overwrite prevented above)
  update public.items set notes = 'stale-unguarded'
   where id = v_item;
  get diagnostics n = row_count;
  if n = 1 then
    insert into _p4_results values (3, '#2 BROKEN (no version guard)',
      'PASSED: WHERE id=? (no version) affected 1 row -> THIS is the silent overwrite the guard prevents');
  else
    insert into _p4_results values (3, '#2 BROKEN (no version guard)',
      format('UNEXPECTED: unguarded UPDATE affected %s row(s)', n));
  end if;

  -- ---- PROOF #3: a normal field edit still writes a field-level audit row ------
  -- (notes was just changed by the unguarded UPDATE above; grab the latest UPDATE
  --  row for this item and confirm who/what/old->new are captured.)
  select actor, action, field, old_value, new_value
    into v_audit
  from public.change_log
  where item_id = v_item and action = 'UPDATE' and field = 'notes'
  order by id desc limit 1;
  if v_audit.field = 'notes' and v_audit.new_value = 'stale-unguarded' then
    insert into _p4_results values (4, '#3 audit trail intact',
      format('PASSED: change_log captured UPDATE field=%s old=%L new=%L (who/what/old->new still logged)',
             v_audit.field, v_audit.old_value, v_audit.new_value));
  else
    insert into _p4_results values (4, '#3 audit trail intact',
      format('FAILED: latest notes audit row looked wrong: field=%s new=%L', v_audit.field, v_audit.new_value));
  end if;
end
$$;

-- ---- PROOF #4: no permissive items policy (qual/with_check are role-gated, never true)
insert into _p4_results
select 5,
       '#4 no permissive items policy',
       case when count(*) = 0
            then 'PASSED: 0 items policies with USING(true)/WITH CHECK(true)'
            else format('FAILED: %s permissive items policy(ies) found: %s',
                        count(*), string_agg(policyname, ', '))
       end
from pg_policies
where schemaname = 'public' and tablename = 'items'
  and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');

select seq, step, result from _p4_results order by seq;

rollback;  -- discards the throwaway item + its change_log rows + every tamper

-- Expected result rows (all PASSED):
--   0  setup                          throwaway item id=... created with version=1
--   1  #1 server bumps version        PASSED: version 1 -> 2 -> 3 on two UPDATEs ...
--   1  #1b version NOT audited        PASSED: change_log has 0 rows for field=version ...
--   2  #2 FIXED (guarded, stale)      PASSED: WHERE version=2 (stale) affected 0 rows -> REJECTED
--   3  #2 BROKEN (no version guard)   PASSED: WHERE id=? affected 1 row -> the silent overwrite ...
--   4  #3 audit trail intact          PASSED: change_log captured UPDATE field=notes old=... new=...
--   5  #4 no permissive items policy  PASSED: 0 items policies with USING(true)/WITH CHECK(true)
-- =============================================================================
