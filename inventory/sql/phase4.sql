-- =============================================================================
-- Inventory — Phase 4: Write path — server-authoritative optimistic locking
-- Source-of-truth migration. Run ONCE in the Supabase SQL editor (owner/postgres),
-- AFTER inventory/sql/phase1.sql and BEFORE inventory/sql/proofs/phase4_proofs.sql.
-- Idempotent: safe to re-run (create-or-replace / drop-if-exists).
--
-- Governing contract: inventory/spec.md, inventory/CLAUDE.md, inventory/PROGRESS.md.
--
-- WHAT THIS ADDS (and ONLY this):
--   A BEFORE UPDATE trigger on public.items that makes the server the sole
--   authority over items.version:  new.version = old.version + 1 on every UPDATE.
--   The client never sends version; it cannot fake or freeze it. Combined with a
--   client save of the form  UPDATE ... WHERE id = ? AND version = <expected>,
--   a stale save (someone else already bumped the row) matches 0 rows -> rejected,
--   never a silent overwrite. (spec.md Features: "optimistic locking (version check)".)
--
-- WHY A SEPARATE TRIGGER (not folded into tg_set_updated_at):
--   Single responsibility + survivability. Phase 1 owns tg_set_updated_at; keeping
--   version bumping in its own function/trigger means a future phase1.sql re-run
--   (create-or-replace) cannot silently drop the version logic, and each trigger
--   reads as one obvious thing.
--
-- INTERACTION WITH THE PHASE-1 AUDIT TRIGGER (verified, important):
--   public.log_item_change() logs 14 business columns but deliberately NOT version
--   (nor updated_at / created_at). So bumping version here writes NO spurious
--   change_log row. Archive / un-archive remain ordinary is_archived UPDATEs that
--   ARE audited (is_archived false<->true), with version bumped like any edit.
--
-- SECURITY — NOTHING IS LOOSENED:
--   * No new RLS policy. No `USING (true)`. No permissive policy. No GRANT/REVOKE.
--   * Edit / Add / Archive / Un-archive all ride the EXISTING least-privilege
--     items policies from phase1.sql:
--       - items_insert  WITH CHECK editor/admin   (Add)
--       - items_update  USING/CHECK editor/admin   (Edit, Archive, Un-archive —
--         archive is just an is_archived column UPDATE; there is intentionally NO
--         DELETE policy, so "archive instead of delete" is enforced by absence).
--   * change_log stays immutable (no UPDATE/DELETE policy + BEFORE U/D RAISE trigger).
--   * This file introduces ZERO debugging loosenings. The Phase-4 gate's RLS
--     re-check (anon curl on all four sensitive tables -> []) must still pass
--     unchanged after this runs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Version-bump trigger function: server owns items.version.
--    SECURITY INVOKER (default) is correct — it only mutates the NEW row that the
--    caller is already updating under RLS; it needs no elevated rights.
-- -----------------------------------------------------------------------------
create or replace function public.tg_bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Monotonic, server-authoritative. The client's submitted version (if any) is
  -- ignored: the new value is always old.version + 1. NULL-safe via coalesce in
  -- case a legacy row predates the NOT NULL DEFAULT 1 (defensive; should not occur).
  new.version = coalesce(old.version, 0) + 1;
  return new;
end
$$;

drop trigger if exists items_bump_version on public.items;
create trigger items_bump_version
  before update on public.items
  for each row execute function public.tg_bump_version();

-- =============================================================================
-- End Phase 4 schema. Two BEFORE UPDATE triggers now fire on items
-- (items_bump_version + items_set_updated_at); they touch disjoint columns
-- (version vs updated_at) so firing order is irrelevant. The AFTER UPDATE audit
-- trigger (items_audit) still logs only the 14 business columns.
--
-- Next: run inventory/sql/proofs/phase4_proofs.sql (owner, SQL editor) to prove
-- version increments + stale-version rejection (broken-vs-fixed), then the
-- client-path REST proofs in inventory/proofs/phase4-write-proofs.ts (editor key).
-- =============================================================================
