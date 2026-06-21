# 081KQZVQW0008QG0R001FG05RZ PR Blocker Live-Output Calibration - 2026-05-30

## Status

Prepared as a bounded monitor calibration receipt.

## Provenance

- Surface: codex-background-service
- Origin: codex-launchd-loop
- Claim Run ID: 20260530T234235Z
- Calibration run observed at: 2026-05-31T01:21:30Z

## Live Output

Command:

```bash
bun tools/health/factory-health-monitor.ts --json
```

Observed summary:

- 11 ok signals
- 22 warning signals
- 1 critical signal

The critical signal was:

- Surface: `coincidence-incident`
- Message: `1 incident-grade coincidence window(s) detected`
- Action: `investigate stronger-source coincidence before treating it as queue-drain noise`

The compact incident debug line identified the live stronger-source window:

- Window: `2026-05-30T17:08:34.000Z..2026-05-30T17:13:34.000Z`
- Trajectories: `codex+otto`
- Events: `otto:merged-pr-6129`, `codex:loop-run-20260530T170632Z`

## Calibration

The PR blocker source join is wired into live monitor output, but this run did
not surface a current PR-review or failed-gate incident. Direct GitHub
inspection after the monitor run returned zero open PRs, so there was no live
open-PR blocker source for the adapter to emit.

The remaining incident-grade window is a stronger-source loop-run plus merged
PR adjacency. That is expected under the current escalation rule because
loop-run claim increases are intentionally incident-grade while pure merged-PR
adjacency remains warning-grade.

## Decision

Keep `pr-review-blocker` and `failed-gate` in the stronger-source set. The live
calibration did not produce evidence that same-PR blocker deduplication is too
weak or that PR-blocker events are inflating the current incident count.

## Next Bounded Slice

Add a bounded explicit broadcast-blocker adapter only if the bus carries a
fresh blocker with enough structure to map it into `CoincidenceEvent`. The next
slice should not treat stale local broadcast notes as authoritative remote
blockers.

## Verification

- `bun tools/health/factory-health-monitor.ts --json`
- `gh pr list --repo Lucent-Financial-Group/Zeta --state open --limit 20 --json number,headRefName,title,updatedAt,mergeStateStatus`
