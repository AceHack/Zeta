-- =============================================================================
-- Inventory — Phase 1 proofs (SQL editor / privileged owner path)
-- Run this AFTER inventory/sql/phase1.sql, in the Supabase SQL editor.
--
-- Proves (privileged/owner path):
--   #1a  UPDATE on change_log is blocked by the immutability trigger.
--   #1b  DELETE on change_log is blocked by the immutability trigger.
--   #2   Broken-vs-fixed: with the guard DISABLED the tamper SUCCEEDS (protection
--        fails), proving the trigger is the thing stopping it. The whole proof
--        runs in one transaction and ROLLS BACK -> guard restored, no artifacts.
--
-- The client-session path of proof #1 (a logged-in user is refused by RLS) and
-- proof #3 (anon returns nothing) are in inventory/sql/proofs/anon_checks.md.
--
-- HOW TO READ THE OUTPUT: this returns a single results table. Every row whose
-- result starts with "PASSED" is a satisfied assertion. A row starting "FAILED"
-- means immutability is NOT enforced -> STOP, do not mark the gate passed.
-- =============================================================================

begin;

create temporary table _proof_results (seq int, step text, result text) on commit drop;

-- SETUP: a throwaway item INSERT fires the audit trigger -> a change_log row to attack.
insert into public.items (name, status) values ('__phase1_proof_item__', 'In Storage');

do $$
declare
  v_item   bigint;
  v_log    bigint;
  v_action text;
begin
  select id into v_item from public.items where name = '__phase1_proof_item__';
  select id into v_log  from public.change_log where item_id = v_item order by id limit 1;
  insert into _proof_results values
    (0, 'setup', format('throwaway item id=%s wrote change_log row id=%s (audit trigger works)', v_item, v_log));

  -- ---- PROOF #1a: UPDATE blocked ------------------------------------------------
  begin
    update public.change_log set action = 'TAMPERED' where id = v_log;
    insert into _proof_results values (1, '#1a UPDATE change_log', 'FAILED: update SUCCEEDED (immutability NOT enforced!)');
  exception when others then
    insert into _proof_results values (1, '#1a UPDATE change_log', 'PASSED: blocked -> ' || sqlerrm);
  end;

  -- ---- PROOF #1b: DELETE blocked ------------------------------------------------
  begin
    delete from public.change_log where id = v_log;
    insert into _proof_results values (2, '#1b DELETE change_log', 'FAILED: delete SUCCEEDED (immutability NOT enforced!)');
  exception when others then
    insert into _proof_results values (2, '#1b DELETE change_log', 'PASSED: blocked -> ' || sqlerrm);
  end;

  -- ---- PROOF #2: broken-vs-fixed -----------------------------------------------
  -- "Break" the guard: disable the immutability trigger. The same tamper that was
  -- blocked above now succeeds -> proves the trigger is the protection. The outer
  -- ROLLBACK below re-enables the trigger (DDL is transactional) and undoes the
  -- tamper + the throwaway item, so nothing persists.
  alter table public.change_log disable trigger change_log_immutable;
  update public.change_log set action = 'TAMPERED-DEMO' where id = v_log;
  select action into v_action from public.change_log where id = v_log;
  insert into _proof_results values
    (3, '#2 broken (guard DISABLED)', 'tamper SUCCEEDED, action now = ' || coalesce(v_action, '<null>') || '  (=> the trigger is what stops tampering)');
end
$$;

select seq, step, result from _proof_results order by seq;

rollback;  -- restores the immutability trigger; discards throwaway item, log row, and tamper

-- After this script, immutability is back in force. Re-running it is safe (idempotent).
-- Expected result rows:
--   0  setup                      throwaway item ... wrote change_log row ... (audit trigger works)
--   1  #1a UPDATE change_log      PASSED: blocked -> change_log is immutable (no UPDATE/DELETE allowed)
--   2  #1b DELETE change_log      PASSED: blocked -> change_log is immutable (no UPDATE/DELETE allowed)
--   3  #2 broken (guard DISABLED) tamper SUCCEEDED, action now = TAMPERED-DEMO  (=> the trigger is what stops tampering)
