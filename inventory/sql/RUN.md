# Inventory SQL — run order & responsibilities

All SQL here is **source-of-truth** authored in the repo. DDL is **run by the
owner** in the Supabase SQL editor (Claude has no privileged DB access;
`service_role` is forbidden). Claude verifies *behavior* afterward with the
public anon key.

## Phase 1

1. **`phase1.sql`** — owner pastes the whole file into the Supabase **SQL editor**
   and runs it once. Idempotent (safe to re-run). Creates tables, RLS, the
   `current_user_role()` function, and the audit + immutability triggers.
   - After it runs, confirm: `select user_id, role from public.profiles;`
     should show the admin (`addisonstainback@gmail.com`) with role `admin`.

2. **`proofs/phase1_proofs.sql`** — owner runs in the SQL editor. Returns a
   results table; every row should read `PASSED…` (proves change_log immutability
   + the broken-vs-fixed demonstration). Runs in a transaction that rolls back —
   leaves no artifacts.

3. **`proofs/anon_checks.md`** — proof #3 (anon returns `[]`) and proof #1 client
   path (logged-in user refused by RLS). Claude runs proof #3 to show observed
   output; the owner/auditor re-runs as the authority (per spec's
   "EXTERNAL CHECK (owner/auditor-run)").

Phase 1 gate is **passed** only when all three proofs show the expected observed
output. Until then PROGRESS.md keeps Phase 1 as `[ ]`.

## Phase 4 (Write path — optimistic locking)

Run AFTER `phase1.sql` (Phases 2–3 add no SQL). Additive + idempotent; loosens
nothing (no new RLS policy, no GRANT/REVOKE).

1. **`phase4.sql`** — owner pastes into the Supabase **SQL editor** and runs once.
   Adds the `items_bump_version` BEFORE UPDATE trigger so the **server** owns
   `items.version` (`new.version = old.version + 1`). The client never sends
   `version`; a stale save (`WHERE id=? AND version=<old>`) then matches 0 rows
   instead of silently overwriting.

2. **`proofs/phase4_proofs.sql`** — owner runs in the SQL editor. Returns a results
   table; every row should read `PASSED…` (version bump + stale-version
   broken-vs-fixed + audit-trail-intact + no-permissive-policy). Runs in a
   `BEGIN…ROLLBACK`, so it leaves no artifacts.

3. **Client-path proofs** — `inventory/proofs/phase4-write-proofs.ts` (Claude runs
   as the editor test user, publishable/anon key, NO service_role) proves the
   write path end-to-end: field-level audit (old→new, UTC stored), stale-version
   rejection over REST, archive→un-archive recoverable + history intact, and
   re-runs the anon default-deny check on all four sensitive tables.

Phase 4 gate is **passed** only when all four proofs show observed output and the
anon checks still return `[]`. Until then PROGRESS.md keeps Phase 4 as `[ ]`.

## Phase 5 (Typed dynamic custom fields)

Run AFTER `phase1.sql` + `phase4.sql`. Additive + idempotent; loosens nothing (no new RLS policy,
no GRANT/REVOKE).

1. **`phase5.sql`** — owner pastes into the Supabase **SQL editor** and runs once. Adds a GIN index
   on `items.custom_fields` and the `validate_custom_fields()` BEFORE INSERT/UPDATE trigger (DB-side
   per-type validation against `field_definitions`; rejects malformed values + unknown keys even from
   a direct PostgREST write with the anon key). A trigger (not a CHECK constraint) because a CHECK
   cannot subquery `field_definitions`.

2. **`proofs/phase5_proofs.sql`** — owner runs in the SQL editor. Returns a results table; every row
   should read `PASSED…` (per-type accept/reject + unknown-key reject + numeric-cast sort
   broken-vs-fixed `[10,100,9]` lexicographic vs `[9,10,100]` typed + no-permissive-policy). Runs in
   a `BEGIN…ROLLBACK`, so it leaves no artifacts.

3. **Client-path proofs** — `inventory/proofs/phase5-custom-fields-proofs.ts` (Claude runs with the
   ADMIN test user for field-def create/deactivate AND the EDITOR test user for value writes;
   publishable/anon key, NO service_role). Proves: add one field of each of the 5 types; defs visible
   to viewer/editor + every item has a custom_fields slot; per-type validation DB-rejected via direct
   REST as the editor (the zero-trust bypass case); `<script>`/onerror stored verbatim as data;
   deactivate-preserves-values+history; anon default-deny on all four sensitive tables. Needs ENV:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAIL/ADMIN_PASSWORD`, `EDITOR_EMAIL/EDITOR_PASSWORD`.

4. **Browser proofs** (numeric sort + XSS-inert render of values AND field names) were run this
   session in real Chrome via Playwright (see PROGRESS.md "Phase 5 evidence"); the Phase-7 Auditor
   re-verifies on the live merged site.

Phase 5 gate is **passed** only when proofs 1–3 show observed output (and the anon checks still return
`[]`). Until then PROGRESS.md keeps Phase 5 as `[~]`.

## Test users (create AFTER step 1)

Once `phase1.sql` has run, the `handle_new_user` trigger will auto-create a
`profiles` row (default `viewer`) for any new user. Create in the dashboard:

- a **Viewer** test user (leave role = `viewer`),
- an **Editor** test user, then elevate it:
  `update public.profiles set role='editor' where user_id =
   (select id from auth.users where lower(email)=lower('EDITOR_EMAIL'));`
