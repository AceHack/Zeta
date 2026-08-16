---
id: 081M065HVB5087G0R002N9NPFA
type: bug
state: backlog
priority: P2
slug: four-corner-dilationfactor-is-blind-to-loss-rate-a-0-loss-la
title: "four-corner dilationFactor is blind to loss rate: a 0%-loss lane and a 100%-loss lane both compute dilationFactor 0 (the metric is agreement rate, not autocorrelation)"
created: 2026-08-16T20:52:29.669Z
depends_on: []
composes_with: []
---

# four-corner dilationFactor is blind to loss rate: a 0%-loss lane and a 100%-loss lane both compute dilationFactor 0 (the metric is agreement rate, not autocorrelation)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M065HVB5087G0R002N9NPFA-*.md` glob. -->

## What

`updateQuasiState` (`src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts:266-283`) says it
computes "the autocorrelation of the binary rejection sequence". It computes

```ts
if (history[i] === history[i - tau]) match++;
const corr = total > 0 ? match / total : 0;
```

which is the **agreement rate**, not the autocorrelation. The two differ exactly where it matters: a
mean-centred autocorrelation of a CONSTANT sequence is `0/0` — undefined, zero variance, nothing to
correlate. The agreement rate of a constant sequence is `1.0`, the maximum.

Consequence: `dilationFactor` is a function of **pattern regularity** and carries **no information about
loss rate**. Measured over 16-sample windows:

| pattern | loss rate | isQuasi | period | dilationFactor |
|---|---|---|---|---|
| all rejected | 1.00 | true | 1 | 0.000 |
| **all received (ideal lane)** | **0.00** | **true** | **1** | **0.000** |
| alternating | 0.50 | true | 2 | 0.000 |
| one-in-four | 0.25 | true | 4 | 0.000 |

A perfectly healthy lane and a totally dead lane receive the identical maximal throttle. `FC-9` in
`four-corner-feedback.test.ts` records this and pushes the repair onto the caller — *"the caller should
NOT time-dilate a lane with 0 rejections"* — and the one caller
(`discovery/zeta-transport-cell.ts:196`) satisfies that note only by accident, because it never reads
`dilationFactor` on the success path at all. That accident is 081M065HQKT087G0R0033B3GTD.

Also measured: only **3224 / 65536** (4.92%) of 16-sample windows are flagged `isQuasi`, so the
detector's negative branch is reachable and discriminating — the defect is the metric's blindness at the
degenerate ends, not that it fires for everything.

## Fix sketch (not implemented here)

Either centre the statistic (`r = 2*agreement - 1`, and refuse to report on a zero-variance window) or
gate dilation on `rejectionRate > 0` so a constant-success lane is structurally incapable of being
throttled. A regression test must FAIL without the fix: feed 16 `false` outcomes and assert the lane is
not throttled.

Related but distinct: 081M00SW8YJ087G0R002J1WFFE (the detector's *name* — it detects `Crystal n`, the
commensurate class, while its own definition names the incommensurate one).
