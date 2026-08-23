---
id: 081M0QCN462087G0R000VXKBER
type: bug
state: backlog
priority: P1
slug: the-lane-packer-fills-to-100-of-its-budget-and-ci-asserts-th
title: "The lane packer fills to 100% of its budget and CI asserts the measurement against that same budget — so a lane can only pass by luck"
created: 2026-08-23T13:23:42.402Z
depends_on: []
composes_with: []
---

# The lane packer fills to 100% of its budget and CI asserts the measurement against that same budget — so a lane can only pass by luck

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QCN462087G0R000VXKBER-*.md` glob. -->

## What happened

PR #14174 made three previously-UNPRICED Applications measurable (`redis`, `weaviate`,
`gitlab`), which raised dev-rung coverage 39/47 -> 41/47. The packer then did its job and
filled the lanes closer to the ceiling. `lane lane-2` went red:

```
MEASURED on-disk for lane-2: 8999 MiB against a budget of 8.500 GiB
lane-2 does NOT fit: 8999 MiB measured > 8704 MiB budgeted. The x2.67 ratio under-estimates this lane.
```

The three lanes in that same run:

| lane | estimated | measured | measured / estimated |
|---|---|---|---|
| lane-1 | 8704 MiB | 7721 MiB | **0.887** |
| lane-2 | 8704 MiB | 8999 MiB | **1.034** |
| lane-3 | 1587 MiB | 1427 MiB | **0.899** |

So the `x2.67` ratio is not biased low — it is ±10% **per lane**, exactly as
`measure-lane-footprints.ts` says in its own header ("the four samples span x2.49-x3.39
and 2.67 is the low end of that spread applied uniformly").

## The defect is structural, and it is not a tuning problem

`packLanes` fills each lane until the next closure would exceed the budget, so **a packed
lane always sits at ~100% of budget**. `.github/workflows/k8s-lane-partition.yml` then
asserts the *measurement* against that *same* budget (`--lane <n> --budget-gib`). Slack is
therefore ~0 by construction, and any positive per-lane estimator error fails the lane.

**Lowering the margin does not help, and this was checked rather than assumed.** At
`--margin 0.80` the partition still packs to the ceiling:

```
--margin 0.85   budget 8.50Gi   lane-1 8.50Gi   lane-2 8.50Gi   lane-3 1.55Gi
--margin 0.80   budget 8.00Gi   lane-1 7.98Gi   lane-2 7.97Gi   lane-3 1.49Gi
```

The budget and the fill move together, so the ratio of measured-to-budget is unchanged at
every margin. There is no value of `--margin` that fixes this.

It has been green until now only because the lanes were not full: before #14174, lane-2
estimated 8.05 GiB against 8.50 GiB — 5% slack it did not earn.

## Why the failure message is also false as written

`freeDiskGib 14 - reservedDiskGib 4 = 10 GiB` is the runner's real capacity for lane
images. lane-2 measured 8999 MiB, which is **under** that. The lane *does* fit the runner;
what it exceeds is the planning budget. "does NOT fit" is therefore not what was observed,
and `budgetOf`'s own docstring says why the two differ: the reservation "is not padding",
while the margin "is a separate and weaker thing ... 0.85 is a judgement, not a
measurement" — headroom for the estimate being wrong.

Comparing a *measurement* against a budget already discounted for estimate-error
double-counts the discount.

## The two candidate fixes, neither taken here

1. **Pack below the assertion threshold.** Give `packLanes` a second, named fraction so a
   lane is filled to (say) 0.95 of the budget the fit check uses. This keeps the gate
   strict and makes the slack explicit and measurable.
2. **Assert fit against capacity, report the ratio separately.** Fail on
   `measured > (freeDiskGib - reservedDiskGib)`, and record `measured / estimated` per lane
   as the running evidence about the x2.67 ratio — which is the thing that check was
   actually built to convict.

**Not decided here on purpose.** Both touch `lane-partition.ts` or
`k8s-lane-partition.yml`, and #14163 (`feat/take-the-70-unlock-giants`) is in flight on
both, moving `freeDiskGib` 14 -> 70. Three agents converging on those files is how a
ten-PR oscillation starts. Whoever lands the 70 should land this with it, because at a
56.1 GiB budget the same ±10% is ±5.6 GiB of unbudgeted disk.

## Falsifier

A lane whose measured cost exceeds its budget by any margin, on a tree where every image
pulled successfully. Reproduced 2026-08-23 in run 32641344919, job `lane lane-2`.
