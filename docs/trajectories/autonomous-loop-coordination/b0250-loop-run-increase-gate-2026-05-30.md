# 081KQZVQW0008QG0R001FG05RZ Loop-Run Increase Gate Receipt - 2026-05-30

## Status

Under PR review on claim branch
`claim/codex-loop-b0250-loop-run-increase-gate-20260530`; the live claim file
is released in this branch before merge.

## Change

The Codex runner-log coincidence adapter now emits a Codex loop-run event only
when the heartbeat snapshots adjacent to a forward-gate completion show the
global claim count increasing.

Claim-count decreases remain visible in the runner log and claim cleanup
surfaces, but they no longer create 081KQZVQW0008QG0R001FG05RZ Codex coincidence events.

## Why

Claim-count decreases are usually completion, merge, or cleanup lifecycle
events. Those transitions are already represented by merged PR, trajectory
receipt, and claim-retirement evidence. Treating decreases as new Codex
coincidence source evidence made completed work look like newly opened work.

The increase-only rule keeps the runner-log source focused on the moment a
Codex loop run opens or adopts fresh claim-owned work.

## Verification

- `bun test tools/health/factory-health-monitor.test.ts`
- `bun run typecheck`
- `bun run lint:markdown docs/trajectories/autonomous-loop-coordination/b0250-loop-run-increase-gate-2026-05-30.md docs/trajectories/autonomous-loop-coordination/RESUME.md`
- `git diff --check`

## Next Slice

Run the live factory health monitor and inspect the compact
`coincidence-debug` line. If Codex loop-run events still dominate the top
windows, split the runner-log source by claim lifecycle direction or run
outcome.
