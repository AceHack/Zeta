---
id: 081KWGA0C7008QG0R0006KVBWR
type: bug
state: backlog
priority: P1
slug: intervalring-violates-ring-and-semiring-laws-negate-is-not-a
title: "IntervalRing violates ring AND semiring laws — Negate is not an inverse, distributivity fails (phantom retraction residue)"
created: 2026-07-02T02:19:57.024Z
depends_on: []
composes_with: []
---

# IntervalRing violates ring AND semiring laws — Negate is not an inverse, distributivity fails (phantom retraction residue)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWGA0C7008QG0R0006KVBWR-*.md` glob. -->

## Found (Soraya, math-team review of 081KWG9JQ9H, 2026-07-02)

Seeded by the dispatch brief's suspicion question ("[a,b]+(−[a,b]) ≠ [0,0] —
CHECK THIS"; the distributed-seed pattern), Soraya confirmed and escalated:
`IntervalRing` (`src/Core/Semiring.fs` ~84–107) **violates BOTH the ring and the
semiring laws it claims**:

1. **Negate is not an additive inverse** (the ring lie):
   `[a,b] + [−b,−a] = [a−b, b−a] ≠ [0,0]` unless `a = b`. The code implements
   standard Moore negation while the docstring claims Kaucher; the true Kaucher
   additive inverse is the *improper* interval `[−Lo,−Hi]` (Kaucher 1980).
2. **Distributivity fails** (the semiring lie): intervals are only
   SUB-distributive (Moore 1966). Counterexample: `x=[−1,1], y=[1,1], z=[−1,−1]`
   → `x·(y+z) = [0,0]` but `x·y + x·z = [−2,2]`. So it is not a lawful
   `ISemiring` at all.

## Consequence (why P1)

`WeightedSet.subtract` (src/Core/WeightedSet.fs:89) and `ZSetW.difference` over
interval weights never cancel — `a − a ≠ ∅` — leaving **phantom retraction
residue** in DBSP folds. Wrong-tool cost: false-green incrementality over
interval-weighted circuits. The ZSetW.Tests interval cases exercise sum/width
only, so nothing currently catches it.

## Fix routing (Soraya)

- Demote `IntervalRing` out of the ring tier when the IRing/ISemiring split
  (081KWG9JQ9H) lands; since it is not even lawfully a semiring, it needs an
  **on-file substrate-honest exception** documenting sub-distributivity (per the
  manifesto exception discipline) — or a rebuild as genuine Kaucher directed
  intervals (a group under +, still not distributive; a ring rung is unreachable
  either way — that is the mathematics, not a bug to fix).
- The FsCheck law-pack (081KWG9JQ9H formal anchor) would have caught both lies;
  land the laws first, let them fail on IntervalRing, then demote with the
  exception on file. Build = verify.

## Anchors

Moore 1966 *Interval Analysis* (sub-distributivity); Kaucher 1980 (directed
intervals, the true inverses); Golan 1999. Depends on / composes with
081KWG9JQ9H (the split). Found-by lineage: [[fable5-enhancements]] memory,
adversarial-review economics ([[every-bug-has-economic-value]]).

