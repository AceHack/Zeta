# Claim-Path Collision Health Receipt - 2026-05-30

Status: focused checks passed on claim branch
Surface: codex-background-service
Origin: codex-launchd-loop
Session: codex/launchd-loop
Run ID: 20260530T025330Z
Claim: `claim/codex-loop-claim-path-collision-health-20260530`
Grounding backlog:
`docs/backlog/P1/081KQZVQW0008QG0R001FG05RZ-coincidence-detection-rx-join-dora-mechanism-2026-05-07.md`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/lane-runway-service-health-adapter-2026-05-29.md`

## Scope

This packet adds a reusable lane-runway signal for claim-path collision
evidence. It keeps local broadcasts out of the authority path and reads remote
claim files as the first evidence surface.

The monitor now parses both historical claim headings:

- `Initial intended path set:`
- `Planned path set:`

It detects exact overlaps and conservative directory-glob overlaps such as
`tools/health/**` colliding with `tools/health/factory-health-monitor.ts`.

## Rule

`tools/health/factory-health-monitor.ts` now exports:

| Export                        | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `ClaimPathSetObservation`     | Claim branch plus parsed path ownership evidence.              |
| `ClaimPathCollision`          | Normalized collision report for one path overlap.              |
| `parseClaimPathSet`           | Extracts claim-owned paths from supported claim file headings. |
| `findClaimPathCollisions`     | Finds exact and conservative glob overlaps across claims.      |
| `classifyClaimPathCollisions` | Emits `lane-runway` warnings for path ownership collisions.    |

## Verification

Focused checks for this packet:

- `bun test tools/health/factory-health-monitor.test.ts`
- `bun tools/health/factory-health-monitor.ts --json`
- `git diff --check`

## Next Step

After this PR lands, add secondary local-worktree dirt evidence for cases where
remote claim files are clean but same-machine worktrees carry uncommitted edits
inside another active claim's path set.
