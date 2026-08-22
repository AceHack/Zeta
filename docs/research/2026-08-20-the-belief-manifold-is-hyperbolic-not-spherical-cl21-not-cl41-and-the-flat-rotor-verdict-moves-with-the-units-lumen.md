# The belief manifold CliffordAntiSybil embeds is hyperbolic, not spherical — Cl(2,1), not Cl(4,1) — and the flat rotor verdict moves with the units

> **Assignment.** `src/Bayesian/CliffordAntiSybil.fs` maps a Gaussian belief into flat
> **Cl(3,0)** and calls two agents Sybils when one belief stream is a rotor away from the
> other. But `docs/research/2026-08-18-falsifier-1-fails-*.md` established Fisher–Rao as the
> canonical metric (Čencov 1982), and Fisher–Rao is not Euclidean: on a categorical simplex
> `p ↦ 2√p` carries it to the round sphere. So: spherical instead of flat? Which signature?
> Does the Sybil test survive? Is flat a legitimate local approximation, and if so is the fix a
> comment?
>
> **Verdict: the premise is right and points at the wrong module and the wrong term.** It is not
> a sphere — this family is _hyperbolic_, K = −1/2. And curvature is not what is broken. The flat
> chart is wrong at **zeroth order**, by an amount that does **not** shrink as the belief steps
> shrink, and the measured consequence is that the shipped detector's verdict is a function of
> the **unit you measure the believed quantity in**. So no, a comment is not the fix.

## The carved version

> **Same theorem, opposite sign: Fisher–Rao is canonical, and on the _Gaussian_ family it is
> HYPERBOLIC (K = −1/2), not spherical.** The right algebra is **Cl(2,1)** — whose rotors are
> `Spin⁺(2,1) ≅ SL(2,ℝ)`, the double cover of the isometry group of H² — not Cl(4,1) and not the
> shipped Cl(3,0), and the invariant that decides it is **non-compactness**, not a dimension
> count. **The rotor test survives verbatim and gets strictly better**, because a Sybil's real
> mask (relabel the units of what you believe about, `x ↦ ax+b`) is _exactly_ an isometry, hence
> _exactly_ a rotor — a **boost**, which compact Cl(3,0) cannot express. **And the flat embedding
> is NOT a legitimate local approximation.** The error splits in two: a curvature term that is
> genuinely second-order and vanishes (1% of the score at `D_KL ≈ 0.038` nats per step), and a
> **chart term that converges to 116° and never vanishes**. The flat chart's angles equal the
> Fisher–Rao angles at **exactly one belief in the whole manifold, N(0,2)** — a measure-zero set.
> Measured price: rescale the believed quantity across five decades and the shipped score on one
> unchanged pair of streams sweeps **0.9998 → 0.000006**. Same agents. Same beliefs. Opposite
> verdict.

Everything numeric below is computed by
`src/Core.TypeScript/research/belief-manifold-curvature-sybil.ts` and its test, which is
mutation-checked (§8).

## 0. First correction: this module does not embed a categorical belief

The assignment inherited "the simplex becomes a sphere" from the 2026-08-18 falsifier. That
falsifier was working on `src/Core/BeliefConvergence.fs`, which folds unnormalized weights over a
fixed candidate set — the **categorical** exponential family. For that family the statement is
exactly right: `p ↦ 2√p` is an isometry from the Fisher–Rao simplex onto the round sphere of
radius 2 (Bhattacharyya 1943; the Hellinger arc), so the curvature is `+1/R² = +1/4`.

`CliffordAntiSybil` embeds something else. One line, and it decides the whole document:

```fsharp
let beliefToVector (belief: Gaussian) : Cl3.Mv =
    Cl3.vector belief.PrecisionMean belief.Precision 0.0
```

`Gaussian` is the univariate normal in natural parameters (`src/Bayesian/Message.fs`:
`ν = μτ`, `τ = 1/σ²`). That is the **location–scale** family, and its Fisher–Rao geometry is
**hyperbolic**. Carrying the sphere across would have been the right theorem on the wrong module.

**Computed, three independent ways.** The Fisher metric in `(μ, σ)` is `diag(1/σ², 2/σ²)` — matched
against finite differences of the exact KL divergence, since the Fisher metric _is_ the Hessian of
KL. Substituting `y = √2 σ` gives `ds² = 2(dμ² + dy²)/y²`: twice the Poincaré half-plane metric.
The classical orthogonal-metric curvature formula, evaluated numerically at four scattered points,
returns:

| belief     | Gauss curvature K |
| ---------- | ----------------- |
| N(0, 1)    | −0.5000000355     |
| N(5, 0.04) | −0.5000008750     |
| N(−3, 49)  | −0.4999999977     |

And the Rao distance closed form (Atkinson & Mitchell 1981) agrees to 9–10 digits with (a) direct
numerical integration of Fisher arc length along the `μ = const` geodesic, (b) the hyperboloid
formula `√2 · arccosh(−⟨X,Y⟩)`, and (c) the exact vertical-geodesic value `√2 |log(σ₂/σ₁)|`.
Beliefs map onto the unit hyperboloid with `⟨X,X⟩ = −1` to 1e-13.

**Anchors, checked.** Rao 1945 (_Bull. Calcutta Math. Soc._ 37, 81–95) — the Fisher metric as a
Riemannian metric and its geodesic distance. Čencov/Chentsov 1982 (_Statistical Decision Rules and
Optimal Inference_, AMS) — uniqueness under Markov morphisms, which is what makes "canonical" mean
something. Atkinson & Mitchell 1981 (_Sankhyā_ A 43, 345–365) — the closed-form Rao distance for
the univariate normal, i.e. the hyperbolic identification itself. Costa, Santos & Strapasson 2015
(_Discrete Appl. Math._ 197) — the modern derivation with K = −1/2 stated explicitly. Amari &
Nagaoka 2000 — the dually flat structure used in §5.

## 1. Which algebra — and why not Cl(4,1)

**Not Cl(4,1).** Conformal geometric algebra `Cl(n+1,1)` (Li, Hestenes & Rockwood 2001)
linearizes the conformal group of ℝⁿ. `Cl(4,1)` is CGA of ℝ³ — a five-dimensional algebra for a
three-dimensional flat space, whose rotor group is `Isom(H⁴)`. Our parameter manifold is
**two**-dimensional. Reaching for Cl(4,1) would be importing machinery for round objects in
Euclidean 3-space into a problem that has neither.

**Cl(2,1).** The Fisher–Rao manifold _is_ H² (scaled by √2), and H²'s hyperboloid model is the
sheet `⟨X,X⟩ = −1` in ℝ^{2,1}. `Spin⁺(2,1) ≅ SL(2,ℝ)` double-covers `Isom⁺(H²) ≅ PSL(2,ℝ)`, so
**every isometry of the belief manifold is a rotor sandwich `X ↦ R X R̃` in Cl(2,1)**. Doran &
Lasenby 2003 carry this construction.

There is a second, independent route to the same algebra, and it is a consistency check rather
than a coincidence: the conformal group of the **sample space** ℝ¹ is `Cl(1+1, 0+1) = Cl(2,1)`,
and the Poincaré extension theorem says the conformal group of ℝⁿ _is_ `Isom(H^{n+1})`. So "the
CGA of the thing we are believing _about_" and "the isometry algebra of the space of beliefs" are
the same algebra by a named isomorphism, not by a matching number.

**The identification is by invariants, because a count identifies nothing.** Under
`.claude/rules/numerology-vs-number-theory.md`: Cl(3,0) and Cl(2,1) are _both_ 8-dimensional with
_both_ 3-dimensional rotor groups. Dimension excludes neither. What excludes Cl(3,0):

| invariant        | Cl(3,0) — shipped                  | Cl(2,1) — required                      | why the geometry forces it                                                                                     |
| ---------------- | ---------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| rotor group      | `Spin(3) = SU(2)`, **compact**     | `Spin⁺(2,1) = SL(2,ℝ)`, **non-compact** | Rao distance is unbounded, so isometry orbits are unbounded — a compact group cannot act with unbounded orbits |
| even subalgebra  | quaternions ℍ, a **division ring** | `M₂(ℝ)`, has **zero divisors**          | computed: `(1+e₁₃)(1−e₁₃) = 0` exactly                                                                         |
| bivector squares | all `−1`: rotations only           | mixed: `e₁₂² = −1`, `e₁₃² = +1`         | rescaling a belief is translation **along a geodesic** = a **boost**, and Cl(3,0) has no boosts                |

All three are computed in the test, not cited.

## 2. Does the Sybil test survive? Yes — verbatim, and by one degree of freedom better

**At a point, curvature changes nothing.** The tangent plane of H² is a two-dimensional
_positive-definite_ space, so the tangent-plane algebra is Cl(2,0) — the same even subalgebra the
shipped code already uses, and the geometric product of two unit tangent vectors is still a rotor
`cos φ + sin φ e₁₂`. **The rotor machinery is untouched.** Curvature enters _only_ when tangent
vectors at _different_ points are compared, i.e. only through parallel transport. This is the
single most useful structural fact in the document, because it says the shape of the fix is
"measure the angle correctly", never "abandon geometric algebra".

**The masking group shrinks, which is the improvement.** The current test works on normalized
deltas, so its invariance group is the **similarity group of the plane** — 2 translations + 1
rotation + 1 scale = **4 parameters**. The hyperbolic test's group is `Isom⁺(H²)` = **3
parameters**. And the group a real adversary can actually act in is smaller still: the only mask
an agent can perform on a Gaussian belief stream is to **relabel the quantity it believes about**,
`x ↦ ax + b`, which acts as `(μ,σ) ↦ (aμ+b, |a|σ)` — the **`ax+b` group, 2 parameters**, a
subgroup of `Isom⁺(H²)`.

So the ladder is **4 → 3 → 2**, and each rung removes coincidental matches. This is _argued_, not
proven: it is a modelling claim about what adversaries can do, and it would be falsified by
exhibiting a belief-stream masking operation outside `ax+b`.

**The extra flat parameter is not merely redundant — it is populated by impossibilities.** A
rotation of the `(ν, τ)` chart mixes the precision-mean axis into the precision axis. Nothing an
agent does to a belief does that, and the result is not a belief: applying the 90° rotation the
existing test `CAS-4` asserts on, the precision goes **negative** (an improper EP message, per
`Message.fs`'s own domain contract). Measured:

| relation between A and B                               | flat rotor score                          | Fisher–Rao score         |
| ------------------------------------------------------ | ----------------------------------------- | ------------------------ |
| exact clone                                            | 1.000000                                  | 1.000000                 |
| **real mask** `x ↦ 3x + 5`                             | **0.699809** — missed at a 0.9 threshold  | **1.000000** exactly     |
| **impossible mask**: 90° chart rotation (drives τ < 0) | **1.000000** — flagged as a certain clone | undefined (off-manifold) |

**The flat detector misses the mask an adversary can perform and catches one no adversary can.
The curved detector reverses both.** The `1.000000` on the real mask is not a fitted number: an
`ax+b` relabeling is an isometry, turn angles are isometry invariants, so the angle differences
are identically zero — a theorem, not a measurement.

**Honest limitation of the curved statistic as implemented.** Turn angles are invariant under
_orientation-preserving_ isometries only, so the reflection `x ↦ −x` scores 0.054 rather than 1.
The fix is one line (score against the negated turn-angle sequence too, take the max); it is
measured in the module and left unfixed deliberately so the limitation is on the record.

**Also on the record — `CAS-4` is testing on non-beliefs.** Every belief in that test has
`Precision = 0.0`, which is `Gaussian.One`, the uniform message: `σ = ∞`, `μ = 0/0`. That is the
ideal boundary of H², at _infinite_ Rao distance from every proper belief. The test's assertion is
not wrong about the flat code's behaviour; it is a specification of the false-positive channel,
written as if it were a requirement.

## 3. Is flat a legitimate local approximation? No — and the reason is not curvature

The defence on offer is: _Fisher–Rao is Euclidean to first order, because `D_KL` expands to second
order as a quadratic form._ The expansion is real:
`D_KL(p ‖ p+dθ) = ½ g_ij dθⁱ dθʲ + O(dθ³)`. But `g_ij` there is **the Fisher matrix**, not `δ_ij`.
The defence slides from "the metric is a quadratic form" to "the metric is the identity quadratic
form", and those are different claims. The error therefore splits into two terms with completely
different behaviour, and only one of them is the curvature.

### Term 2 — curvature. Second order, vanishes, and is small

Gauss–Bonnet: parallel transport around a closed loop rotates a vector by exactly `∫∫ K dA`, so
with `K = −1/2` the holonomy of a geodesic triangle is its angle defect. Isolated cleanly by
working in the conformal `(μ, y)` chart — where the pointwise metric is already correct, so any
residual gap is **pure curvature** — and comparing chord directions against geodesic initial
directions:

| per-step `D_KL` (nats) | score deficit from curvature | deficit / `D_KL` |
| ---------------------- | ---------------------------- | ---------------- |
| 0.16272                | 3.72e-2                      | 0.229            |
| 0.03553                | 9.41e-3                      | 0.265            |
| 0.00832                | 2.35e-3                      | 0.283            |
| 0.00202                | 5.88e-4                      | 0.292            |

Linear in `D_KL`, ratio converging to ≈ 0.29. **The answer to "at what separation does it
materially disagree" is `D_KL ≈ 0.038 nats` per step for a 1% score deficit** — equivalently a
mean shift of **0.28 σ** per update. Real Bayesian streams sit well inside that: with constant
observation precision the Fisher step length falls off like `1/√n`, so curvature error _decays_ as
a stream matures. **Curvature is not the problem.**

### Term 1 — chart. Zeroth order, does not vanish, and is enormous

At a _single point_, with no curvature involved, the shipped code measures angles with `δ_ij`
while the canonical metric is the Fisher matrix pushed into the `(ν, τ)` chart. Take a belief
`N(2.5, 0.5)` (`ν = 5, τ = 2`) and two chords 45° apart in the flat chart:

| chord step | flat angle | true Fisher–Rao angle | gap         |
| ---------- | ---------- | --------------------- | ----------- |
| 1e-1       | 45.000°    | 164.328°              | 119.33°     |
| 1e-2       | 45.000°    | 161.845°              | 116.84°     |
| 1e-3       | 45.000°    | 161.593°              | 116.59°     |
| 1e-6       | 45.000°    | 161.565°              | **116.57°** |

**It converges — to 116.57°, not to zero.** Shrinking the steps buys nothing, because the two
metrics differ by a **non-conformal linear map** at the point, and a linear map's angle distortion
is scale-free. Across ordinary beliefs the maximum angle error runs 20°–160°; the Fisher matrix in
the `(ν, τ)` chart at `ν = 20, τ = 10` has condition number **508**.

**And there is exactly one belief where the flat chart is right.** Requiring the pushed-forward
Fisher metric to be conformal in `(ν, τ)` forces the off-diagonal `∝ ν` to vanish and the diagonals
`1/τ` and `1/(2τ²)` to agree, i.e. `ν = 0` **and** `τ = 1/2`. One isolated point,
**N(0, 2)** — verified as a numerical zero with every neighbour non-conformal. A measure-zero set
in a two-dimensional manifold. That is the precise sense in which "flat is locally fine" is false:
it is fine at one belief and nowhere else.

## 4. The metering test, and what it costs — the headline number

Lumen's tone contract requires a metaphor that cannot be metered to be flagged. This one meters,
and it fails.

**Dimensional analysis, before any experiment.** `ν = μτ` carries units `[x]⁻¹`; `τ = 1/σ²`
carries `[x]⁻²`. `Cl3.norm` computes `√(ν² + τ²)` — adding `[x]⁻²` to `[x]⁻⁴`. **The quantity the
detector normalizes by is dimensionally incoherent**, so the angle it derives from it must depend
on the unit of `x`. That is a prediction, and it is testable.

**Measured.** Two agents, twenty Bayesian updates each, independent data. Rescale the underlying
quantity `x ↦ kx` (`ν ↦ ν/k`, `τ ↦ τ/k²`) — a pure change of measurement unit, ratings in points
versus kilo-points. Nothing about who is a Sybil changes.

| k    | shipped flat rotor score | Fisher–Rao score |
| ---- | ------------------------ | ---------------- |
| 0.01 | **0.999752**             | 0.157017         |
| 0.1  | 0.976185                 | 0.157017         |
| 1    | 0.412369                 | 0.157017         |
| 10   | 0.012922                 | 0.157017         |
| 100  | **0.000006**             | 0.157017         |

**Five decades of unit change move the shipped verdict from "certainly the same agent" to
"certainly independent" on an unchanged pair of streams.** The Fisher–Rao score does not move at
all, to 1e-9 — as it must, since rescaling is an isometry.

The fair caveat: the detector is **sound at the extremes**. An _exact_ clone scores 1.000000 under
every unit, because identity is preserved under conjugation by the rescaling. What is
unit-dependent is the entire graded middle — which is to say, **the decision boundary**.

**Separation, 60–300 synthetic pairs** (positives = a stream masked by a real `ax+b` relabel;
negatives = an independent agent):

| condition                             | flat AUC  | flat TPR @ 0.9 | flat FPR @ 0.9 | Fisher AUC | Fisher FPR @ 0.9 |
| ------------------------------------- | --------- | -------------- | -------------- | ---------- | ---------------- |
| all agents in the same units          | 0.959     | 0.247          | 0.000          | 1.000      | 0.000            |
| agents in different units (realistic) | **0.746** | 0.497          | **0.187**      | 1.000      | 0.000            |

Register, stated plainly: the Fisher **TPR = 1 is a theorem**, not a measurement — the positive
class is exactly the transformation the statistic is provably invariant under. **The measured half
is the FPR**: that independent agents do not accidentally produce matching turn-angle sequences
(max negative score 0.042). And all of it is synthetic, so under
`.claude/rules/toy-is-free-metered-must-be-earned.md` the _comparison_ is **metered** (it has a
falsifier that fails) while any claim that the curved detector is better **in production** stays
**unearned** until it runs on real streams.

## 5. What the shipped code got right, and it is not nothing

The `(ν, τ)` plane is not an arbitrary chart. Natural parameters `θ = (ν, −τ/2)` are the **affine
coordinates of Amari's e-connection** — the flat, torsion-free connection whose parallel transport
is translation in `θ`. And `Gaussian.( * )` _adds_ natural parameters, so **Bayesian updating is
literally translation in this chart**. Straight lines there are e-geodesics. That structure is
canonical (Amari & Nagaoka 2000), and the earlier falsifier already established that our folds
transport along exactly this connection.

So the honest split is:

> **The affine structure is earned. The metric laid on top of it is not.**

And the rotor test consumes exactly the metric — norms, angles, rotors. That is why a detector
built on a canonical affine structure still produces a unit-dependent verdict.

One legible consequence worth recording: with constant observation precision every step has the
same `dτ`, so the flat delta direction is a monotone function of the observation itself, and the
shipped score reduces to a **von Mises concentration test on arctan-transformed observations**. It
is a coherent statistic. It is just not a statistic about the geometry of belief.

## 6. So is the fix a comment?

**No.** The document was offered "the existing code is right and should say why" as a valid
result, and it would have been — if the error had been the curvature term. It is not. A comment
saying "flat is the first-order approximation" would be **false**, and a comment saying "the
verdict depends on your units" is not a fix, it is a defect report.

What the evidence supports, in order:

1. **Land the honest label now.** `CliffordAntiSybil.fs` gains a doc comment recording the
   measured limitation and pointing here — not as the fix, but because
   `toy-is-free-metered-must-be-earned` says a model whose falsifier now exists **and fails** must
   say so out loud. Done in this PR.
2. **File the real fix as a work-item.** Angles from the Fisher–Rao geometry, `Cl(2,1)` rotors for
   the isometry hypothesis. It is a contained change: the statistic, the score curve, and the
   public signature all stay; only the angle computation moves. Filed as
   `081M0FT2JZV087G0R003HXFCEW`.
3. **`CAS-4` needs rewriting regardless of (2).** It asserts, as a requirement, that two streams of
   improper messages at infinite Rao distance from every belief are clones.

## 7. Register table

| claim                                                            | register                                   | evidence                                 |
| ---------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| Fisher–Rao is essentially unique under sufficient statistics     | **theorem** (borrowed)                     | Čencov 1982                              |
| Gaussian family is H² with K = −1/2                              | **theorem** (borrowed, **checked** 3 ways) | Atkinson & Mitchell 1981; §0             |
| holonomy = `∫∫ K dA`                                             | **theorem** (borrowed)                     | Gauss–Bonnet (do Carmo)                  |
| `Spin⁺(2,1) ≅ SL(2,ℝ)` covers `Isom⁺(H²)`                        | **theorem** (borrowed)                     | Doran & Lasenby 2003                     |
| the belief-rescaling isometry is a **boost rotor**, `φ = −log a` | **computed**, exact to 1e-16               | §1, test                                 |
| Cl(3,0) excluded by compactness + zero divisors                  | **computed**                               | §1, test                                 |
| shipped score `= ρ² exp(−(1−ρ²)/2)`                              | **computed**, 12 digits                    | §4, test                                 |
| shipped verdict spans 0.9998 → 0.000006 under unit change        | **computed**                               | §4                                       |
| chart error converges to 116.57°, does not vanish                | **computed**                               | §3                                       |
| flat chart conformal at exactly N(0,2)                           | **computed** + derived                     | §3                                       |
| curvature error 1% at `D_KL ≈ 0.038` nats                        | **computed**                               | §3                                       |
| the real masking group is `ax+b` (2 params)                      | **argued**                                 | §2 — a modelling claim about adversaries |
| a curved detector is better **in production**                    | **UNEARNED**                               | synthetic streams only                   |

## 8. Falsifiers, and that they can fail

`src/Core.TypeScript/research/belief-manifold-curvature-sybil.test.ts` — 14 tests, 101 assertions.
Mutation-checked, because a test that survives mutation is not a falsifier. Eight targeted
mutants, **all killed**:

| mutant                                                     | tests failed |
| ---------------------------------------------------------- | ------------ |
| Fisher metric `2/σ²` → `1/σ²`                              | 2            |
| `raoDistance` denominator `4` → `2`                        | 2            |
| `beliefToHyperboloid` drops the `√2`                       | 3            |
| `fisherCloneScore` uses flat turn angles                   | 3            |
| shipped-score port drops the `\|avgRotor\|²` factor        | 2            |
| `Cl(2,1)` signature → all `+1` (becomes Cl(3,0))           | 2            |
| boost-rotor rapidity sign flip                             | 1            |
| `fisherNaturalMetric` drops the off-diagonal Jacobian term | 1            |

The rapidity-sign mutant is the one this document earned honestly: the first version of
`beliefScaleRotor` had that sign wrong, the check failed by a factor of order 20, and the function
was fixed rather than the check relaxed.

## 9. Search terms used (so a miss is a claim about the search, not the repo)

`fisher.?rao`, `cencov|čencov|chentsov`, `poincar`, `hyperbolic`, `CliffordAntiSybil`,
`type Gaussian`, `PrecisionMean`, `module Cl3` across `src/` and `docs/` with
`references/prior-art/` excluded. Found: the 2026-08-18 contortion falsifier (categorical family),
`SoftValueInfo.fs` (KL over the candidate support), `TangleNavigator.fs`, `PolarityFilter.fs`,
`PhasePortrait.fs`. **No existing treatment of the Gaussian family's Fisher–Rao geometry, and no
`Cl(2,1)` anywhere in the tree.** A same-day sibling, `gromov-hyperbolicity.ts`, measures δ-
hyperbolicity of the _tower graph_ — a different object (combinatorial, not Riemannian); the two
should be read together but neither implies the other.

## Pointers

- `src/Bayesian/CliffordAntiSybil.fs` — the module under test.
- `tests/Bayesian.Tests/CliffordAntiSybil.Tests.fs` — `CAS-4`, the off-manifold assertion.
- `src/Core/Cl3.fs` — its own header already names Cl(4,1) as "the next slice"; §1 argues the
  next slice is Cl(2,1), for a different reason than the one recorded there.
- `src/Bayesian/CloneDetectionBenchmark.fs` — the existing rotor-vs-Pearson-vs-Procrustes bench;
  the natural home for a fourth arm.
- `docs/research/2026-08-18-falsifier-1-fails-no-levi-civita-analogue-*.md` — the categorical
  half of the same geometry.
- `.claude/rules/numerology-vs-number-theory.md` — why §1 is a table of invariants.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §4's last paragraph exists.
