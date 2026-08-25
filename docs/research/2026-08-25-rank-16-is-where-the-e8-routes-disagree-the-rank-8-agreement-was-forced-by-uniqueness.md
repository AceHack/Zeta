# Rank 16 is where the E8 routes disagree — the rank-8 agreement was forced

**Date:** 2026-08-25
**Work item:** `081M0X50HY1087G0R003HTDJ1N`
**Author:** Soraya (formal-verification routing), running the one test PR #15415 named and did not run
**Standard applied:** `.claude/rules/numerology-vs-number-theory.md`, `.claude/rules/toy-is-free-metered-must-be-earned.md`
**Computation:** `src/Core.TypeScript/algebra/rank-sixteen-lattice-routes.ts` (+ `.test.ts`, 18 tests, 83 assertions, 5.0s)

---

## Verdict in one line

**The routes disagree at rank 16, so the rank-8 agreement carried no information — and the
"one object" reading dies.** Worse for the synthesis than the adversary guessed: the in-tree
theta-series route cannot even _see_ the difference, the Clifford/versor route is handed the
answer as an input, and the Cayley–Dickson route is **provably incapable** of reaching one of
the two targets. The adversary's `?` — a uniform lattice operation natural in the doubling
carrying A₂ → D₄ → E₈ — is moved from **UNPROVEN** to **PROVEN NOT TO EXIST** under the only
formalisation of "natural in the doubling" I can make precise, and it fails at the _first_ rung,
not at rank 16.

---

## 0. The adversary's not-found, verified

PR #15415 reported "I searched `src/` and `tests/` … and found no rank-16 lattice comparison"
as _not-found_, not _absent_. Re-run with a positive control:

| term                                                                                                                     | files in `src/` + `tests/` | disposition                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `E8Lattice` (**positive control**)                                                                                       | 5                          | search works                                                                               |
| `D16`, `D_16`, `Niemeier`, `Leech`, `Barnes-Wall`, `BarnesWall`, `rank.16`, `rank-16`, `Spin(32)`, `so(32)`, `heterotic` | **0**                      | absent                                                                                     |
| `d16`                                                                                                                    | 10                         | **all ten are lockfile/signature hex** (`uv.lock`, ed25519 vectors) — zero lattice content |
| `unimodular`                                                                                                             | 6                          | all rank-8; `CliffordPeriodicity.admitsEvenUnimodularLattice` is `n % 8 === 0`             |

The not-found stands. There was no rank-16 lattice comparison in the tree. There is one now.

---

## 1. The classification at rank 16 — computed, not cited

**The brief's parenthetical was wrong, and it says so itself.** It offered "the [16,5] / d=8 code"
as the second doubly-even self-dual code of length 16. A self-dual code has `k = n/2`, so a
length-16 self-dual code is `[16,8]`; `[16,5,8]` is **RM(1,4)**, which is doubly-even and
self-**orthogonal** but not self-dual. Both Type II codes of length 16 are `[16,8,4]`.

### 1.1 Exhaustive classification at length 8 — the positive control

`classifyTypeII(8)` enumerates doubly-even self-orthogonal codes dimension by dimension with
explicit permutation-isomorphism testing:

```
dim 1: 2 classes   dim 2: 2 classes   dim 3: 2 classes   dim 4: 1 class
Type II classes at n = 8: 1     |Aut| = 1344 (AGL(3,2))     8!/1344 = 30
```

One class — **the rank-8 uniqueness sink, reproduced from scratch**, with `|Aut|` landing on the
published 1344 without being told to.

### 1.2 Length 16, by mass formula

The one input from outside is the labelled count `N(n) = 2·∏_{i=1}^{n/2−2}(2ⁱ+1)`. It is not
taken on faith: `N(8) = 30`, which is exactly what §1.1 computed independently. Applied at 16:

| code      | `                                                                                      | Aut                         | ` (computed) | class size `16!/ | Aut | `   |
| --------- | -------------------------------------------------------------------------------------- | --------------------------- | ------------ | ---------------- | --- | --- |
| `e₈ ⊕ e₈` | **3 612 672** = 2·1344² (= `Aut(e₈) ≀ S₂`, and the wreath structure was _not_ assumed) | 5 791 500                   |
| `d₁₆⁺`    | **5 160 960**                                                                          | 4 054 050                   |
|           |                                                                                        | **Σ = 9 845 550 = N(16)** ✔ |

The mass balances **exactly**. A missing third class would appear as missing mass, so this is a
proof of "exactly two", not an assertion. (Control in the test: either class alone falls short.)

### 1.3 The second code, canonically — no magic constant

`CODE_D16_PLUS` is built, not pasted: **seven overlapping "domino" tetrads `{2i, 2i+1, 2i+2, 2i+3}`
for `i = 0..6`, glued by the alternating weight-8 vector `(10)⁸`.**

```
1111000000000000        0011110000000000        0000111100000000
0000001111000000        0000000011110000        0000000000111100
0000000000001111        1010101010101010
```

Checked (not asserted): doubly-even, self-dual, `[16,8,4]`.

---

## 2. Question 1 — do the routes land on the same lattice? **No.**

And the interesting part is _which invariants fail to notice_.

### 2.1 Everything that is a COUNT agrees

| invariant                            | `Λ(e₈⊕e₈)`                       | `Λ(d₁₆⁺)`     | discriminates?             |
| ------------------------------------ | -------------------------------- | ------------- | -------------------------- |
| weight enumerator of the code        | `1 + 28y⁴ + 198y⁸ + 28y¹² + y¹⁶` | **identical** | **no** — Gleason forces it |
| number of weight-4 codewords         | 28                               | 28            | **no**                     |
| minimal vectors (kissing number)     | 480                              | 480           | **no**                     |
| rank                                 | 16                               | 16            | **no**                     |
| minimal-vector norms                 | `{4}` (simply-laced)             | `{4}`         | **no**                     |
| determinant after the `1/√2` regrade | 1                                | 1             | **no**                     |
| **theta series** to norm 12          | `1, 480, 61920, 1050240`         | **identical** | **no**                     |

The theta row is the finding, not a footnote. `ConstructionATheta.fs` is the in-tree route that
"identifies" E8, and its docstring is already honest about how — _"evidence that Construction A
over that code produced an even unimodular rank-8 lattice — of which E8 is the unique one
(Mordell 1938)."_ At rank 16, where uniqueness is gone, the same machine returns the **same
series for both lattices**. This is Milnor's 1964 isospectral pair (the original "you cannot hear
the shape of a drum" example), and it is forced: the space of modular forms of weight 8 for
SL(2,ℤ) is one-dimensional, so _every_ even unimodular rank-16 lattice has theta series `E₄²`.

**So the theta route never had discriminating power at rank 8 either.** It measured
even-unimodularity and let a uniqueness theorem do the identifying. That is not a defect in the
module — it says so — but it is fatal to reading four agreeing routes as evidence of a shared
mechanism.

### 2.2 The invariant that DOES separate them

A matching count of 480 is not an identification: **D₁₆ has 2·16·15 = 480 roots and E₈⊕E₈ has
240+240 = 480.** The excluding invariant is connectivity of the root graph:

|            | components of the minimal vectors     |
| ---------- | ------------------------------------- |
| `Λ(e₈⊕e₈)` | **two**, of 240 roots and rank 8 each |
| `Λ(d₁₆⁺)`  | **one**, of 480 roots and rank 16     |

Competitors named and excluded, as the rule requires. Irreducible, simply-laced, rank 16, 480
roots: `A₁₆` has 272 roots (excluded by count); `E₆/E₇/E₈` have rank ≤ 8 (excluded by rank);
`E₈⊕E₈` has 480 but is decomposable (excluded by connectivity). **Only `D₁₆` survives.** The
lattice is then the even unimodular overlattice of the `D₁₆` root lattice — `D₁₆⁺` (Conway–Sloane;
the _name_ is cited, the _structure_ is computed).

There is also a purely code-level separator, independent of any lattice: the weight-4 codewords
span the whole code in `e₈⊕e₈` (dimension 8) but only a dimension-**7** subcode in `d₁₆⁺`.

---

## 3. Question 2 — which lattice does each route select, and why?

| route                              | in-tree site                     | at rank 16 it selects                    | mechanism of selection                              |
| ---------------------------------- | -------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| Construction A over a Type II code | `E8Lattice.fs`, `AdinkraCode.fs` | **whichever code you feed it**           | none of its own — the code is the input             |
| theta series                       | `ConstructionATheta.fs`          | **cannot tell them apart**               | none — identical series                             |
| Clifford / versor closure          | `CliffordE8Roots.fs`             | **whichever Dynkin diagram you feed it** | none of its own — the Cartan matrix is the input    |
| icosian golden doubling            | `IcosahedralH3.fs:211`           | `E₈⊥E₈` only                             | doubling; **cannot reach `D₁₆⁺`** (§4)              |
| `so(16) ⊕ Δ⁺` spinor route         | `CliffordPeriodicity.fs:192`     | `so(32)` → `D₁₆⁺`                        | a _different_ object — a Lie algebra, not a lattice |

**A route that cannot distinguish them never had discriminating power at rank 8 either.** Three
of the five are in that class.

### 3.1 The Clifford route is diagram-driven — demonstrated, not argued

`CliffordE8Roots.fs` is explicit about its construction: it works "in the SAME integer frame as
`E8Lattice.roots` (Construction A over the [8,4] adinkra code)", **hardcodes the E8 Cartan
matrix**, searches that root set for a matching simple system, and closes under the versor
sandwich. Re-running that exact algorithm at rank 16, changing only the supplied diagram:

| ambient root set | supplied diagram | result                                                             |
| ---------------- | ---------------- | ------------------------------------------------------------------ |
| `Λ(e₈⊕e₈)`       | `E₈+E₈`          | simple system found → versor closure = **480 roots, 2 components** |
| `Λ(e₈⊕e₈)`       | `D₁₆`            | none                                                               |
| `Λ(d₁₆⁺)`        | `E₈+E₈`          | none                                                               |
| `Λ(d₁₆⁺)`        | `D₁₆`            | simple system found → versor closure = **480 roots, 1 component**  |

Same code, same dimension, same reflection closure. **The only thing that changed is the answer
handed in as input.** So the versor route is not an independent road to E8 — it is a
_verification_ that a hand-supplied E8 diagram embeds in a root set Construction A already built.
It confirms; it cannot select.

Both negatives are settled, and I separate what was _computed exhaustively_ from what was
_proven_:

- **`Λ(d₁₆⁺)` contains no E₈ subsystem at all — EXHAUSTIVE SEARCH, 34 299 361 nodes, terminated.**
  Two sound prunes: simple roots are linearly independent (so the Gram–Schmidt basis must grow),
  and the first root may be restricted to one representative per irreducible component (a
  simply-laced Weyl group is transitive on the roots of each component, and its elements are
  isometries carrying type-X simple systems to type-X ones). Control: the identical machinery
  finds a `D₈` simple system there in 801 nodes, so "not found" is a property of the root system
  and not of the search.
- **`Λ(e₈⊕e₈)` admits no connected rank-9 diagram — PROVEN, with computed premises.** The 480
  roots fall into two mutually orthogonal families of rank 8 (computed). A connected diagram's
  simple roots have pairwise non-zero inner products along its edges, so they all lie in one
  family; a family spans rank 8; `A₉` needs 9 independent vectors. ∎ The brute-force version of
  this **hit the 3·10⁸-node cap and is INCONCLUSIVE** — reported as such, and not used.

---

## 4. Question 3 — the invariant `?`: **proven not to exist**

The adversary's target:

> There must exist a single lattice-level operation `?` — one uniform rule, not three separate
> classical theorems — carrying A₂ → D₄ → E₈, natural in the Cayley–Dickson doubling.

### 4.1 First, the adversary's own argument is too weak, and should be retired

PR #15415 offered the kissing sequence as evidence against: _"6, 24, 240 has no doubling law
(ratios 4 and 10) while rank does (2, 4, 8)."_ That refutes only a _multiplicative_ rule. Plenty
of functions send 6↦24 and 24↦240; unequal ratios prove nothing on their own. Replace it with
the following, which is structural and computed.

### 4.2 The formalisation, and why it is the honest one

Cayley–Dickson doubling is `CD(A) = A ⊕ A` with norm `N(a,b) = N(a) + λN(b)`. **That norm form is
an orthogonal direct sum** — it is the doubling's _entire_ lattice-level shadow. So the minimal
content of "natural in the doubling" is:

> **(N)** `D(L) ⊇ L ⊥ L`, the inclusion being an isometry onto the doubled module.

Anything weaker makes "natural in the doubling" contentless, because there is nothing else about
the doubling that a lattice can see. _Honest limit: a proposer who offers a different
formalisation is not refuted by what follows. I could not construct one._

### 4.3 Theorem A — no operation satisfying (N) carries A₂ → D₄

`det(A₂ ⊥ A₂) = 9`, `det(D₄) = 4` (computed). A finite-index sublattice satisfies
`det = index²·det(parent)`, so `index² = 9/4` and `index = 3/2 ∉ ℤ`. **`A₂ ⊥ A₂` is not a
sublattice of `D₄` at all.** ∎

The chain breaks at the _first_ rung, not at 16.

### 4.4 …and it breaks even earlier than that

The Cayley–Dickson doubling of ℝ is ℂ, whose maximal order is **`ℤ[i]`, norm form `ℤ²`, kissing
number 4** — not `A₂` (kissing 6). `A₂ = ℤ[ω]` is the maximal order of ℚ(√−3), a field the CD
tower never produces. So `A₂ → D₄ → E₈` is not the CD tower's chain at step 1 either; `A₂` was
chosen because it is the _best_ rank-2 lattice, not because doubling produced it.

### 4.5 Theorem B — any (N)-operation lands on E₈⊕E₈ at rank 16 and can never reach D₁₆⁺

Suppose `D(E₈)` is even unimodular of rank 16. By (N), `E₈ ⊥ E₈ ⊆ D(E₈)`. Both have rank 16 and
determinant 1, so `index² = 1` and `D(E₈) = E₈ ⊥ E₈`. ∎

So the doubling route has **range `{E₈⊕E₈}`** — it selects, but by construction, with no
discriminating power whatever. Independently confirmed by a _stronger_ computed fact: `Λ(d₁₆⁺)`
contains no E₈ subsystem at all (§3.1). The same argument shows `D₁₆⁺` contains no `E₈`
_sublattice_: an `E₈` inside a unimodular lattice splits off orthogonally (E₈ being unimodular),
the complement is even unimodular of rank 8 hence `E₈`, forcing `D₁₆⁺ ≅ E₈⊕E₈` — contradicting
the computed component invariant.

### 4.6 Theorem C — the doubling law _does_ exist; it is ×2, and the chain violates it

| lattice              | kissing | its CD double `L ⊥ L`  | kissing       |
| -------------------- | ------- | ---------------------- | ------------- |
| `ℤ[i] = ℤ²`          | 4       | `ℤ⁴` (Lipschitz order) | **8** = 2×4   |
| `ℤ[ω] = A₂`          | 6       | `A₂ ⊥ A₂`              | **12** = 2×6  |
| `D₄` (Hurwitz order) | 24      | `D₄ ⊥ D₄`              | **48** = 2×24 |

All computed. **The doubled module's kissing number is exactly 2× at every rung.** The claimed
chain is 6 → 24 → 240: ×4 then ×10. Every excess vector comes from the **glue** — the cosets by
which the maximal order exceeds `L ⊥ L`:

- Lipschitz `ℤ⁴` ⊂ Hurwitz, **index 2** (8 → 24 minimal vectors);
- `D₄ ⊥ D₄` ⊂ Cayley integers, **index 4** (`det 16 → 1`, so `index = 4`; 48 → 240).

**The algebra supplies `L ⊥ L`. The glue supplies everything interesting. And the doubling does
not determine the glue** — which is precisely why rank 16 has two answers: `E₈⊕E₈` and `D₁₆⁺`
are two different glue choices over a common sublattice, and nothing in the Cayley–Dickson tower
prefers either.

### 4.7 So what actually generates 6, 24, 240?

**Extremality in the target dimension.** `A₂`, `D₄`, `E₈` are the densest lattice packings in
dimensions 2, 4, 8 — a uniform _rule_, but a property of each dimension re-derived from scratch,
not an operation applied to the previous lattice. It is not natural in any doubling, and §5 shows
it diverges from the even-unimodular rule at 16.

**Verdict: the adversary's `?` moves from UNPROVEN to PROVEN NOT TO EXIST**, for formalisation
(N), by Theorem A. Theorems B and C say what stands in its place.

---

## 5. Why E₈ looked like one object: four criteria collide at rank 8 and separate at 16

| selection criterion                            | rank 8                                                                    | rank 16                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| unique **even unimodular** lattice             | `E₈`                                                                      | **two**: `E₈⊕E₈`, `D₁₆⁺`                                                                                                                                                                                                                                                                                                                                                 |
| **densest** lattice packing                    | `E₈` (proven — Blichfeldt 1935; sphere-packing optimality Viazovska 2016) | **`Λ₁₆` Barnes–Wall** — kissing **4320**, centre density **1/16**, i.e. **16× denser** than either even unimodular lattice (1/256). _Both numbers computed here from Construction B over RM(1,4), reproducing the published values._ **Unverified:** densest-lattice-packing is proven only in dimensions 1–8 and 24, so `Λ₁₆` is densest _known_, not densest _proven_. |
| **maximal-order unit lattice** of the CD tower | Cayley integers `= E₈`                                                    | `E₈ ⊥ E₈` (the doubled module — §4.5)                                                                                                                                                                                                                                                                                                                                    |
| **root lattice** of a simple Lie algebra       | `E₈`                                                                      | `D₁₆` root lattice — determinant 4, **not unimodular**                                                                                                                                                                                                                                                                                                                   |

At rank 8 all four name the same point. At rank 16 they name **four different lattices**. The
agreement was a collision of criteria in one dimension — a fact about the number 8 (Gleason's
mod-8 clock, Hurwitz's terminating list, Bott periodicity), not about a single underlying object.

**And the conflation the brief warns about becomes visible exactly here.** At rank 8, E₈'s
Cartan matrix has determinant 1, so _root lattice = weight lattice = even unimodular lattice_ —
three notions collapse to one, which is why "the E8 lattice" is unambiguous. At rank 16 they
separate into three distinct objects: the `D₁₆` root lattice (det 4), its dual weight lattice,
and `D₁₆⁺` (det 1) sitting between them. Any argument that slid between these senses at rank 8
was surviving on a coincidence.

**Footnote, same shape one level up.** The two even unimodular rank-16 lattices are the two
heterotic string gauge lattices, `E₈×E₈` and `Spin(32)/ℤ₂`. Their algebras have dimension
`248+248 = 496` and `dim so(32) = 32·31/2 = 496` — equal. That agreement is _also_ forced: 496 is
fixed by Green–Schwarz anomaly cancellation, a condition on the target. Even the physics
"coincidence" here is a theorem about what is being aimed at.

---

## 6. The separate question: is Zamolodchikov/Coldea a non-resonance appearance of E₈?

Aaron's position, stated honestly: _"the evidence [for E₈'s significance] is only in the human
resonance, not any other thing that I've seen yet."_

**Answer: yes, it is a genuine one — and it is about a different face of E₈ than every lattice
claim in this thread.** Being precise about which E₈ is the whole point.

### 6.1 What appears, exactly

Zamolodchikov (1989): the critical 2D Ising model perturbed by a magnetic field is integrable,
and its eight particle masses are proportional to the components of the **Perron–Frobenius
eigenvector of the E₈ Cartan matrix**. Computed here from the E₈ **Dynkin diagram adjacency
matrix and nothing else**, against Zamolodchikov's published closed forms as an external anchor:

```
PF eigenvector ratios   : 1.000000  1.618034  1.989044  2.404867  2.956295  3.218340  3.891157  4.783386
Zamolodchikov closed form: 1.000000  1.618034  1.989044  2.404867  2.956295  3.218340  3.891157  4.783386
max deviation 5.3e-15      PF eigenvalue 1.9890437907 = 2cos(pi/30), Coxeter number h = 30
m2/m1 = 1.618033988750 = phi = 2cos(pi/5)   (diff 1.6e-15)
```

_A bug the anchor caught, recorded because it is instructive:_ a Dynkin diagram is a tree, hence
bipartite, so its adjacency matrix has eigenvalues ±λ and plain power iteration **oscillates**
rather than converging. The first run returned a spectrum in which four of eight components were
off by a common factor 1.1106. The published closed forms are what exposed it. Shifting to
`A + 2I` fixes it. This is why an anchor must be **checked**, not cited.

Coldea et al., _Science_ **327**, 177 (2010): CoNb₂O₆, a quasi-1D Ising ferromagnetic chain at
its transverse-field critical point, where weak interchain coupling supplies the longitudinal
perturbation. Neutron scattering resolved the two lowest bound-state masses with ratio
**1.618 ± 0.01**. _(Cited, not computed — I have no access to the data.)_

### 6.2 Which E₈ — the distinction the brief asked for

| face of E₈                                       | does it appear in Coldea/Zamolodchikov?                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **root system / Cartan matrix / Dynkin diagram** | **YES — this is the one.** The masses _are_ its PF eigenvector.                                                                   |
| **Lie algebra `e₈` (dim 248)**                   | Yes, derivatively — the affine Toda theory is built on it.                                                                        |
| **Lie group E₈**                                 | Not directly; no E₈ group action is observed.                                                                                     |
| **the E₈ lattice**                               | **NO.** Nothing in the physics uses unimodularity, Construction A, the theta series, the `[8,4]` Hamming code, or sphere packing. |

So it is a real, measured, non-human-resonance appearance of **E₈ as a symmetry algebra**, and it
**does not bear on the lattice claims at all**. The root system and the root lattice determine
each other at rank 8, so they are "the same E₈" in a precise sense — but every property the
synthesis leans on lives on the lattice side and plays no role here.

### 6.3 Is the identification sound, or is 1.618 numerology?

Applying our own rule — _what else has this number?_ — φ ≈ 1.618 is exactly the kind of value
many things have. Three things carry the identification, and one of them I computed:

1. **It is a prediction, not a fit.** Zamolodchikov 1989 precedes Coldea 2010 by 21 years, and
   predicts the whole 8-mass spectrum plus the S-matrix, not one ratio.
2. **The competitor is excluded by structure.** `D₁₆` has Coxeter number `2·16−2 = 30` — **the
   same as E₈** — and therefore the **same PF eigenvalue** 1.9890437907. Another shared number
   identifying nothing. But its PF **eigenvector** is a different spectrum, and **φ does not
   appear in it** (computed). The eigenvalue is the coincidence; the eigenvector is the
   identification. Exactly the pattern this rule exists to catch.
3. **Honest limit.** The 2010 paper resolved **two** masses clearly, not eight. "8 of 8 measured"
   would be a much stronger claim and is _not_ what happened; later work on related materials has
   reported more of the spectrum, which I have not verified.

### 6.4 The fair answer to Aaron

His claim needs splitting, because two different faces of E₈ have two different evidence bases:

- **The E₈ lattice** has non-resonance evidence that is **mathematical**, not physical: Mordell/Witt
  (unique even unimodular rank-8 lattice) and Viazovska 2016 (provably optimal sphere packing in
  dimension 8). These are theorems. They are not human resonance.
- **The E₈ root system** has non-resonance evidence that is **physical and measured**: Coldea 2010.
- **Neither supports the synthesis**, because the synthesis's claim was never that E₈ is
  significant — it was that a _doubling mechanism_ links these appearances. §4 is that mechanism's
  obituary.

And §5 partly _explains away_ the mystique without denying the facts: E₈ is where four extremal
criteria collide, and the collision is a property of dimension 8. That is a better reason to find
E₈ interesting than resonance, and a worse reason to expect it to keep generalising.

---

## 7. What this does NOT show

- It does **not** show the tree's E8 work is wrong. `E8Lattice.fs`, `ConstructionATheta.fs`,
  `CliffordE8Roots.fs` and `IcosahedralH3.fs` each compute what they say they compute, and their
  docstrings are careful — `ConstructionATheta.fs` names Mordell as the identifying step, and
  `CliffordPeriodicity.fs` says outright that Construction A yields the lattice while the spinor
  route yields the algebra. **The error was never in the modules; it was in reading their
  agreement as evidence.**
- It does **not** refute a Cayley–Dickson ↔ adinkra connection in general. The surviving join from
  PR #15415 — 𝕆 → Fano → `[7,4]` → `[8,4]` — is a derivation and is untouched here.
- It does **not** settle whether some _other_ formalisation of "natural in the doubling" admits a
  `?`. Theorem A covers (N) only.
- The Barnes–Wall row's optimality claim is **unverified** and flagged as such in §5.
- `|Aut(d₁₆⁺)| = 5 160 960` and the labelled-count formula were **not** independently
  cross-checked against a computer-algebra system; the mass balance is the check they have.

---

## Reproduce

```bash
bun test src/Core.TypeScript/algebra/rank-sixteen-lattice-routes.test.ts
# 18 pass, 0 fail, 83 expect() calls, ~5s
```

**Mutation check (the suite is a falsifier, not decoration):** replacing `CODE_D16_PLUS` with
`CODE_E8_PLUS_E8` — i.e. asserting the two routes coincide — turns **6 of 18 tests red**.

**markdownlint does NOT cover this file.** `docs/research/2026-*-*.md` is in the `ignores` list of
`.markdownlint-cli2.jsonc` (line 151). A green markdownlint run says nothing about this document —
a check that did not run, not one that passed.

---

## Anchors (Beacon)

- L. J. Mordell (1938); E. Witt — uniqueness of E₈ among even unimodular rank-8 lattices.
- J. H. Conway & N. J. A. Sloane, _Sphere Packings, Lattices and Groups_ — Construction A (ch. 5),
  the two even unimodular rank-16 lattices (ch. 4 §11), Barnes–Wall (ch. 4 §10), mass formulae (ch. 19).
- V. Pless (1972), _A classification of self-orthogonal codes over GF(2)_.
- A. M. Gleason (1971) — the weight enumerator of a Type II code is forced.
- J. Milnor (1964) — `E₈⊕E₈` and `D₁₆⁺` are isospectral and non-isometric.
- E. S. Barnes & G. E. Wall (1959) — the `Λ₁₆` construction.
- M. Viazovska (2016) — E₈ is the optimal sphere packing in dimension 8.
- P.-P. Dechant (2016, 2017) — the Clifford versor route re-run in §3.1.
- A. B. Zamolodchikov (1989) — the E₈ mass spectrum.
- R. Coldea et al., _Science_ **327**, 177 (2010) — the measurement.
- M. Green & J. Schwarz (1984) — anomaly cancellation forcing dimension 496.
- Doran, Faux, Gates, Hübsch, Iga, Landweber (2008) — the adinkra ↔ doubly-even code correspondence.

## Pointers

- `docs/research/2026-08-25-adversarial-review-the-lattice-cayley-dickson-adinkra-hexagon-synthesis-*.md` (PR #15415) — P0-4 named this test
- `src/Core.TypeScript/algebra/rank-sixteen-lattice-routes.ts` · `.test.ts` — the computation
- `src/Core/E8Lattice.fs` · `ConstructionATheta.fs` · `CliffordE8Roots.fs` · `IcosahedralH3.fs:211` · `CliffordPeriodicity.fs:179,192` — the four routes
- `src/Core.TypeScript/algebra/mod-eight-correspondence.ts` — the rank-8 sibling
- `.claude/rules/numerology-vs-number-theory.md` — the standard applied throughout
