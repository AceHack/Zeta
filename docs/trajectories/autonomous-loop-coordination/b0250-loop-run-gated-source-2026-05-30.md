# B-0250 Loop-Run Gated Source Receipt - 2026-05-30

## Status

Landed in claim branch `claim/codex-b0250-loop-run-gating-20260530`.

## Change

The Codex loop-run coincidence source no longer emits an event for every
`codex forward gate end` line in the local runner log. It now requires adjacent
`heartbeat complete` snapshots around the gate completion and emits only when
the surrounding snapshots show a claim-count or open-PR-count transition.

## Why

The first loop-run source was useful evidence that the Codex loop participated
in a time window, but it also counted ordinary forward-gate completions. Those
generic completions inflated B-0250 coincidence windows even when no visible
claim or PR publication changed.

This packet keeps loop-run evidence in the join while narrowing it to a
publish-like transition that the existing heartbeat line already exposes.

## Limits

This is a conservative proxy, not semantic proof of exactly what the gate did.
It can miss a useful gate completion when the surrounding heartbeat counts do
not change. That is acceptable for this slice because the target is to reduce
false-positive coincidence noise before adding another event source.

## Next Slice

Add a compact debug surface for the top coincidence windows so future B-0250
tuning can inspect the remaining sources without reading raw JSON manually.
