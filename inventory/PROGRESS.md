# Inventory Build — Progress & Plan

Status: [ ] todo · [~] doing · [x] gate passed (record HOW verified — evidence, not just a check)

## Decisions log

- Backend: Supabase, USA region, owner-owned. Connector-first; CLI fallback.
- Archive over delete. $0 target; anon read-only heartbeat to prevent pause; manual + scheduled export.
- service_role key: forbidden everywhere. (append decisions as we go)

## Evidence rule

A [x] must record 1–2 lines of HOW it was verified. A later session must NOT trust a [x] lacking
recorded evidence — re-verify instead. Doc changes happen only via an owner-approved PR step.

## Phases

- [ ] Phase 0a — Docs & decisions (Claude, no app code): resolve open items (Pages deploy source;
your environment's planning/effort capabilities; current Supabase free-tier limits; region=USA);
draft CLAUDE.md + spec.md + PROGRESS.md; give plain Supabase setup steps.
GATE: owner approves docs + resolved items.
- [ ] Phase 0b — Supabase live (owner): create project; turn ON "Enable RLS on new tables"; provide
project URL + anon key. GATE: Claude confirms it can reach Supabase with the anon key.
service_role key NOT shared.
- [ ] Phase 1 — Schema + RLS + audit trigger.
GATE: every table RLS-ON, default-deny, NO permissive/`USING(true)` policies, least-privilege;
change_log immutable; trigger writes who/what/when.
VERIFY (mix of Claude + OWNER): from a real client session attempt UPDATE/DELETE on change_log →
refused. OWNER-RUN: unauthenticated anon `curl` on items, field_definitions, change_log, profiles
→ each returns nothing. (Claude provides commands + expected output; owner runs; not self-certified.)
- [ ] Phase 2 — Auth + roles.
GATE: trust uses getUser()/verified claims; role single-source read by BOTH UI and RLS and they
agree; sign-out ends access and clears rendered data.
VERIFY: log in as Viewer in the browser, attempt an edit → refused BY THE DB (not just UI hidden);
confirm RLS sees correct role per user; sign out → data gone, session ended.
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
actually propagated (account for Pages CDN caching).
Auditor brief: you did NOT build this. Using spec.md + PROGRESS.md as the contract, independently
re-verify EVERY gate; probe — any secret in the repo? service_role referenced? RLS permissive or
bypassable from the client (run the unauthenticated anon checks)? custom-field XSS? change_log
editable? role mismatch UI-vs-DB? Then review the Residual Risk Register and confirm each item is
handled or consciously deferred. Report findings; fix nothing without owner go-ahead.

## If a gate fails

Stop the phase. Diagnose + fix + re-verify, or escalate. Never mark passed to advance.

## Residual risk register (verify at Auditor pass / tune post-launch)

auth email deliverability · login rate-limiting · deep a11y · timezone display · CSV encoding edges ·
password reset · browser compatibility · region latency · large-scale performance · live multi-user sync.

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
