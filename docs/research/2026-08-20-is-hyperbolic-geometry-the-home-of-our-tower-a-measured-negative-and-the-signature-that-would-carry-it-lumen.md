# Is hyperbolic geometry the home of our tower? A measured negative — and the signature that would carry it

**Lumen, 2026-08-20.** Mathematical-physics hat. Advisory: mappings, dimensional checks,
falsifiable conjectures. Nothing here is a binding decision.

> **Carved sentence.** **Zeta has two candidate homes for hyperbolic geometry and today they got
> OPPOSITE verdicts, which is the result. On the _continuous_ side it lands: the Gaussian belief
> manifold IS hyperbolic, `K = −1/2`, algebra `Cl(2,1)` — established earlier today in
> `…-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-…-lumen.md`. On the _discrete_
> side it does not. Our named "towers" are PATHS, not branching trees, and a path embeds in
> ℝ¹ with zero distortion — so hyperbolic space buys the tower literally nothing; and on the five
> real graphs this repo actually has, no graph is tree-like and the only one where a null
> comparison is even valid sits INSIDE its own degree-preserving null band. The degree half of
> Krioukov's correspondence is MEASURED and holds (power-law α ≈ 2.5–3.3, KS ≤ 0.07); the
> curvature half is NOT established. What the hyperbolic proposal was reaching for — a distance
> in which "routable-around" (oracle) and "must-route-through" (hub) are visible — already has a
> classical, exact, linear-time answer that needs no geometry at all: Menger's theorem and
> articulation points, which name `docs/BACKLOG.md`, `src/Core/DynamicValue.fs` and
> `src/Core.TypeScript/observe/observe.ts` as hubs in the strict sense of our own rule. Where a
> hyperbolic signature _is_ wanted, it is `Cl(n,1)` — and `Cl(3,0)`, the algebra we already use
> 171 times, is exactly `Cl⁰(3,1)`, the rotor algebra of H³, so we have been holding the even
> half of Lorentzian geometry all along and spending it on Euclidean rotations. The division is
> the lesson: hyperbolicity of a statistical family is a THEOREM about that family, while
> hyperbolicity of a repo artifact would have been an EMPIRICAL property — and artifacts are
> under no obligation to be anything.**

## Register table — every claim, labelled

| #   | Claim                                                                                                                                | Register                                       | Evidence                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------- |
| 1   | Isom(H^n) = O⁺(n,1); the hyperboloid model of H^n sits in ℝ^{n,1}, so the algebra is `Cl(n,1)`                                       | **THEOREM**                                    | standard; Ratcliffe, _Foundations of Hyperbolic Manifolds_ §3.2 |
| 2   | `Cl(1,3) ≅ M₂(ℍ) ≇ M₄(ℝ) ≅ Cl(3,1)`                                                                                                  | **THEOREM**, already **METERED** in-tree       | `tests/Tests.FSharp/CliffordPeriodicity.Tests.fs:59`            |
| 3   | `Cl⁰(p,q) ≅ Cl(p,q−1)`, hence `Cl⁰(3,1) ≅ Cl(3,0)`: our most-used algebra IS the H³ rotor algebra                                    | **THEOREM**, in-tree as `evenSubalgebraClass`  | `src/Core/CliffordPeriodicity.fs:151`                           |
| 4   | Our two named towers are paths of length 3–4, not branching trees                                                                    | **MEASURED** (by inspection + the path test)   | `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` row 5; §3 below   |
| 5   | Degree distributions of `ts-imports` / `fs-modules` / `docs-links` are power-law, α ≈ 2.83 / 3.25 / 2.52, KS ≈ 0.035 / 0.068 / 0.010 | **MEASURED**                                   | `repo-graph-hyperbolicity.ts`                                   |
| 6   | No repo graph is tree-like; `fs-modules` (the only comparable case) sits INSIDE its degree-preserving null band                      | **MEASURED**                                   | ibid.                                                           |
| 7   | δ/diam is invalid as a graph-vs-null comparator when diameters differ; the grid anchor caught it                                     | **MEASURED** (a bug in my own instrument)      | §4 below                                                        |
| 8   | "Routable-around vs must-route-through" = vertex connectivity; exact, linear-time, no geometry                                       | **THEOREM**                                    | Menger 1927; Hopcroft–Tarjan 1973                               |
| 9   | `docs/BACKLOG.md`, `DynamicValue.fs`, `observe.ts` are articulation points — strict hubs                                             | **MEASURED**                                   | §5 below                                                        |
| 10  | Hyperbolic embedding would buy the repo better hub modelling                                                                         | **UNEARNED — refused**                         | §6                                                              |
| 11  | Hyperbolic containment radii for rooms                                                                                               | **UNEARNED — no room graph exists to measure** | §6                                                              |

**Provenance flag.** Every mapping below rides on **borrowed, published mathematics**. These are
**math-shape correspondences** — the shapes match. None of it is evidence that "the geometry
proves our system." Math grounds validity; physics grounds the metering, by analogy.

---

## 0. Reconciliation — this is the second hyperbolic result today, and the first one LANDED

Earlier on 2026-08-20 (commit `0ac05aa5b8`) I landed
`docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-and-the-flat-rotor-verdict-moves-with-the-units-lumen.md`.
Read the two together or neither, because in isolation each is misleading.

> Companion is on origin/main (`0ac05aa5b8`). §4 does not depend on it.

|                     | **belief manifold** (that doc)                                                              | **tower / hierarchy graph** (this doc)                          |
| ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| object              | the location–scale Gaussian family in `src/Bayesian/CliffordAntiSybil.fs`                   | five real repo graphs (imports, modules, docs, skills, commits) |
| kind of object      | a **continuous statistical manifold**                                                       | **discrete artifacts**                                          |
| verdict             | **HYPERBOLIC — landed.** Fisher–Rao curvature `K = −1/2`, computed three independent ways   | **NOT ESTABLISHED — measured negative**                         |
| algebra             | **`Cl(2,1)`**, `Spin⁺(2,1) ≅ SL(2,ℝ)`; `Cl(3,0)` excluded by _non-compactness_, not a count | `Cl(n,1)` _if ever wanted_; nothing currently warrants it       |
| status of the claim | a **theorem** about a named family                                                          | an **empirical property** an artifact was free not to have      |
| consequence         | the shipped Sybil score sweeps `0.9998 → 0.000006` under a unit rescale                     | no action; the intended payoff is superseded by §5              |

**Why the verdicts differ, and it is not luck.** The belief manifold's hyperbolicity is forced:
Fisher–Rao is the canonical metric (Čencov 1982), the location–scale family's Fisher–Rao geometry
_is_ the Poincaré half-plane, and that is a theorem with no empirical content to fail. The repo
graphs had no such obligation. **A statistical family must be what its metric says it is; an
artifact is whatever it grew into.** Expecting the second to inherit the first is the error this
document exists to refuse.

**Two consistency checks between the documents, both of which pass:**

1. That doc argues **against `Cl(4,1)`** for the belief manifold ("a five-dimensional algebra for
   a three-dimensional flat space… our parameter manifold is **two**-dimensional"). This document
   notes that `Cl(4,1)` is already shipped in `src/Core/ConformalGA.fs` and that its hyperbolic
   reading is free. **These do not conflict**: `Cl(4,1)` carries H⁴ and Conf(ℝ³), which is the
   wrong dimension for a 2-parameter belief family and the right one for 3-D conformal work. The
   rule both obey is §2.2's ladder — **the signature is fixed by the dimension of the space you
   are actually in**, never by which algebra is nearest to hand.
2. That doc identifies `Cl(2,1)` via `Spin⁺(2,1) ≅ SL(2,ℝ)` and the Poincaré extension theorem;
   §2.2 below derives the same row from `Isom(H^n) = O⁺(n,1)` and the classification table in
   `CliffordPeriodicity.fs`. Two routes, same row — a check, not a coincidence, and it is worth
   saying which is which under `.claude/rules/numerology-vs-number-theory.md`.

**So the honest one-line summary of Zeta's hyperbolic situation as of today:** the geometry is
real and it lives in the **beliefs**, not in the **file graph** — and one shipped module is
currently paying a measured price for using the flat chart anyway.

## 1. What was asked, and what the answer turned out to be

The proposal: hyperbolic space embeds trees with arbitrarily low distortion while Euclidean space
cannot (Sarkar 2011; Nickel & Kiela 2017), and scale-free networks have latent hyperbolic geometry
(Krioukov et al. 2010) — so hyperbolic geometry should be the home of our tower/hierarchy
structure, and some Clifford signature should carry it.

The motivating facts are real and I checked them rather than assuming them (§2, §7). The
**application to us** does not survive contact with the repo, for two independent reasons, and
the second is the one I did not expect:

1. **The tower is the wrong shape for the argument.** Sarkar's advantage is about _trees with
   branching factor > 1_, where node count grows exponentially with depth and Euclidean space
   runs out of room. Our two named towers branch **not at all**.
2. **The graphs that _do_ branch are not measurably hyperbolic** beyond what their degree
   sequence already explains.

And the thing the proposal was actually reaching for turns out to have a better answer that is
not geometric at all (§5).

---

## 2. Which Clifford signature gives hyperbolic space — worked, not assumed

### 2.1 The construction

Hyperbolic _n_-space is the upper sheet of the unit pseudosphere in Minkowski space:

> H^n = { x ∈ ℝ^{n,1} : ⟨x,x⟩ = −1, x⁰ > 0 }, with the induced metric.

Its isometry group is O⁺(n,1). **Therefore the Clifford algebra that carries H^n is `Cl(n,1)`** —
not because the numbers work out, but because the quadratic form defining the model _is_ the one
the algebra is generated from. The usual model algebra is `Cl(n,1)` (or `Cl(1,n)`); a definite
form has no null cone.

The single structural reason `Cl(p,0)` cannot do this: a **definite** quadratic form has no
isotropic (null) vectors, hence no light cone, hence no ideal boundary and no exponential volume
growth. Our `Cl(3,0)` (×171) and `Cl(8,0)` (×56) are definite. Aaron's _"Euclidean is the boring
one"_ has a precise content: **we have been working in a space with no null cone.**

### 2.2 The ladder, computed and cross-checked

Computed from the classification in `src/Core/CliffordPeriodicity.fs` (Lawson & Michelsohn I.4),
cross-checked against the four independently-known values its own test suite pins —
`Cl(0,1) ≅ ℂ`, `Cl(0,2) ≅ ℍ`, `Cl(1,3) ≅ M₂(ℍ)`, `Cl(3,1) ≅ M₄(ℝ)` — and against the invariant
`dim_ℝ = 2^{p+q}` in every row:

| model                | algebra   | `s = p−q mod 8` | `Cl(n,1)`     | even subalgebra `Cl⁰`   | `Spin(n,1)` |
| -------------------- | --------- | --------------- | ------------- | ----------------------- | ----------- |
| **H²** Poincaré disk | `Cl(2,1)` | 1               | M₂(ℝ) ⊕ M₂(ℝ) | `Cl(2,0)` = M₂(ℝ)       | **SL(2,ℝ)** |
| **H³**               | `Cl(3,1)` | 2               | M₄(ℝ)         | `Cl(3,0)` = M₂(ℂ)       | **SL(2,ℂ)** |
| **H⁴** = CGA of ℝ³   | `Cl(4,1)` | 3               | M₄(ℂ)         | `Cl(4,0)` = M₂(ℍ)       | Sp(1,1)     |
| **H⁵**               | `Cl(5,1)` | 4               | M₄(ℍ)         | `Cl(5,0)` = M₂(ℍ)⊕M₂(ℍ) | —           |

Nickel & Kiela's Poincaré embeddings live in the first row. (MEASURED — the table is computed and
every row satisfies the pinning invariant.)

### 2.3 `Cl(1,3) ≇ Cl(3,1)`, and why the _algebra_ is the weaker question

Both have real dimension 16. **The dimension identifies nothing** — this is the
numerology-vs-number-theory test applied to my own claim. What else has real dimension 16 as a
Clifford algebra of a 4-dimensional space? All five of them:

| signature | `s` | algebra   |
| --------- | --- | --------- |
| `Cl(4,0)` | 4   | M₂(ℍ)     |
| `Cl(3,1)` | 2   | **M₄(ℝ)** |
| `Cl(2,2)` | 0   | **M₄(ℝ)** |
| `Cl(1,3)` | 6   | M₂(ℍ)     |
| `Cl(0,4)` | 4   | M₂(ℍ)     |

The invariant that separates the two Morita classes is the **Brauer class**: `M₄(ℝ)` is Morita-
equivalent to ℝ (trivial class), `M₂(ℍ)` to ℍ (the non-trivial element of Br(ℝ) ≅ ℤ/2). They are
not isomorphic, and no amount of matching dimension makes them so.

But note the row that matters more, and which I did not expect to be the sharp one:
**`Cl(3,1) ≅ Cl(2,2)` — the same algebra from two different signatures.** So:

> **The Morita class does not determine the geometry.** The light cone lives in the _signature_,
> not in the algebra type. "Which Clifford algebra" is strictly weaker than "which signature",
> and a mapping that only matches the algebra has not landed the geometry.

That is the honest guard against the most tempting version of this whole proposal: finding that
some structure of ours "is M₄(ℝ)" would establish nothing about hyperbolicity.

**Engineering consequence, and it is real.** If hyperbolic embeddings were ever computed here,
the convention matters for the byte-lock: `Cl(3,1) ≅ M₄(ℝ)` is 4×4 **real** matrices (a Majorana
representation exists), while `Cl(1,3) ≅ M₂(ℍ)` forces 2×2 **quaternionic** arithmetic. The repo
has already chosen mostly-minus (`CliffordPeriodicity.spacetimeSignature = (1,3)`) for physics
reasons. For four-oracle real-float byte-lock, `(3,1)` is the cheaper convention. (ARGUED.)

### 2.4 The finding worth carrying: we already hold half of it

`evenSubalgebraClass p q = signatureClass p (q−1)` in `CliffordPeriodicity.fs` is the theorem
`Cl⁰(p,q) ≅ Cl(p,q−1)`. Instantiate at `(3,1)`:

> **`Cl(3,0) ≅ Cl⁰(3,1)`.** The algebra this repo uses 171 times **is** the even (rotor)
> subalgebra of Minkowski space — i.e. it is exactly the algebra whose group of unit rotors,
> `Spin(3,1) ≅ SL(2,ℂ)`, is the orientation-preserving isometry group of hyperbolic 3-space
> (and simultaneously the Möbius group of its boundary sphere S² = ∂H³). (THEOREM.)

So the upgrade Aaron asked about is not a rewrite. **It is one generator.** Adjoin `e₄` with
`e₄² = −1` to the existing `Cl(3,0)` and the Euclidean rotor algebra becomes the full Lorentzian
one, with the same rotors now readable as hyperbolic isometries. We have been computing in the
even half of a hyperbolic geometry and spending it on Euclidean rotations.

The same holds one dimension up and is already shipped: **`src/Core/ConformalGA.fs` is `Cl(4,1)`**,
and O⁺(4,1) is simultaneously the conformal group of ℝ³ and Isom(H⁴) — the Poincaré extension
theorem (Ratcliffe §4.4). The file uses it only for the Euclidean identity `P·Q = −½|x−y|²`. The
hyperbolic reading of the same algebra is free.

**One trivial fact, labelled trivial so nobody promotes it.** `signatureClass(n+1,1) =
signatureClass(n,1) + 1 (mod 8)`, so climbing the hyperbolic dimension ladder walks the
Atiyah–Bott–Shapiro clock exactly one step per dimension. This is immediate from the definition
of `p − q mod 8`. It is convenient (our existing mod-8 module already indexes the hyperbolic
ladder) and it is **not a discovery**.

---

## 3. Does our structure look hyperbolic? The tower is the wrong shape

Before measuring anything: the argument that motivates hyperbolic embeddings is about _branching_.
Sarkar's construction and Nickel & Kiela's result concern trees whose node count grows
exponentially with depth — Euclidean space cannot hold that because volume grows polynomially in
radius, while hyperbolic volume grows exponentially.

**Our two named towers do not branch.**

- The **algebraic tower** (register §A row 5): ℝ → ℂ → ℍ → 𝕆. Four nodes, branching factor 1.
- The **Futamura tower**: interpreter → compiler → compiler-generator. Three nodes, branching 1.

A path is 0-hyperbolic (test) and embeds in R^1 isometrically (standard metric geometry, not
instrumented). Distortion 1 is the theorem; the test pins only δ=0. So for the
towers specifically, the entire motivating advantage is zero: there is nothing hyperbolic space
does for a path that the real line does not already do perfectly.

This distinction — **tower ≠ hierarchy** — is the single most useful thing in this document,
because "tower" and "hierarchy" have been used interchangeably and only one of them is the shape
the geometry argument is about.

---

## 4. The measurement — and the two bugs my own anchors caught

**Determinism, stated precisely — because my first draft overclaimed it.** The estimator is
seeded and replays **exactly on a fixed graph**. The _input_, however, is the **live repo**, which
grows. Re-running six commits later moved `n` (1811 → 1805 TS files, 14663 → 14668 docs) and every
commit-DAG row (13535 → 13541 nodes). That is not non-determinism, it is a **different object** —
but "rerunning this file reproduces every number exactly", which is what I first wrote, is false,
and the runner now says so itself and prints the SHA. **All numbers below are pinned to
`809ee500ca`.** The substantive findings were stable across both runs: δ_max and δ_rel were
unchanged for `ts-imports`, `fs-modules` and `docs-links`; only the commit-DAG row moved, and it
was already reported as degenerate.

`src/Core.TypeScript/research/gromov-hyperbolicity.ts` implements Gromov's four-point condition,
CSN power-law fitting, and two null models; `repo-graph-hyperbolicity.ts` extracts five real repo
graphs and measures them. Seeded, deterministic, replays exactly (DST).

### 4.1 The one-way inference, stated before any number is read

Exact δ_max is O(n⁴), so quadruples are **sampled** and the reported δ is a strict **lower bound**
on δ_max. Therefore:

- a **large** sampled δ **CONVICTS** — the graph provably is not δ′-hyperbolic below the witness;
- a **small** sampled δ **never ACQUITS** — it is consistent with a large δ_max hiding in the
  unsampled quadruples.

Every "small δ" below means _no witness found at this sample size_, never _hyperbolic_.

### 4.2 The anchors are in the same table as the data

A measurement you cannot compare to a known answer is not a measurement, so three structures with
closed-form answers ride along: a balanced tree (exactly 0-hyperbolic), the 30×30 grid (flat), and
C₂₀₀ (flat). They calibrated correctly — δ_rel = 0.000 / 0.821 / 0.980, and the cycle's δ_max = 49
against the closed form k/4 = 50.

**They also caught two bugs in my own instrument, which is what they are for.**

**Bug 1 — a runaway loop bound.** The power-law refinement loop read `a <= bestAlpha + 0.01` while
its body assigned to `bestAlpha`. On a tail with no variation the likelihood increases
monotonically in α, so the bound advanced every iteration and the loop ran to float saturation:
the tree anchor reported **α = 112.25 from a grid capped at 6.0**. Invisible on real data;
visible immediately on an anchor whose degree distribution I knew was degenerate. Fixed by
capturing the bound, plus an explicit refusal of tails with fewer than three distinct values —
because for such a tail the MLE genuinely diverges and the KS distance goes to **zero**, i.e. the
fit _looks perfect_. That is the vacuity class in its purest form: a fit that cannot fail. Three
regression tests, all verified to fail with the bug restored and pass without it.

**Bug 2 — δ/diam is not a cross-graph comparator.** My first verdict rule declared the **grid**
"MORE hyperbolic than its degree-preserving null." A grid is the canonical _flat_ space, so the
rule was wrong. The reason generalises and is worth carrying:

> **Randomising a graph collapses its diameter.** The grid's diameter falls from 56 to ~9 under
> degree-preserving rewiring. Any quantity divided by "its own diameter" is then comparing two
> different scales, and the ratio is meaningless. δ/diam is a sound comparator _within_ one graph
> (the anchor scale) and unsound _between_ a graph and a null of different diameter.

The verdict function now **refuses** when null diameters differ by more than 1.5×, and refuses
again when the extreme-value statistic (δ_max/diam) and the bulk statistic (δ_mean/diam) disagree
in sign. It refuses more often than it concludes. That is the correct behaviour and it is why the
result below is a negative rather than the positive my first pass produced.

### 4.3 The results

400,000 quadruples per graph, 7 null replicates, seed `0x5e3da20260820`.

| graph             | n     | lcc   | diam  | δ_max | **δ_rel** | anchor placement      | verdict vs degree-null   |
| ----------------- | ----- | ----- | ----- | ----- | --------- | --------------------- | ------------------------ |
| ANCHOR tree(3,6)  | 1093  | 1093  | 12    | 0     | **0.000** | tree-like             | incomparable (0.2× diam) |
| ANCHOR grid(30)   | 900   | 900   | 56    | 23    | **0.821** | flat, NOT hyperbolic  | incomparable (6.3× diam) |
| ANCHOR cycle(200) | 200   | 200   | 100   | 49    | **0.980** | flat, NOT hyperbolic  | incomparable (1.6× diam) |
| `ts-imports`      | 1805  | 930   | 19    | 4.5   | **0.474** | middle of tree↔grid   | incomparable (2.0× diam) |
| `fs-modules`      | 570   | 478   | 12    | 2.5   | **0.417** | middle of tree↔grid   | **INSIDE the null band** |
| `docs-links`      | 14668 | 1501  | 14    | 1.5   | **0.214** | tree side of middle   | incomparable (2.1× diam) |
| `skills+rules`    | 338   | 25    | 2     | 0     | 0.000     | degenerate (lcc = 25) | degenerate               |
| `commit-dag`      | 13541 | 13541 | 13535 | 0     | 0.000     | a path, degenerate    | INCOMPARABLE (1.8× diam) |

**Reading it honestly:**

- **No repo graph is tree-like.** The two substantive code graphs sit at δ_rel ≈ 0.42–0.47 —
  roughly the **midpoint** between a tree (0.000) and a grid (0.821). They are about as far from a
  tree as from a flat lattice.
- **The one graph where the null comparison is valid — `fs-modules` — lands INSIDE its
  degree-preserving null band.** Its hyperbolicity is fully explained by its degree sequence.
  Hyperbolicity adds nothing on top.
- **`commit-dag` and `skills+rules` are degenerate.** The commit DAG is essentially a path
  (n=13541, diam 13535), INCOMPARABLE (1.8× diam) — a degenerate path, not inside the null
  band. It is trivially 0-hyperbolic _and_ trivially Euclidean — it carries no information
  either way. The skills/rules link graph has a largest component of **25
  nodes out of 338**: it is almost entirely disconnected, which is itself a finding worth
  reporting but not one δ can speak to.
- **The workitem dependency graph could not be measured at all**: 303 of 311 `workitems/*.md`
  carry `depends_on: []`. Search terms used: `^depends_on:`, `^blocked_by:`, `^blocks:`,
  `^parent:`, `^related:` across `workitems/*.md`. That is a claim about those terms; if
  dependencies are recorded somewhere else, I did not find them.

**And the positive half, which is real:** the degree distributions **are** power-law over their
tails, with good fits — `ts-imports` α = 2.83 (KS 0.035), `docs-links` α = 2.52 (KS 0.010),
`fs-modules` α = 3.25 (KS 0.068). All three land in the classic scale-free range 2 < α < 3.3. The
anchors' fits are correctly **refused** or given large KS (grid 0.473, cycle refused), so the
fitter discriminates rather than always producing a number.

> **The verdict on Krioukov.** The correspondence has two halves. The **degree half is measured
> and holds** — preferential attachment producing power-law degree, exactly as
> `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` claims from Barabási–Albert.
> The **curvature half is not established**: where the comparison is valid, δ does not go below
> what the degree sequence alone produces. Under Krioukov that is _expected_ rather than
> contradictory — but it means a hyperbolic embedding would be **re-encoding information we
> already have** rather than adding any.

---

## 5. What the proposal was actually reaching for — and the better answer

The third candidate benefit was: _"a distance in which routable-around (oracle) vs must-route-
through (hub) is visible."_ This is the sharpest of the three, and it does **not** need geometry.

The itron rule already states the discriminator: _"Can you defer elsewhere? Then it is an oracle…
Must you route through it? Then it is a hub."_ That is not a metric statement. It is **vertex
connectivity**, and it is classical:

- **Menger (1927):** the maximum number of internally vertex-disjoint s–t paths equals the minimum
  s–t vertex cut. "Routable-around" _is_ "at least two internally disjoint paths".
- A vertex is a **hub in the strict sense** for some pair iff removing it disconnects that pair —
  i.e. iff it is an **articulation point**.
- **Hopcroft & Tarjan (1973):** all articulation points in **O(n + m)**, one DFS.

Exact, linear-time, no embedding, no curvature, no approximation. A hyperbolic embedding would
give an _approximate_ answer to a question that has an exact one. **Reaching for geometry here
would be strictly worse.** (THEOREM + ARGUED.)

Measured on the same graphs (implementation iterative, because the 13k-deep commit DAG blows a
recursive DFS — a measurement that crashes on the largest real graph is not a measurement):

| graph             | cut vertices          | highest-degree node                                      | is it a cut vertex? |
| ----------------- | --------------------- | -------------------------------------------------------- | ------------------- |
| ANCHOR grid(30)   | **0 / 900 (0.0%)**    | degree 4                                                 | **NO**              |
| ANCHOR cycle(200) | **0 / 200 (0.0%)**    | degree 2                                                 | **NO**              |
| ANCHOR tree(3,6)  | 364 / 1093 (33.3%)    | degree 4                                                 | YES                 |
| `ts-imports`      | 206 / 930 (**22.2%**) | **`src/Core.TypeScript/observe/observe.ts`** (43)        | **YES**             |
| `fs-modules`      | 74 / 478 (**15.5%**)  | **`src/Core/DynamicValue.fs`** (69)                      | **YES**             |
| `docs-links`      | 142 / 1501 (**9.5%**) | **`docs/BACKLOG.md`** (1140)                             | **YES**             |
| `skills+rules`    | 1 / 25 (4.0%)         | `.claude/skills/storage-and-query-engines/SKILL.md` (24) | YES                 |

**Two things fall straight out, and both are actionable:**

1. **Degree does not predict hub-ness — measured, not asserted.** The grid's highest-degree node
   is _not_ a cut vertex; `observe.ts`'s is. This is precisely the rule's own claim (_"the
   discriminator is EXIT, not degree"_) turned from a principle into a computation. The rule says
   §11 becomes "a distribution you can check"; articulation points make it sharper than a
   distribution — a **per-node boolean with a witness**.
2. **We have named strict hubs.** `docs/BACKLOG.md` (degree 1140), `src/Core/DynamicValue.fs`
   (degree 69), and `src/Core.TypeScript/observe/observe.ts` (degree 43) are articulation points:
   remove them and parts of the repo genuinely disconnect. Under the rule's own vocabulary these
   are **hubs, not oracles** — deference that is _enforced_ rather than _chosen_, regardless of
   how they got there ("emergence does not launder enforcement"). Whether that is acceptable is
   an architecture call for Kenji, not mine. What I can say is it is now **measurable and named**
   rather than argued.

---

## 6. What hyperbolic geometry would buy — evaluated, mostly refused

| candidate                                   | verdict                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Better hub / emergence modelling**        | **REFUSED as unearned.** The degree distribution is measured, power-law, and good-fitting. A hyperbolic embedding adds a latent coordinate, which would carry new information only if δ fell below the degree-preserving null. Where the comparison is valid, it does not.                                                                                                               |
| **Natural containment radii for rooms**     | **UNEARNED — and unmeasurable today.** The property is real (hyperbolic balls have exponential volume growth, so a fixed radius holds exponentially many nodes, which is a genuinely nice fit for a Markov-boundary containment story). But there is **no room graph in the repo to measure**, so this is a hypothesis about a structure that does not yet exist. Named falsifier in §7. |
| **A distance making oracle-vs-hub visible** | **SUPERSEDED.** Menger + articulation points answer it exactly and in linear time (§5). Do not build the geometric version.                                                                                                                                                                                                                                                              |
| **The `Cl(3,0) = Cl⁰(3,1)` observation**    | **THEOREM, and cheap.** Not a reason to adopt hyperbolic geometry, but it means that if we ever want it, the cost is one generator, not a rewrite.                                                                                                                                                                                                                                       |

---

## 7. Falsifiers — what would change this verdict

State them so the negative is refutable rather than merely asserted:

1. **A branching hierarchy appears and measures tree-like.** If a genuinely branching structure
   is built (a room containment tree, a taxonomy, a real workitem dependency forest) and its
   δ_rel lands **below its degree-preserving null band with both statistics agreeing** and with
   diameters within 1.5×, the curvature half acquires evidence. Re-run
   `repo-graph-hyperbolicity.ts` with the new graph added; the verdict is computed, not narrated.
2. **The workitem graph gets populated.** 303 of 311 rows have empty `depends_on`. If dependency
   capture becomes real, that graph is the best candidate in the repo for genuine hierarchy, and
   it should be measured before anyone assumes its shape.
3. **A distortion comparison, which I did not run.** The decisive experiment for "is hyperbolic
   the right home" is not δ at all — it is: embed the graph in H^d and in ℝ^d at matched d, and
   compare **average distortion**. δ is a proxy. If someone wants to close this properly, that is
   the measurement, and Sarkar/Nickel–Kiela give the method. My result says the proxy shows
   nothing; it does not prove the direct measurement would.
4. **Exact δ_max.** Everything here is sampled, hence a lower bound. Cohen, Coudert & Lancin
   (2015) give practical exact algorithms; at lcc ≈ 500–1500 an exact computation is feasible and
   would remove the "never acquits" caveat in one direction.

---

## 8. Proposed register row (for `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B)

> **Conjecture Z-3H: Hyperbolic geometry is the natural home of Zeta's tower/hierarchy structure**
> (proposed and tested 2026-08-20).
>
> **Status: NOT ESTABLISHED — measured negative on all five available graphs.** Filed as a row so
> the negative is enumerated rather than lost. The _mathematics_ (§2) is theorem-level and stands
> independently; the _mapping to our substrate_ does not.
>
> - The named towers are paths, so the tree-embedding motivation does not apply to them at all.
> - No repo graph is tree-like; the only graph where a null comparison is valid sits inside its
>   own degree-preserving band.
> - The degree half of Krioukov et al. (2010) IS confirmed (α ≈ 2.5–3.3, KS ≤ 0.07).
> - The intended payoff (oracle vs hub) is superseded by Menger + articulation points, exact and
>   linear-time.
>
> Falsifiers: §7 above, four of them, all runnable.
>
> Evidence: `docs/research/2026-08-20-is-hyperbolic-geometry-the-home-of-our-tower-*.md`;
> checked numbers in `src/Core.TypeScript/research/gromov-hyperbolicity.ts` +
> `repo-graph-hyperbolicity.ts`, 25 falsifiers in `gromov-hyperbolicity.test.ts`.

**For Soraya.** The theorem-level claims in §2 (rows 1–3 of the register table) are the ones
worth formal treatment, and two are already pinned by in-tree tests. The claim I would most like
checked is §2.3's guard — that matching a Morita class does **not** identify a signature — since
that is the one that would stop a future overclaim of the form "structure X is M₄(ℝ), therefore
X is Lorentzian." `Cl(3,1) ≅ Cl(2,2)` is the counterexample.

---

## 9. Anchors (checked, not merely cited)

- **Gromov (1987)**, "Hyperbolic groups", in _Essays in Group Theory_, MSRI 8, 75–263 — the
  four-point condition, used verbatim in `quadrupleDelta`.
- **Krioukov, Papadopoulos, Kitsak, Vahdat & Boguñá (2010)**, "Hyperbolic geometry of complex
  networks", _Phys. Rev. E_ **82**, 036106 — power-law degree and negative curvature as two faces
  of one latent geometry. Checked: this is _why_ the degree-preserving null is the honest control
  and Erdős–Rényi alone is not sufficient.
- **Clauset, Shalizi & Newman (2009)**, "Power-law distributions in empirical data", _SIAM Review_
  **51**(4), 661–703 — MLE α with x_min by KS minimisation. Their thesis is this document's thesis
  one level down: a straight line on a log-log plot identifies nothing.
- **Sarkar (2011)**, "Low distortion Delaunay embedding of trees in hyperbolic plane", _GD 2011_,
  LNCS 7034, 355–366 — trees embed in H² with arbitrarily low distortion. Checked: the result is
  about **trees**, which is what §3 turns on.
- **Nickel & Kiela (2017)**, "Poincaré embeddings for learning hierarchical representations",
  _NeurIPS 2017_ — the applied form; lives in the `Cl(2,1)` row of §2.2.
- **Menger (1927)**, "Zur allgemeinen Kurventheorie", _Fund. Math._ **10**, 96–115 — the exact
  routable-around theorem.
- **Hopcroft & Tarjan (1973)**, "Algorithm 447: efficient algorithms for graph manipulation",
  _CACM_ **16**(6), 372–378 — articulation points in O(n+m).
- **Maslov & Sneppen (2002)**, "Specificity and stability in topology of protein networks",
  _Science_ **296**, 910–913 — degree-preserving double-edge-swap randomisation.
- **Atiyah, Bott & Shapiro (1964)**, "Clifford modules", _Topology_ **3** Suppl. 1, 3–38 — the
  mod-8 clock; already in-tree as `CliffordPeriodicity.fs`.
- **Lawson & Michelsohn (1989)**, _Spin Geometry_, Princeton, I.4 — the classification table and
  `Cl⁰(p,q) ≅ Cl(p,q−1)`.
- **Ratcliffe (2006)**, _Foundations of Hyperbolic Manifolds_, 2nd ed., §3.2 (hyperboloid model,
  Isom(H^n) = O⁺(n,1)) and §4.4 (Poincaré extension).
- **Cohen, Coudert & Lancin (2015)**, "On computing the Gromov hyperbolicity", _ACM J. Exp.
  Algorithmics_ **20** — exact algorithms; named in §7 as the way to remove the sampling caveat.
- **Barabási & Albert (1999)**, _Science_ **286**, 509–512 — preferential attachment; the degree
  half that this measurement confirms.

## 10. Pointers

- `docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-and-the-flat-rotor-verdict-moves-with-the-units-lumen.md`
  — the companion result, and the one that **landed**. Read §0 above before reading either alone.

- `src/Core.TypeScript/research/gromov-hyperbolicity.ts` — the library (δ, nulls, CSN fit,
  articulation points).
- `src/Core.TypeScript/research/gromov-hyperbolicity.test.ts` — 25 falsifiers, including the
  anchors with closed-form answers and three regression tests for the runaway-α bug.
- `src/Core.TypeScript/research/repo-graph-hyperbolicity.ts` — the five extractors and the runner.
- `src/Core/CliffordPeriodicity.fs` + `tests/Tests.FSharp/CliffordPeriodicity.Tests.fs` — the
  mod-8 clock this document's §2 stands on.
- `src/Core/ConformalGA.fs` — `Cl(4,1)`, already shipped, currently Euclidean-only.
- `.claude/rules/numerology-vs-number-theory.md` — §2.3 and §4.2 are this rule applied to my own
  claims.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register labels throughout.
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — the oracle/hub discriminator
  that §5 makes computable.
