---
id: B-0140
priority: P1
status: open
title: Bash → TS migration completion — debt-prevention prerequisite to B-0132 (CRDT-composition)
created: 2026-05-01
last_updated: 2026-05-08
depends_on: []
decomposition: atomic
classification: buildable-now
composes_with: [B-0190, B-0196]
type: friction-reducer
---

# B-0140 — Bash → TS migration completion

**Priority:** P1 (debt-prevention; prerequisite to B-0132 CRDT-composition; bounded scope; substantial cumulative cost if deferred).

**Filed:** 2026-05-01.

**Filed by:** Otto under backlog-prioritization authority delegated 2026-05-01. Origin: Aaron 2026-05-01 ~10:55Z: *"Bash → TS migration completion this is also usefull so we don't just keep building dept"*. Companion to B-0125 (build-track split); both are prerequisites to B-0132 (CRDT-composition) per Aaron's framing that CRDT work shouldn't compound debt onto a half-migrated tooling layer.

**Effort:** M (1-3 weeks — finish the in-progress migration; remove dead `.sh` files; update CI references).

## What

Complete the bash → TypeScript+Bun migration for `tools/` scripts. Currently in-progress (per `tools/backlog/generate-index.ts` self-described as "slice 12 of the TS+Bun migration"); both `.sh` and `.ts` versions exist for at least the backlog-index generator and probably others. Each duplicate is debt: maintenance happens in one place, drift happens in the other; CI invokes one, dev workflows invoke another.

Specific scope (concrete; verify-before-state-claim discipline applies — first acceptance criterion is the audit):

1. **Audit current state**: enumerate every `tools/**/*.sh` file with a corresponding `tools/**/*.ts` file that supersedes it (same purpose, parallel implementation). Output: a table of `(.sh path, .ts path, status, kill-or-keep decision)`.
2. **Cutover decisions**: for each pair, decide whether to (a) kill the `.sh` and migrate all callers to `.ts` (most cases), (b) keep the `.sh` because it's load-bearing somewhere TS can't run yet (rare), (c) port the `.ts` back to `.sh` because the migration was wrong direction (rare).
3. **Execute the cutovers**: remove dead `.sh` files; update CI workflow references; update README/docs references; verify dev-laptop install (`tools/setup/install.sh` is the bootstrap; bash will continue to be the bootstrap target per CLAUDE.md, but post-bootstrap operations migrate to TS).
4. **Verify in CI**: at least 2-3 PRs land with the migration completing each affected slice; observe CI green.

## Why P1

- **Debt-prevention is real and recurring.** Each duplicated implementation (.sh + .ts) is maintenance debt that grows with every change. Without completion, CRDT-composition work (B-0132) will touch both tracks of the duplicated tooling and compound the debt.
- **Aaron flagged it explicitly as backlog-worthy** in same exchange as B-0125 + B-0132 prerequisite framing.
- **Bounded scope** — the duplications are finite and discoverable via grep; cutover is mechanical per item.
- **Composes with existing work**: task #341 (TS port + future git scripts: enforce 3-tier multi-remote design) and B-0122 (peer-call scripts TypeScript migration — post-install cutover) both touch this scope. B-0140 is the **completion-side row** that consolidates the in-progress migration.
- **Bash compatibility target preserved** per `feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_otto_235_2026_04_24.md` — `tools/setup/install.sh` and bootstrap-class scripts stay bash; post-bootstrap tooling migrates.

## Why not P0

- **Not blocking**: the duplications work; CI uses one or the other; nothing is broken.
- **Real risk**: removing a `.sh` whose callers haven't all been migrated to `.ts` will break things. The audit + execute pattern needs careful per-item verification.

## Why not P2

- **The cost compounds**: each new substrate operation (B-0132 onwards) touches more tools/ scripts; deferring multi-week leaves more accumulation to clean up later.
- **Aaron explicitly framed it as "so we don't just keep building dept"** — the priority signal is clear.

## Acceptance criteria

1. **Audit table** documented (in this row's followups or in `docs/research/`): every `tools/**/*.sh` file mapped to its `.ts` counterpart with kill-or-keep decision and rationale.
2. **All kill-decisions executed**: dead `.sh` files removed; CI workflow references updated; README/docs references updated.
3. **All keep-decisions documented**: explicit rationale for why a `.sh` is preserved (e.g., bootstrap-class per `feedback_bash_compatibility_target_*`).
4. **CI green** across the cutover PRs — no regressions in lint, build, or test workflows.
5. **`tools/setup/install.sh` and bootstrap-class scripts preserved as bash** — the 4-shell-target compatibility (macOS 3.2 / Ubuntu / git-bash / WSL) for bootstrap is unchanged.
6. **Documentation updated**: any `tools/best-practices/repo-scripting.md` or equivalent that describes the migration status reflects completion.

## Out of scope

- **Bootstrap-class scripts** (`tools/setup/install.sh`, etc.) — explicitly preserved as bash.
- **F# code or src/ structure** — this row is about `tools/` only.
- **CI workflow language** — `.github/workflows/*.yml` is YAML, not in scope.
- **New TS-bun features** — only completing existing migrations, not adding scope.

## Composes with

- **B-0125** (skip-csharp-on-docs-only) — companion prerequisite to B-0132; both about clean separation before adding more.
- **B-0132** (CRDT-composition for BFT propagation) — depends on this row + B-0125; CRDT work shouldn't compound debt onto half-migrated tooling.
- **Task #341** (TS port + future git scripts: enforce 3-tier multi-remote design) — broader scope; this row is the completion sub-scope.
- **B-0122** (peer-call scripts TypeScript migration — post-install cutover) — peer-call-specific migration; this row covers the rest.
- **`feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_otto_235_2026_04_24.md`** — bash compatibility target for bootstrap-class scripts; this row preserves that boundary.
- **`feedback_otto_215_windows_via_peer_harness_not_ci_matrix_plus_bun_ts_post_install_migration_before_windows_work_otto_215_2026_04_24.md`** — Bun-TS post-install migration; this row's completion is the post-install side.
- **`feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`** — Otto picks the implementation cadence; framing-as-input not directive.

## Status

**In progress.** Phase 1 complete (2026-05-07): 19 dead .sh files
with .ts counterparts removed. 2 CI workflows updated to call .ts.

### Audit table (2026-05-07)

**KILL (done)** — .sh removed, .ts counterpart exists:

| .sh path | .ts path |
|----------|----------|
| tools/alignment/audit_archive_headers.sh | .ts |
| tools/alignment/audit_commit.sh | .ts |
| tools/alignment/audit_personas.sh | .ts |
| tools/alignment/audit_skills.sh | .ts |
| tools/alignment/citations.sh | .ts |
| tools/audit-packages.sh | .ts |
| tools/audit/live-lock-audit.sh | .ts |
| tools/backlog/generate-index.sh | .ts |
| tools/budget/daily-cost-report.sh | .ts |
| tools/budget/project-runway.sh | .ts |
| tools/budget/snapshot-burn.sh | .ts |
| tools/git/batch-resolve-pr-threads.sh | .ts |
| tools/git/push-with-retry.sh | .ts |
| tools/lint/doc-comment-history-audit.sh | .ts |
| tools/lint/no-directives-otto-prose.sh | .ts |
| tools/lint/runner-version-freshness.sh | .ts |
| tools/lint/safety-clause-audit.sh | .ts |
| tools/pr-preservation/archive-pr.sh | .ts |
| tools/skill-catalog/backfill_dv2_frontmatter.sh | .ts |

**PORTED (Phase 2, 2026-05-07):**

| .sh path | PR | Status |
|----------|-----|--------|
| tools/lanes/code-lane.sh | #1961 | merged |
| tools/lanes/doc-lane.sh | #1961 | merged |
| tools/lanes/lane-allocator.sh | #1961 | merged |
| tools/profile.sh | #1962 | merged |
| tools/hygiene/check-tick-history-shard-schema.sh | #1986 (Vera) | merged, .sh deleted |

**REMAINING (0 files — all ported in B-0156 PR):**

| .sh path | lines | CI-referenced | status |
|----------|-------|--------------|--------|
| tools/hygiene/check-github-settings-drift.sh | 83 | yes | ported to .ts, .sh deleted |
| tools/hygiene/snapshot-github-settings.sh | 165 | yes | ported to .ts, .sh deleted |
| tools/hygiene/audit-orphan-role-refs.sh | 322 | no | ported to .ts, .sh deleted |

**KEEP** — external dependencies (Lean4 .lake packages):
All `tools/lean4/.lake/packages/*/scripts/*.sh` — not our code.

**KEEP** — install-graph (Rule 0 boundary = Ace Package Manager):
All `tools/setup/**/*.sh` — the only bash that stays.

## Verify-before-deferring note

The audit step is itself the verify-before-state-claim discipline applied — don't claim "TS migration is done" or "bash is dead" without enumerating exactly which scripts are which. Aaron's framing names the *direction* (don't keep building debt); the *scope* needs the audit to be honest.
