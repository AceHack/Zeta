---
id: 081M0WMEGNE087G0R000V25RW1
type: bug
state: backlog
priority: P2
slug: the-dla-meter-s-d-f-was-typed-in-never-computed-and-its-mutu
title: "the DLA meter's D_f was typed in, never computed, and its mutual-information detector could not fail"
created: 2026-08-25T14:16:06.574Z
depends_on: []
composes_with: []
---

# the DLA meter's D_f was typed in, never computed, and its mutual-information detector could not fail

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WMEGNE087G0R000V25RW1-*.md` glob. -->

## The bug

Two defects with one root cause, both fixed in PR #15353.

**1. `D_f ≈ 1.322` was typed in and never computed.** It entered as a literal with
`dfa6085455` (the Oracle 10 WASM sources) and propagated as prose across README,
demo site, and docs. No code path in the repo has ever produced it from a
measurement, and no physical quantity in the DLA problem has been identified that
it equals.

Related and repeatedly misreported: the claim that `dla.wat` holds "a hardcoded
~1.322 constant" is **itself wrong**. The `* 1.322` was only ever in a *comment*.
The body was always `csize / (maxr * maxr)` — a number **density**, measured
0.248–0.450 across the eight byte-locked seeds, a factor of 3–5 from its own
comment. `N/R² = R^(D−2)` is not scale-invariant, so it has no fixed point and
cannot be a dimension. Zero callers. Renamed `toy_density_proxy`.

**2. The mutual-information detector could not fail.** Every assertion about
`runCommitPairProbe.isExcess` asserted `false`, or that two runs agreed. Mutating
it to a hardcoded `false` left the suites at **41 pass, 0 fail**.

**The two are one bug.** Every probe fixture pinned `fractalDim: 1.322`. A constant
has zero variance, so mutual information is identically 0 for both the real pairing
and the permutation null — the assertion was trivially satisfied. A number that
never varies cannot exercise a correlator.

## Also established (physics)

The ≈1.30 box-counting reading is an **estimator artifact**, not small-cluster
physics. The prior explanation ("800 walkers is too small for the 1.71 asymptote")
is refuted by a control: the same code returns **1.0001** on a Sierpinski gasket —
exactly self-similar, true dimension 1.58496, no finite-size physics — subsampled
to the DLA cluster's ~330 points. Definitionally (Falconer), the box dimension of
any finite point set is **0**, so only "the slope over a stated window" is
well-posed. The Witten–Sander mass-radius estimator on the *same* clusters gives
**1.668**, within 2.5% of the accepted 1.71.

## Falsifiers landed

- `src/wasm-dla/bytelock/box-counting.test.ts` — CALIB-1..4 (known-dimension
  controls), the mass-radius cross-check, and a pin on the density expression.
- `src/Core.TypeScript/oracle/dla-meter.probe.test.ts` — DMP-9 positive **and**
  negative controls. Both mutation directions now die.

## Register (`toy-is-free-metered-must-be-earned`)

box-counting **algorithm** → `metered` · the ≈1.30 DLA reading → `toy` · the 1.668
mass-radius reading → `unmetered` · `toy_density_proxy`,
`toyDfFromClusterSizeOnly` → `toy`. Nothing deleted; demoting is the point.

## Bearing on §A: none

No §A row depends on `D_f`. The whole Z-2…Z-7 batch was demoted to §B on
2026-08-01 and Z-6 quarantined then — there was **no false discharge left to
correct**. The register worked.

## Open, deliberately

This DLA variant's true asymptotic dimension is **undetermined**. It spawns at
`min(maxR+3, 58)` and kills at `spawn+8`; a birth circle 3 cells outside the
cluster does not sample the harmonic measure, so there is no *a priori* reason its
asymptote should be Witten–Sander's. Not guessed. Separately, `arXiv:2607.02216`
(cited beside Halsey 2000) could not be verified offline and is flagged unchecked.

## Pointers

- `docs/research/2026-08-25-does-the-dla-meter-measure-a-fractal-dimension-four-estimators-one-typed-in-constant-lumen.md`
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-dla-meter
- PR #15353
