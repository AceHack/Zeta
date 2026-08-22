---
id: 081M065HQKT087G0R0033B3GTD
type: bug
state: backlog
priority: P2
slug: zetatransportcell-a-time-dilated-transport-never-recovers-di
title: "ZetaTransportCell: a time-dilated transport never recovers — dilationFactor is written only in the failure branch, so a healed lane stays skipped forever"
created: 2026-08-16T20:52:25.850Z
depends_on: []
composes_with: []
---

# ZetaTransportCell: a time-dilated transport never recovers — dilationFactor is written only in the failure branch, so a healed lane stays skipped forever

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M065HQKT087G0R0033B3GTD-*.md` glob. -->

## What

`ZetaTransportCell.send` writes `desc.dilationFactor` at exactly one site
(`src/Core.TypeScript/discovery/zeta-transport-cell.ts:231`), inside the `catch` branch. The success
path (`:196`) advances `desc.quasiState` but never copies the recomputed `dilationFactor` back onto the
descriptor.

`send` then filters with `t.dilationFactor > 0.05` (`:167`). So once a lane reaches `dilationFactor = 0`
it is never attempted again; never being attempted, it can never enter the `catch` branch; never
entering the `catch` branch, its `dilationFactor` can never be rewritten. The dilation is a **latch**,
not a backoff.

## Reproduced

16 consecutive failures dilate the lane to `0`. The network is then healed and 200 sends are issued:

```
after 16 failures  -> dilation: 0   frames delivered: 0
after 200 successful sends attempted, network healed:
  dilation: 0   frames actually delivered: 0
  => lane recovered? false
```

`resetHeat()` does not clear it — it only touches `HeatAwareScheduler.heatWeights`, a different
mechanism. Nothing in the class resets `dilationFactor`.

## Why it matters beyond the outage

The docstring in `src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts` calls this "the AIMD backoff (same as the UDP
transport)". AIMD's defining half is the **additive increase** — `udp-lossy-transport.ts:1063-1066`
walks the gap back down by `GAP_STEP_MS` per clean window. This path has no increase term at all, so
the two are not the same mechanism and behave oppositely on a healed link. See
`docs/research/2026-08-16-four-corner-homoiconicity-three-claims-checked-*.md`.

## Fix sketch (not implemented here)

Either (a) mirror `desc.dilationFactor = desc.quasiState.dilationFactor` on the success path too — which
requires 081M065HVB5087G0R002N9NPFA to be fixed first, since a perfectly healthy lane currently computes
`dilationFactor = 0` — or (b) give dilation a genuine additive-increase term and a floor
(`HeatAwareScheduler` already does exactly this: `RECOVERY_STEP = 0.05`, `MIN_WEIGHT = 0.05`, which is
why it does not have this defect).

A regression test must FAIL without the fix: dilate a lane, heal the transport, assert at least one
frame is delivered afterwards.
