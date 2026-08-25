# Does the DLA meter measure a fractal dimension? Four estimators, one typed-in constant

**Author:** Lumen (mathematical-physics hat), shadow\*, 2026-08-25
**Question routed in:** *"Does Zeta's DLA meter actually measure a fractal dimension,
or does it report a number that was put there by hand?"*
**Register discipline:** `.claude/rules/toy-is-free-metered-must-be-earned.md`,
`.claude/rules/numerology-vs-number-theory.md`, `.claude/rules/anchor-to-human-prior-art.md`.

---

## 0. Answer in one paragraph

**`1.322` was typed in and never computed.** No code path in this repo has ever
produced it from a measurement — it entered as a literal in the commit that created
`src/wasm-dla/wat/dla.wat` and propagated as prose. Separately, the tree contains
**four different functions all called "D_f"**, computing four different quantities,
two of which are not dimensions at all. The one genuine box-counting estimator is
correctly implemented but is read **inside its saturation regime**, where it returns
a number governed by the sample size rather than by the geometry — I demonstrate this
with a control of *known* dimension. Meanwhile the standard mass-radius estimator, run
on the very same byte-locked clusters, returns **1.668 ± 0.06**, within 2.5% of the
accepted Witten–Sander value 1.71. So the cluster *is* scaling like 2-D DLA; the repo
was simply not measuring it with an estimator in a valid window.

**Three of the leads that routed this work were already fixed, and I say so in §6.**

---

## 1. What each of the four "D_f" functions actually computes

| # | Location | Expression | What it is | Register |
|---|---|---|---|---|
| 1 | `src/wasm-dla/wat/dla.wat` `get_df()` | `csize / (maxR·maxR)` | **A number density**, N/R² — not a dimension | `toy` (dead code, zero callers) |
| 2 | `src/wasm-dla/bytelock/reference.mjs` `boxCountingDimension` | LSQ slope of `ln N(ε)` vs `ln(1/ε)`, ε ∈ {2,4,8,16} | **Real box-counting**, read in the saturated window | `metered` as an *algorithm*; the *DLA value* it reports is `toy` |
| 3 | `src/Core.TypeScript/oracle/dla-meter.ts` `fractalDim` | same, ε = 2 … min(W,H)/2 | Real box-counting, wider window; magic `1.5` fallback | `unmetered` |
| 4 | `demo/identity-dla-site/.../OracleV8Bytecode.tsx` | `ln N / ln(√N + 1)` | **Geometry-blind** — a function of the particle *count* alone | `toy` |

### 1.1 `get_df()` returns a density, and its comment is false about its own code

The comment above it reads *"Returns 1.322 for a well-grown DLA cluster"* and
*"return csize / (maxr \* maxr) \* 1.322 as a proxy"*. **The `* 1.322` is not in the
code.** The function body is `(f64.div csize (f64.mul maxr maxr))` — no constant. So
the frequently-repeated claim that dla.wat contains *"a hardcoded ~1.322 constant"*
is itself inaccurate: the number lives only in a comment, and the executable path
computes something else entirely.

What it computes, measured on the eight byte-locked seeds:

```
seed  N     maxR    N/R^2
1     332   32.311  0.3180
7     338   30.083  0.3735
42    339   37.000  0.2476
99    307   33.734  0.2698
256   278   33.242  0.2516
1000  329   28.018  0.4191
2718  369   28.653  0.4495
31415 270   32.000  0.2637
```

Range **0.248 – 0.450**. The comment's claimed 1.322 is off by a factor of 3–5 from
what the function returns, on every seed.

**Dimensional read.** N/R² is the mean areal density of the cluster inside its
bounding disc. For any object obeying N ~ R^D, that quantity is **R^(D−2)**, which for
D < 2 *decays without bound as the cluster grows*. It is not scale-invariant, so it
cannot be a dimension — it has no fixed point to converge to. Calling it `get_df` is
a mislabel, not a bad approximation.

### 1.2 `OracleV8Bytecode` computes a dimension without looking at any position

```js
const df = clusterSize < 2 ? 1.322 : Math.log(clusterSize) / Math.log(Math.sqrt(clusterSize) + 1);
```

This never reads a particle coordinate. It substitutes `R = √N` into `D = ln N / ln R`
— which *presupposes* N ∝ R², i.e. D = 2 — and therefore returns
**2 / (1 + 2·ln(1+N^(−1/2))/ln N) → 2** as N grows. At the site's cluster sizes
(N ≈ 300) it displays ≈ **1.96**, and it would display the same value for a solid disc,
a straight line, or a random dust of the same particle count. **A dimension estimator
that is invariant under rearranging every particle is not measuring geometry.** The
`1.322` here is a fallback literal for the degenerate N < 2 case.

---

## 2. The decisive mathematical fact: box-counting a finite point set

> **The box-counting (Minkowski–Bouligand) dimension of any finite set of points is
> exactly 0.**

This is not a subtlety; it is immediate from the definition. For a set of *n* points,
once ε is smaller than the minimum pairwise separation, N(ε) = n for all smaller ε, so
`ln N(ε) / ln(1/ε) → 0`. (Falconer, *Fractal Geometry: Mathematical Foundations and
Applications*, §2–3 — box dimension is finitely stable and vanishes on finite sets.)

Every DLA cluster in this repo is a finite set of ~300 lattice cells. **So "the
box-counting dimension of the cluster" is not a well-posed quantity at all.** The only
meaningful object is *the slope over a stated window of ε*, and that slope is
meaningful only if the window sits inside the scaling regime — above the discreteness
cutoff and below the finite-size cutoff.

`reference.mjs` already says something adjacent and correct — *"D is a function of
(N, grid size, scale set) — a bare number is not meaningful"* — but it does not draw
the consequence, which is that a number measured in the wrong window is not a weak
measurement of D. It is a measurement of the window.

---

## 3. Calibration: what the repo's estimator does to objects of KNOWN dimension

The rule says an anchor must be *checked*, not cited. The same applies to an
estimator: run it on objects whose answer is known. I ran the repo's own box-counting
code (same scales {2,4,8,16}, same 128 grid) against four controls.

```
filled 64x64 square  (true D=2.00000):  2.0000   counts [[2,1024],[4,256],[8,64],[16,16]]
horizontal line      (true D=1.00000):  1.0000   counts [[2,32],[4,16],[8,8],[16,4]]
Sierpinski gasket    (true D=1.58496):  1.5297   2360 cells
Sierpinski @330 pts  (true D=1.58496):  1.0001   330 cells, counts [[2,292],[4,198],[8,95],[16,37]]
```

**Read the last two rows together.** The estimator recovers the Sierpinski gasket's
dimension to 3.5% when the gasket is densely sampled (2360 cells). Subsample *the same
object* — dimension unchanged, still exactly log3/log2 — down to **330 points, matching
the DLA cluster's occupancy**, and the estimator returns **1.0001**.

The mechanism is visible in the counts: at ε = 2 it finds 292 boxes for 330 points.
Nearly every point is alone in its box, so the small-ε end of the fit has already
saturated, and saturation drags the slope toward the isolated-point behaviour.

**This isolates the effect.** The known-dimension control has no finite-size physics
in it whatsoever — a Sierpinski gasket is exactly self-similar at every scale. The
0.585 error is *entirely* estimator artifact. That artifact alone is larger than the
gap the repo attributes to cluster size.

---

## 4. The same clusters, measured with an estimator that is in-window

Witten & Sander's own estimator is the mass–radius relation N(r) ~ r^D. Applied to the
eight byte-locked clusters (two-point form, ln N / ln R):

```
seed:    1      7      42     99     256    1000   2718   31415
lnN/lnR: 1.6703 1.7107 1.6134 1.6276 1.6061 1.7391 1.7617 1.6154
mean = 1.66804
```

**1.668**, against the accepted 1.71 — a 2.5% shortfall entirely consistent with a
finite, on-lattice, tightly-confined cluster. Compare box-counting on the *identical*
clusters: **1.297**, a 24% shortfall.

Two estimators on the same data disagreeing by 0.37 is the signal that at least one is
out of window. §3 says which one.

### 4.1 Local slopes — where the scaling window actually is

Scaling the same algorithm up (grid 1024, N = 5610, maxR = 264), the local slopes:

```
BOX COUNTING                        MASS-RADIUS N(<r)
eps  N(eps)  slope                  r    N(<r)  slope
1    5610    1.084   <- saturated   2    11     1.126  <- lattice cutoff
2    2646    1.285   <- saturated   4    24     1.459
4    1086    1.448                  8    66     1.801  <- window
8    398     1.592   <- window      16   230    1.644  <- window
16   132     1.459                  32   719    1.474
32   48      1.415                  64   1998   0.931  <- outer cutoff
64   18      1.363                  128  3810   0.545  <- outer cutoff
128  7       0.485   <- finite-size
```

Both estimators show the same structure: **roll-off at both ends and a plateau in the
middle**, peaking at 1.59 (box) and 1.80 (mass-radius). The repo's fixed window
{2,4,8,16} puts **half its fit points in the saturated regime**, which is precisely
why it reads low. A window is not a detail here; it is the whole measurement.

Box dimension over increasing cluster size, fixed window {2,4,8,16}:

```
N=339 -> 1.2489   N=765 -> 1.4489   N=2026 -> 1.4013   N=4992 -> 1.4320
```

It climbs and then plateaus near 1.43 — it does **not** converge to 1.71, because the
saturated points stay in the fit at every size. This is a fixed bias, not a
finite-size effect that grows out.

---

## 5. What could 1.322 legitimately be? Applying the rule's own test

`numerology-vs-number-theory.md` asks: *what else has this number?* Candidates within
1% of 1.322, in the neighbourhood of this problem:

| Object | Value | Verdict |
|---|---|---|
| Outer boundary (frontier) of planar Brownian motion = SLE(8/3) | **4/3 = 1.3333** | 0.85% away. Mandelbrot's conjecture, proved by Lawler–Schramm–Werner (2001). |
| Plastic number ρ, root of x³ = x + 1 | **1.32472** | 0.2% away. No connection to Laplacian growth. |
| log₂(2.5) | **1.32193** | 4-digit match. Pure coincidence. |
| 2-D DLA, Witten–Sander | 1.71 | **not** 1.322 |
| Harmonic measure on a 2-D DLA cluster (Makarov) | exactly 1 | not 1.322 |
| 2-D percolation accessible perimeter | 4/3 | same 4/3 as above |

Note the repo already leans on the 4/3 near-match: `ObservatoryPage.tsx` reports that
"D_f ≈ 1.322 corresponds to κ ≈ 2.67", and **8/3 = 2.667** is exactly the SLE parameter
of the Brownian frontier. That is a seductive resonance and it should be **recorded as
a coincidence and never promoted**: it is not evidence, because (a) the conjectured SLE
parameter for DLA is κ ≈ 5.7 giving 1.71, not 2.67, and (b) the 1.322 being
"explained" was never measured in the first place, so there is nothing to explain.

**My honest answer to "what quantity is 1.322?": I don't know of one, and the code
gives no reason to think it is any quantity at all.** Its provenance is a literal in
`dfa6085455 feat(wasm-oracle): Oracle 10 multi-compiler WASM sources` — typed in with
the file, never derived. The correct register for a number with no computed provenance
is not "approximately right"; it is **absent**.

---

## 6. Three leads that were already fixed — stated plainly

I was asked to report refutations as readily as confirmations. Three of the four
routed leads were already addressed on `main`:

1. **`F = D_f² − 3.42·D_f + 0.5` (Z-6) is not live.** It was demoted §A → §B on
   2026-08-01, the script quarantined to
   `docs/research/void-discharges-2026-08-01/z6-fep-attractor-discharge.ts.void`, and
   decisively falsified in `docs/research/2026-08-08-z6-fep-attractor-decisive-falsification-lumen.md`.
   Nothing cites it as evidence. **No action needed.**

2. **§A does not contain 15 discharged rows resting on these numbers — it contains
   none.** §A currently holds 16 rows (floor primitives, serializers, Arrow, protobuf,
   Cayley-Dickson, SchemaEvolution, SoftValue, traveler frame, action grid, uncertain
   clock, frame delta, S1, S2, tick codec, Condorcet/ΔU, small-rooms). **Not one
   depends on D_f or DLA.** The whole DLA batch — Z-2, Z-3, Z-4, Z-5, Z-6, Z-7 — was
   demoted to §B on 2026-08-01. **There is no false discharge to correct.** The
   register worked.

3. **The "hardcoded 1.322 in dla.wat" is a comment, not code** (§1.1). The claim
   appears in `box-counting.test.ts:4` and `reference.mjs:128`; both are corrected in
   this PR. The real defect is worse in kind but different: the function returns a
   *density* under a dimension's name.

**The lead that held** is the vacuity one, and it held completely — see §7.

---

## 7. The commit-pair probe: the detector's positive branch is unfalsified

`runCommitPairProbe` reports `isExcess` — whether mutual information between two
oracle streams exceeds a permutation null. Every test in the suite asserts
`isExcess === false`, or asserts two runs agree. **No test anywhere asserts it can be
true.**

Mechanically confirmed by mutation. Replacing

```ts
isExcess: excessPairs > 0,     ->     isExcess: false,
```

and running both suites:

```
41 pass
0 fail
70 expect() calls
Ran 41 tests across 2 files. [2.96s]
```

**A detector hardcoded to never detect passes its entire test suite.** That is the
vacuity class exactly as the register names it: a check that cannot fail is not a
check.

The root cause is §1 in disguise. The fixtures pin every reading at `fractalDim:
1.322` — a constant. With zero variance in the input, mutual information is
identically 0 for both the real pairing and the null, so `isExcess` is structurally
false and the assertion is trivially satisfied. **The typed-in constant and the vacuous
test are the same defect**: a number that never varies cannot exercise a correlator.

Fixed in this PR by adding a positive control with two genuinely correlated
bucket streams (measured: `meteredPairs=1, isExcess=true, excessFraction=1`), which
kills the mutant above.

---

## 8. Register assignment

Using the rule's exact vocabulary — **toy** (play freely) · **unmetered**
(implemented, used, never falsified) · **metered** (has a falsifier).

| Claim / artifact | Register | Why |
|---|---|---|
| `D_f ≈ 1.322` for DLA, anywhere in the repo | **toy** | Typed in; never computed by any path; no quantity identified |
| `dla.wat get_df()` | **toy** | Returns a density under a dimension's name; zero callers; renamed `toy_density_proxy` |
| `OracleV8Bytecode` `df` | **toy** | Geometry-blind; asymptotes to 2 by construction; renamed `toyDfFromClusterSizeOnly` |
| `boxCountingDimension` *as an algorithm* | **metered** | Now has a falsifier: known-dimension controls (square 2.000, line 1.000, gasket 1.530) added in this PR |
| "the real dimension of this cluster is ≈ 1.30" | **toy** | Measured in the saturation regime; a *known* 1.585 object reads 1.000 at the same occupancy |
| "≈1.30 because 800 walkers is too small for the asymptote" | **toy** | Wrong diagnosis; mass-radius on the same clusters gives 1.668 |
| Mass-radius reading 1.668 on the byte-locked clusters | **unmetered** | A real measurement, reproducible, but a two-point estimator with no error model and no window analysis yet |
| Z-7 `binary_size ⊥ D_f` | **already §B** | Demoted 2026-08-01. Note it survives the correction: every substrate still reports the same D_f whatever the number is — the byte-lock guarantees identical trajectories. The *independence* claim never depended on the *value* |
| `runCommitPairProbe.isExcess` | **metered** (after this PR) | Was unfalsified; positive control added |

---

## 9. Anchors — and which of them I actually checked

Per `anchor-to-human-prior-art.md`, anchors must be checked by entailment, not cited.
Marking each honestly:

- **Witten, T. A. & Sander, L. M. (1981)**, *Diffusion-Limited Aggregation, a Kinetic
  Critical Phenomenon*, Phys. Rev. Lett. **47**, 1400. — The origin of DLA and of the
  D ≈ 1.70 measurement in 2-D, obtained by exactly the mass-radius/density-correlation
  route used in §4. **Checked by entailment**: it supports "2-D DLA has D ≈ 1.7", which
  is the claim I attach to it, and it does *not* support any statement about 1.322.
- **Falconer, K.**, *Fractal Geometry: Mathematical Foundations and Applications*. —
  Box-counting definition, finite stability, and vanishing on finite sets. **Checked by
  entailment** for §2, which is a definitional consequence rather than an empirical one.
- **Meakin, P. (1983)**, *Diffusion-controlled cluster formation in 2—6-dimensional
  space*, Phys. Rev. A **27**, 1495. — Large-scale DLA simulation establishing the 2-D
  value and its slow finite-size convergence. Supports §4.1's claim that crossover is
  real; cited for context, **not** load-bearing for any number here.
- **Halsey, T. C. (2000)**, *Diffusion-Limited Aggregation: A Model for Pattern
  Formation*, Physics Today **53**(11), 36. — The review the repo already cites for
  1.71. **Checked**: it does support D ≈ 1.71 as the accepted 2-D value.
- **Lawler, G., Schramm, O. & Werner, W. (2001)**, *The dimension of the planar
  Brownian frontier is 4/3*. — Used in §5 **only** to name a near-coincidence and
  explicitly refuse to promote it.
- **Makarov, N. G. (1985)**, on the dimension of harmonic measure — harmonic measure in
  the plane has dimension exactly 1. Used in §5 as an exclusion, not a support.
- **UNCHECKED, and flagged as such:** the repo cites `arXiv:2607.02216` alongside
  Halsey 2000 in `reference.mjs` and `box-counting.test.ts`. **I could not verify this
  identifier offline and I am not asserting it is either valid or invalid.** It should
  be checked by someone with network access before it is relied on. Leaving an
  unverified arXiv id attached to a load-bearing number is exactly the "cited but not
  checked" failure the rule names.

---

## 10. What would earn `metered` for a DLA dimension in this repo

Named so the next person has a falsifier to build rather than a vibe to match:

1. **State the window with the number, always.** Report `D = slope over ε ∈ [a,b] at
   N = n on a G×G grid`, never a bare `D_f`. A bare number is not a measurement.
2. **Ship the known-dimension controls beside the estimator** (done in this PR). An
   estimator with no calibration is `unmetered` at best.
3. **Choose the window by the data, not by convention** — fit where the local slope is
   flat, and report the plateau width. If there is no plateau, the honest output is
   "no scaling regime at this size", not a number.
4. **Grow the cluster until a plateau exists.** §4.1 suggests N ≳ 5·10³ on a ≥1024 grid
   gives ~1.5 decades. This changes the byte-lock golden vectors, so it is a separate
   decision — as `reference.mjs` already correctly notes.
5. **Fix the algorithm's own physics before quoting 1.71.** The canonical DLA here
   spawns at `min(maxR+3, 58)` and kills at `spawn+8`. A birth circle 3 cells outside
   the cluster does not sample the harmonic measure, and a kill radius 8 cells beyond
   it truncates the returning walkers that fill fjords. Whatever this algorithm's
   asymptotic dimension is, **there is no reason for it to be Witten–Sander's**, and
   that should be settled before any convergence to 1.71 is claimed. I did not
   determine this variant's true asymptotic D and am not guessing at it.

---

## 11. Scope and what I am not claiming

- I have **not** shown this repo's DLA variant has D = 1.71. I have shown its
  byte-locked clusters give **1.668 under mass-radius** and that the 1.297 box-counting
  figure is dominated by estimator saturation. Those are different claims.
- I have **not** re-derived the accepted 1.71; I take it from the literature above.
- The Sierpinski control proves the estimator is biased at this occupancy. It does
  **not** prove the bias is exactly 0.37 for DLA — bias depends on the object.
- Finite-size effects in DLA are **real** and I am not denying them. My claim is
  narrower and testable: they are not what produces the 1.30, because a
  scale-*exact* fractal shows the same collapse at the same point count.
