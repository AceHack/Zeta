# The continuation question, answered: one checked Axiom A system, one malformed premise

**Date:** 2026-08-16 · **By:** Otto (shadow) · **Work-item:** `081M05YMHAN087G0R003TT3AS4`
**Answers:** `docs/research/2026-08-16-generate-the-tangle-dont-map-it-pollicott-ruelle-resonances-vs-lyapunov-cartography.md`
(PR #11025) — and corrects two of its claims.

> **The bar this item was filed under:** check the Axiom A hypothesis, do not cite it. A *failed
> attempt* at continuation is not a negative answer — a negative answer requires a **density**
> result (singularities accumulating on the abscissa), the complex-analysis analogue of a divergent
> curvature invariant proving a GR singularity is real rather than a coordinate artifact.

## 0. The answer in five lines

1. **The premise about `FigureEightEnsemble` is false.** It is not the three-body problem and not
   chaotic. Its tick map is **affine** — a cyclic permutation plus a constant translation in
   Gaussian natural-parameter space. All Lyapunov exponents are **exactly 0**, `h_top = 0`, the
   non-wandering set is **empty**, and its orbit-counting zeta is the constant function **ζ ≡ 1**.
   Ruelle's theorem applies *vacuously* and its conclusion is empty. **The question is malformed
   there** — this is a derivation, not a failed attempt.
2. **We do run one genuinely Axiom A system: the Arnold cat map** (`tests/Tests.FSharp/Braid.Tests.fs`).
   Hypothesis **checked**, five conditions, below. Its zeta function is not merely meromorphic — it is
   **rational**, so no natural boundary is even possible.
3. **The derived-vs-measured comparison therefore runs, and they disagree by −1.20%** — and the
   disagreement is **fully explained analytically**: `largestLyapunov` carries a deterministic bias
   of `log|cos θ| / windowLen`. Predicted −0.161754/wlen, measured −0.16175/wlen. Six-digit match.
   Nothing was tuned.
4. **The research doc conflates two different zeta functions**, and the conflation is load-bearing:
   Pollicott–Ruelle resonances are *correlation-decay* rates, not *expansion* rates. On the cat map —
   the best case, where continuation works perfectly — the resonance spectrum is **trivial** and does
   **not** contain `log λ`. So resonances cannot replace `largestLyapunov` even where the generator
   demonstrably exists.
5. **No natural boundary was established anywhere, and none is claimed.** For Hénon at our
   parameters I established only that the *known* hyperbolic regime does not contain them. That is
   an ignorance claim and is registered as **open**, not as a no.

## 1. What we actually run — the census that had to come first

The item names four files. Three of them (`Orbit.fs`, `OrbitBraid.fs`, `BraidEntropy.fs`) are
**generic in the map**:

```fsharp
let largestLyapunov (dist: 'S -> 'S -> float) (step: 'S -> 'S) (nudge: 'S -> 'S) ...
let braidOfTrajectory (map: (float * float) -> (float * float)) ...
```

They are *methods*, not systems. Asking whether `Orbit.fs` is Axiom A is a type error. **The concrete
dynamical systems we run live at the call sites**, and every one of them is in a test:

| system | where | parameters |
|---|---|---|
| logistic map | `tests/Tests.FSharp/Orbit.Tests.fs:41` | `r = 4` |
| plane rotation | `Orbit.Tests.fs:53` | `θ = 0.7` |
| Hénon map | `Orbit.Tests.fs:96,117` | `a = 1.4, b = 0.3` |
| linear expansion | `Orbit.Tests.fs:108` | `×1.2` |
| **Arnold cat map on T²** | `tests/Tests.FSharp/Braid.Tests.fs:228` | `[[2,1],[1,1]]`, mod 1 |
| `FigureEightEnsemble` | `src/Bayesian/` + `tests/Bayesian.Tests/` | Gaussian natural params |

That census is itself the first correction: the doc's §6 and the work-item both say
`FigureEightEnsemble` is *"the figure-eight three-body orbit, the canonical chaotic system we
actually run."* **We do not run the three-body problem anywhere in this repo.** The cat map — not
named in either document — is the one system that actually satisfies Ruelle's hypothesis.

## 2. `FigureEightEnsemble` — the question is malformed, and here is the derivation

### 2.1 The map, in closed form

Read from source (`src/Bayesian/FigureEightEnsemble.fs`, `ThousandBrains.fs`, `Message.fs`):

- A belief is a Gaussian in **natural parameters** `x = (ν, τ)`.
- `Gaussian.( * )` **adds** natural parameters, so `observe s` is `x ↦ x + s`. Translation.
- The "chase" replaces each cell's belief with the previous cell's post-observation belief.

So on the belief triple `(x_A, x_B, x_C) ∈ (ℝ²)³` the tick map is exactly

> **T(x_A, x_B, x_C) = (x_C + s, x_A + s, x_B + s) = P·x + S**

where `P` is the 3-cycle permutation (⊗ I₂) and `S = (s,s,s)`. **An affine bijection: an isometry
composed with a translation.**

### 2.2 Every hypothesis condition, checked

| Ruelle/Smale condition | status on `T` | how established |
|---|---|---|
| phase space compact | **fails** — `(ℝ²)³`, and `τ → ∞` | precision sums each tick; measured `τ = 40` after 20 ticks |
| `DT` hyperbolic | **fails, maximally** — `DT ≡ P`, orthogonal, **all** eigenvalues on the unit circle (1, ω, ω̄) | `P` is a permutation matrix; constant, so this is exact, not estimated |
| Lyapunov exponents | **all exactly 0** | `DT` is an isometry — no estimator needed |
| `Ω(T)` hyperbolic | **vacuous** — `Ω(T) = ∅` | `σ(x) = x_A+x_B+x_C` satisfies `σ(T ⁿx) = σ(x) + 3n·s`, strictly drifting ⇒ every point wanders |
| periodic points dense in `Ω` | **vacuous** — `Fix(Tⁿ) = ∅ ∀n` | `Pⁿx + nS = x` needs `−nS ∈ range(Pⁿ − I)`, but `range` is the sum-zero subspace and `σ(−nS) = −3ns ≠ 0` |

Empirically confirmed against the built assembly (`dotnet fsi` against `Zeta.Bayesian.dll`):

```
sigma_tau after n ticks:  n=1..5  ->  6, 12, 18, 24, 30   (predicted 3n·τ_s = 3n·2)  ✓ exact
belief after 20 ticks:    (ν=100, τ=40)                   (predicted 20·s = 20·(5,2)) ✓ exact
```

### 2.3 The zeta function, derived

`N_n = #Fix(Tⁿ) = 0` for every `n ≥ 1`, so

> **ζ_AM(z) = exp( Σ N_n zⁿ/n ) = exp(0) = 1.**

**Entire. No poles. No zeros. No abscissa of convergence. No resonances to derive.** Axiom A is
*vacuously* satisfied (an empty set is compact, vacuously hyperbolic, and vacuously has dense
periodic points), so Ruelle's theorem technically applies and says nothing. This is the
**vacuity class**: a hypothesis check that passes because there is nothing to check.

Note the cleaner statement available alongside it: `T` is a diffeomorphism of a **non-compact**
manifold, which is outside the setting of Ruelle's theorem in the first place.

### 2.4 The well-posed version of the question

> *For the concrete maps our tests exercise, does the orbit-counting zeta continue past its abscissa
> of convergence `z = e^{−h_top}` — and separately, are Pollicott–Ruelle resonances even the quantity
> that would replace `largestLyapunov`?*

Both halves are answered below, and the second answer is **no** independent of the first.

## 3. The Arnold cat map — Axiom A, **checked**

`tests/Tests.FSharp/Braid.Tests.fs:225-228`:

```fsharp
let frac (v: float) = v - floor v
let cat (x, y) = (frac (2.0 * x + y), frac (x + y))
```

That is the linear toral automorphism `A = [[2,1],[1,1]]` on **T² = ℝ²/ℤ²** — the `frac` is read
from the source, not assumed; the test's own comment says *"on the TORUS (mod 1) so the reference
orbit stays bounded."*

### 3.1 The five conditions

| condition | status | how checked |
|---|---|---|
| **compact phase space** | ✅ | `T²` — the `frac` in the source puts it there |
| **`A ∈ SL(2,ℤ)`, so `A` descends to a diffeomorphism of T²** | ✅ | `det A = 2·1 − 1·1 = 1` |
| **hyperbolic: no eigenvalue on the unit circle** | ✅ | `tr = 3`, `det = 1` ⇒ `λ± = (3±√5)/2 = 2.6180…, 0.3820…`; neither has modulus 1 |
| **uniform hyperbolicity: `DT` splits as `E^s ⊕ E^u` with uniform rates** | ✅ **and trivially uniform** | `DT ≡ A` is **constant** over the whole manifold, and `A` is **symmetric**, so `E^u ⊥ E^s` are the eigendirections with constant rates — the hyperbolicity constant is `C = 1`, exactly |
| **`Ω(T) = T²`, periodic points dense in `Ω`** | ✅ | `A` preserves Lebesgue measure (`|det| = 1`) ⇒ `Ω = T²`; `Fix(Aⁿ)` = rationals with denominator dividing `det(Aⁿ − I)`, which are dense as `n → ∞` |

**This is what "checked, not cited" means.** Every row is a property of the matrix in the test file,
computed. No citation is doing load-bearing work; Manning/Ruelle enter only to *name* the result the
computation already establishes.

The Anosov ⇒ Axiom A implication is immediate: an Anosov diffeomorphism of a compact manifold has
`Ω` = the whole manifold and is uniformly hyperbolic there by definition.

### 3.2 The zeta function is not merely meromorphic — it is **rational**

Periodic-point count for a hyperbolic toral automorphism: `N_n = |det(Aⁿ − I)| = tr(Aⁿ) − 2`.
Verified by integer matrix powers:

```
n     1    2    3     4     5      6      7      8
N_n   1    5    16    45    121    320    841    2205
λⁿ+λ⁻ⁿ−2  identical to 4 d.p. at every n
```

Hence

> **ζ_AM(z) = exp( Σ (λⁿ + λ⁻ⁿ − 2) zⁿ/n ) = (1−z)² / ((1−λz)(1−λ⁻¹z))**

A **rational function**. It continues to all of ℂ. Its only singularities are simple poles at
`z = 1/λ` and `z = λ`, and a double zero at `z = 1`.

**And this settles the natural-boundary question in the strongest possible way, by the density
criterion rather than by a successful attempt:** a rational function has **finitely many**
singularities, so they cannot be dense on any curve. No natural boundary exists — not "we managed to
continue," but "the singularity set is finite." (Anchor: Manning 1971 — Axiom A diffeomorphisms have
*rational* zeta functions. The computation above is that theorem's instance, done rather than cited.)

Abscissa of convergence: `|z| = 1/λ = e^{−h_top}`, i.e. `h_top = log λ = 0.96242365`. This is the
"escape-rate" boundary §5b of the parent doc correctly identifies — a **convergence** boundary,
which is exactly why it is *not* a natural boundary. The parent doc keeps those apart; this
confirms it on a concrete system.

### 3.3 Derived vs measured — the comparison the item asked for, with the disagreement stated

Both numbers on the *same* system, `largestLyapunov` called exactly as the repo's own test calls it:

| | value |
|---|---|
| **derived** — `log λ`, from the pole of the continued ζ at `z = 1/λ` | **0.96242365** |
| **measured** — `Orbit.largestLyapunov`, 250 windows × 14 (the test's own parameters) | **0.950870** |
| **disagreement** | **−0.011554 (−1.20%)** |

**They disagree. The measurement is low.** Reported as measured; nothing tuned.

Then the useful part — the disagreement is **not noise, it is a derivable bias**:

| `windowLen` | measured λ | error | error × wlen |
|---|---|---|---|
| 4 | 0.921985 | −0.040438 | −0.16175 |
| 8 | 0.942204 | −0.020219 | −0.16175 |
| 14 | 0.950870 | −0.011554 | −0.16176 |
| 20 | 0.954336 | −0.008088 | −0.16176 |
| 28 | 0.956664 | −0.005760 | −0.16128 |
| 40 | 0.895165 | −0.067259 | *breaks down — saturation* |

The error is exactly `c / windowLen` with `c = −0.16175`. **Derivation of `c`:** the estimator seeds
its perturbation along `(1,0)`; `A` is symmetric so its eigenvectors are orthonormal; the unit
unstable eigenvector is `(0.850651, 0.525731)`; the perturbation's component along it is
`|cos θ| = 0.850651`; and `‖Aⁿv‖ ≈ |cos θ|·λⁿ‖v‖`, so

> `λ̂(T) = log λ + log|cos θ| / T`, with `log(0.850651) = −0.161754`.

Predicted vs measured, to six decimals:

```
wlen    4        8        14       20       28
pred    0.921985 0.942204 0.950870 0.954336 0.956647
meas    0.921985 0.942204 0.950870 0.954336 0.956664
```

The `wlen = 40` row is the **saturation** the `Orbit.fs` docstring already warns about
(*"windowLen too long saturates it"*) — `2.618⁴⁰ × 10⁻¹⁶ ≈ 4.6`, past the torus diameter. **The
repo's own honest caveat, reproduced exactly.** Good docstring.

**What this buys, and it is the real yield of the item:** where the generator exists, it supplies
the *exact* value, which lets you **calibrate the cartographic estimator's bias** instead of
guessing at it. That is a smaller claim than "replace `largestLyapunov`", and unlike that one it is
true.

**Honest limit on generalising it:** the six-digit match relies on `A` being *symmetric and
constant*, so `|cos θ|` is one exact number. For a nonlinear map the finite-window bias is neither
constant nor even sign-stable — see §5.

## 4. The conflation — two different zeta functions, and it matters

The parent doc §2 states:

> *"the **poles** of the meromorphically continued Ruelle zeta function are the **Pollicott–Ruelle
> resonances** — the system's correlation-decay rates. That is the same class of information
> `largestLyapunov` samples."*

The first sentence is correct. **The second does not follow, and on the cat map it is false.** Two
distinct objects are being merged:

| object | what its poles give | what it is |
|---|---|---|
| **Artin–Mazur / orbit-counting zeta** `exp(Σ N_n zⁿ/n)` | leading pole at `e^{−h_top}` ⇒ **topological entropy / expansion** | counts periodic orbits |
| **Pollicott–Ruelle resonances** | **correlation-decay** rates | eigenvalues of the transfer operator on anisotropic Banach spaces |

**A Lyapunov exponent is an expansion rate, not a correlation-decay rate.** For the cat map the
difference is decisive, by a one-line exact computation. For characters `e_k(x) = e^{2πi⟨k,x⟩}`:

```
⟨e_k ∘ Tⁿ , e_m⟩ = ∫_{T²} e^{2πi⟨(Aᵀ)ⁿk − m, x⟩} dx = δ((Aᵀ)ⁿk, m)
```

Since `‖Aⁿk‖ → ∞` for `k ≠ 0`, this is **exactly zero for all large n**. Correlations of smooth
observables do not decay exponentially — they **vanish identically after finitely many steps**. The
transfer-operator spectrum on smooth observables is `{1}` and nothing else. **The cat map has no
non-trivial Pollicott–Ruelle resonances at all, and certainly none at `log λ`.**

So: **even in the one system where continuation demonstrably works — where the zeta is not just
meromorphic but rational — the Pollicott–Ruelle resonances do not deliver `largestLyapunov`'s
quantity.** The substitution the doc contemplates fails on its own best case, for a reason that has
nothing to do with continuation.

What *does* deliver `log λ` is the **orbit-counting** zeta (via `h_top = log λ`, and Pesin's formula
`h_μ = λ⁺` for the Lebesgue/SRB measure of a linear Anosov with a single positive exponent). That is
a different zeta than the one §2 names. §3.3 above therefore quietly uses the *correct* one, and the
parent doc's §2 needs the row split.

**Register:** the correction is **verified** for the cat map (exact character computation, checkable
by inspection). The general claim "resonances never give Lyapunov exponents" is **not** asserted —
for open systems the leading resonance *is* the escape rate, exactly as §5b of the parent doc says.
The claim is narrower and sufficient: *they are different quantities, and coincidence must be
argued per system, never assumed.*

## 5. The other three systems

### 5.1 Logistic `r = 4` — Axiom A **fails**, and the zeta continues **anyway**

- `f(x) = 4x(1−x)`, `f'(x) = 4 − 8x`, so **`f'(1/2) = 0`**. The critical point is in `Ω(f) = [0,1]`.
  **Uniform hyperbolicity fails.** Ruelle's Axiom A theorem does **not** apply. ✗
- And yet: `#Fix(fⁿ) = 2ⁿ`, verified numerically by counting sign changes of `fⁿ(x) − x` on a
  2×10⁷ grid — `2, 4, 8, 16, 32, 64, 128, 256` for `n = 1..8`, exact. So

  > `ζ_AM(z) = exp(Σ 2ⁿzⁿ/n) = 1/(1 − 2z)`

  Rational, single pole at `z = 1/2`, `h_top = log 2 = 0.693147`. Continues to all of ℂ.
- **Measured** `largestLyapunov` (the test's own parameters): **0.693494**. Disagreement **+0.05%**.

**Why this row is the important one for the discipline:** the rationality here does **not** come
from Ruelle's theorem. It comes from the periodic-point count being a *topological conjugacy
invariant* and `f` being conjugate to the tent map (via `h(x) = sin²(πx/2)`), hence to a full
2-shift. **Axiom A is sufficient, not necessary.** A failed Axiom A check therefore establishes
*nothing* about the existence of a continuation — which is precisely the sharpened bar's point, and
here it is a live counter-example rather than a caution.

### 5.2 Hénon `(a,b) = (1.4, 0.3)` — **open**, and I will not dress it as a no

What I **did** establish:

- Devaney–Nitecki (1979, *Shift automorphisms in the Hénon mapping*, Comm. Math. Phys. 67:137–146)
  give a hyperbolic-horseshoe (Axiom A) regime for large `a`. I could not confirm the exact constant
  from the primary source; the two forms I found in the secondary literature are `a > 2(1+|b|)²`
  (**= 3.38** at `b = 0.3`) and `a > (5+2√5)(1+|b|)²/4` (**= 4.002** at `b = 0.3`). **Our `a = 1.4`
  is far below both**, so the conclusion is robust to which constant is correct — and I flag the
  uncertainty rather than picking the one I half-remember.
- Benedicks–Carleson (1991) give *non*-uniform hyperbolicity for a positive-measure parameter set
  near `a ≈ 2`, small `b` — which does **not** contain `(1.4, 0.3)`. Whether a strange attractor
  even exists at `(1.4, 0.3)` is, to my knowledge, open.

What I **did not** establish, stated as ignorance:

> **I did not establish a natural boundary for the Hénon zeta function at these parameters.** I did
> not look for, attempt, or find a density-of-singularities result. "Axiom A is not known to hold"
> is *not* "the continuation does not exist" — §5.1 is a live example of exactly that gap. **Status:
> open.** Where I looked: the hyperbolicity literature for the parameter regime, not the zeta
> function's analytic structure.

Measured, for the record (`largestLyapunov`, `windows = 2000`):

```
wlen     1        2        5        10       20       40
λ_max    0.494293 0.455018 0.433933 0.427339 0.422944 0.421243
```

converging from **above** toward ≈ 0.4212 (literature value for the Hénon attractor ≈ 0.419 —
**anchored, not derived here**). **Note the sign flip:** the cat map's finite-window bias is
*negative*, Hénon's is *positive*. So the bias is not universally signed — which is the
methodological point: **an estimator with no derived reference has no way to know its own bias, or
even its direction.** The repo's test uses `wlen = 2` (8.6% high) but only asserts `λ > 0`, so the
test overstates nothing.

### 5.3 The one place the repo already has a **derived**, non-cartographic number

`Orbit.divergenceRate2D` on Hénon returns `Σλ = −1.203973` and `ln 0.3 = −1.203973`. This is not a
lucky estimate: `det J = −b` is **constant** for the Hénon map, so `Σλ = ln|det J| = ln b` is an
exact identity, independent of the orbit. The test's docstring already says so
(*"det J = -0.3 constant"*). **That is a generator-side quantity we already hold** — derived, not
sampled — and it is the honest, small version of what §2–§4 of the parent doc reaches for.

## 6. Where the repo overstates what it has measured

Every row below was checked against a run, not read off a docstring.

### 6.1 `src/Bayesian/FigureEightEnsemble.fs` — the mechanism claim is false as implemented

The module docstring claims a *spiral*: *"the beliefs spiral toward consensus (the fixed point) and
then… stay there"*, *"The groupthink spiral IS the homoclinic tangle"*, *"The rhoProxy should
approach 1"*, *"after enough rounds all three cells will have processed the same information in the
same order."*

**Measured (against `Zeta.Bayesian.dll`, sensory `{ν=5, τ=2}`, canonical codewords):**

```
initial beliefs:  A (ν=0, τ=0)   B (ν=0, τ=0)   C (ν=0, τ=0)     ← all three IDENTICAL
rho history:      1, 1, 1, 1, 1, 1, …          all 20 ticks exactly 1.0
```

`ρ` does not *approach* 1 — it **is** 1.0 at tick 1 and every tick after. There is no spiral, no
convergence, and **no dependence on the loop.** The cause:

- `ThousandBrains.createColumn` gives **every** column the identical uninformative prior `(ν=0, τ=0)`.
- The Adinkra codeword becomes only the column's **`Id` string**. **It never reaches the belief.**
- So the three cells are belief-identical from `t = 0`, and stay so under a shared input.
- The "chase" is a **permutation of the belief multiset** — it is *dynamically inert* on every
  quantity `ρ` reads (variance, max, min are permutation-invariant).

Confirmed by the sharpest available test: **`compareWithIndependent` returns identical `ρ` values when
passed the same codeword three times as when passed three distinct ones.** The seeding that the
docstring calls the identity anchor has zero effect on the reported result. (The `Codeword` field
itself differs, of course — it is carried, and never read by anything that moves.)

### 6.2 `compareWithIndependent` is a comparison of two provably equal numbers

`FigureEightEnsemble` and `YinYangEnsemble.rhoProxy` compute `ρ` by *the same formula*, over the same
belief multiset. Measured: `fig8Rho = 1`, `indepRho = 1`, `identical = true`. **The experiment cannot
distinguish the loop from no-loop**, which is exactly the hypothesis it was built to test.

### 6.3 Three vacuous assertions in `tests/Bayesian.Tests/FigureEightEnsemble.Tests.fs`

Under `ρ ≡ 1.0` these cannot fail:

- **FIG8-3** `rho > 0.5` after 20 ticks — true at tick 1, before any of the claimed mechanism runs.
- **FIG8-5** both `> 0.9` — both are exactly 1.0 by construction.
- **FIG8-6** "ρ history is monotonically non-decreasing" — **a constant sequence is trivially
  non-decreasing.** The docstring reads this as *"the information-theoretic analog of the homoclinic
  tangle: the trajectory spirals toward the fixed point"*; the test would pass identically if the
  chase step were deleted.

To the tests' credit, FIG8-4's comment already concedes half of it: *"When all cells receive the SAME
input, they converge regardless of seed."* The docstrings above it were not updated to match.

### 6.4 The parent doc and work-item

- **§6 / the work-item premise:** `FigureEightEnsemble` called *"the figure-eight three-body orbit …
  the canonical chaotic system we actually run."* It is a linear Gaussian update loop that shares
  only a name — zero Lyapunov exponents, zero entropy. The three-body problem is not run anywhere in
  this repo.
- **§2's conflation** — see §4 above. This is the substantive one.
- **§1 is accurate and should stand.** I re-read `PhasePortrait.fs` and `Orbit.fs`; the "our tangle
  handling is cartography" reading is correct.
- **§5b is accurate and should stand.** The convergence-boundary-is-set-by-`h_top` claim is confirmed
  concretely here: the cat map's abscissa is exactly `e^{−h_top}`, and it is *not* a natural boundary.
- The parent doc's own register table is **honest** — it marked "our systems admit such a
  continuation" as **UNKNOWN** and "resonances could replace `largestLyapunov`" as **NOT claimed**.
  Both rows can now be filled in, and the second one gets a **no** for a reason the doc did not
  anticipate.

### 6.5 What the repo gets right, and should not be "fixed"

- `Orbit.largestLyapunov`'s docstring: *"it is an ESTIMATE, not a certified exponent"* and
  *"windowLen too long saturates it."* **Both reproduced exactly** (§3.3). This is a docstring whose
  caveats are load-bearing and correct.
- `BraidEntropy`'s peel about raw Artin growth being an estimate, not a certified train-track
  dilatation — correct and correctly scoped.
- `Braid.Tests.fs`'s BRIDGE test peel: *"this equality holds because it is the canonical cat-map /
  σ₁σ₂⁻¹ pA correspondence, NOT because λ_max = growthRate for arbitrary systems."* Exactly right,
  and exactly the discipline §4 above is applying to a different pair of quantities.

## 7. Register

| claim | register |
|---|---|
| `FigureEightEnsemble.tick` is the affine map `x ↦ Px + S` | **verified** — derived from source, confirmed exactly against the built assembly |
| its Lyapunov exponents are all exactly 0; `Ω = ∅`; `ζ_AM ≡ 1` | **verified** — `DT` is a permutation matrix; drift functional `σ` exhibited |
| the item's premise (three-body / chaotic) is false | **verified** |
| the Arnold cat map is Anosov ⇒ Axiom A | **verified** — five conditions computed from the matrix in the test |
| its `ζ_AM(z) = (1−z)²/((1−λz)(1−λ⁻¹z))`, rational ⇒ no natural boundary | **verified** — `N_n` computed to `n = 8`; rationality is Manning 1971 (**anchored**) |
| derived `log λ = 0.962424` vs measured `0.950870`, −1.20% | **verified** — both computed here |
| the −1.20% is the bias `log|cos θ|/T`, predicted −0.161754 | **verified** — 6-digit match at four window lengths |
| the cat map has no non-trivial Pollicott–Ruelle resonances | **verified** — exact character/orthogonality computation |
| resonances ≠ Lyapunov exponents in general | **anchored + demonstrated on one system**; the general negative is **not** claimed |
| logistic `r=4` is not Axiom A but has `ζ_AM = 1/(1−2z)` | **verified** — `f'(1/2)=0`; `#Fix(fⁿ)=2ⁿ` counted to `n=8` |
| Hénon `(1.4,0.3)` is outside the *known* hyperbolic regime | **anchored** — Devaney–Nitecki threshold; exact constant **not** confirmed from the primary source, both candidate forms exceed 1.4 |
| **whether the Hénon zeta has a natural boundary** | **OPEN — not established.** No density result attempted. Not a no. |
| `Σλ = ln b` for Hénon is exact, not sampled | **verified** — `det J = −b` constant; measured `−1.203973` = `ln 0.3` |
| `FigureEightEnsemble` `ρ ≡ 1.0` from tick 1; codeword never reaches the belief | **verified** — run; same-codeword run is output-identical |
| FIG8-3/5/6 are vacuous | **verified** — a constant sequence is trivially monotone |

## 8. Disposition

- **The item closes successfully.** Not with the anticipated clean no, and not with a strained yes:
  the premise was wrong about *which* system, the corrected question has a genuine **yes** on the cat
  map, and the downstream proposal fails anyway for an unrelated reason (§4).
- **Cartography is promoted from default to justified — with a caveat the item did not anticipate.**
  Justified, because for three of our four maps the generator either does not exist, is empty, or
  does not carry the quantity we want. But `largestLyapunov` now has a **measured, signed,
  window-dependent bias** on both systems where a reference value exists (−1.2% cat, +8.6% Hénon at
  the test's own parameters), and the sign is not universal.
- **Nothing in `src/` changed**, per the item's register discipline. No `src/` change is warranted by
  this: §6.1–§6.3 describe a docstring/test-vacuity problem in `FigureEightEnsemble`, which deserves
  its own work-item and its own decision (is the module modelling something real, or is it a name?).
  That is not this item's authorization to spend.

## 9. Anchors (checked where the claim is load-bearing)

- **Manning, A.** (1971) *Axiom A diffeomorphisms have rational zeta functions.* Bull. LMS **3**(2):215–220,
  DOI `10.1112/blms/3.2.215`. — §3.2's rationality; the instance is computed, the theorem names it.
- **Ruelle, D.** (1976) *Zeta-functions for expanding maps and Anosov flows.* Invent. Math. **34**. — the
  meromorphic-continuation theorem the item is about.
- **Pollicott, M.** (1985) *On the rate of mixing of Axiom A flows.* Invent. Math. **81**. — resonances.
- **Smale, S.** (1967) *Differentiable dynamical systems.* Bull. AMS **73** — Axiom A, the definition §2.2/§3.1 test against.
- **Artin, M. & Mazur, B.** (1965) — the orbit-counting zeta.
- **Devaney, R. & Nitecki, Z.** (1979) *Shift automorphisms in the Hénon mapping.* Comm. Math. Phys.
  **67**:137–146. — §5.2; **constant not confirmed from primary source**, flagged in place.
- **Benedicks, M. & Carleson, L.** (1991) *The dynamics of the Hénon map.* Ann. Math. **133**. — §5.2.
- **Miles, R.** *A natural boundary for the dynamical zeta function for commuting group automorphisms* —
  a concrete natural boundary (unit circle) established by **density**, i.e. the shape a negative
  answer would have had to take. Not instantiated here.
- **Benettin et al.** (1980) — the estimator `largestLyapunov` implements; the §3.3 bias is a property
  of the re-seeding variant, not of Benettin's method as published.

## 10. Pointers

- `src/Bayesian/FigureEightEnsemble.fs` · `src/Bayesian/ThousandBrains.fs` · `src/Bayesian/Message.fs`
  (`Gaussian.( * )` = natural-parameter addition — the fact §2.1 turns on)
- `src/Core/Orbit.fs` (`largestLyapunov`, `divergenceRate2D`) · `src/Core/PhasePortrait.fs`
- `tests/Tests.FSharp/Orbit.Tests.fs` · `tests/Tests.FSharp/Braid.Tests.fs` (the cat map)
- `tests/Bayesian.Tests/FigureEightEnsemble.Tests.fs` (§6.3)
- `docs/research/2026-08-16-generate-the-tangle-dont-map-it-pollicott-ruelle-resonances-vs-lyapunov-cartography.md` — the doc this answers and corrects
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — §3.3 is a falsifier; §5.2 stays `open`
- [`anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md) — the entailment check §3.1 performs on "Axiom A (Ruelle 1976)"
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — §4 is that rule's exact shape: two objects sharing a *name* and a *role*, separated only by checking the invariant
