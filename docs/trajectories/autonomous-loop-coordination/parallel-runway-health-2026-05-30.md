# Parallel Runway Health Receipt - 2026-05-30

Status: implementation slice in review
Surface: codex-background-service
Origin: codex-launchd-loop
Session: codex/launchd-loop
Run ID: 20260530T040934Z
Claim: `claim/codex-loop-b0249-parallel-runway-health-20260530`
Grounding backlog:
`docs/backlog/P0/081KQZVQW0008QG0R000C35RNY-autonomous-backlog-pickup-self-sustaining-new-work-2026-05-07.md`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/local-worktree-dirt-health-2026-05-30.md`

## Scope

This packet adds a bounded Codex parallel-runway signal to the factory health
monitor.

The existing lane-runway classifier answers whether each lane has open PRs or
active claims. That is necessary, but it can still report a healthy quiet
Codex lane when 081KQZVQW0008QG0R000C35RNY says the loop should keep at least one bounded work item
in flight and target roughly two.

## Rule

`tools/health/factory-health-monitor.ts` now exports
`classifyParallelRunway`. The classifier counts lane-owned open PR branches and
active claim branches as active runway items.

For Codex, the monitor uses:

- minimum active items: 1
- target active items: 2

If Codex has no active item, the monitor emits a `lane-runway` warning that
the loop should open or advance a bounded Codex PR before treating the lane as
idle. If Codex has one active item, the monitor records that the lane is above
the hard minimum but below target. If Codex has two or more active items, the
target is met.

## Operational Reading

This signal is advisory and bounded. It does not authorize overlapping claims,
root-checkout writes, duplicate backlog rows, or bypassing CI/review. It only
prevents a healthy Codex service with zero owned runway from being interpreted
as complete.

## Verification

Focused tests cover:

- warning when Codex has no active item
- ok signal when Codex is above the hard minimum but below target
- ok signal when Codex reaches the target

## Follow-Up

Use this signal during quiet-lane windows to decide whether the next safe step
is new bounded Codex work, stale-claim cleanup, or waiting on an existing
claim/PR.
