---
id: 081M0QRPY6W087G0R001K4TE3M
type: task
state: backlog
priority: P2
slug: gaussian-to-weightedset-natural-parameter-homomorphism-the-l
title: "Gaussian to WeightedSet natural-parameter homomorphism + the log-map negative control"
created: 2026-08-23T16:54:24.732Z
depends_on: []
composes_with: []
---

# Gaussian to WeightedSet natural-parameter homomorphism + the log-map negative control

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRPY6W087G0R001K4TE3M-*.md` glob. -->

**Scope:** `docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-and-the-natural-parameter-embedding-that-does-not-truncate.md` §6.

The bounded first milestone for connecting the BNN lane to the `WeightedSet` substrate **without
discretising**. `src/Bayesian/Message.fs`'s `Gaussian` is already a pair of natural parameters whose
product is componentwise addition; `src/Core/WeightedSet.fs`'s `add` is per-key `sr.Add` with `Zero`
pruned. So `Gaussian` embeds as `WeightedSet<NatCoord, float>` over a two-element key set, exactly.

Add `toWeightedSet` / `ofWeightedSet` plus four property tests:

1. `toWeightedSet (a * b) = WeightedSet.add (toWeightedSet a) (toWeightedSet b)`.
2. `toWeightedSet Gaussian.One = WeightedSet.empty` (identity ↦ identity; relies on `Zero` pruning).
3. `toWeightedSet (a / b) = WeightedSet.subtract …`, **including improper results** — the EP cavity
   (Minka 2001) must survive; forbidding `τ ≤ 0` would break it.
4. **The negative control** (this is the one that keeps it out of the numerology class): a discrete
   belief's `SoftValue.combine` is **not** `WeightedSet.add` in probability coordinates, **and is**
   `WeightedSet.add` in log coordinates up to the normaliser. Probe measured `1.110e-16`.

Local-only by construction: `float` has no `WireWeight` (`src/Core/WireWeight.fs`), so nothing here can
cross into shared state. That is correct, and it is why the exact-weight item is filed separately.

**Not in scope:** making `Sppf` semiring-generic; widening `Rational` to bigint
(`081M0QRQ1WV087G0R002G1EW7N`); any grid/`IBeliefProjection` path; anything called a dual BNN.
