-- =============================================================================
-- Inventory — "Start fresh" pre-launch reset (OWNER-RUN, in the Supabase SQL editor)
-- =============================================================================
-- PURPOSE: wipe build/test inventory data to a clean slate before go-live. After
-- this runs (and you re-seed / start entering items), the change_log naturally
-- contains ONLY fresh INSERT rows — the "insert-only history" end state — WITHOUT
-- ever deleting rows from the immutable audit trail.
--
-- WHY THIS KEEPS THE IMMUTABILITY GUARANTEE INTACT:
--   change_log is protected by (1) no UPDATE/DELETE RLS policy and (2) a
--   BEFORE UPDATE/DELETE trigger (change_log_immutable) that RAISEs. TRUNCATE is
--   NEITHER an UPDATE nor a DELETE of existing rows and does NOT fire row-level
--   triggers — so we re-initialize the whole table instead of tampering with it.
--   The trigger is NOT disabled here. Immutability (and the Phase 7 audit) holds.
--
-- ⚠ IRREVERSIBLE. EXPORT FIRST:
--   In the app, signed in, use Export CSV AND Export JSON (Phase 6) to back up the
--   current inventory before running this. There is no undo.
--
-- WHAT THIS TOUCHES / DOES NOT TOUCH:
--   TRUNCATES: public.items, public.change_log  (RESTART IDENTITY → ids reset).
--   OPTIONAL : public.field_definitions          (custom-field config; see block B).
--   NEVER:     public.profiles, auth.users       (user accounts + ROLE mapping —
--              truncating profiles would strip every user's role and lock admins
--              out, since handle_new_user only provisions NEW auth users).
--
-- Supersedes sql/phase7-proof-residue-cleanup.sql (a full wipe removes that residue
-- too — you do not need to run both).
-- =============================================================================

begin;

-- ---- A. Core data reset (items + their audit trail), atomic re FK ------------
-- Listed together so the change_log.item_id -> items.id FK is satisfied without
-- CASCADE. RESTART IDENTITY resets the items id sequence so a fresh start (or a
-- re-seed with explicit ids 1..211) begins clean.
truncate table public.change_log, public.items restart identity;

-- ---- B. OPTIONAL: also clear typed custom-field DEFINITIONS ------------------
-- Leave COMMENTED to keep your admin-defined field schema. UNCOMMENT to wipe the
-- custom-field config as well (truly empty slate). No FK references it, so it
-- truncates independently.
-- truncate table public.field_definitions;

-- ---- C. Verify clean slate (expect 0 / 0) -----------------------------------
select
  (select count(*) from public.items)      as items_remaining,
  (select count(*) from public.change_log) as change_log_remaining;

-- Review the counts above. If correct (0 / 0), COMMIT; otherwise ROLLBACK.
commit;
-- rollback;  -- <- use this instead of commit if the counts look wrong

-- =============================================================================
-- AFTER THIS:
--   * Re-seed the real inventory (re-run inventory/seed/seed-import.ts with the
--     seed file + a fresh editor credential), OR start entering items live via the
--     UI. Either way change_log begins with only INSERT rows.
--   * Sanity re-check (anon, no creds): the unauthenticated REST reads on items /
--     change_log / profiles / field_definitions must STILL return [] (RLS intact).
--   * Optional: re-run the audit's change_log immutability proof to confirm the
--     guarantee survived the reset.
-- =============================================================================
