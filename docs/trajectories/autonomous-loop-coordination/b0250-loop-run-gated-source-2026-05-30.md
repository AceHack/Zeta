# 081KQZVQW0008QG0R001FG05RZ Loop-Run Gated Source Receipt - 2026-05-30

## Status

Landed in claim branch `claim/codex-b0250-loop-run-gating-20260530`.
Superseded by
`docs/trajectories/autonomous-loop-coordination/b0250-loop-run-claim-gate-2026-05-30.md`,
which requires a claim-count transition and no longer emits on
open-PR-only churn.

## Change

The Codex loop-run coincidence source no longer emits an event for every
`codex forward gate end` line in the local runner log. This receipt narrowed
the source to adjacent `heartbeat complete` snapshots around the gate
completion whose surrounding snapshots showed a broad count transition. The
later claim-gate receipt narrows this again to claim-count transitions only.

## Why

The first loop-run source was useful evidence that the Codex loop participated
in a time window, but it also counted ordinary forward-gate completions. Those
generic completions inflated 081KQZVQW0008QG0R001FG05RZ coincidence windows even when no visible
claim or PR publication changed.

This packet keeps loop-run evidence in the join while narrowing it to a
publish-like transition that the existing heartbeat line already exposes.

## Limits

This is a conservative proxy, not semantic proof of exactly what the gate did.
It can miss a useful gate completion when the surrounding heartbeat counts do
not change. That is acceptable for this slice because the target is to reduce
false-positive coincidence noise before adding another event source.

## Next Slice

Add a compact debug surface for the top coincidence windows so future 081KQZVQW0008QG0R001FG05RZ
tuning can inspect the remaining sources without reading raw JSON manually.
