-- =============================================================================
-- Inventory — Phase 7 proof-residue cleanup (SQL editor / privileged owner path)
-- Run ONCE in the Supabase SQL editor. OWNER-RUN (not a client/REST op) for the
-- same reasons as phase3_cleanup.sql: items has NO DELETE policy (archive-only)
-- and change_log is immutable (a BEFORE UPDATE/DELETE trigger RAISEs for everyone),
-- so the only correct mechanism is this script that briefly disables the
-- immutability trigger, removes the residue, and re-enables it. service_role is
-- NOT used or required — the SQL editor runs as the table owner/postgres.
--
-- WHAT THIS REMOVES (the EXPECTED Phase-5 live-proof residue, per the Residual
-- Risk Register in inventory/PROGRESS.md):
--   * throwaway items 216, 225, 226, 227, 228 (all left ARCHIVED by the proof)
--     plus their immutable change_log rows;
--   * the INACTIVE proof field-definitions whose key matches 'p5_mpyh93ei_%' or
--     'p5_mpyhaucf_%' (deactivated during the deactivate-preserves proof).
--
-- AUDIT OF THE DELETION IS PRESERVED (same precedent as phase3_cleanup.sql,
-- owner-approved Decision 1):
--   1. This committed script + the PROGRESS.md entry are the durable git record.
--   2. Before re-enabling immutability we INSERT one documentary change_log row
--      (item_id=NULL, action='ADMIN_CLEANUP'). Append-only INSERT does NOT violate
--      immutability (only UPDATE/DELETE are blocked).
--
-- SAFETY: runs in ONE transaction. GUARDS abort (RAISE) the whole transaction
--   before any delete if the DB does not look like the expected state — e.g. a
--   target item is missing, or is NOT archived, or any target id is <= 211 (a real
--   seed item). Re-running after success is a safe no-op-with-abort (guard sees the
--   targets already gone). NOTHING is deleted unless every guard passes.
--
-- BEFORE YOU RUN (spec.md): EXPORT/BACK UP first (Phase-6 CSV/JSON export) so the
--   pre-cleanup state is captured, per the "EXPORT before any bulk data op" rule.
-- =============================================================================

begin;

do $$
declare
  v_target_ids  int[] := array[216, 225, 226, 227, 228];  -- the throwaway proof items
  v_id          int;
  v_found       int;
  v_archived    boolean;
  v_log_rows    bigint;
  v_def_rows    bigint;
begin
  -- ---- GUARD 0: no target id may be a real seed item (1..211).
  foreach v_id in array v_target_ids loop
    if v_id <= 211 then
      raise exception 'ABORT: target id % is <= 211 (a real seed item). Refusing.', v_id;
    end if;
  end loop;

  -- ---- GUARD 1: every target item must EXIST and be ARCHIVED (is_archived = true).
  foreach v_id in array v_target_ids loop
    select count(*), bool_or(is_archived) into v_found, v_archived
      from public.items where id = v_id;
    if v_found = 0 then
      raise exception
        'ABORT: target item id % not found. If cleanup already ran this is expected — '
        'but re-running is then unnecessary; inspect public.items manually before forcing.', v_id;
    end if;
    if v_archived is distinct from true then
      raise exception
        'ABORT: target item id % is NOT archived (is_archived <> true). The proof left these '
        'archived; an un-archived row here is unexpected real data. Refusing to delete.', v_id;
    end if;
  end loop;

  -- ---- GUARD 2: the field-definitions we will delete must be INACTIVE only.
  select count(*) into v_def_rows
    from public.field_definitions
    where is_active = false
      and (key like 'p5_mpyh93ei_%' or key like 'p5_mpyhaucf_%');
  if exists (
    select 1 from public.field_definitions
    where is_active = true
      and (key like 'p5_mpyh93ei_%' or key like 'p5_mpyhaucf_%')
  ) then
    raise exception
      'ABORT: a p5_mpyh93ei_/p5_mpyhaucf_ field definition is still ACTIVE. The residue defs '
      'should be inactive; an active match is unexpected. Refusing to delete definitions.';
  end if;

  select count(*) into v_log_rows
    from public.change_log where item_id = any(v_target_ids);
  raise notice 'Pre-clean: % target items (all archived), % of their change_log rows, % inactive p5_* defs.',
    array_length(v_target_ids, 1), v_log_rows, v_def_rows;

  -- ---- DO THE CLEANUP (immutability trigger briefly disabled for the child-row delete).
  alter table public.change_log disable trigger change_log_immutable;

  delete from public.change_log where item_id = any(v_target_ids);
  delete from public.items
    where id = any(v_target_ids) and is_archived = true;  -- WHERE re-guards archived-only
  delete from public.field_definitions
    where is_active = false
      and (key like 'p5_mpyh93ei_%' or key like 'p5_mpyhaucf_%');

  -- ---- DOCUMENTARY AUDIT ROW: append-only INSERT, item_id NULL.
  insert into public.change_log (item_id, actor, action, field, old_value, new_value)
  values (
    null,
    auth.uid(),                               -- NULL in SQL editor (no JWT) — honest
    'ADMIN_CLEANUP',
    null,
    'deleted Phase-5 proof residue: items 216/225/226/227/228 + their change_log rows + inactive p5_mpyh93ei_/p5_mpyhaucf_ defs',
    'see inventory/sql/phase7-proof-residue-cleanup.sql (Phase 7 Part 1; Residual Risk Register OWNER-PENDING item)'
  );

  -- ---- restore the immutability guard for everyone.
  alter table public.change_log enable trigger change_log_immutable;
end
$$;

-- ---- Informational: surviving items that still carry a p5_* key in custom_fields.
-- The proof set p5_* VALUES only on the throwaway items (now deleted), so this should
-- be EMPTY. If it returns rows, those are orphaned JSONB keys on real items — review
-- before deciding whether to strip them (NOT done automatically; spec: don't hard-delete
-- definition data without intent). Strip statement, if ever needed, is commented below.
select id, name,
       (select array_agg(k) from jsonb_object_keys(custom_fields) k
         where k like 'p5_mpyh93ei_%' or k like 'p5_mpyhaucf_%') as orphan_p5_keys
from public.items
where custom_fields ?| array(
  select key from public.field_definitions
  where key like 'p5_mpyh93ei_%' or key like 'p5_mpyhaucf_%'
)
   or exists (
     select 1 from jsonb_object_keys(custom_fields) k
     where k like 'p5_mpyh93ei_%' or k like 'p5_mpyhaucf_%'
   );

-- ---- Show what remains so the owner can eyeball before COMMIT.
select 'target_items_remaining' as what, count(*)::text as value
  from public.items where id = any(array[216,225,226,227,228])
union all
select 'p5_defs_remaining', count(*)::text
  from public.field_definitions where key like 'p5_mpyh93ei_%' or key like 'p5_mpyhaucf_%'
union all
select 'admin_cleanup_rows', count(*)::text
  from public.change_log where action = 'ADMIN_CLEANUP';

commit;

-- Expected after COMMIT:
--   target_items_remaining   0
--   p5_defs_remaining        0
--   admin_cleanup_rows       >= 1   (this run added one)
--   the informational query  0 rows (no orphaned p5_* keys on surviving items)
-- =============================================================================
