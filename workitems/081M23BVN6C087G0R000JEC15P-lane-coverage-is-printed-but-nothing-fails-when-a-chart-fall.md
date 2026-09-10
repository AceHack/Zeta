---
id: 081M23BVN6C087G0R000JEC15P
type: task
state: backlog
priority: P2
slug: lane-coverage-is-printed-but-nothing-fails-when-a-chart-fall
title: "lane coverage is printed but nothing fails when a chart falls out of every lane"
created: 2026-09-09T15:16:22.860Z
depends_on: []
composes_with: []
---

# lane coverage is printed but nothing fails when a chart falls out of every lane

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23BVN6C087G0R000JEC15P-*.md` glob. -->


## The gap

`lane-partition.ts` prints `covered by a lane: 47/49`. Nothing failed when that
ratio dropped. `k8s-lane-partition.yml` fails only on a ZERO-lane matrix, so a
single Application quietly leaving every lane -- a new chart, a changed dependency
edge, a footprint that grew past the budget -- was invisible. A report is not an
assertion.

This matters more now than when the partition was written, because Aaron has asked
for one cluster bring-up per chart-set. A split built on an unchecked coverage
claim is a quiet way to stop testing something.

## The check

Every Application the INCLUDED PROOF asserts is either assigned to exactly one
lane, or quarantined with a named artifact. Duplicate assignment fails too: an app
asserted in two lanes hides which lane proved it. Quarantine is a third answer,
never a pass -- the reason must name what a human would fix.

Mutation-tested:

| mutant | tests failed |
|---|---|
| an unpriced app vanishes instead of being quarantined | 3 |
| a quarantine reason is emptied | 2 |

Plus a non-vacuity test: the asserted roster must be >= 30 apps and at least one
lane must hold at least one app, so neither an empty roster nor a zero-lane
partition can read as coverage.

## The design it unblocks

`docs/research/2026-09-09-one-kind-cluster-per-chart-set-the-starvation-premise-is-refuted-and-the-coverage-claim-needed-a-falsifier.md`
-- DRAFT, five numbered questions awaiting maintainer sign-off. It records that the
starvation premise for the split is refuted by measurement (the green run reached
37/37 in 513 s against a 2400 s cap), that the ask survives on attribution rather
than headroom, and that most of the machinery already exists in `lane-partition.ts`
and `k8s-lane-partition.yml`.
