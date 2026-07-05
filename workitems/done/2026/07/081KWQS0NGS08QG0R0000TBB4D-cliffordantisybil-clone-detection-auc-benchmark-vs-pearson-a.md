---
id: 081KWQS0NGS08QG0R0000TBB4D
type: task
state: done
priority: P2
slug: cliffordantisybil-clone-detection-auc-benchmark-vs-pearson-a
title: "CliffordAntiSybil clone-detection AUC benchmark vs Pearson and Procrustes baselines"
created: 2026-07-04T23:56:56.217Z
depends_on: []
composes_with: ["081KVP3GYW108QG0R003V7E6VT"]
---

# CliffordAntiSybil clone-detection AUC benchmark vs Pearson and Procrustes baselines

## Why

External audit (2026-07-04): repo has unit tests for `CliffordAntiSybil.computeGeometricCorrelation`
(`tests/Bayesian.Tests/CliffordAntiSybil.Tests.fs`) but **no head-to-head benchmark** against
`AntiSybil.computeCorrelation` (Pearson) or an affine-map residual baseline. Research prose claims
Clifford upgrades Pearson; that claim is not measurable in CI today.

Ad hoc experiment (not committed) showed rotor AUC ≥ Pearson at all noise levels on synthetic
clone streams; Procrustes wins at low noise, rotor wins at medium/high noise.

## Done when

1. Checked-in benchmark (F# preferred — ports live `CliffordAntiSybil.fs` / `AntiSybil.fs`):
   N=200 clone + N=200 independent pairs, noise sweep, report AUC for all three scorers.
2. Baseline Pearson uses `AntiSybil.computeCorrelation` on mean trajectories.
3. Procrustes = affine least-squares on `(mean, precision)` pairs; score = −MSE.
4. Test CDB-1: rotor AUC ≥ Pearson AUC at every noise level in the default sweep.
5. Landed: `src/Bayesian/CloneDetectionBenchmark.fs`, `tests/Bayesian.Tests/CloneDetectionBenchmark.Tests.fs`.

## Anchors

- `src/Bayesian/CliffordAntiSybil.fs`
- `src/Bayesian/AntiSybil.fs`
- `tests/Bayesian.Tests/CliffordAntiSybil.Tests.fs`

## Distinct from

- **081KWQS2PN608QG0R002CXSBG0** — minimal BNN inference cell (factor graph + measurable IV task).
  This item is Sybil-detection benchmarking only; it does not implement or extend BNN.

## Notes

Priority P2 — after FROST DKG slice (081KWPHRNFW) and USB/onboarding round-trip harness.
