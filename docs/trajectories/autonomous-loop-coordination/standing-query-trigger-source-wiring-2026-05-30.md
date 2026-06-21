# Standing-Query Trigger Source Wiring - 2026-05-30

Status: PR-ready source wiring
Claim: `claim/codex-loop-standing-query-trigger-sources-20260530`
Grounding backlog:
`docs/backlog/P1/081KQZVQW0008QG0R001FG05RZ-coincidence-detection-rx-join-dora-mechanism-2026-05-07.md`
Predecessor:
`docs/trajectories/autonomous-loop-coordination/standing-query-trigger-inventory-2026-05-29.md`

## Boundary

This patch does not add a new runner action and does not change which probes
the factory health monitor runs. It makes the existing probes explicit
standing-query trigger sources so future coincidence detection work can compose
sources without re-opening each side-effecting probe.

## What Changed

- Added `StandingQueryTriggerSource` as the small source contract:
  a source has a surface, a collector, and an optional failure action.
- Added `collectStandingQuerySignals`, which preserves source order and turns a
  throwing source into a bounded warning signal instead of aborting the whole
  health report.
- Rewired `runHealthCheck` through `buildStandingQueryTriggerSources` so the
  current lane-runway, PR queue, backlog, claims, working-tree, trajectory,
  lost-file, and cadence checks are registered through one source layer.
- Added deterministic tests for source ordering and source failure bounding.

## Verification

- `bun test tools/health/factory-health-monitor.test.ts`
- `FACTORY_HEALTH_WORKTREE_DIRT_LIMIT=0 bun tools/health/factory-health-monitor.ts --json`

## Next Use

The next 081KQZVQW0008QG0R001FG05RZ slice can add an event-window source that consumes recent
trajectory and PR events, emits a coincidence signal, and plugs into the same
source collection layer without changing the existing monitor contract.
