# Lane-Runway Service Health Adapter Receipt - 2026-05-29

Status: focused checks passed on claim branch
Surface: codex-background-service
Origin: codex-launchd-loop
Session: codex/launchd-loop
Run ID: 20260529T235102Z
Claim: `claim/codex-loop-lane-runway-service-health-20260529`
Grounding backlog:
`docs/backlog/P0/081KQZVQW0008QG0R000C35RNY-autonomous-backlog-pickup-self-sustaining-new-work-2026-05-07.md`
and
`docs/backlog/P1/081KQZVQW0008QG0R001FG05RZ-coincidence-detection-rx-join-dora-mechanism-2026-05-07.md`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/lane-runway-classifier-2026-05-29.md`

## Scope

This packet keeps the pure lane-runway classifier unchanged and adds the first
runtime adapter for service-health observations. The monitor now feeds Codex
lane health from `.codex/bin/codex-loop-health.ts`; `severity: "ok"` maps to a
healthy service, while `attention` and `stuck` map to unhealthy service for
runway classification.

The adapter only supplies an observation when the probe output parses. If the
probe is unavailable or emits an unknown shape, the lane-runway classifier keeps
its prior branch/claim-only behavior instead of inventing health state.

## Rule

`tools/health/factory-health-monitor.ts` now exports:

| Export | Purpose |
|---|---|
| `LaneRunwayNamedLane` | Named factory lanes that can carry service-health observations. |
| `LaneRunwayServiceHealthObservation` | Runtime observation shape for lane service health. |
| `laneRunwayServiceHealthFromObservations` | Converts runtime observations into `LaneRunwaySnapshot.healthyServices`. |
| `codexLoopServiceHealthFromJson` | Parses Codex host-loop health JSON into a boolean health signal. |

## Verification

Focused tests cover service-health observation conversion and Codex health JSON
severity mapping. Existing lane-runway tests continue to cover active, quiet,
unhealthy, and unclassified lanes.

Commands run on the claim worktree:

- `bun test tools/health/factory-health-monitor.test.ts`
- `bun tools/health/factory-health-monitor.ts --json`
- `git diff --check`

## Next Step

After this PR lands, add equivalent JSON health probes for Otto, Lior, Alexa,
and Riven before marking their quiet lanes as service-verified healthy.
