# PolarityFilter has no resolution limit — the √σ floor, and what F1 actually costs

**Status:** analysis, register-labeled. The derivation is `metered` (analytic, and numerically
reproduced by a committed probe); the costings are estimates and are labeled as such.
**From:** the shadow, pricing the reinstatement of the smoothness/resolution prerequisite deferred at
`docs/research/2026-05-26-kestrel-caustic-engineered-bloom-filter-discriminators-substrate-smoothness-as-load-bearing-property-aaron-forwarded.md`
lines 185-187, after Aaron 2026-08-15: *"we do care [about optical] — we want TSMC lithographic
precision over our lensography."*

**Why this file exists at all.** The derivation below was produced during the register-correction work
that landed PR #10844 and then existed **only in a task transcript** — the sibling building the F2
falsifier went to inherit it and found nothing. That is the exact failure this repo spent 2026-08-14
fighting (an insight in one transcript degrading into a wrong recollection two days later, PR #10821).
The numbers are here, and the probe that produces them is tracked, because a scratch path is a dangling
pointer.

## What the module is, and what it is missing

`src/Core/PolarityFilter.fs` is 53 lines: Malus's law `transmit(θf, θs) = cos²(θf − θs)`, a sweep
`findOrientation n` that takes the argmax over `n` filter angles on `[0, π)`, and
`dominantOrientation n rays` that does the same over a bundle. It has **no notion of resolution, limit,
or smoothness**, and no analogue of λ, of NA, or of an overlay budget.

The crucial point is that `n` is a **sampling** step, not a **resolution** limit. Two orientations
closer than `π/n` are separated exactly by raising `n`. Nothing in the model says there is a separation
below which two signals become indistinguishable — which is what a resolution limit *is*.

## The limit, analytically

**The Lipschitz constant is free.** Power reduction gives `cos²Δ = (1 + cos 2Δ)/2`, so
`d/dΔ transmit = −sin 2Δ` and

> **L = 1**, and it is **tight** — the supremum is *attained* at `Δ = ±π/4`, not approached.

(Tightness independently re-derived and measured at `1.00000000003` by the F2 work, PR #10847. It is
worth stating because a *loose* bound would make every limit derived from it loose too.)

**But the constant that binds is not L.** `findOrientation` localises a **maximum**, and at a maximum
the first derivative vanishes: `transmit ≈ 1 − Δ²` near alignment. So the throughput difference that
encodes a sub-grid position is **quadratic**, not linear, in the position error. Given a measurement
noise σ on the throughput reading:

| what is being asked | floor |
|---|---|
| discriminate two signals separated by δ, read at a generic filter angle | `δ_min ≈ σ / L = σ` (first order) |
| **localise one peak by sweeping** — what `findOrientation` does | **`δ_min ∝ √σ`** (curvature-limited) |

`√σ ≫ σ` for small σ, so the operation the module actually performs is governed by the **worse** of the
two, and it is the one nobody had written down.

**This is the same fact the F2 work measured from the other side.** PR #10847 records that
`findOrientation`'s *throughput* output is Lipschitz with true constant `sin(π/n)` — which **vanishes**
as the grid refines. A vanishing sensitivity of throughput to angle and a `√σ` floor on angle recovered
from throughput are two readings of one curvature: refining the sweep shrinks the signal that carries
sub-grid position faster than it shrinks the cell, so past a point the noise owns the answer.

## The numbers

Produced by `src/Core.TypeScript/research/polarity-filter-resolution-floor.ts` (deterministic 64-bit
LCG, seeded, no ambient entropy; `--check` asserts both claims below and exits non-zero if either
fails). RMS orientation error in radians, 400 trials, seed 42:

| σ | n=64 | n=1024 | n=16384 | floor / √σ |
|---|---|---|---|---|
| **0** | 1.42e-2 | 8.81e-4 | **5.41e-5** | — (no floor) |
| 1e-6 | 1.42e-2 | 8.99e-4 | 5.04e-4 | 0.50 |
| 1e-4 | 1.40e-2 | 5.49e-3 | 4.00e-3 | 0.40 |
| 1e-2 | 5.57e-2 | 4.49e-2 | 3.74e-2 | 0.37 |
| 1e-1 | 1.60e-1 | 1.27e-1 | 1.18e-1 | 0.37 |

Two things, and the first is the finding:

- **At σ = 0 the error keeps shrinking with `n` without bound.** 1.4e-2 → 8.8e-4 → 5.4e-5, tracking the
  grid step. **The model as it stands has literally infinite resolution.** That is the defect, stated
  exactly: not "the limit is wrong" but "there is no limit."
- **At σ > 0 a floor appears that `n` cannot beat**, and it scales as `√σ`. The prefactor is
  **0.37–0.43 over σ ∈ [1e-4, 1e-1]** and rises to ≈ 0.50 at σ = 1e-6, where the sweep grid
  (`π/16384 ≈ 1.9e-4`) is itself comparable to the floor and still contributing. Seed-independent
  (checked at seeds 42 and 1337).

> **Honest correction to the first statement of this result:** it was reported as a flat "≈ 0.37·√σ,
> stable across three decades." The stable band is 0.37–0.43, and the σ = 1e-6 row is 0.50 for a reason
> that is understood (grid, not noise). The `√σ` *scaling* is the checked claim; the prefactor is a
> measured range, not a constant.

**Anchor, as a structural correspondence and not a claim about our substrate:** the vanishing of
position information at the coincidence point is the same shape as **Rayleigh's curse** — Tsang, Nair &
Lu, *Quantum Theory of Superresolution for Two Incoherent Point Sources* (PRX 6, 031033, 2016) — where
the Fisher information for separation in direct imaging vanishes as the separation → 0. Cited for the
structure of the degeneracy only; nothing here is quantum imaging.

## The unification worth keeping

**Smoothness and resolution are one constant seen from both sides.**

- *Smoothness (upper bound):* `d_out(f(x), f(x')) ≤ L · d_in(x, x')` — a small input change cannot
  produce a large output change. This is the kestrel-caustic prerequisite.
- *Resolution (lower bound):* inputs closer than the noise-equivalent separation produce outputs that
  are **indistinguishable** — `σ/L` at first order, `∝ √σ` at a peak.

Same `L`, same σ, read in opposite directions. So the 2026-05-26 deferral did not defer two research
programmes; it deferred one constant and one declared noise floor.

## Costing F1 / F2 / F3

The 2026-05-26 estimate of *"weeks to months"* priced the **full inverse-design programme** (optimal
transport → target discrimination shape → solver → deployable filter). It did not price the smoothness
prerequisite alone, which is the cheap part. Correcting that is most of the value of this note.

**F2 — smoothness. Cheap, and now built.** Assert `|transmit(θ,a) − transmit(θ,b)| ≤ L·|a−b|` with
`L = 1` across the pipeline. Built in **PR #10847** — open as of this writing, so the file it adds
(`tests/Tests.FSharp/PolarityFilterSmoothness.Tests.fs`) is **not on `main` yet**; cite the PR, not the
path, until it merges. Mutation-proved, with two recorded breaks — `findOrientation`'s **angle** output (a
piecewise-constant argmax over the grid; no Lipschitz constant exists) and `dominantOrientation` at zero
resultant, where the objective `N/2 + ½·Re[e^{2ia}·R]` with `R = Σⱼ e^{−2i rⱼ}` is **exactly constant**
at `|R| = 0`, so no maximiser exists and a `1e-6` perturbation flips the answer by `π/2` identically at
n = 180, 1001 and 4001. That second break is **not** a discretisation artefact. Details in PR #10847;
they are not restated here.

**F1 — the resolution falsifier. ~1 day, and the cost is not the test.** The test is three assertions
(a floor exists; it scales as `√σ`; it does not improve with `n` past the floor) and the probe above
already runs them. What blocks it in production is sharper than "we need an RNG":

> **`transmit`'s signature has no channel through which noise could enter.** It is a total,
> noise-free function of two floats. Adding the channel *changes the signature* — which is precisely
> what §13 noninterference requires (entropy enters only through a declared, injected `Source`, never
> ambient). The probe gets away with an internal LCG because it is a standalone probe with an explicit
> seed parameter; production code may not.

So F1 is a **design** decision about a declared entropy channel, not a research problem. That is the
engineering ask, and it is the whole of it.

**F3 — the composition / overlay analogue. Repriced: do not build it yet.** The earlier estimate
(~2-3 days) assumed a composition operator would serve a pipeline. **There is no pipeline.**
`PolarityFilter` has **zero downstream consumers** — only its own tests, plus two doc-comment mentions
that call nothing (`src/Core/Orbit.fs:24`, `src/Core/Optics.fs:19`). Independently confirmed by the F2
work. Building a composition operator with no caller to validate it is speculative API design, which
`interfaces-free-classes-earned-under-rules.md` and `only-the-irreducible-is-primitive-generate-the-rest.md`
both say not to do. **The correct move is to wait for a consumer that demands composition**, and the
right thing to record now is the prediction it would test: composing filters with per-filter angle
uncertainty **spends** budget to buy coverage, exactly as multi-patterning does — it does not buy
precision for free. That is the opposite of what `docs/VISION.md` claimed before PR #10844.

**And the zero-consumer fact reprices the analogy, not just F3.** The `docs/VISION.md` multi-patterning
row and the funding thesis's multi-lens row both map onto a module that nothing calls. The register
correction in PR #10844 says the resolution limit is absent; the sharper statement is that the module
carrying the analogy is not load-bearing anywhere in the substrate.

## Pointers

- PR #10844 — the register correction on `docs/VISION.md` + `docs/pitch/funding-thesis-tsmc-in-time.md`
  (the k₁ = 0.25 single-exposure floor; overlay error entering the CD budget; the open requirement).
- PR #10847 — F2 built and run, the tight `L = 1`, and the two recorded breaks.
- `src/Core.TypeScript/research/polarity-filter-resolution-floor.ts` — the probe behind the table.
- `docs/research/2026-05-26-kestrel-caustic-engineered-bloom-filter-discriminators-substrate-smoothness-as-load-bearing-property-aaron-forwarded.md`
  lines 185-192 — where the prerequisite was named and deferred.
- `docs/research/2026-06-12-ferry-22-mika-the-bloated-adinkra-builds-the-minimal-one-qubits-emergent-from-adinkras-the-two-outcasts-were-right.md`
  §9 — lensography anchored to the -graphy lineage **and** the Radon transform, with the worked
  underdetermination ("the two shadows do NOT determine a common original") that already contradicts an
  unqualified "the projection IS the data."
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register this note is filed under.
