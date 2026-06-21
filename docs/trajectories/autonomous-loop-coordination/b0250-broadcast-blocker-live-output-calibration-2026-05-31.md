# 081KQZVQW0008QG0R001FG05RZ Broadcast Blocker Live-Output Calibration - 2026-05-31

## Status

Prepared as a bounded monitor calibration receipt.

## Provenance

- Surface: desktop heartbeat `vera-desktop-loop`
- Origin: Codex harness
- Claim: `claim/task-b0250-broadcast-live-calibration-packet`
- Calibration run observed at: 2026-05-31T04:10:04Z

## Live Output

Command:

```bash
bun tools/health/factory-health-monitor.ts --json
```

Observed summary:

- 9 ok signals
- 24 warning signals
- 1 critical signal

The critical signal was:

- Surface: `coincidence-incident`
- Message: `1 incident-grade coincidence window(s) detected`
- Action: `investigate stronger-source coincidence before treating it as queue-drain noise`

The compact incident debug line identified the same live stronger-source
window recorded before the broadcast-blocker adapter:

- Window: `2026-05-30T17:08:34.000Z..2026-05-30T17:13:34.000Z`
- Trajectories: `codex+otto`
- Events: `otto:merged-pr-6129`, `codex:loop-run-20260530T170632Z`

## Calibration

The structured broadcast-blocker adapter is wired into the live monitor and was
quiet in this run. No `broadcast-blocker` event appeared in either the
incident-grade debug surface or the warning-grade coincidence debug surface.

That is the expected result for the current local environment: the adapter only
converts fresh structured JSON bus envelopes with explicit blocker fields. The
human-readable markdown broadcasts remain coordination input for agents, but do
not become 081KQZVQW0008QG0R001FG05RZ event evidence.

## Decision

Keep `broadcast-blocker` in the stronger-source set. The live calibration did
not produce evidence that the adapter inflates incident windows or converts
stale free-form bus notes into authoritative coincidence events.

The remaining incident-grade window is unchanged from the PR-blocker live
calibration: `otto:merged-pr-6129` joined with
`codex:loop-run-20260530T170632Z`. Further tuning should target that
stronger-source lifecycle, not the broadcast-blocker adapter.

## Verification

- `bun tools/health/factory-health-monitor.ts --json`
- `gh pr list --state open --json number,headRefName,isDraft,mergeStateStatus,statusCheckRollup --limit 100`
- `git diff --check`

## Next Bounded Slice

Decide whether old loop-run claim-increase events should age out or be
classified separately once their associated PR and claim branch have already
merged and cleaned up.
