# 081KQZVQW0008QG0R001FG05RZ Loop-Run Claim Gate Receipt - 2026-05-30

## Status

Under PR review on claim branch
`claim/codex-loop-b0250-loop-run-claim-gate-20260530`; the live claim file is
released in this branch before merge.

## Change

The Codex runner-log coincidence adapter now requires a claim-count transition
across the heartbeat snapshots adjacent to a forward-gate completion. A
transition in `open_prs` alone no longer emits a `codex` `CoincidenceEvent`.

The event description still includes both claim and open-PR counts when an
event is emitted, so the retained events remain diagnosable.

## Why

The compact debug surface showed a `codex+otto` coincidence window where the
Codex loop-run event was caused by global open-PR churn, not Codex-owned work.
That made peer-lane PR activity look like Codex source evidence in the 081KQZVQW0008QG0R001FG05RZ
event join.

Claim-count movement is the narrower signal for Codex loop ownership. Generic
open-PR movement remains visible in runner logs and lane-runway health, but it
is too broad for this coincidence source.

## Verification

- `bun test tools/health/factory-health-monitor.test.ts`
- `bun run typecheck`
- `bun run lint:markdown docs/trajectories/autonomous-loop-coordination/b0250-loop-run-claim-gate-2026-05-30.md docs/trajectories/autonomous-loop-coordination/RESUME.md`
- `git diff --check`
- `bun tools/health/factory-health-monitor.ts --json`

## Next Slice

After this lands, run the live factory health monitor and inspect the compact
`coincidence-debug` line. If Codex loop-run events still dominate the top
windows, split the runner-log source further by run outcome or local claim
lifecycle.
