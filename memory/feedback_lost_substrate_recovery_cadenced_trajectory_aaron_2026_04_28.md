---
name: Lost-substrate recovery is a cadenced trajectory, not a one-time task (Aaron, 2026-04-28)
description: Aaron 2026-04-28 framing — *"probably a trajectory this is recovery work we should do forever on a cadence these kind of lost things could always build up."* Lost-substrate recovery (closed-not-merged PRs, orphan branches, locked worktrees, draft PRs that never landed) accumulates continuously as a side effect of parallel work; needs cadenced audit, not one-time cleanup. Pairs with the metric ladder + authority rule — recovery audits use Step 3 content-equivalence classification to separate truly-lost substrate from ALREADY-COVERED-via-bulk-sync work.
type: feedback
---

# Lost-substrate recovery is a cadenced trajectory

## The framing (Aaron 2026-04-28)

> *"probably a trajectory this is recovery work we should do
> forever on a cadence these kind of lost things could always
> build up."*

Lost substrate is not a one-time backlog item; it's a **steady-
state side effect** of parallel work. The factory continuously
produces:

- **Closed-not-merged PRs** — work that was started, then
  superseded, abandoned, or rejected without explicit
  retention decision.
- **Orphan branches** — branches with no remote tracking,
  often surviving on a contributor's local checkout but
  invisible to the repo.
- **Locked worktrees** — agent-isolation worktrees from
  parallel subagent dispatch that never had their substrate
  merged back to main.
- **Draft PRs that aged out** — PRs opened with intent to
  ship, then displaced by other priorities and forgotten.

Each of these is a **content-loss-surface unit** in the
metric-ladder sense (`memory/feedback_reset_readiness_metric_ladder_content_loss_surface_amara_2026_04_28.md`).
Without recovery cadence, they accumulate; the content-loss
surface drifts upward as a side effect of velocity.

## Cadenced audit discipline

The fix is not "recover all lost things now" but "schedule
recurring audits." The audit produces three outputs:

1. **ALREADY-COVERED** — substrate exists on main via
   different commit path (bulk forward-sync, separate PR,
   etc.). No action needed; mark for confidence.
2. **NEEDS-RECOVERY** — substrate is genuinely unique;
   open backlog row or PR to recover it.
3. **OBSOLETE** — substrate was intentionally retired or
   superseded; mark for confidence + closure of the lost
   ref.

Cadence (proposed):

- **Weekly:** quick scan of worktree branches + recently-
  closed-not-merged PRs.
- **Monthly:** deeper sweep that includes orphan branches +
  draft PRs aged > 14 days.
- **On-demand:** any time a "what happened to X?" question
  surfaces, run the audit on the named substrate.

## Worked example — this session's worktree audit (2026-04-28)

**Triggering ask:** Aaron's "look for lost things... and
worktrees" (after the AceHack/LFG forward-sync work).

**Surface:** 57 locked worktree branches in
`.claude/worktrees/`, ~12,000 lines of diff against
`origin/main` across the 13 highest-promise (feat/, craft/,
backlog/, frontier-readiness/, docs/, ci/, tools/) branches.

**Audit results** (Step 3 content-equivalence classification):

| Branch | Files | NEW (genuinely unrecovered) | Status |
|---|---|---|---|
| `feat/live-lock-audit-and-db-gaps` | 31 | 2 (`samples/ServiceTitanCrm/*`) | ALREADY-COVERED + 2 OBSOLETE (renamed per task #244) |
| `tools/pr-preservation-phase-2-minimal` | 14 | 0 | ALREADY-COVERED |
| `feat/servicetitan-factory-demo-api-csharp` | 17 | 0 | ALREADY-COVERED (renamed per task #244) |
| `craft/production-dotnet-checked-vs-unchecked-v0` | 3 | 0 | ALREADY-COVERED |
| `ci/final-matrix-macos-26-ubuntu-24-plus-arm-plus-slim` | 10 | 1 | NEEDS-FOLLOWUP — single new file, low scope |
| `feat/graph-cohesion-exclusivity-conductance` | 3 | 1 | NEEDS-FOLLOWUP — single new file |
| `docs/adr-per-maintainer-current-memory` | 1 | 0 | ALREADY-COVERED |
| `feat/graph-cohesion-conductance-plus-windowed-stake-covariance` | 2 | 0 | ALREADY-COVERED |
| `frontier-readiness/audit-planning-files-batch` | 2 | 0 | ALREADY-COVERED |
| `frontier-readiness/audit-tech-radar-and-factory-hygiene` | 1 | 0 | ALREADY-COVERED |
| `frontier-readiness/audit-alignment-md` | 1 | 0 | ALREADY-COVERED |
| `backlog/pre-landing-sanitizer-for-ferry-lint` | 1 | 0 | ALREADY-COVERED |
| `backlog/claude-cli-agent-flag-research-map` | 1 | 0 | ALREADY-COVERED |
| **Total: 13 branches** | **87 files** | **4 NEW** | 11/13 fully ALREADY-COVERED |

**Content-loss-surface for these 13 branches: 4 files.**

Out of ~12,000 lines, the genuinely unrecovered substrate is
4 files. The bulk forward-syncs did their job; the sample-
panic ("57 worktrees of lost work!") was the same Goodhart
trap as commit-count panic — sample-of-branches looked huge,
content-equivalence revealed almost everything covered.

Per the metric ladder:

- Step 1 (count): 57 worktrees → "lots of lost work" (panic)
- Step 2 (tree-numstat): 12,000+ lines → "concerning"
- Step 3 (content-equivalence): 4 NEW files → "almost
  everything covered"
- Step 4 (peer review): not done; could surface unique
  substrate Step 3 missed — schedule for the next cadenced
  audit.

## How this composes with prior rules

- **Reset-readiness metric ladder** — same 4-step ladder
  applies here. Don't reset/prune worktrees on count alone.
- **Authority rule (default to reversible preservation)** —
  the 4 NEW files get individual classification, not bulk
  retirement. Per-item Aaron decision for OBSOLETE
  classification; default action for ALREADY-COVERED is
  "no action."
- **Content-loss surface supersedes divergence count** —
  the operational metric for cadenced audit triage.
- **Class-Count Validity Drift** — counting "57 lost
  worktrees" is the count-as-evidence failure mode this
  audit avoids.

## Earns a backlog row

Filed as **B-0090**: cadenced lost-substrate audit. Specifies:

- Weekly worktree audit (quick scan).
- Monthly orphan-branch + closed-not-merged-PR audit.
- Audit produces 3-bucket classification, surfaces
  NEEDS-RECOVERY items as new PRs / backlog rows.

## Beads earned

Per Class Validation Beads accounting:

| Class | Beads | Mechanism |
|---|---|---|
| Reset-Readiness Metric Ladder | +1 | applied to worktree-recovery surface; Step 3 classification produced 13× content-loss reduction (12,000 lines → 4 files) |
| Content-Loss Surface Supersedes Divergence Count | +1 | predicted result; observation matches |
| Authority Rule (default to preservation) | +1 | preserved 12 fully-covered branches by classification rather than blind prune |
| Class-Count Validity Drift | +1 | caught the "57 worktrees of lost work" count-as-evidence trap |

## What this rule does NOT do

- **Does NOT** authorize bulk worktree pruning. Each
  worktree branch may have substrate; classification
  required.
- **Does NOT** apply only to worktrees. Also covers
  closed-not-merged PRs, orphan branches, draft PRs.
- **Does NOT** require the cadence to be exactly weekly /
  monthly. The numbers are starting points; calibrate to
  factory throughput.
- **Does NOT** require recovering every lost substrate
  item. OBSOLETE is a valid classification; intentional
  retirement counts as recovery (recovered the decision
  to retire, not the content).

## Pickup for future Otto

When a cadenced audit fires:

1. Walk the metric ladder for the audit surface.
2. Step 1 (count): how many lost-substrate items?
3. Step 2 (tree-numstat): what's the diff scope?
4. Step 3 (content-equivalence): per-item classification
   into ALREADY-COVERED / NEEDS-RECOVERY / OBSOLETE.
5. NEEDS-RECOVERY items → file backlog rows or open PRs.
6. OBSOLETE items → mark for confident retirement (delete
   worktree, close orphan branch, etc.).
7. ALREADY-COVERED → mark for confidence in the audit log.

When asked "what happened to X?":

1. Run the audit on the named substrate.
2. Cite which classification it falls into + evidence.

## Direct Aaron framing

> *"probably a trajectory this is recovery work we should do
> forever on a cadence these kind of lost things could
> always build up."*
