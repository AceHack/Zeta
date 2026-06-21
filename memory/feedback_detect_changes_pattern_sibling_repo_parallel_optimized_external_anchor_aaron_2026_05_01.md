---
name: detect-changes pattern + fine-grained workflow split — sibling-repo parallel-optimized external anchor — Aaron 2026-05-01
description: Aaron 2026-05-01 *"../no-copy-only-learning-agents-insight is the best repo in github i've seen setup to be parallel, it's not perfect but it's pretty good."* — external-anchor pointing at sibling repo's parallel-optimization patterns. Seven load-bearing patterns identified via direct inspection: (1) `detect-changes.yaml` workflow that emits per-change-class outputs (`mfe-src-changed`, `backend-src-changed`, etc.); (2) fine-grained workflow split (42 workflows, one concern each, vs our ~15 monolithic); (3) test parallelism at script level (bash + PowerShell pair); (4) 5 concern-aligned rulesets empirically validating 081KQGDBJ0008QG0R0028YTDQ2 architecture; (5) branch protection effectively empty (zero contexts, all migrated to rulesets); (6) sibling uses Wiki not Pages — Aaron's prior Jekyll-on-Pages was workaround-not-preference (*"bun is probably enough"*); (7) AGENTS.md learning-discipline convergence. The pattern's core insight is that PRs only run workflows their changes need — backend-only PR doesn't trigger MFE workflows. Massive parallel-PR-friendliness because CI churn drops to zero across unrelated changes.
type: feedback
caused_by:
  - "Aaron 2026-05-01 message naming `../no-copy-only-learning-agents-insight` as the best parallel-optimized repo he's seen on GitHub"
  - "Direct inspection of the sibling repo's .github/workflows/ + AGENTS.md per the DST-grade-A pull-to-sibling-repo discipline"
composes_with:
  - feedback_dst_grade_a_dependency_source_inspection_pull_to_sibling_repo_for_deep_search_aaron_2026_05_01.md
  - feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md
  - feedback_beacon_promotion_load_bearing_rules_earn_external_anchors_aaron_amara_2026_04_28.md
  - feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md
---

# Rule

When designing CI for a repo that hosts multiple concerns
(frontend / backend / infra / docs / tests), structure the
workflows so that **PRs only run checks relevant to their
changed files**. The mechanism: a `detect-changes` workflow
that emits per-change-class outputs, and downstream workflows
gate on those outputs.

This is the load-bearing parallel-PR-friendliness pattern.

# Why

Aaron 2026-05-01 surfaced the external anchor:

> *"optimized for parallel, ../no-copy-only-learning-agents-insight
> is the best repo in github i've seen setup to be parallel,
> it's not perfect but it's pretty good."*

Direct inspection of the sibling repo (per the DST grade-A
*"pull dependency source down to ../sibling repo"* discipline)
surfaced three load-bearing patterns.

## Pattern 1 — `detect-changes.yaml` workflow

The sibling repo has a single `detect-changes.yaml` workflow
that emits per-change-class outputs:

- `mfe-src-changed` — only deployable MFE source changed
  (used by deploy workflows)
- `mfe-any-changed` — any MFE-related file changed (includes
  tests, storybook, workflow files; used by CI workflows)
- `backend-src-changed` — backend deployable source (`src/`)
  changed
- `backend-any-changed` — any backend-related files changed
  (src, tests, build config)
- `infra-changed` — infra files changed

**Naming convention** (verbatim from the file):

- `*-src-changed` — only deployable source changed (deploy gate)
- `*-any-changed` — any related file changed including tests,
  config, workflow files (CI gate)
- `*-changed` — single-scope filter where the distinction
  doesn't apply

Other workflows depend on these outputs to decide whether to
run. A backend-only PR sees `mfe-any-changed: false` →
MFE workflows skip themselves entirely.

**Result**: massive parallel-friendliness. Sibling PRs that
touch different concerns don't compete for CI minutes; they
also don't invalidate each other's CI runs because each PR's
required checks are scoped to its own change-class.

## Pattern 2 — Fine-grained workflow split (42 workflows vs our 15)

The sibling repo has 42 workflow files, each focused on one
concern:

- `pr_backend-coverage.yaml`
- `pr_database_migration.yaml`
- `pr_db-citus-coverage.yaml`
- `pr_db-citus-package.yaml`
- `pr_frontend-coverage.yaml`
- `pr_mfe-build.yaml`
- `pr_mfe-check.yaml`
- `pr_deploy-preview.yaml`
- `pr_destroy-preview.yaml`
- ... and 33 more

Each workflow:

- Triggers via `workflow_call` from a parent or via path-filter
- Has its own concurrency group (per-PR per-concern)
- Can fail without blocking unrelated workflows on the same PR
- Composes via `detect-changes` outputs (Pattern 1)

**Compare to ours**: `gate.yml` is monolithic with all checks
inside; `lint.yml` runs all linters in matrix. When any
matrix-leg fails the whole gate fails. Aaron's
`splitting-rulesets-so-you-could-have-multiple-smaller`
direction (per 081KQGDBJ0008QG0R0028YTDQ2) is the ruleset analogue of this
workflow-splitting pattern.

## Pattern 3 — Test parallelism at script level (bash + PS1 pair)

The sibling repo has:

- `scripts/run-test-projects-parallel.sh`
- `scripts/run-test-projects-parallel.ps1`

A pair — exactly the 4-bash + PowerShell alignment per
Otto-235 + task #305. The bash + PS1 pair runs test projects
in parallel from the script level, not just from CI matrix.
This means local development gets parallel test execution
too — not just CI.

## Pattern 4 — Multiple concern-aligned rulesets (081KQGDBJ0008QG0R0028YTDQ2 architecture validated)

Aaron 2026-05-01 follow-up: *"you should be able to use the gh
cli i think to see it's setting in read only mode too"* + *"on
gh not in ../no-copy-only-learning-agents-insight."*

Direct `gh api repos/<sibling-org>/<sibling-repo>` audit revealed **five
concern-aligned rulesets**:

1. `Copilot review for default branch` (active) — review-process
2. `Prevent Flux config change re-deploy` (evaluate-mode) —
   domain-specific guard
3. `Release Pending Check` (active) — release-process gate
4. `Status Checks and Merge Queue` (active) — CI gate
5. `deployment/* branch protection` (evaluate-mode) —
   deployment-branch concern

This is **exactly the 081KQGDBJ0008QG0R0028YTDQ2 architectural target**: multiple
smaller concern-aligned rulesets, all always-on (or staged-on
via `evaluate` mode for new rules). The sibling repo has done this in
production at scale. Empirical validation that the split-into-
multiple-smaller-rulesets pattern is the right architecture.

The `evaluate` enforcement mode is a pattern we don't yet
exploit: rulesets in `evaluate` mode don't block merges but
DO record what would have been blocked, letting you stage a
new ruleset rule's introduction with zero blast-risk before
flipping to `active`. Composes with 081KQGDBJ0008QG0R0028YTDQ2's three-ruleset
split: each new rule could ship via `evaluate` → observe →
`active` rollout.

## Pattern 5 — Branch protection effectively empty post-migration

the sibling repo's `gh api .../branches/master/protection` shows:

- `required_status_checks.strict: null`
- `required_status_checks.contexts: []` (zero contexts)
- `required_linear_history: false`
- `required_conversation_resolution: false`

**They've migrated EVERY enforcement out of legacy branch
protection into rulesets.** Branch protection is effectively
inert; the rulesets carry the policy.

This is the 081KQGDBJ0008QG0R0028YTDQ2 Phase-3-cleanup endpoint: minimized branch
protection. the sibling repo is the empirical proof that the migration
works — they're operating at production scale with branch
protection as a thin shim.

## Pattern 6 — the sibling repo uses Wiki, not Pages

`gh api repos/<sibling-org>/<sibling-repo>` shows `has_pages: false`,
`has_wiki: true`. the sibling repo uses Wiki, not Pages — opposite shape
from Aaron's previous Jekyll-on-Pages experience.

Aaron 2026-05-01 follow-up framing correction:

> *"opposite of your Pages-with-Jekyll preference; not my
> preference, i've just used it before cause i didn't want
> to write ts at the time, bun is probably enough."*

The Pages-with-Jekyll choice in Aaron's prior work was a
workaround (Jekyll-without-TS) under a constraint
(didn't-want-to-write-TS), NOT a preference. With bun on
PATH (post-install-graph), TS-native static site generators
become viable:

- **Astro** — TS-native, fast static gen, excellent SEO
- **Vitepress** — TS-native, dev-friendly, used by Vue / Vite docs
- **Eleventy** with TS plugins — flexible
- **Bun-native templating** — minimal, can build incrementally
  from existing `docs/**.md` markdown

This sharpens 081KQGDBJ0008QG0R002NV04N9's static-site-generator choice: Jekyll
was the default candidate, but post-bun-on-PATH the TS-native
options (Astro / Vitepress) deserve evaluation. Composes with
081KQGDBJ0008QG0R000A4EZS5's TS-preference (Pages should follow the same TS-default
trajectory the rest of the codebase is on).

Click-vs-decision framing applies again: "Pages-with-Jekyll
in past projects" was a click (workaround), not a decision.
The 081KQGDBJ0008QG0R002NV04N9 decision is open.

## Pattern 7 — AGENTS.md learning-discipline (composing patterns)

The sibling AGENTS.md has rules we already have analogues for:

- *"Lessons learned belong IN the PR that surfaced them —
  when load-bearing"* — same as our session-cluster
  pattern (lessons land in the PR that produced them)
- *"Every bot review comment is a joint learning opportunity
  — encode in the same PR"* — convergence-loop discipline
  (Otto-358 candidate observed across this very session)
- *"Investigate dependency source code as evidence"* —
  same as DST grade-A dependency-source-inspection rule
- *"Always check the live registry feed for current versions
  — never reuse training data or earlier-in-session results"*
  — same as Otto-247 + Otto-364 search-first authority

Convergence: the sibling repo and Zeta arrived at the same agent-discipline
patterns independently. External-anchor-lineage strongly
validates our substrate.

# How to apply

For 081KQGDBJ0008QG0R0028YTDQ2 (ruleset-split refactor) + 081KQGDBJ0008QG0R000E10AAM (lint suite) +
081KQGDBJ0008QG0R000A4EZS5 (TS port) — the detect-changes pattern composes:

1. **Phase 1 — port `gate.yml` outputs into `detect-changes` shape**:
   emit per-class outputs (`memory-changed`, `code-changed`,
   `tools-changed`, `docs-changed`, etc.)
2. **Phase 2 — split `gate.yml` into per-concern workflows**:
   `pr_memory-lint.yaml`, `pr_tools-typecheck.yaml`,
   `pr_code-build.yaml`, `pr_code-test.yaml`,
   `pr_docs-markdownlint.yaml`, etc.
3. **Phase 3 — update CI-gate ruleset** (081KQGDBJ0008QG0R0028YTDQ2 Ruleset 3) to
   require only the workflows that emit `*-changed: true`
   for a given PR. This is GitHub-API-side conditional
   required checks; the host doesn't natively support
   conditional required-checks well, so the workaround is
   typically to have each workflow self-skip when its
   `*-changed` output is false but still report SUCCESS so
   the required-check is satisfied.
4. **Phase 4 — extend the bash+PS1 parallelism pattern** to
   our test execution (composes with 081KQGDBJ0008QG0R000A4EZS5 TS port for the
   bash side; PowerShell side is task #305).

# Composes with

- 081KQGDBJ0008QG0R0028YTDQ2 (ruleset-split refactor) — workflow splitting at
  the ruleset level is the architectural twin of workflow
  splitting at the GitHub Actions level
- 081KQGDBJ0008QG0R000A4EZS5 (TS standardization) — many of the per-concern
  TS scripts could be invoked from per-concern workflows
- 081KQGDBJ0008QG0R000E10AAM (pre-commit lint suite) — local pre-commit catches
  the same things detect-changes-gated workflows do at CI
- 081KQGDBJ0008QG0R002NV04N9 (Pages + Wiki) — Pages-deploy workflow should be
  detect-changes-gated (only run when Pages content
  changes)
- task #305 (install.ps1 for Windows) — the bash+PS1
  parallelism pair pattern is the Windows-reach trajectory
- task #341 (TS port + 3-tier multi-remote) — composes with
  the TS preference + workflow-split

## Attribution — the sibling repo config is deliberate-by-others, not Aaron-clicked

Aaron 2026-05-01 follow-up: *"this has had a lot of intention
put into by others not so much by me the gh config for that
project."*

Important attribution distinction:

- **Zeta's host config** = Aaron-clicked-alone-under-time-
  pressure (per the everything-greenfield cause-attribution:
  rushed-bootstrap + safety-bias + limited-experience)
- **the sibling repo's host config** = multi-engineer org-scale
  deliberation, invested-by-others, NOT primarily Aaron-
  clicked

This sharpens the external-anchor strength. The patterns we're
extracting from the sibling repo aren't "Aaron-via-different-org converged
on the same shape" — they're "engineers who built the parallel
architecture deliberately produced this design." External
validation from a *different* deliberation process is stronger
than convergence-via-Aaron-self-consistency.

Composes with the everything-greenfield cause-attribution
refinement: the click-vs-decision distinction generalizes across
WHO clicked vs decided. Aaron clicked Zeta; the sibling repo team
decided the sibling repo design. Pattern-extraction from the sibling repo is pattern-extraction
from a decision, not a click — high-credibility source.

# Carved sentence (candidate, not seed-layer yet)

*"The detect-changes pattern is the parallel-PR primitive.
Without it, every PR contests for every check. With it,
PRs that touch different concerns don't see each other."*

(Marked candidate per CSAP. Has not been multi-domain-tested.
Promotes via Razor + CSAP under DST grading on cadence, not
by maintainer fiat. The sibling repo's external-anchor
provides one data point of multi-domain testing in the
direction of validation.)

# What this rule does NOT do

- **NOT a mandate to copy the sibling repo workflows wholesale** — we
  port the *pattern*, not the implementations. Their domain
  (MFE / backend / Citus DB) is different from ours
  (F# DBSP / Lean / TLA+).
- **NOT 42 workflows immediately** — phased adoption. Start
  with the highest-value split (memory lints / code build /
  docs lints).
- **NOT a replacement for 081KQGDBJ0008QG0R0028YTDQ2's ruleset-split** —
  workflow-split + ruleset-split compose; both are required
  for full parallel-friendliness. Workflow-split alone
  doesn't change which checks are *required*; ruleset-split
  alone doesn't change which checks *run*.
- **NOT a "best repo on GitHub" claim by Otto** — Aaron's
  framing was *"the best repo in github i've seen setup
  to be parallel, it's not perfect but it's pretty good."*
  External-anchor is "Aaron-encountered, Aaron-named-positive";
  Otto is reporting Aaron's anchor, not making an
  independent claim. (Quote retains lowercase "github"
  per Aaron's verbatim; Otto's surrounding prose uses
  "GitHub" per established capitalization.)
