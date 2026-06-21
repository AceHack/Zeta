---
id: 081KQGDBJ0008QG0R0028YTDQ2
priority: P1
status: open
title: GitHub settings refactor — split single ruleset into multiple smaller always-on rulesets, prefer git-native over legacy UI/CLI-only settings (Aaron 2026-05-01)
created: 2026-05-01
last_updated: 2026-05-01
decomposition: decomposed
depends_on:
  - 081KQGDBJ0008QG0R002NV04N9
children: [081KR2E4K0008QG0R001DYEFD7, 081KR2E4K0008QG0R001VZMQBH, 081KR2E4K0008QG0R002NYV33T]
type: friction-reducer
---

# 081KQGDBJ0008QG0R0028YTDQ2 — GitHub settings refactor — ruleset split + git-native preferred

## What

Aaron 2026-05-01 — full permission for the github-settings refactor:

> *"the settings that are there are accidental complexity not intentional,
> we want best practices and to prefer the git native settings over the
> legacy github ui/cli only settings, these are nasty thats why they are
> legacy"*

Plus prior framing from same exchange:

> *"i'm sure you'll keep your good disciplines like you were splitting
> rulesets so you could have all always on but multiple smaller rulesets"*

Three composing directives:

1. **Treat current settings as accidental complexity** — not load-bearing,
   not intentional design. Apply assumed-state-vs-actual-state discipline:
   the actual-state is "what someone clicked under time pressure"; the
   target-state is "best-practices fresh design."
2. **Split single big ruleset into multiple smaller always-on rulesets**
   — separation of concerns, smaller blast-radius, easier reasoning.
3. **Prefer git-native (declarative-in-tree) over legacy UI/CLI-only
   settings** — *"these are nasty thats why they are legacy."*

## Why now

Drift-debt on `github-settings-drift.yml` was just resolved by snapshot
refresh in PR #1126 — but the snapshot captures *current accidental state*,
not *target architectural state*. The refactor work is about moving from
accidental → intentional.

Current state (as of 2026-05-01 16:53Z, post-PR #1126):

- **One** `Default` ruleset with 5 rules (deletion, non_fast_forward,
  copilot_code_review, pull_request, required_linear_history)
- **Plus** legacy branch protection on `main` with
  `required_status_checks` (7 contexts, `strict: false`) +
  `required_conversation_resolution` + others
- The branch protection's status-checks aren't represented in any
  ruleset → split-system causes review-policy duplication and drift risk

## Architectural target — three-ruleset split

Split the single `Default` ruleset into three concern-aligned smaller
rulesets, all always-on. Migration from legacy branch protection
folds the status-checks INTO ruleset #3 (CI gate), making branch
protection mostly redundant.

### Ruleset 1 — "Branch integrity"

**Concern**: physical-git-history protection. The branch must not be
deleted, force-pushed, or have non-linear history.

**Rules**:

- `deletion` (block branch delete)
- `non_fast_forward` (block force-push)
- `required_linear_history` (no merge commits — squash-only)

**Why split**: these are the lowest-level git invariants. They never
need to be temporarily disabled (unlike review-process which might
during emergency-fix scenarios). Always-on.

### Ruleset 2 — "Review process"

**Concern**: human and AI review gating before merge.

**Rules**:

- `pull_request` (review thread resolution + allowed merge methods +
  required reviewers + dismiss-stale-reviews)
- `copilot_code_review` (auto-review on draft + push)

**Why split**: review process IS occasionally adjusted (e.g., for
emergency hot-fix lanes, or when re-tuning auto-review). Splitting
this concern means review-policy adjustments don't risk the
branch-integrity invariants.

### Ruleset 3 — "CI gate"

**Concern**: required status checks must pass before merge.

**Rules**:

- `required_status_checks` (migrated from legacy branch protection):
  contexts include `build-and-test (macos-26)`, `build-and-test
  (ubuntu-24.04)`, `build-and-test (ubuntu-24.04-arm)`, `lint
  (actionlint)`, `lint (markdownlint)`, `lint (semgrep)`, `lint
  (shellcheck)`, plus the memory-* lints, backlog-index-integrity,
  and tick-history-order
- `strict: false` — **CONFIRMED DELIBERATE** (Aaron 2026-05-01:
  *"no we want false"* + *"yes that is not accidentally"*).
  Parallel-PR-friendly cadence is the design choice; sequential
  merging via `strict: true` would force every merged PR to
  invalidate all sibling PRs. This setting graduates from the
  everything-greenfield-accidental default to confirmed-deliberate
  via direct maintainer signal — sharpens the rule (most settings
  are accidental; specific settings can be confirmed-deliberate
  via maintainer-graduation)

**Why split**: CI gate evolves most frequently — every new workflow,
every new lint, every new check. Isolating CI-policy churn from
review-process and branch-integrity reduces blast-radius.

### Branch protection — keep or remove?

After the migration:

- `required_status_checks` lives in Ruleset 3 (canonical)
- `required_conversation_resolution` — must verify if rulesets have
  this as a rule type (they may not yet); if not, branch protection
  keeps it
- Other branch-protection settings (`enforce_admins`, etc.) — case-
  by-case audit

**Default direction**: remove branch protection entirely if all its
settings have ruleset equivalents. Branch protection is the legacy
mechanism Aaron's directive flags as "nasty."

## Phase plan

### Phase 1 — Audit + design (this row's first deliverable)

1. Run `gh api repos/.../branches/main/protection` and document every
   field in current branch protection
2. For each field, identify whether a ruleset rule type exists that
   replaces it
3. Build the migration matrix: each branch-protection field →
   ruleset rule (or "no equivalent, keep in branch protection")
4. Document at `docs/GITHUB-SETTINGS.md` (extend existing or create)

### Phase 2 — Split implementation

1. Update `tools/hygiene/github-settings.expected.json` with the
   target three-ruleset shape (this is the declarative source-of-
   truth; the host catches up via reconciliation)
2. Build a reconciliation script
   (`tools/hygiene/apply-github-settings.sh` — envisioned, not yet
   implemented) that reads the expected JSON and applies via
   `gh api PUT/POST/DELETE` to the host
3. Run the reconciliation script with `--dry-run` first; review
   diff; then apply
4. Verify drift workflow passes after reconciliation

### Phase 3 — Branch-protection cleanup

1. Once Ruleset 3 has all branch-protection's must-have rules,
   reduce branch protection to the minimum (or remove entirely)
2. Update snapshot
3. Verify CI still passes (drift workflow + actual PR merges)

### Phase 4 — Documentation

1. `docs/GITHUB-SETTINGS.md` — full architecture doc explaining
   the three-ruleset split + the git-native-preferred discipline
2. `tools/hygiene/README.md` (or new doc) — operator runbook for
   adjusting settings (always edit `expected.json` first, then
   reconcile, never click in UI)
3. ADR under `docs/DECISIONS/2026-05-01-github-settings-ruleset-split.md`

## Acceptance criteria

1. **Three rulesets exist on host** (Branch integrity / Review
   process / CI gate), all `enforcement: active`, conditions
   `~DEFAULT_BRANCH`
2. **`required_status_checks` migrated** from branch protection
   into Ruleset 3
3. **Branch protection minimized or removed** — only fields with
   no ruleset equivalent remain
4. **`tools/hygiene/github-settings.expected.json` updated** with
   the three-ruleset shape as canonical source-of-truth
5. **Reconciliation script** at
   `tools/hygiene/apply-github-settings.sh` (or equivalent)
   that applies expected.json to host (idempotent)
6. **`github-settings-drift.yml` passes** post-refactor
7. **ADR landed** documenting the architectural decision +
   the git-native-preferred discipline
8. **No regression on PR merge cadence** — verify by attempting to
   merge a small test PR after the refactor; merge gate must still
   work + still produce same merge-method (squash)

## Anti-patterns this guards against

1. **Treating legacy as canonical** — branch protection's UI checkboxes
   ARE legacy; ruleset-as-code IS the modern git-native equivalent.
   Migrate; don't preserve.
2. **One big always-on ruleset** — concern-coupling means any policy
   adjustment risks unrelated invariants. Split.
3. **Click-ops drift** — settings adjusted via GitHub UI without
   updating the expected snapshot create silent drift. Reconciliation
   script makes the snapshot authoritative.
4. **Premature mid-PR cleanup** — the refactor needs its own PR with
   its own CI verification. Don't bundle with unrelated work.

## Out of scope (defer)

- **CODEOWNERS-as-policy** — separate concern; not changing CODEOWNERS
  in this row
- **Webhook config** — webhooks are click-ops-only on GitHub; no
  ruleset equivalent. Out of scope.
- **Repo secrets / Dependabot config** — declarative config for
  these lives elsewhere (`.github/dependabot.yml` already exists);
  separate concerns.
- **Org-level settings** — this row is repo-level only

## Composes with

- 081KQGDBJ0008QG0R002NV04N9 (GitHub Pages for SEO + Wiki first-class; forward-ref to PR #1125 not yet merged on main) — both rows are
  GitHub-host-config refactor work; ordering: drift-debt resolved
  first (PR #1126), then this row, then 081KQGDBJ0008QG0R002NV04N9's Pages workflow
  lands cleanly
- `memory/feedback_github_settings_as_code_declarative_checked_in_file.md`
  — declarative-config-as-code discipline; this row IS this
  discipline applied at scale
- `memory/feedback_git_native_vs_github_native_plural_host_pluggable_adapters_2026_04_23.md`
  — git-native vs github-native distinction; this row preserves
  git-native shape
- `memory/project_factory_is_git_native_github_first_host_hygiene_cadences_for_frictionless_operation_2026_04_23.md`
  — git-native first-class architectural framing
- `memory/feedback_agent_owns_all_github_settings_and_config_all_projects_zeta_frontier_poor_mans_mode_default_budget_asks_require_scheduled_backlog_and_cost_estimate_2026_04_23.md`
  — Aaron's standing authorization for agent-owned GitHub settings
- `memory/feedback_everything_greenfield_at_week_one_including_host_and_coding_rules_aaron_2026_05_01.md`
  — Aaron's "current configurations are candidates not constraints"
  reframe; directly applies here
- `memory/feedback_assumed_state_vs_actual_state_audit_horizon_check_aaron_2026_05_01.md`
  — apply the audit-horizon discipline: actual-state of settings is
  what's on the host RIGHT NOW; target-state is the best-practices
  shape; the gap between them IS the refactor scope
- Aaron's visibility-constraint rule (Aaron 2026-04-28: don't
  change shared-production things he can't see) — referenced
  in MEMORY.md fast-path and prose across multiple memory
  files but not yet captured as its own dedicated memory file.
  Applies here: settings changes must be visible to Aaron
  post-merge; this is satisfied by the declarative
  expected.json being checked in
- task #343 (drift-debt receipt 2026-04-29) — historical predecessor;
  the drift-debt that PR #1126 just resolved is what motivated
  Aaron's directive to refactor properly
- PR #1126 (snapshot refresh) — landed before this row; gets CI
  green so this row's refactor work has a clean baseline

## Effort

**L (large, 3+ days)** — multiple host changes, reconciliation tooling,
migration matrix, documentation. Phase 1 (audit + design) alone could
be S (under a day); the implementation phases are M-L each.

## Why P1

- **Not P0** because the factory functions today (drift-debt resolved
  in PR #1126; CI is now green)
- **Not P2** because Aaron explicitly named the current state as
  "accidental complexity" and authorized the refactor; deferring this
  row makes future settings changes harder (every change adds more
  drift-debt)
- **P1** because it's foundational infrastructure that compounds with
  every future host-config change. Every day spent on the
  current-accidental-shape is a day of compounding click-ops drift
  risk.

## Mechanization candidate

The reconciliation script (`tools/hygiene/apply-github-settings.sh`)
IS the mechanization. After Phase 2 ships, every settings change
flows through:

1. Edit `tools/hygiene/github-settings.expected.json`
2. Run reconciliation script (verifies + applies)
3. Drift workflow stays green

Click-ops drift becomes structurally impossible — any host change
that wasn't applied via the script gets caught by the drift workflow
on next run.
