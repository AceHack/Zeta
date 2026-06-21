# 081KQZVQW0008QG0R001FG05RZ Loop-Run Lifecycle Age-Out Calibration - 2026-05-31

## Status

Prepared as a bounded lifecycle calibration receipt.

## Provenance

- Surface: desktop heartbeat `vera-desktop-loop`
- Origin: Codex harness
- Claim: `claim/task-b0250-loop-run-lifecycle-age-out-calibration`
- Calibration run observed at: 2026-05-31T04:30Z

## Live Output

Command:

```bash
bun tools/health/factory-health-monitor.ts --json
```

Observed summary:

- 9 ok signals
- 25 warning signals
- 1 critical signal

The critical signal was:

- Surface: `coincidence-incident`
- Message: `1 incident-grade coincidence window(s) detected`
- Action: `investigate stronger-source coincidence before treating it as
  queue-drain noise`

The compact incident debug line still identified the same historical
stronger-source window recorded by the PR-blocker and broadcast-blocker live
calibration packets:

- Window: `2026-05-30T17:08:34.000Z..2026-05-30T17:13:34.000Z`
- Trajectories: `codex+otto`
- Events: `otto:merged-pr-6129`, `codex:loop-run-20260530T170632Z`

Corroborating evidence:

- PR #6129 is merged as `d7a8cb4f889e1ef903f5a6677131e3f5c11d3ced`.
- The Codex runner log records `20260530T170632Z` starting at
  2026-05-30T17:06:33Z and ending successfully at 2026-05-30T17:09:33Z.
- The same incident remained present roughly 11 hours after the loop-run
  completed.

## Calibration

The remaining critical window is not evidence of an active PR blocker,
failed gate, broadcast blocker, or current Codex claim escalation. It is
historical lifecycle residue: a successful Codex loop-run claim-increase event
still joins with a nearby merged Otto PR after both events have already been
handled by their normal durable surfaces.

Keep loop-run claim increases in the stronger-source set for fresh events.
They are useful when a Codex loop opens or adopts fresh claim-owned work near
another trajectory event. Do not let the same completed run remain
incident-grade indefinitely after the run has finished and no live claim or
PR blocker keeps it actionable.

## Decision

Classify old loop-run claim-increase events as `lifecycle-residue` once both
conditions hold:

- the run is complete, and
- the event is older than the bounded freshness window used for current
  coordination response.

Lifecycle-residue should remain visible in warning/debug output for audit, but
should not satisfy the `coincidence-incident` stronger-source escalation gate.
This preserves the original safety property for fresh loop-run claim
increases while preventing a completed historical run from keeping the lane in
critical state.

## Next Bounded Slice

Implement the freshness classifier in the coincidence source or escalation
gate, with deterministic tests for:

- a fresh loop-run claim increase still escalates with another trajectory,
- an old completed loop-run claim increase demotes to debug/warning only, and
- non-loop stronger sources such as failed gates, PR review blockers, and
  explicit broadcast blockers keep their current incident behavior.

## Verification

- `bun tools/health/factory-health-monitor.ts --json`
- `gh pr view 6129 --json number,state,mergedAt,mergeCommit,headRefName,title,url`
- `rg -n "20260530T170632|17:06:32|6129|claim-count|claim count|loop-run" /Users/acehack/Library/Logs/zeta-codex-loop/runner.log docs/trajectories/autonomous-loop-coordination -g '*.md'`
