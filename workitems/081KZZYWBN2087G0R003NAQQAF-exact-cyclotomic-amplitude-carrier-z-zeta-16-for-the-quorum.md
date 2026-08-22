---
id: 081KZZYWBN2087G0R003NAQQAF
type: task
state: in-progress
priority: P2
slug: exact-cyclotomic-amplitude-carrier-z-zeta-16-for-the-quorum
title: "Exact cyclotomic amplitude carrier Z[zeta_16] for the quorum interference fold"
created: 2026-08-14T11:00:27.426Z
depends_on: []
composes_with: []
---

# Exact cyclotomic amplitude carrier Z[zeta_16] for the quorum interference fold

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZZYWBN2087G0R003NAQQAF-*.md` glob. -->

## Why

The quorum interference fold (`QuorumAlgebra.interfere`, arithmetic in `AmplitudeEmu.mergeOf`) is IEEE-754
with an `EPS = 1e-12` drop. Measured (`tests/Tests.FSharp/QuorumAlgebra.Tests.fs`):

- associativity fails **structurally** - one grouping measures `None`, the other `Some` at `1.6e-6`; on a
  larger witness the gap is `1.13e8` ULPs, far above rounding;
- scale-covariance fails - `support(a) = 2` but `support(0.5*a) = 1`, so halving a state (physically the
  identity, since states are rays) changes its Born distribution.

So the amplitude layer **cannot carry a byte-locked claim**, and `join`'s conflict detection can convict a
source of disagreeing with itself over a rounding difference.

## What

Replace the float carrier with an exact cyclotomic one at the **quorum layer only**: amplitudes as
`(1/sqrt2)^k * sum_i a_i * zeta_N^i`, `N = 16` (Z-rank 8, contains zeta_8 and zeta_4) or `N = 8`
(Z-rank 4, the Clifford+T ring `Z[1/sqrt2, i]`). Keep the float path for the continuous-phi interferometer
sweeps and label it permanently outside the byte-lock treaty.

Cost is small because **the quorum fold is depth-1**: coefficients grow by `log2(members)` bits, not
linearly in circuit depth. 2-4x memory, no compounding.

## Prize beyond byte-lock

`src/Core.TLA/specs/QuorumPhaseCancellation.tla` already restricted to the 4th roots of unity (Gaussian
integers) to be checkable at all. With `4` dividing `N`, the model and the implementation share a carrier
and **TLC counterexamples become directly executable F# tests**.

## Pointers

- `docs/research/2026-08-14-the-quorum-fold-is-not-a-join-interference-vs-evidence-and-the-cyclotomic-exit-lumen.md` (5)
- `universal/interference.md` - the honest boundary this closes
- Anchors: Coste-Gannon 1994, Ng-Schauenburg 2010 (modular data is cyclotomic); Giles-Selinger 2013,
  Kliuchnikov-Maslov-Mosca 2013 (exact synthesis over `Z[1/sqrt2, i]`, denominator-exponent form)

## The fourth reason, which outranks the other three (2026-08-14)

Conjecture **Z-EPS was run and it HOLDS** (#10554,
`docs/research/2026-08-14-z-eps-run-the-threshold-drop-signals-routing-the-conjecture-and-the-witness-soraya.md`).
A Bob-local, trace-preserving operation moves Alice's marginal Born probability from `0.2647` to
`0.0000` on the shipped `AmplitudeEmu.step`. **The emulator computes a theory that signals**, and it
survives normalisation. "Tune EPS" is dead **as a class** - the shift is scale-dependent and the
theory is not - so **the admissible fixes are carrier changes**. This item stopped being an
improvement and became the repair for a proven defect.

## What shipped (2026-08-14, Lumen)

- `src/Core/CyclotomicAmplitude.fs` - the `Cyc` carrier (`Z[zeta_16][1/sqrt2]`, unique canonical
  form, `encode` as the byte-lock text) and `CyclotomicAmplitude`, the same fold with `Cyc.isZero`
  in place of the `EPS` comparison.
- `tests/Tests.FSharp/CyclotomicAmplitude.Tests.fs` - 27 tests: ring soundness cross-checked against
  float complex arithmetic; the laws back; the instrument surviving; the **Z-EPS differential**
  (both carriers, one ray, one test); the `Z[zeta_4]` bridge with a TLC counterexample executed;
  byte-lock; and cost measured against the depth-1 prediction.
- **`N = 16` chosen, and `N = 8` / `N = 4` are sub-lattices of it, not alternatives.** The fallback
  branch of this item is therefore a selection, not a second implementation.
- **The float path is untouched.** `AmplitudeEmu` still carries the continuous-phase sweeps and is
  still where the Z-EPS regression test lives.

## What remains (the follow-on slice)

Migrating `QuorumAlgebra.Contribution` itself to `Cyc` is **not** done here and is deliberately
separate: `tests/Tests.FSharp/QuorumAlgebra.Tests.fs` section C *measures the float defects*, so
converting that module in the same change would delete the evidence along with the defect - the
exact trap Z-EPS section 5 named. The migration wants its own PR that keeps a float-path arm.
