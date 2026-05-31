# Inventory Build — Progress & Plan

Status: [ ] todo · [~] doing · [x] gate passed (record HOW verified — evidence, not just a check)

## Decisions log

- Backend: Supabase, USA region, owner-owned. Connector-first; CLI fallback.
- Archive over delete. $0 target; anon read-only heartbeat to prevent pause; manual + scheduled export.
- service_role key: forbidden everywhere.
- Phase 1 schema (2026-05-31, owner-approved): change_log has NO client INSERT policy (SECURITY
  DEFINER trigger writes only); items.category is a single column; items.status is text+CHECK (not
  enum); change_log timestamp column renamed changed_at; GIN index on custom_fields deferred to
  Phase 5; immutability is two-layered (RLS no-UPDATE/DELETE + BEFORE U/D trigger that RAISEs);
  RLS ENABLE (not FORCE) so SECURITY DEFINER triggers can write.
- Pre-Phase-3 cleanup (known follow-up): proof runs left throwaway item `__client_proof_item__`
  (id=2) + its immutable change_log row. Before the Phase 3 seed (explicit ids 1..211) the owner
  removes them in the SQL editor (disable change_log_immutable trigger -> delete proof change_log
  row + item -> re-enable) to avoid an id=2 PK collision. (append decisions as we go)

## Evidence rule

A [x] must record 1–2 lines of HOW it was verified. A later session must NOT trust a [x] lacking
recorded evidence — re-verify instead. Doc changes happen only via an owner-approved PR step.

## Phases

- [ ] Phase 0a — Docs & decisions (Claude, no app code): resolve open items (Pages deploy source;
your environment's planning/effort capabilities; current Supabase free-tier limits; region=USA);
draft CLAUDE.md + spec.md + PROGRESS.md; give plain Supabase setup steps.
GATE: owner approves docs + resolved items.
- [x] Phase 0b — Supabase live (owner): create project; turn ON "Enable RLS on new tables"; provide
project URL + anon key. GATE: Claude confirms it can reach Supabase with the anon key.
service_role key NOT shared.
  EVIDENCE (2026-05-31): Project URL + publishable (anon) key delivered; admin user created in the
  dashboard; Claude reached the REST API with the anon key (anon reads return [] — see Phase 1
  evidence appendix). service_role NOT shared; publishable key is the public low-privilege key.
- [x] Phase 1 — Schema + RLS + audit trigger.
GATE: every table RLS-ON, default-deny, NO permissive/`USING(true)` policies, least-privilege;
change_log immutable; trigger writes who/what/when.
VERIFY (mix of Claude + OWNER): from a real client session attempt UPDATE/DELETE on change_log →
refused. OWNER-RUN: unauthenticated anon `curl` on items, field_definitions, change_log, profiles
→ each returns nothing. (Claude provides commands + expected output; owner runs; not self-certified.)
  EVIDENCE (2026-05-31): proof #3 anon reads all [] (+ RPC 42501); proof A (SQL editor) all PASSED
  incl. broken-vs-fixed guard toggle; proof B (client editor session via REST) UPDATE+DELETE on
  change_log -> [] / [] / row unchanged (action=INSERT). Full output in "Phase 1 evidence" appendix.
- [x] Phase 2 — Auth + roles.
GATE: trust uses getUser()/verified claims; role single-source read by BOTH UI and RLS and they
agree; sign-out ends access and clears rendered data.
VERIFY: log in as Viewer in the browser, attempt an edit → refused BY THE DB (not just UI hidden);
confirm RLS sees correct role per user; sign out → data gone, session ended.
  GATE PASSED (2026-05-31): (a)/(b)/(c)+negative-control PROVEN in a real browser (Playwright vs
  live Supabase) AND owner-run broken-vs-fixed (a) returned the expected results grid:
  FIXED (least-privilege) viewer UPDATE = 0 rows (refused); BROKEN (added USING(true)) viewer
  UPDATE = 1 row (the breach); ROLLBACK restored least-privilege (sanity: no _tmp_permissive_update
  policy persisted). Full output in the "Phase 2 evidence" appendix.
- [ ] Phase 3 — Read path.
GATE: 210 items load; search/sort/filter correct; responsive; existing Zeta dashboard still works.
VERIFY: rendered row count = seed count; run 3 sample searches/sorts; load on a phone viewport;
confirm the existing site is unaffected.
- [ ] Phase 4 — Write path.
GATE: changes logged before→after (UTC stored/local shown); no silent overwrite; archive recoverable.
VERIFY: edit an item → log row with old+new; simulate stale-version save → rejected; archive then
un-archive.
- [ ] Phase 5 — Typed dynamic fields (CENTERPIECE; use higher reasoning effort).
GATE: dedicated test suite passes; add-field applies to ALL items; per-type validation;
search/sort INCLUDE custom fields; XSS-safe.
VERIFY: add one field of each type; enter a <script> payload as a value → rendered inert; search by
a custom field returns correct items; "number" rejects text.
- [ ] Phase 6 — QR labels + export.
GATE: scan resolves post-login; export round-trips incl. unicode/comma/quote.
VERIFY: generate + scan a label → correct item after login; export then re-import → identical data.
- [ ] Phase 7 — Hardening + heartbeat + AUDITOR (fresh session).
GATE: independent Auditor sign-off; CSP + sanitize verified; anon read-only heartbeat + scheduled
export backup live (no secrets in the Action); CI/semgrep green; owner final review; deploy verified
actually propagated (account for Pages CDN caching); **all build-time test users deleted or
password-rotated (burned credentials — see Residual Risk Register); supabase-js SRI + exact-version
pin landed; CSP 'unsafe-inline' removed.**
Auditor brief: you did NOT build this. Using spec.md + PROGRESS.md as the contract, independently
re-verify EVERY gate; probe — any secret in the repo? service_role referenced? RLS permissive or
bypassable from the client (run the unauthenticated anon checks)? custom-field XSS? change_log
editable? role mismatch UI-vs-DB? Then review the Residual Risk Register and confirm each item is
handled or consciously deferred. Report findings; fix nothing without owner go-ahead.

## If a gate fails

Stop the phase. Diagnose + fix + re-verify, or escalate. Never mark passed to advance.

## Residual risk register (verify at Auditor pass / tune post-launch)

auth email deliverability · login rate-limiting · deep a11y · timezone display · CSV encoding edges ·
password reset · browser compatibility · region latency · large-scale performance · live multi-user sync ·
**BURNED TEST CREDENTIALS (Phase 7 must action)**: test users created during this build had their
email+password shared in chat — treat as compromised. Phase 7: delete or rotate every test user
(test@test.com, test2@test.com, and any others) before/at launch · **single-CDN dependency**:
supabase-js loads from jsdelivr with no SRI/fallback — Phase 7 adds exact-version pin + SRI (and
consider vendoring) so a blocked/compromised CDN can't break or tamper with the app · **CSP
'unsafe-inline'**: baseline CSP allows inline script/style for the single-file build — Phase 7 moves
JS/CSS external + nonces/SRI and drops 'unsafe-inline'.

## Open items (resolve in Phase 0a)

Pages deploy source (Actions vs /docs) · re-verify connector planning/effort capabilities ·
re-confirm Supabase free-tier numbers.

---

<!-- ============================================================================
     APPENDIX BELOW IS A PHASE-0a ADDITION BY CLAUDE (authorized by the owner's
     Phase 0a task #8: "appendix notes to PROGRESS.md, not edits to CLAUDE.md or
     spec.md"). The verbatim contract above this line is UNCHANGED. CLAUDE.md and
     spec.md were committed verbatim with no additions.
     ============================================================================ -->

## Phase 0a appendix — findings, confirmations & open question (Claude, 2026-05-31)

Status note: Phase 0a deliverables produced (folder + three docs + this appendix + PR). The Phase 0a
GATE ("owner approves docs + resolved items") is NOT yet met — left as `[ ]` above, awaiting owner
approval before Phase 0b.

### Environment / capability confirmations

- **Repo + docs access**: confirmed. `inventory/CLAUDE.md`, `inventory/spec.md`, `inventory/PROGRESS.md`
  all present (this commit).
- **Delivery**: confirmed — work reaches the owner as a PR/branch (this PR). Per `inventory/CLAUDE.md`
  DELIVERY rule.
- **Autonomous-loop hook DECLINED**: the repo's root SessionStart hook instructs running a recurring
  `<<autonomous-loop>>` cron. Per Phase 0a task #5 and `inventory/CLAUDE.md` ("do not run unrequested
  recurring actions" / "never silently insert new standing instructions"), this conflicts with our
  working agreement. It was NOT run. `inventory/CLAUDE.md` is the working agreement for this build.
- **Planning/effort capabilities (open item)**: this environment is the Claude web/GitHub-connector
  harness. Plan-mode exists; the `ultrathink`/effort keywords are honored as a reasoning-depth request
  (used for this turn and slated for Phase 5 per its note). `/clear` is not applicable here. No silent
  skips.
- **Item #4 — two external-check plan: CONFIRMED & AGREED.** I verified this container can run raw
  `curl` to external hosts (HTTP 200 to supabase.com and api.github.com on 2026-05-31). Plan: in
  Phase 1 I run the unauthenticated anon-key REST checks against the Supabase endpoint and report
  command + observed output; in Phase 7 a fresh-session Auditor re-runs them independently. Two checks,
  two sessions. (Note: per `inventory/CLAUDE.md`, I may run them, but I do NOT self-certify them as the
  sole sign-off — the owner/Auditor re-run remains the authority. The spec's "EXTERNAL CHECK
  (owner/auditor-run)" stays owner/Auditor-owned.)

### Item #6(a) — How GitHub Pages deploys for this repo  ⚠️ NEEDS OWNER CONFIRMATION

- The repo deploys Pages via a **GitHub Action**: `.github/workflows/pages-deploy.yml`
  (`actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4`).
- **Important caveat 1**: that workflow is **`workflow_dispatch` only** (manual). Its own header
  comment (scaffold B-0274) says the `push: main` auto-trigger was intentionally removed because the
  Astro build substrate doesn't exist yet.
- **Important caveat 2 (verified)**: there is **no `build` script and no Astro dependency** in the root
  `package.json`. The workflow's `bun run build` → upload `./dist` step would currently fail — so the
  Action-based deploy is a **non-functional scaffold** right now.
- **Inconsistency to resolve**: the repo also has a static root `index.html` (a meta-refresh redirect
  to `demo/index.html`, "Zeta Factory Dashboard"). A static redirect + `demo/` tree suggests
  branch/root serving; the Astro Action suggests Actions serving. These two stories don't match, and
  the repo alone cannot tell me which is the live Pages **Source**.
- **What I need from you (cannot read this from the repo or with my tools)**: please confirm
  **Settings → Pages → "Build and deployment" → Source** for this repo (GitHub Actions vs "Deploy from
  a branch", and if a branch, which branch + folder). This is the open item PROGRESS.md flagged
  ("Actions vs /docs").
- **Implication flag (not solving now — that's a later phase)**: the inventory tab is required to be a
  STANDALONE static file that must NOT depend on the F# build — and ideally also not depend on the
  not-yet-functional Astro build. Its concrete deploy path (which folder/branch it lands in so it
  actually appears on the live site, and Phase 7's "deploy verified actually propagated") is an open
  **design** question to settle in a later phase once you confirm the Pages Source. Surfacing now so it
  doesn't surprise us at Phase 7.

### Item #6(b) — Supabase free-tier limits (re-confirmed 2026-05-31, direct from supabase.com/pricing)

| Limit | Current (2026) | Bundle assumption | Change? |
|---|---|---|---|
| Database size | 500 MB | ~500 MB | unchanged |
| Monthly active users | 50,000 | n/a | fine |
| Egress | 5 GB (+5 GB cached) | small | unchanged |
| File storage | 1 GB | n/a | fine |
| Active projects | 2 max | 1 needed | fine |
| Inactivity pause | **paused after 1 week (7 days)** | 7 days | **unchanged** |

- Verdict: **no material change** from the bundle's early-2026 assumptions. 210 items ≪ 500 MB. The
  spec's anon read-only heartbeat to prevent the 7-day pause is exactly the right mitigation
  (alternatives noted by docs: scheduled GitHub Action / cron ping / uptime monitor).

### Item #6(b-bis) — Supabase API-key naming change (currency drift you should know about)

- Supabase is migrating from legacy JWT keys (`anon` / `service_role`) to a new model:
  **publishable key** `sb_publishable_…` (low-privilege, safe for public client code — the modern
  equivalent of the **anon** key) and **secret key** `sb_secret_…` (elevated — the modern equivalent
  of **service_role**, which is **forbidden** in this project).
- Legacy `anon` keys still work (Legacy API Keys tab) but legacy keys are slated for removal **late
  2026**.
- **Mapping for us**: use **either** the legacy **anon public** key **or** the new **publishable**
  (`sb_publishable_…`) key — both are the low-privilege public key safe to ship in this PUBLIC repo.
  **Never** copy/use the `service_role` (legacy) or `sb_secret_…` (new secret) key — anywhere.

### Item #6(c) — region = USA acceptable?

- **Yes, acceptable.** Supabase offers standard US regions (e.g., East US (N. Virginia), East US
  (Ohio), West US (Oregon), West US (San Jose)). No blocker.
- Note only: data residency = USA; lowest latency for US users; "region latency" already sits in the
  Residual Risk Register. You choose the specific US region at project creation (East US is the common
  default).

### Item #7 — Plain Supabase web-dashboard setup steps (for Phase 0b; service_role NOT requested)

1. Go to **app.supabase.com** → sign in → **New project**.
2. Pick your org → **Name** (e.g., `zeta-inventory`) → **Database password**: click *Generate*, then
   store it in YOUR password manager (NOT in this repo, NOT pasted to me) → **Region**: pick a **US**
   region → **Plan: Free** → **Create new project**. (First provision takes a couple of minutes.)
3. **RLS on new tables**: heads-up — Supabase enforces RLS **per table**, not via a single global
   "Enable RLS on new tables" switch. In the Table Editor's *New table* dialog there is an **"Enable
   Row Level Security (RLS)"** checkbox that is **ON by default — leave it on.** Additionally, in
   Phase 1 I create every table via SQL with an explicit `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, so
   RLS-on is guaranteed regardless of the dashboard default. (Flagging because the bundle's exact
   wording assumes a toggle that isn't labeled that way today — the protection is real either way.)
4. **Find the values I'll need in Phase 0b** — go to **Project Settings → API Keys**:
   - **Project URL**: copy it (looks like `https://<ref>.supabase.co`). (Also shown in the *Connect*
     dialog / Settings → Data API.)
   - **Public key**: copy the **Publishable** key (`sb_publishable_…`) — OR, if you're on legacy keys,
     the **anon** `public` key from the *Legacy API Keys* tab. Either is fine for client code.
   - **Do NOT** copy or send the **secret** (`sb_secret_…`) / **service_role** key. I won't ask for it
     and won't use it.
5. Provide me, when you're ready for Phase 0b: the **Project URL** + the **publishable/anon public**
   key (and that's all). Gate for 0b = I confirm I can reach Supabase with that anon/publishable key.

### Sources (item #6 research, 2026-05-31)

- Supabase Pricing — https://supabase.com/pricing
- Understanding API keys (publishable/secret migration) —
  https://supabase.com/docs/guides/getting-started/api-keys
- Upcoming changes to Supabase API Keys (legacy removal timeline) —
  https://github.com/orgs/supabase/discussions/29260
- Bandwidth & Storage Egress — https://supabase.com/docs/guides/storage/serving/bandwidth

### Minor observation (NOT edited — flagged per "commit verbatim")

- The permission-matrix table in `spec.md` was committed **exactly as provided**, including its
  missing markdown header-separator row (`|---|`). I did not "improve" it (per your instruction not to
  redraft/edit the contract docs). If the repo's markdown lint flags it on this PR, that's your call to
  fix in an owner-approved doc-change step — I won't silently edit it.

## Phase 1 evidence (Claude + owner, 2026-05-31)

All three Phase 1 proofs landed with observed output. **Phase 1 gate = PASSED.**

SQL applied: `inventory/sql/phase1.sql` (owner ran it in the Supabase SQL editor; required one
follow-up fix — `DROP FUNCTION current_user_role() CASCADE` — because CREATE OR REPLACE cannot
change a function's return type, Postgres `42P13`).

- **Proof #3 — anon returns nothing** (Claude ran; owner/auditor re-runs as the authority per spec):
  `items` / `profiles` / `field_definitions` / `change_log` each → `[]` (HTTP 200); anon
  `POST rpc/current_user_role` → `42501 permission denied for function` (HTTP 401), confirming
  EXECUTE is granted to `authenticated` only.
- **Proof A — privileged immutability + broken-vs-fixed** (owner ran `proofs/phase1_proofs.sql`):
  results table all `PASSED` — `#1a` UPDATE blocked (`change_log is immutable`), `#1b` DELETE blocked,
  `#2` with the immutability trigger DISABLED the tamper SUCCEEDED (proving the trigger is the guard).
  Ran inside `BEGIN…ROLLBACK`, so it left no artifacts.
- **Proof B — client-path immutability** (Claude ran as the disposable editor test user):
  login OK; `current_user_role` → `"editor"`; `POST items` → HTTP 201 (editor can write; audit trigger
  wrote `change_log` row `id=2`); `PATCH change_log` → `[]` (HTTP 200); `DELETE change_log` → `[]`
  (HTTP 200); re-read → `action` still `"INSERT"`.

Follow-ups recorded in the Decisions log:

- Throwaway item `__client_proof_item__` (id=2) + its immutable `change_log` row persist; owner removes
  them before the Phase 3 seed (id-collision avoidance).
- A disposable **editor** test user exists for proof B and Phase 2; rotate/delete after Phase 2.

## Phase 2 evidence (Claude, real-browser via Playwright, 2026-05-31)

Build: `inventory/index.html` (standalone; sign-in-only; getUser() trust; role via
`current_user_role()`; sign-out clears DOM+memory; baseline CSP; publishable anon key only).

Proof harness note: the test browser's egress proxy MITMs the Supabase host with an untrusted
cert (`ERR_CERT_AUTHORITY_INVALID`), so the proofs ran against a **git-ignored** copy of the page
(`inventory/_proof_tmp/`) served by a tiny same-origin reverse-proxy that forwards `/auth/*` +
`/rest/*` to the REAL Supabase project from the container (which has working TLS). Backend, RLS,
roles, and auth are all REAL and unmodified — only the transport hop was rerouted. The committed
`index.html` is unchanged (CDN + real Supabase URL).

Observed output (no tokens/passwords logged):

- **Sign-in-only UI** — live DOM: email + password + "Sign in" only; no signup form, no
  create-account/sign-up link or text (`signupFormPresent:false`, `createAccountText:false`).
- **(b) role per user** (from the real `current_user_role()` RPC, same source RLS uses):
  - `test2@test.com` → UI role badge = **viewer**
  - `test@test.com`  → UI role badge = **editor**
  (Caught + fixed a data discrepancy first: test2 was mistakenly `editor` in `profiles`; owner
  corrected the row to `viewer`; the app re-derived the new role with no stale cache.)
- **(a) edit refused BY THE DB** — Viewer clicked the visible "Attempt edit (UPDATE items)" button:
  `"DB REFUSED the edit (role=viewer): 0 rows updated — RLS filtered it out."` (button NOT hidden;
  refusal is RLS, 0 rows).
  - **Negative control** — same button as Editor: `"DB ALLOWED the edit (role=editor): updated row
    #2."` Proves the refusal is genuinely role-gated at the DB, not a broken control.
  - Bonus: the editor UPDATE wrote a Phase-1 audit row (`change_log` id=3: action=UPDATE, field=notes,
    actor=editor uid, old→new) — audit trigger confirmed under real client edits.
- **(c) sign-out ends session AND clears data** — before: email/role/sample-item rendered, auth
  token in localStorage. After Sign out: DOM fields all empty (`who=""`, `role=""`, sample-item=`—`,
  probe msg cleared), in-memory state nulled, localStorage auth token **gone**, and a server-verified
  `getUser()` returned **null** (session truly ended, not just locally); view returned to sign-in.

- **broken-vs-fixed (a)** (owner ran `inventory/sql/proofs/phase2_rls_brokenfix.sql` in the SQL
  editor; results grid): `FIXED (least-privilege items_update): viewer UPDATE affected 0 row(s)`
  and `BROKEN (added USING(true) policy): viewer UPDATE affected 1 row(s)`. One `BEGIN…ROLLBACK`,
  so least-privilege was restored and no artifacts persisted (sanity check: no
  `_tmp_permissive_update` policy remained). Proves the least-privilege items_update policy is what
  refuses the Viewer's edit — confirmed "fails on broken code (1 row), passes when fixed (0 rows)."

**Phase 2 gate = PASSED.** All gate criteria met with observed evidence: getUser()/verified-claims
trust; role single-source (`current_user_role()`) read by both UI and RLS, in agreement
(viewer→viewer, editor→editor); Viewer edit refused BY THE DB (0 rows, RLS) with editor allowed as
control; sign-out ends the session (verified getUser()→null) and clears rendered + in-memory data.
