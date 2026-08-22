# `LatticeVoa` graded dimensions — metered: two routes agree, and what that does **not** buy

Scope: the "next rung" PR #10840 §8 costed and Aaron authorized (_"lets do it."_) — **graded dimensions
only, integer-only, one module, one golden vector, no floats, no new dependency.**
Attribution: Aaron authorized the rung; #10840 (shadow/Otto) specified it and derived the target
sequence one way; this PR builds it and derives the same sequence a second way.
Operational status: **code + golden vector + tests.** Registers used below: **[computed]** (run here,
raw exit codes quoted), **[cited-checked]** (the named source was _read_ and states exactly this),
**[coincidence]** (a count, not a structure).

**Date:** 2026-08-15
**Related:** `src/Core/LatticeVoa.fs` · `src/Core/golden-vectors-lattice-voa.json` ·
`tests/Tests.FSharp/Formal/LatticeVoaGradedDimensions.Tests.fs` · `src/Core/E8Lattice.fs` ·
`src/Core/AdinkraCode.fs` ·
`docs/research/2026-08-15-bounded-infinity-the-grading-not-the-tower-affine-vs-voa-continuation-of-the-adinkra-e8-chain.md`
(PR #10840)

---

## 1. What landed

`LatticeVoa` computes `dim (V_L)_n` for `L` = the in-tree E8 lattice — the coefficients of
`theta_L(q) / eta(q)^8` with the `q^(-1/3)` prefactor stripped — as exact `int64`, and byte-locks
nine terms as hex-in-JSON.

```
n:      0    1     2      3       4        5         6          7           8
dim:    1  248  4124  34752  213126  1057504  4530744  17333248  60655377
```

**[computed]** Every value above was produced twice, by two routes that do not share inputs, and
compared against two separately-transcribed published sequences. All four lanes agree.

## 2. What this is **NOT** — stated before anything else, because it is the part that gets rounded up

This buys **a sequence of integers**. It does **not** implement, and must never be cited as evidence
for:

- vertex operators, or any VOA axiom (locality, the Jacobi identity, the Virasoro action);
- the Frenkel–Kac isomorphism `V_L ≅` the level-1 vacuum module of affine E8;
- an E9 action of any kind;
- anything about the Monster.

**The quantifier-domain check (#10840 §5b), applied to this PR's own citations:**

| theorem / source                                                                      | quantifies over                                   | our object                                                            | licensed here?                                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Frenkel–Kac / FLM**, `L ↦ V_L`                                                      | **even positive-definite lattices**               | `E8Lattice` — evenness proven in-tree from the code's double-evenness | **YES.** This is the one load-bearing licence, and it is the same one #10840 established.                                      |
| **Conway–Sloane**, Construction A / theta series of E8                                | **binary codes and the lattices built from them** | exactly what `E8Lattice.fs` is                                        | **YES.**                                                                                                                       |
| **Euler**, pentagonal number theorem                                                  | **formal power series**                           | our `int64[]` series                                                  | **YES.**                                                                                                                       |
| **Zhu 1996**, modular invariance                                                      | **C₂-cofinite rational VOAs**                     | we have **no VOA** — a sequence is not an algebra                     | **NO. Not claimed.** Quoting modularity as a property of this code would be exactly the Gates-ECC error PR #10832 caught.      |
| **Abe–Buhl–Dong** (rational + C₂-cofinite)                                            | **`V_L` for positive-definite even `L`**          | the VOA we did not build                                              | **NO. Not claimed.**                                                                                                           |
| **OEIS A007245** name ("McKay–Thompson series of class 3C for the **Monster** group") | a Monster-related modular function                | our sequence agrees with it **numerically**                           | **the numbers only.** Agreeing with a sequence whose _name_ mentions the Monster is not a Monster result. See §5 correction 1. |

The module docstring, the golden vector's `description` field, and the test file header each carry
this scope independently, so it cannot be lost by reading only one of them.

## 3. The falsifier — four lanes, and an honest account of how independent they are

`toy-is-free-metered-must-be-earned`: the graded dimensions are **`metered`**, because there is a
check that fails when they are wrong. Nothing else in the module is metered.

| lane          | how it is derived                                                                                                                                                                     | what it reads                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **routeL**    | `thetaByEnumeration` — depth-first point count over `L_A(C) = {x ∈ ℤ⁸ : x mod 2 ∈ C}`, `C = AdinkraCode.allCodewords` — times `etaPowMinus8Geometric` (8-colour partition recurrence) | the in-tree binary code, and nothing else              |
| **routeM**    | `eisensteinE4` — `1 + 240·Σ σ₃(m) qᵐ`, divisor sums — times `etaPowMinus8Pentagonal` (Euler pentagonal expansion, three squarings, series inversion)                                  | number theory only; **no lattice point is enumerated** |
| **published** | OEIS **A007245**, terms 0..8, transcribed 2026-08-15                                                                                                                                  | an external datum                                      |
| **cube**      | the convolution cube of the result must equal OEIS **A000521** (the coefficients of `j`)                                                                                              | an external datum **neither route consumed**           |

**Honest limit on the word "independent," because the brief's two-route framing overstates it.**
The two routes' **numerators** are genuinely disjoint — one counts lattice points, the other sums
cubes of divisors, and they share no input. The two routes' **denominators** are _the same
mathematical object_ computed by disjoint algorithms: that is algorithmic independence, not
derivational independence, and on its own it would only catch an implementation bug, not a wrong
model. That is why the **cube** lane exists: A007245's own OEIS formula line states _"Convolution
cube is A000521 (the modular j-function)"_ **[cited-checked]**, so cubing our result and comparing
against published `j` coefficients tests the whole product against a number that entered through
neither route. Three genuinely different kinds of evidence, not two.

## 4. Mutation proof — raw exit codes, never piped

`.claude/rules/toy-is-free-metered-must-be-earned` + the vacuity guard: a check that cannot fail is
not a check. Two mutations were run, at two different layers.

**(a) Data layer — perturb one graded dimension in the golden vector.** Grade 4, `213126 → 213127`
(both the `dec` and the `hex` field, so the row stays internally consistent and the failure is
attributed to the _lanes_ rather than to a half-edited row).

```
MUTANT_EXIT=1
Failed:     5, Passed:     7, Skipped:     0, Total:    12
  lane=routeL(lattice-theta*eta^-8) index n=4: committed 213127, computed 213126
  lane=routeM(E4*eta^-8)            index n=4: committed 213127, computed 213126
  lane=published(oeis-a007245)      index n=4: committed 213126, computed 213127
  lane=cube(oeis-a000521)           index n=4: committed 864299970, computed 864299973
```

Every lane fires independently, and each message names **the lane and the index**. Restored:

```
RESTORED_EXIT=0
Passed!  - Failed: 0, Passed: 12, Skipped: 0, Total: 12
```

**(b) Source layer — perturb the adinkra generator itself.** `AdinkraCode.generator` row 4,
`[|0;0;0;1;1;1;1;0|] → [|0;0;0;1;1;1;0;1|]` (still weight 4, no longer part of a doubly-even code).
Rebuilt `Core`, re-ran the derivation:

```
BUILD_EXIT=0
EMIT_EXIT=1
System.InvalidOperationException: Construction-A vector of norm^2 30 is not doubly-even;
the generator is not a doubly-even code.
```

Reverted via `git checkout --`; `git status --porcelain` clean; re-derived; all four lanes agree
again. This is the proof that routeL genuinely _reads_ the in-tree code rather than reproducing a
constant.

## 5. Corrections to the brief I was handed — flagged explicitly

1. **OEIS A007245 is not titled "the `j^{1/3}` coefficients."** Both #10840 and the brief call it
   that. Its actual OEIS **name** is _"McKay–Thompson series of class 3C for the Monster group."_
   The `j^{1/3}` reading is licensed by two **formula/example lines** I read for entailment —
   _"In the notation of Gunning… expand `E_2(z) / Delta(z)^(1/3)`"_ (Gunning's `E_2` is the weight-4
   Eisenstein series and `Delta^(1/3) = eta^8`, so that line **is** the `E₄/η⁸` route the brief asked
   for) and _"Convolution cube is A000521"_ — not by the title. The identification survives intact;
   the **label** was loose, and the loose label quietly imports Monster vocabulary into a rung whose
   entire point is that it buys no Monster. `anchor-to-human-prior-art`: an anchor must be checked,
   not cited, and checking it is what surfaced this.
2. **"The independent `E₄/η⁸` route" is only half-independent** — see §3. I did not narrow the
   brief; I added a third lane so the claim the doc makes is the claim the evidence supports.
3. **#10840 §8 predicted "perturb one codeword and the series breaks at n=1." It does not break at
   n=1 — it refuses.** With the double-evenness check written into the enumerator, a non-doubly-even
   generator throws before any coefficient is emitted (§4b), because Construction A over such a code
   produces vectors of norm² ≢ 0 (mod 4). "Breaks at n=1" is the behaviour of an _unguarded_
   enumerator, which would have silently floor-divided and produced a plausible-looking wrong series.
   Recorded because testing against the predicted symptom would have missed the guard entirely.
4. **`E8Lattice.isMember` is not on this path, deliberately.** The enumerator writes `x = c + 2y` over
   the codewords, so membership holds by construction — an O(1) structural fact instead of an O(16)
   list scan per leaf. The equivalence is not assumed: the test asserts `theta[1] = 240 =
E8Lattice.kissingNumber`, i.e. the enumerated minimal shell equals the independently-constructed
   in-tree root list.

## 6. Numerology triage (`numerology-vs-number-theory` governs)

| number                               | register                           | what else has it / why it does or does not discriminate                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **248**                              | **identity, not a match**          | For **any** even lattice, `(V_L)_1` is the Cartan part plus one basis vector per root, so the coefficient is _forced_ to `rank + \|roots\| = 8 + 240`. Nothing was compared. It is true that **248 is also `dim E8` (the Lie algebra)**, and that is exactly the competitor a bare count could not exclude — so the test asserts the _identity_ `LatticeVoa.rank + E8Lattice.kissingNumber = dims[1]` from in-tree values rather than asserting the literal 248 alone. Seeing 248 here should feel like arithmetic, not discovery. |
| **240** at `theta[1]`                | in-tree, proven three ways already | used here as a cross-check against `E8Lattice.kissingNumber`, not as a match.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **9-term agreement across 4 lanes**  | **derivation check**               | a _derived_ series agreeing with a _named published_ series across nine terms, plus the cube identity, checks a classical theorem on our data. It **verifies**; it does not discover.                                                                                                                                                                                                                                                                                                                                              |
| the E8 lattice itself                | **uniquely determined**            | E8 is the unique even unimodular positive-definite rank-8 lattice (Mordell/Witt), so there is no competitor object these measurements could be confusing it with — the exclusion step the rule demands.                                                                                                                                                                                                                                                                                                                            |
| "too many correlations is a warning" | applied                            | four lanes agreeing is _not_ four confirmations if they share a mechanism. §3 says exactly where they share one (the `eta^-8` factor) and what was added to compensate.                                                                                                                                                                                                                                                                                                                                                            |

## 7. Discipline notes

- **Integer-only.** No float appears anywhere in the graded-dimension path: `int64` series, integer
  square root by ascent, integer divisor sums. The golden vector stores every value as **strings**
  (`dec` + 16-digit big-endian `hex`), never as a JSON number, so a float representation cannot enter
  through the file either; a test asserts the `ValueKind` is `String`.
- **`no-binary-in-proof-lineage`.** Hex-in-JSON, diffable, DST-replayable (pure function of the
  in-tree code — no clock, no RNG, no IO beyond reading the vector), human-auditable in `git diff`.
- **No existing golden vector was moved or edited.** `src/Core/golden-vectors-lattice-voa.json` is a
  new file.
- **No E10/E11 anything**, per #10840 §4 and the brief. Nothing here climbs the affine tower.
- **`FROZEN-CORE-AND-CONJECTURE-REGISTER.md` is untouched.** This rung does not discharge a §A row and
  was not authorized to; the `metered` label lives on the module, where its evidence lives.

## 8. Anchors (Beacon) — checked for entailment

- **I. L. Frenkel & V. Kac**, _Basic representations of affine Lie algebras and dual resonance models_,
  Invent. Math. **62** (1980) — the vertex-operator construction; the functor's input type.
- **I. Frenkel, J. Lepowsky & A. Meurman**, _Vertex Operator Algebras and the Monster_ (1988) —
  `L ↦ V_L` for even lattices; `(V_L)_1 = h ⊕ span{e_α}` is why 248 is forced.
- **J. H. Conway & N. J. A. Sloane**, _SPLAG_, ch. 4–5 — Construction A; the theta series of E8 is `E₄`.
- **L. Euler** — pentagonal number theorem (routeM's denominator).
- **OEIS A007245** — read 2026-08-15: name _"McKay–Thompson series of class 3C for the Monster
  group"_; formula lines _"expand `E_2(z)/Delta(z)^(1/3)`"_ (Gunning) and _"Convolution cube is
  A000521"_; example line `G.f. = 1 + 248x + 4124x² + 34752x³ + 213126x⁴ + 1057504x⁵ + 4530744x⁶ + …`.
- **OEIS A000521** — _"Coefficients of modular function j"_, offset −1, terms `1, 744, 196884,
21493760, 864299970, 20245856256, 333202640600, 4252023300096, 44656994071935`.
- **Y. Zhu** (JAMS 9, 1996) and **Abe–Buhl–Dong** (Trans. AMS 356, 2004) — cited here **only** to name
  what this PR does _not_ claim (§2).
