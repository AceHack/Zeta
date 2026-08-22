# Which eights are the same eight — the mod-8 correspondence matrix

**Date:** 2026-08-18
**Work item:** `081M0B8JP9X087G0R000PBXTCE`
**Author:** Lumen (mathematical-physics-expert)
**Executable half:** `src/Core.TypeScript/algebra/mod-eight-correspondence.ts` (+ `.test.ts`, 23 tests)

**Verdict in one line:** four of the six eights are **one eight** — the order of the cyclic
group in which the Weil index of a real quadratic form takes its values — one is a
**restatement** of another, and **Legendre's eight is not one of them and is not even a mod-8
condition**, which is the clean negative.

---

## 0. The question, and the standard it has to meet

The tree keeps meeting the integer 8. A shared integer is not a connection
(`.claude/rules/numerology-vs-number-theory.md`: _"a coincidence of counts is numerology; an
identification requires structure"_). So for every pair below there is either a **named theorem
or functor** carrying one to the other, or **two named and different mechanisms** — never a
shrug.

The six candidates:

| #   | statement                                                           | anchor                                                      |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `Cl(p,q)` depends only on `p − q (mod 8)`                           | Atiyah–Bott–Shapiro, _Clifford Modules_, Topology 3 (1964)  |
| 2   | doubly-even self-dual binary codes exist only at length ≡ 0 (mod 8) | Gleason (1970); Mallows–Sloane                              |
| 3   | even unimodular lattices exist only at signature ≡ 0 (mod 8)        | Milnor–Husemoller ch. II; Serre, _A Course in Arithmetic_ V |
| 4   | `n` is a sum of three squares unless `n = 4^a(8b+7)`                | Legendre (1798), Gauss _D.A._                               |
| 5   | adinkra / garden algebra closure at `N = 8`                         | Radon (1922), Hurwitz (1923); DFGHIL arXiv:0806.0051        |
| 6   | real Bott periodicity, `KO` has period 8                            | Bott (1959); ABS (1964)                                     |

---

## 1. The correspondence matrix

Verdicts: **THEOREM** (a named theorem or functor carries one to the other) ·
**RESTATEMENT** (the same statement in different vocabulary) · **COINCIDENCE** (two different
mechanisms, same integer) · **INDIRECT** (connected only through a third item).

| pair                 | verdict                                | the mechanism, named                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 – 3                | **THEOREM**                            | The **Weil index**. Both eights are the order of the value group of `gamma`, equivalently of the Brauer–Wall group `BW(R)`. Derivation in section 2; computed in section 3. **This was the open question; it is now closed.**                                                                                                                                                                                                                                                                                    |
| 2 – 3                | **THEOREM**                            | **Construction A** (Conway–Sloane ch. 7). Self-dual gives unimodular; doubly-even gives even. Item 2's "only if" is _derived from_ item 3's. Executed on the in-tree code.                                                                                                                                                                                                                                                                                                                                       |
| 1 – 2                | **THEOREM**                            | Via 3; and directly, the phase `exp(i·pi·n/4)` that MacWilliams duality forces on a self-dual code's weight enumerator at `(1, i)` **is** the archimedean Weil index of the rank-`n` standard form.                                                                                                                                                                                                                                                                                                              |
| 1 – 5                | **RESTATEMENT**                        | The garden-algebra relations `L_I R_J + L_J R_I = 2 delta_IJ` _are_ Clifford relations at signature `(0,N)`. The closure is **Hurwitz–Radon**, whose modern proof is the real Clifford module classification. Item 5 is item 1 evaluated at a signature.                                                                                                                                                                                                                                                         |
| 2 – 5                | **THEOREM**                            | **DFGHIL 2008**: an `N`-colour adinkra is the `N`-cube quotiented by a doubly-even code of length `N`. A genuinely _second_ route to the same number — and it agrees with the Clifford route at every `N` from 1 to 12 (section 3).                                                                                                                                                                                                                                                                              |
| 1 – 6                | **THEOREM**, not a restatement         | ABS's theorem is that the Grothendieck groups of graded Clifford modules compute `KO`. Worth stating _why it is not a restatement_: `BW(R) ≅ Z/8` is elementary algebra, while `pi_(k+8)(O) ≅ pi_k(O)` was proved by Bott with Morse theory on loop spaces, using no Clifford algebra at all. Two independent proofs, one theorem identifying them.                                                                                                                                                              |
| 3 – 6                | **THEOREM**, deep — _and out of scope_ | The **Rokhlin** route: signature divisible by 16 for a smooth closed spin 4-manifold, proved through the index theorem. It genuinely connects them, and the connecting quantity is the _quaternionic_ row of the clock: `Cl(4)` sits at `s = 4`, so the Dirac index in dimension 4 is quaternionic, hence even, which upgrades `8 divides sigma` to `16 divides sigma`. Note what that means: **the Clifford clock supplies the refinement 8 to 16, not the 8 itself.** See section 5 for why we may not use it. |
| 3 – 5, 2 – 6, 5 – 6  | **INDIRECT**                           | Composites of the rows above. No direct mechanism, and none needed.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **1 – 4**            | **COINCIDENCE**                        | Section 4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **2 – 4**            | **COINCIDENCE**                        | Section 4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **3 – 4**            | **COINCIDENCE**                        | Section 4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **4 – 5**, **4 – 6** | **COINCIDENCE**                        | Section 4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

So: items **1, 2, 3, 5, 6 are one eight**, joined by named theorems, with 5 a restatement of 1.
Item **4 is a different eight** and, as it turns out, is not a mod-8 statement at all.

---

## 2. Settling 1 – 3: the Clifford eight and the lattice eight are the same eight

This was the flagged open question. The argument is four steps, each a standard citable fact,
and the join is a one-line observation about homomorphisms out of `Z`.

**Step 1 — sharpen item 3 so the two statements are about the same expression.**
The theorem is _not_ "dimension ≡ 0 (mod 8)". That form is true only for **positive definite**
lattices. The sharp statement (Serre V.2; Milnor–Husemoller II.5) is:

> An even unimodular lattice of signature `(p, q)` exists **iff** `p − q ≡ 0 (mod 8)`.

The hyperbolic plane `U` is even, unimodular, and of **dimension 2** — it exists because its
signature is 0. Once stated on `p − q`, item 3 is about _literally the same expression_ as item
1, which is a much sharper coincidence than "both are 8" and is what makes the rest worth doing.

**Step 2 — the Clifford eight is `|BW(R)|`.**
The Witt group `W(R)` is `Z`, by signature (Sylvester). The graded Clifford functor induces a
homomorphism `cl: W(R) -> BW(R)` into the **Brauer–Wall group** of `Z/2`-graded central simple
real algebras, and `BW(R) ≅ Z/8` (C. T. C. Wall, _Graded Brauer groups_, J. reine angew. Math.
213 (1964)). `cl` sends the generator `<1>` to `[Cl(1,0)]`, which generates. So `cl` is
"signature mod 8" — which _is_ the Atiyah–Bott–Shapiro classification.

**Step 3 — the lattice eight is the archimedean Weil index.**
The **Weil index** `gamma` of a real quadratic form of signature `(p,q)` is
`exp(i·pi·(p − q)/4)`, i.e. `zeta_8^(p−q)`, an eighth root of unity (Weil 1964). Weil's product
formula over the places of `Q` makes the finite and archimedean indices cancel. For a
**unimodular** lattice the finite places contribute trivially, so `zeta_8^sigma = 1`, i.e.
`8 | sigma`. The number-theoretic form of exactly this is **Milgram's Gauss-sum formula**
(Milnor–Husemoller, appendix 4): for an even lattice `L` with discriminant form `(A, q)`,

> `(1 / sqrt|A|) * sum over x in A of exp(2·pi·i·q(x))  =  exp(2·pi·i·sigma(L)/8)`.

Unimodular means `A` is trivial, the left side is 1, and `8 | sigma` falls out.

**Step 4 — the join.**
`gamma: W(R) -> mu_8` and `cl: W(R) -> BW(R) ≅ Z/8` are both homomorphisms out of `W(R) ≅ Z`,
and both send the generator `<1>` to a **generator** of an order-8 cyclic group (`gamma(<1>) =
exp(i·pi/4)`; `cl(<1>) = 1 in Z/8`). A homomorphism out of `Z` is determined by the image of the
generator. **Hence `cl` and `gamma` are the same homomorphism** under the identification
`Z/8 ≅ mu_8`, `1 |-> exp(i·pi/4)`.

> **Therefore the eight in "Cl(p,q) depends on p − q mod 8" and the eight in "an even
> unimodular lattice has signature divisible by 8" are the same eight: the order of the value
> group of the Weil index, evaluated on the signature.** Connected by theorem, not coincidence.

**Register discipline.** Steps 1–3 are cited literature and each is checkable. Step 4 is a
two-line argument from them, and it is the only part that is mine; it is elementary and I would
hand it to Soraya as such rather than as a research claim. The identification "Milgram's formula
is the number-theoretic form of Weil's product formula" is a _literature_ statement (it is how
the formula is presented in Nikulin's and Scharlau's treatments), not something computed here.

---

## 3. What was computed

Each check takes its input from data that does **not** already contain the answer. Everything
below is in `mod-eight-correspondence.test.ts` unless marked _offline_.

### 3.1 Construction A, executed — the 2 to 3 bridge

| input code                                         | det | integral | even    | norm-1 vectors | norm-2 vectors |
| -------------------------------------------------- | --- | -------- | ------- | -------------- | -------------- |
| `[8,4]` extended Hamming (`AdinkraCode.generator`) | 1   | yes      | **yes** | 0              | **240**        |
| `i2^4` — self-dual, **singly** even                | 1   | yes      | **no**  | **16**         | 112            |

Two hypotheses cleanly separated: **self-dual gives unimodular** (both rows have det 1),
**doubly-even gives even** (only the first row). The second row is the falsifier — same length,
same self-duality, drop doubly-even and you land on `Z^8`, an odd unimodular lattice, which
exists in _every_ dimension and carries no mod-8 obstruction at all. So item 2's eight is
genuinely _inherited_ from item 3's rather than being an independent fact.

Not vacuous: perturbing one generator to weight 5 gives `integral: false, even: false,
norm2: 128`.

**Converged with parallel work, same day.** `ConstructionATheta.fs` and
`tests/Tests.FSharp/Formal/ConstructionAThetaE8.Tests.fs` landed on `main` while this was in
flight, computing the **theta series** of the same lattice and matching it against the
Eisenstein series `E_4`: `1, 240, 2160, 6720, 17520, ...`. Their first shell is the same **240**
counted here, reached from a different observable, and byte-locked in
`src/Core/golden-vectors-construction-a-theta.json`.

So the identification of `L_A([8,4])` with E8 now rests on **three independent observables**:
the Cartan-matrix structure match (`CliffordE8Roots`), the theta series (`ConstructionATheta`),
and the even-plus-unimodular-plus-minimal-vector count here. What this section adds that the
other two do not is the **negative control** — the singly-even code — which is what separates
the two hypotheses and makes the row a bridge rather than one more confirmation of E8.

### 3.2 Gauss–Milgram, executed — the 1 to 3 bridge

Thirteen lattices, `sigma` from 0 to 8. Maximum deviation of the Gauss sum from
`exp(2·pi·i·sigma/8)`: **1.4e-15**. Test tolerance 1e-9; the nearest _wrong_ eighth root is
0.765 away, so the check discriminates all eight residues.

Includes three non-vacuous `sigma ≡ 0` cases with **non-trivial** discriminant groups —
`D4 + D4` (`|A| = 16`), `A2^4` (`|A| = 81`), `A1^8` (`|A| = 256`) — where the sum has to
cancel to exactly 1 rather than being empty; and two **indefinite** even unimodular lattices,
`U` (dimension 2) and `U + U` (dimension 4).

This is the load-bearing computation. Its input is a finite abelian group with a `Q/Z`-valued
quadratic form — arithmetic, finite, with no notion of "positive" or "negative" anywhere in it —
and its output reads off an **archimedean** invariant.

### 3.3 The adinkra eight is the Clifford eight — two sequences, no shared input

Left: maximal doubly-even code dimension `k_max(N)`, exhaustive search, then `2^(N − k − 1)`
(the DFGHIL route). Right: `radonHurwitzMinimalDim(N)` (the Clifford route).

| N              | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8     | 9   | 10  | 11  | 12  |
| -------------- | --- | --- | --- | --- | --- | --- | --- | ----- | --- | --- | --- | --- |
| `k_max`        | 0   | 0   | 0   | 1   | 1   | 2   | 3   | **4** | 4   | 4   | 4   | 5   |
| code route     | 1   | 2   | 4   | 4   | 8   | 8   | 8   | 8     | 16  | 32  | 64  | 64  |
| Clifford route | 1   | 2   | 4   | 4   | 8   | 8   | 8   | 8     | 16  | 32  | 64  | 64  |

Identical at every point. `N = 1..10` is in CI; `N = 11` (2 s) and `N = 12` (275 s) were run
_offline_ and are recorded here rather than paid for on every test run.

The same column also gives **Gleason, searched rather than assumed**: `k_max(N) = N/2` — i.e. a
doubly-even _self-dual_ code exists — at exactly `N = 8` in the range 1 to 12. The search would
have found one at a length not divisible by 8 if the theorem were false.

### 3.4 MacWilliams gives the same eighth root of unity, with no lattice

`S = sum over C of i^(weight)`. Self-duality forces `S = exp(i·pi·n/4) · conj(S)`.

| code                                   | `S`                        | consequence                                                                          |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `[8,4]` extended Hamming (doubly even) | `16 + 0i` — real, positive | `exp(i·pi·n/4) = 1`, so 8 divides `n`                                                |
| `i2^4` (singly even)                   | `0 + 0i`                   | identity vacuous — _which is why singly-even self-dual codes exist at other lengths_ |
| `e8 + e8`, `n = 16` (_offline_)        | `256 + 0i`                 | consistent                                                                           |

The phase `exp(i·pi·n/4)` here is `zeta_8^n` — the archimedean Weil index of the rank-`n`
standard form again. Third appearance of the same order-8 group, reached from a third
direction.

---

## 4. The clean negative — Legendre's eight is not the periodicity eight, and is not mod 8

Aaron's framing was right and the computation sharpens it past what I expected.

**First, the framing argument.** Item 4 asks a **representation** question (_is this number a
value of this form?_); items 2 and 3 ask a **classification** question (_does a form with these
invariants exist?_). Different questions about quadratic forms, and co-occurrence in the same
branch of mathematics is not a mechanism.

**Second, the group-structure discriminator** — the numerology-rule move of asking _what else
has this number_:

| the eight                               | the group                    | order | exponent                              |
| --------------------------------------- | ---------------------------- | ----- | ------------------------------------- |
| items 1, 2, 3, 5, 6                     | `BW(R)`, equivalently `mu_8` | 8     | **8** (cyclic)                        |
| the 2-adic square classes behind item 4 | `Q_2^* / (Q_2^*)^2`          | 8     | **2** (elementary abelian, `(Z/2)^3`) |

Both have order 8. They are **not isomorphic** — one has an element of order 8, the other has
exponent 2 — so an argument that identified them on the count alone would be identifying `Z/8`
with `(Z/2)^3`. (Computed: the eight square classes `±1, ±2, ±5, ±10` all square to 1.) And the
"8" in `8b + 7` is not even that group's order; it is the **conductor** at which odd squares
stabilise (`odd^2 ≡ 1 mod 8`), and the group with that conductor, `Z_2^*/(Z_2^*)^2`, has order
**4**. A group order and a conductor are not the same kind of number.

**Third, and decisively — the excluded set is not a union of residue classes mod 8 at all.**
Brute-force three-square representability against Legendre's criterion for `n` up to 4000: 0
mismatches, 665 excluded. Tallied by residue:

| `n mod 8`     | excluded / total | reading                                           |
| ------------- | ---------------- | ------------------------------------------------- |
| 7             | **500 / 500**    | the whole class                                   |
| 4             | **125 / 500**    | _partial_ — 28, 60, 92, 124, 156, … but **not** 4 |
| 0             | **40 / 500**     | _partial_ — 112, 240, 368, 448, … but **not** 8   |
| 1, 2, 3, 5, 6 | 0 / 500          | none                                              |

Two residue classes are excluded **in part**, because of the `4^a` factor: `28 = 4·7` is
excluded and is `4 mod 8`; `112 = 16·7` is excluded and is `0 mod 8`; `4` and `8` are not
excluded. **So no condition on `n mod 8` describes the excluded set.** Legendre's obstruction is
2-adic — a condition on the whole 2-adic valuation and unit class — whose customary statement
happens to _mention_ 8.

Contrast items 2 and 3, where "≡ 0 (mod 8)" is _literally_ a union of residue classes. That is
the structural difference, and `legendreResidueTally(...).partialResidues` returning `[0, 4]`
rather than `[]` is the machine-checked form of it.

**Honest limit on the negative.** The two eights are not unrelated _ambiently_: the 2-adic Weil
index `gamma_2` takes values in `mu_8` and its evaluation does depend on units mod 8, so the
classical quadratic Gauss sum is a place where both appear. That is a **contact point, not an
identity** — and it is the kind of thing that gets mistaken for one. The register to keep: _the
two eights are cousins in quadratic-form theory over `Q`; neither theorem is derivable from the
other, and the groups are not isomorphic._

---

## 5. Three corrections to what is in the tree

### 5.1 `admitsEvenUnimodularLattice` is stated on the wrong invariant

`CliffordPeriodicity.fs` (on PRs #12014 / #12023, not yet on `main`):

```fsharp
let admitsEvenUnimodularLattice (dimension: int) : bool =
    dimension > 0 && dimension % 8 = 0
```

False as a general statement: the hyperbolic plane `U = [[0,1],[1,0]]` is even and unimodular in
**dimension 2**. The predicate is correct only for **positive definite** lattices, and the sharp
theorem is on the **signature** `p − q`, not the dimension. Test in
`mod-eight-correspondence.test.ts` pins `U`.

This is a correction that _strengthens_ the result rather than weakening it: once item 3 is
stated on `p − q`, it is about the same expression as item 1, which is precisely what section 2
then identifies. The doc comment claiming "these two predicates agree on every input, which is
why the `[8,4]` code lands on E8" also overstates: agreeing predicates are not a mechanism —
Construction A is, and it is now executed rather than asserted.

### 5.2 The mod-8 clock is a **graded** phenomenon, and `classify` alone cannot witness it

Computed: the ungraded Morita shape takes only **5 distinct values** on the 8 clock positions.
`s = 0` and `s = 2` both give real matrix algebras; `s = 4` and `s = 6` both give quaternionic;
`s = 3` and `s = 7` both give complex. So `classify`, which returns the ungraded type, separates
five of the eight positions and **cannot exhibit an order-8 structure**.

Pairing it with the even subalgebra — whose class is `s + 1`, which the module already knows via
`evenSubalgebraClass` — separates all **8**.

That is the honest reading of item 1: the ungraded Brauer group of the reals has order **2**;
the order-8 group is the Brauer–Wall group of `Z/2`-**graded** algebras. "Clifford periodicity
is mod 8" is a statement about _super_ algebra — which is also exactly why it is the adinkra's
eight, since supersymmetry is the grading. The module's existing pairing is the right shape; the
docstring should say that the grading is where the eight lives.

### 5.3 The "three eights, one periodicity" docstring is right, but for a reason it does not give

`CliffordPeriodicity.fs` asserts items 1, 2, 3 are "one phenomenon in three categories joined by
known constructions" and names Construction A for 2 to 3. Construction A does not reach item 1 —
it never leaves the world of lattices and codes. The join to item 1 is the Weil index (section
2), and it deserves naming, because without it the docstring's claim about item 1 rests on the
shared integer alone, which is the thing the numerology rule forbids.

---

## 6. What is out of scope, and why I am not using it

**The Rokhlin route is a real bridge we may not walk.** It connects items 1 and 3 through the
index theorem, and it is the deepest connection in the matrix. But its hypotheses are _a smooth
closed spin 4-manifold_, and nothing in this tree is one. Per Aaron's standing correction — the
frame here is **reversible computing, not general relativity** — importing it would be importing
a theorem whose hypotheses we do not meet. It is recorded in the matrix as mathematics and
carries **no licence to use** in any in-tree claim.

Note also what it would and would not buy: Rokhlin _refines_ `8 | sigma` to `16 | sigma` using
the quaternionic row of the clock. The 8 was already there from lattice theory. So even on its
own terms it is not the source of the eight.

---

## 7. Checks deliberately NOT written, because they would be tautologies

Named so nobody adds them later thinking they are missing coverage:

- **`exp(i·pi·n/4) = 1` iff `8 | n`.** Both sides are the same modular arithmetic in different
  notation. Zero discriminating power.
- **`admitsDoublyEvenSelfDualCode n = admitsEvenUnimodularLattice n`.** Both are literally
  `n % 8 = 0` in the F# source. Their agreement is a restatement of `x = x`.
- **`signatureClass p q = (p − q) mod 8` agrees with anything else defined as `(p − q) mod 8`.**
  Same defect.

The rule of thumb applied throughout: a check earns its place when its **input does not already
contain its answer**. Gauss–Milgram passes that test in the strongest form available here — a
finite arithmetic object emits an archimedean sign.

---

## 8. What remains open

1. **The 2 to 1 direct route.** I connected them via item 3 and via the MacWilliams phase. There
   is a claimed direct route through the **Brown invariant** in `Z/8` of the `Z/4`-valued
   quadratic form on a self-dual code (Brown, _Generalizations of the Kervaire invariant_,
   Annals 95 (1972)), and the identification of Brown's `Z/8` with `BW`'s `Z/8` is standard in
   the literature but **I did not check the entailment**. Left at CONJECTURE.
2. **Whether the Weil-index identification (section 2, step 4) survives a proof assistant.** It
   is two lines and should; it is offered to Soraya as a falsifiable, small target.
3. **`k_max(N)` beyond `N = 12`.** The exhaustive search is exponential. The agreement with
   Hurwitz–Radon is a theorem in the adinkra literature, so this is an assurance exercise, not
   an open mathematical question — but our _evidence_ stops at 12.
4. **Nothing here licenses a physical claim.** These are math-shape correspondences between
   published mathematics and in-tree structures. Item 4's verdict is the reminder: an integer
   that shows up everywhere discriminates nothing until you name the group it lives in.

---

## 9. Anchors

Atiyah, Bott, Shapiro, _Clifford Modules_, Topology 3 (1964) suppl. 1 · Bott, _The stable
homotopy of the classical groups_, Ann. Math. 70 (1959) · C. T. C. Wall, _Graded Brauer groups_,
J. reine angew. Math. 213 (1964) · Weil, _Sur certains groupes d'operateurs unitaires_, Acta
Math. 111 (1964) · Milnor, Husemoller, _Symmetric Bilinear Forms_ (1973), ch. II and appendix 4
(Milgram) · Serre, _A Course in Arithmetic_ (1973), ch. V · Conway, Sloane, _Sphere Packings,
Lattices and Groups_ (1988), ch. 7 · Gleason, _Weight polynomials of self-dual codes_, ICM 1970 ·
Radon (1922), Hurwitz (1923) · Doran, Faux, Gates, Huebsch, Iga, Landweber, arXiv:0806.0051 ·
Rokhlin (1952) · Legendre (1798), Gauss, _Disquisitiones Arithmeticae_ (1801) · Brown,
_Generalizations of the Kervaire invariant_, Ann. Math. 95 (1972) · Lawson, Michelsohn,
_Spin Geometry_ (1989), I.4 · S. James Gates Jr. (adinkras, doubly-even self-dual codes).

**In-tree:** `src/Core/CliffordPeriodicity.fs` (PRs #12014 / #12023) · `src/Core/AdinkraCode.fs` ·
`src/Core/CliffordE8Bridge.fs` · `src/Core/CliffordE8Roots.fs` ·
`.claude/rules/numerology-vs-number-theory.md` · `.claude/rules/toy-is-free-metered-must-be-earned.md`.
