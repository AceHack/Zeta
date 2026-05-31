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

## Test users (create AFTER step 1)

Once `phase1.sql` has run, the `handle_new_user` trigger will auto-create a
`profiles` row (default `viewer`) for any new user. Create in the dashboard:

- a **Viewer** test user (leave role = `viewer`),
- an **Editor** test user, then elevate it:
  `update public.profiles set role='editor' where user_id =
   (select id from auth.users where lower(email)=lower('EDITOR_EMAIL'));`
