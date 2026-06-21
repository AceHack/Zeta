# 081KQZVQW0008QG0R001FG05RZ Lifecycle-Residue Freshness Classifier - 2026-05-31

## Status

Implemented as a bounded incident-gate refinement.

## Provenance

- Surface: local desktop loop
- Origin: Codex harness
- Claim: `claim/task-b0250-lifecycle-residue-freshness`
- Calibration source:
  `docs/trajectories/autonomous-loop-coordination/b0250-loop-run-lifecycle-age-out-calibration-2026-05-31.md`

## Implementation

`tools/health/factory-health-monitor.ts` now classifies Codex loop-run
claim-increase events by freshness before they can satisfy the
incident-grade stronger-source gate.

Fresh loop-run claim increases keep source `loop-run`, so they still escalate
when they join another trajectory event inside the coincidence window. Old
completed loop-run claim increases remain in the coincidence event stream but
are marked `source: "unknown"` with a `lifecycle-residue` description suffix,
so they stay visible in warning/debug output without keeping the lane in
critical state.

The freshness window is the existing current-response coincidence window:
`FACTORY_EVENT_COINCIDENCE_WINDOW_MS`. The classifier compares that window
against the after-heartbeat timestamp, because the claim-count increase is
observed in that heartbeat snapshot. The emitted event's `occurredAt` value
uses the same after-heartbeat timestamp so source classification and event
time describe the same observation.

## Live Output

Command:

```bash
bun tools/health/factory-health-monitor.ts --json | jq '{summary, coincidence: [.signals[] | select(.surface | startswith("coincidence"))]}'
```

Observed summary after the patch:

- 8 ok signals
- 25 warning signals
- 0 critical signals

The historical `otto:merged-pr-6129` plus
`codex:loop-run-20260530T170632Z` window remains visible in
`coincidence-debug`, but no `coincidence-incident` signal is emitted.

## Verification

- `bun test tools/health/factory-health-monitor.test.ts`
- `bun tools/health/factory-health-monitor.ts --json | jq '{summary, coincidence: [.signals[] | select(.surface | startswith("coincidence"))]}'`
- `git diff --check`
