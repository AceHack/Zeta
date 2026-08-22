---
id: 081M0FT2JZV087G0R003HXFCEW
type: task
state: backlog
priority: P2
slug: cliffordantisybil-measure-clone-angles-in-the-fisher-rao-geo
title: "CliffordAntiSybil: measure clone angles in the Fisher-Rao geometry (Cl(2,1) rotors), not the flat (nu,tau) chart"
created: 2026-08-20T14:44:19.579Z
depends_on: []
composes_with: []
---

# CliffordAntiSybil: measure clone angles in the Fisher-Rao geometry (Cl(2,1) rotors), not the flat (nu,tau) chart

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0FT2JZV087G0R003HXFCEW-*.md` glob. -->

## Why

`src/Bayesian/CliffordAntiSybil.fs` embeds a Gaussian belief as the flat Cl(3,0) vector
`(PrecisionMean, Precision, 0)` and scores clones by rotor consistency. Measured
(`docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-*.md`):

- The score is **not invariant under a change of measurement unit** on the believed quantity.
  Rescaling `x -> kx` across five decades moves the score on one unchanged pair of streams from
  **0.999752 to 0.000006**. Root cause is dimensional: `Cl3.norm` adds `nu^2` (units `[x]^-2`) to
  `tau^2` (units `[x]^-4`).
- It **misses the real adversary move** (`x -> ax + b`, score 0.70) and **flags an impossible one**
  (a 90-degree chart rotation that drives precision negative, score 1.00).
- Clone-vs-independent AUC falls from 0.959 to **0.746** when agents work in different units, with
  an 18.7% false-positive rate at a 0.9 threshold.

The canonical geometry is Fisher-Rao, which on this (location-scale) family is **hyperbolic**,
K = -1/2 (Atkinson & Mitchell 1981) -- not the sphere of the categorical family. Curvature is NOT
the defect: the curvature term is second order and reaches 1% of the score only at
`D_KL ~ 0.038` nats per step. The defect is the **chart**: flat-chart angles converge to a
**116.57-degree** error that does not shrink with step size, and the chart is conformally correct
at exactly one belief in the manifold, N(0,2).

## What to do

1. Replace the angle computation with the Fisher-Rao one. In the `(mu, y = sqrt(2) sigma)`
   half-plane chart the metric is conformal, so angles are the Euclidean angles between **geodesic**
   initial directions -- see `halfPlaneInitialDirection` in
   `src/Core.TypeScript/research/belief-manifold-curvature-sybil.ts`.
2. Keep everything else. The statistic (`rho^2 exp(-(1-rho^2)/2)` in the circular mean resultant
   length), the score curve, and the public signature are unchanged. This is a contained change.
3. Add `Cl21` beside `src/Core/Cl3.fs` for the isometry-hypothesis form of the test: a Sybil mask
   `x -> ax + b` is a **boost rotor** in Cl(2,1) with rapidity `-log a` (verified exact to 1e-16).
   Cl(3,0) cannot express it -- its rotor group is compact, and rescaling has unbounded orbits.
4. Handle the orientation-reversing mask `x -> -x`: turn angles are invariant only under
   `Isom+`, so also score against the negated turn-angle sequence and take the max.
5. **Rewrite `CAS-4`** in `tests/Bayesian.Tests/CliffordAntiSybil.Tests.fs`. Every belief in it has
   `Precision = 0.0` = `Gaussian.One`, the uniform message: `sigma = infinity`, `mu = 0/0`. Those
   points are on the ideal boundary of the manifold, at infinite Rao distance from every belief.
   The test currently specifies the false-positive channel as if it were a requirement.
6. Add a fourth arm to `src/Bayesian/CloneDetectionBenchmark.fs` and, before shipping, run it on
   **real** streams. The synthetic comparison is a toy under
   `.claude/rules/toy-is-free-metered-must-be-earned.md`; "better in production" is UNEARNED.

## Falsifier for the fix

The fixed detector must score identically across at least five decades of unit rescaling
(`|delta| < 1e-9`) and must score an `x -> ax + b` mask at 1.0. Both are already pinned in
`src/Core.TypeScript/research/belief-manifold-curvature-sybil.test.ts`, which is mutation-checked
(8 mutants, all killed).
