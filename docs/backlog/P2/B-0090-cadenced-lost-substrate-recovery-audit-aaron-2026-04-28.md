---
id: B-0090
priority: P2
status: open
title: Cadenced lost-substrate recovery audit (worktrees + orphan branches + closed-not-merged PRs + draft PRs aged > N days)
tier: factory-hygiene
effort: M
ask: maintainer Aaron 2026-04-28T23ish *"probably a trajectory this is recovery work we should do forever on a cadence these kind of lost things could always build up"*
created: 2026-04-28
last_updated: 2026-04-28
composes_with:
  - B-0060
tags: [aaron-2026-04-28, factory-hygiene, lost-substrate, cadenced-audit, content-loss-surface, metric-ladder]
---

# B-0090 — Cadenced lost-substrate recovery audit

## Source

Aaron 2026-04-28T23ish, after Otto's audit of 57 locked
worktrees + the in-flight 19 LOST GitHub branches task (#264):

> *"probably a trajectory this is recovery work we should do
> forever on a cadence these kind of lost things could always
> build up."*

## Why P2

Lost substrate accumulates as a side effect of velocity. Without
a recurring audit, content-loss surface drifts upward
silently. The audit itself is cheap (Step 3 classification of
the metric ladder); the cost of letting it accumulate is
compounding.

## Substrate findings from worked example (2026-04-28)

Audit of 13 highest-promise locked worktree branches:

- 11/13 fully ALREADY-COVERED (every file exists on LFG main
  via bulk forward-sync paths)
- 2/13 with 1 NEW file each (NEEDS-FOLLOWUP for individual
  classification)
- ~12,000 lines diff vs. 4 files genuinely unrecovered
  → content-loss surface = 4 files

Pattern matches AceHack-vs-LFG forward-sync analysis (this
same session): bulk forward-syncs do their job at file level
even when branch-level SHA divergence persists.

Full worked example in
`memory/feedback_lost_substrate_recovery_cadenced_trajectory_aaron_2026_04_28.md`.

## Scope

### Audit surfaces

1. **Locked worktree branches** under `.claude/worktrees/`
   (currently 57; pruning candidate).
2. **Closed-not-merged PRs** on AceHack and LFG (task #264
   tracking 14 such on AceHack).
3. **Orphan branches** — branches with no remote tracking
   (task #264 tracking 5 such).
4. **Draft PRs aged > 14 days** — opened-with-intent that
   stalled.

### Audit cadence (starting point, calibrate per throughput)

- **Weekly:** worktree-branch scan + closed-not-merged-PR
  scan (last 7 days).
- **Monthly:** deeper sweep — orphan branches + draft PRs >
  14 days + cumulative metric-ladder analysis on
  per-branch content-loss surface.
- **On-demand:** any time a "what happened to X?" question
  surfaces.

### Audit deliverable per cycle

A 3-bucket classification per surface item:

- **ALREADY-COVERED** — substrate exists on main via
  different commit path. No action; cite LFG equivalent.
- **NEEDS-RECOVERY** — substrate is genuinely unique. File
  backlog row or open PR to recover.
- **OBSOLETE** — substrate was intentionally retired or
  superseded. Mark for confident retirement (delete worktree,
  close orphan branch, etc.).

### Triage protocol

For each NEEDS-RECOVERY item:

1. Open backlog row OR PR with cherry-pick.
2. If author authorization needed (per visibility-constraint
   + authority rule), surface to Aaron with evidence-based
   classification.
3. If low-risk additive, open LFG PR automatically per the
   authority rule's NEEDS-FORWARD-SYNC default action.

For each OBSOLETE item:

1. Document the retirement rationale (cite the rename, the
   superseding PR, the intentional-deferral memory, etc.).
2. Delete the worktree / close the orphan branch / dismiss
   the draft PR.
3. Reduce the audit surface for the next cycle.

For each ALREADY-COVERED item:

1. Cite the LFG equivalent (commit SHA, PR number, file
   path).
2. Optionally delete the redundant worktree / close the
   redundant draft PR.
3. Increase confidence in next cycle's prior.

## Specific NEEDS-FOLLOWUP from 2026-04-28 audit

These came out of the worked example and remain open for
individual classification:

1. `ci/final-matrix-macos-26-ubuntu-24-plus-arm-plus-slim` — 1 NEW file in 10-file branch. Likely `nightly-low-memory.yml` or similar matrix work; check if superseded by current `low-memory.yml` (renamed per Aaron 2026-04-27).
2. `feat/graph-cohesion-exclusivity-conductance` — 1 NEW file in 3-file branch. Graph-algorithm work; check against current Aurora substrate + `feat/graph-cohesion-conductance-plus-windowed-stake-covariance` (companion branch, 0 NEW).
3. `feat/live-lock-audit-and-db-gaps` — 2 NEW files in `samples/<retired-CRM-naming>/` (early-iteration sample dir using brand-bleed naming that's been deprecated per the external-UI-demo discipline; see `memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md`). Likely intentionally OBSOLETE per task #244 (Factory-demo — generic-name rename); confirm.

Each becomes a sibling backlog row when scoping firms up.

## Acceptance

- [ ] Cadence encoded as a routine (cron / scheduled task / round-cadence reminder).
- [ ] Audit produces standard 3-bucket classification per cycle.
- [ ] NEEDS-RECOVERY items routed to backlog rows or PRs.
- [ ] OBSOLETE items retired with rationale.
- [ ] Each cycle adds an entry to `docs/hygiene-history/` (or equivalent) for trajectory tracking.

## Composes with

- `memory/feedback_lost_substrate_recovery_cadenced_trajectory_aaron_2026_04_28.md`
  — the framing memory; this row is its operational backlog
  item.
- `memory/feedback_reset_readiness_metric_ladder_content_loss_surface_amara_2026_04_28.md`
  — the metric ladder this audit walks per cycle.
- `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`
  — the authority rule that authorizes audit-driven
  classification + selective recovery.
- Task #264 (Recover 19 LOST branches: 14 CLOSED-NOT-MERGED
  + 5 ORPHAN) — first concrete instance to process under
  the new cadence.

## Why M effort

Setting up the cadence (cron job, audit tooling, classification
documentation) is M-effort. Each individual cycle after that
should be S-effort once the tooling is in place.

The first cycle (this 2026-04-28 audit) ate larger because
it was establishing the pattern + processing 57 worktrees +
13 high-promise classifications + 19 GitHub LOST branches in
one pass. Future cycles operate on the **delta** since last
audit, not the cumulative backlog.

## What this row does NOT authorize

- **Does NOT** authorize bulk worktree pruning. Each branch
  needs Step 3 content-equivalence classification first.
- **Does NOT** authorize closing orphan branches without
  audit. Orphans may carry substrate.
- **Does NOT** replace task #264. Task #264 is the first
  concrete cycle; this row is the cadence framework that
  ensures future cycles happen.
