# Ribbon needs a dualizable object — the rank equation that excludes Burau and LKB, and why Schur does not collapse the certificate

**shadow, 2026-08-15.** Answer to Aaron's *"are there other objects we should create to satisfy these
[rigidity/duals]? Are there use cases where they could be useful too?"*, asked against
`docs/handoffs/2026-08-13-meno-braid-brief-for-manus.md`'s finding that **ribbon is blocked at the
object**.

Everything below is **toy** unless marked CHECKED, and CHECKED means *I ran it, in exact integer /
Laurent arithmetic, with planted mutants that died.* No floats appear in any load-bearing step.

***

## 0. Verdict

**The stop stands, and the current object is the right one — for a reason the brief did not have.**

Aaron's candidate list is well-chosen and each candidate is genuinely dualizable. They fail anyway,
and they fail *before* faithfulness, byte-lockability, or the Markov trace ever come up:

> **Reduced Burau and Lawrence–Krammer–Bigelow are representations of the braid *groups*. They are
> not *objects of a braided monoidal category*. There is no `⊗` under which either becomes `V^⊗n`,
> and the proof is a two-line rank equation.**

Dualizability is necessary for ribbon and is nowhere near sufficient: the object also has to
*generate the braid category monoidally*, which forces `rank(V^⊗n) = rᵏⁿ`. Burau's rank is `n−1` and
LKB's is `n(n−1)/2`. Neither is an `n`-th power. So they are not candidates for the ladder at all —
they are a different kind of thing, correctly used elsewhere (PR #10540 put Burau at `t = −1` to
exactly the right use).

The class of objects that **does** satisfy rigidity *and* generate the braid category is the
**finite-rank R-matrix object**, and it exists, and it is standard, and building it is a bad trade:
it buys the Jones polynomial (a Markov-trace scalar link invariant — the thing Q4 already refused),
and its `θ = ρ(Δₙ²)` byte-lock costs `O(4ⁿ)` where the current object's costs `O(n²)`.

**Four corrections to the brief are flagged in §1**, including one that retires an open item Aaron
listed as still open.

***

## 1. Corrections to the brief — flagged, as asked

### 1a. STALE PREMISE. The general-`n` Lean certificate is **already merged**

The brief says: *"a separate open item is a general-n Lean certificate for θ = ρ(Δₙ²), currently
verified computationally only for m+n ≤ 7."*

**CHECKED against `origin/main`:** `src/Core.Lean4/Lean4/MenoBalancedTwist.lean` (404 lines, merged
in PR **#10623**, commit `343e17638`) certifies `dbl_cocycle` — the Garside identity, categorically,
**for all `m` and `n`** — from the hexagon axioms alone via four Yang–Baxter rewrites. The work-item
`081KZZVC3DD087G0R0035SZN58` is under `workitems/done/2026/08/`.

So the certificate did not need to "collapse". It already collapsed, on 2026-08-14, and the thing
that collapsed it was **not** Schur and **not** centrality — it was the observation that the
obstruction is a **2-cocycle condition on the double braiding**, which the hexagons kill outright.

What is genuinely still open is stated honestly in that file's own docstring, and it is a *different*
gap: that `⟨V⟩` **is** such a category in Lean (needs the braid groupoid as the free braided monoidal
category on one object — Joyal–Street 1993 §2 — which Mathlib does not carry), and naturality is
**assumed as a field of `Twist`**, not derived from Chow 1948.

### 1b. Schur's lemma is **inapplicable** to `⟨V⟩` — not "fails", *inapplicable*

The brief's hope: *"On an irreducible representation a central element acts by a scalar (Schur). If
that holds … then θ = ρ(Δₙ²) is a single scalar rather than a matrix."*

Schur's lemma is a statement about a module over a ring whose endomorphism algebra is a division
ring. `⟨V⟩` has no such structure to lose:

- `End_{⟨V⟩}(V^⊗n) = ρ(Bₙ)` is a **group**, not an algebra. `MenoBraided.Hom` is a *braid word*, not
  a function; the module docstring is explicit that the constructor is `Assembly`-scoped precisely so
  nothing else can enter. You cannot add two morphisms, so "irreducible" is not definable.
- `End(I)` is trivial. **The only scalar in `⟨V⟩` is `1`.** So "θ is a scalar" can only mean
  `θ = id` — and that is refuted: it is mutant #1 in §4 below, rejected at `m+n = 2`, and it is
  exactly the misreading two earlier reviews made.

"Central" and "scalar" coincide only when the endomorphism ring is a field. Here they are as far
apart as they get.

### 1c. Centrality is **necessary and not sufficient** — and there is a mechanical witness

This is the sharpest thing in the doc, and it settles the "does the certificate collapse to a short
centrality/Schur argument" question with a machine-checked counterexample rather than an argument.

`Δₙ⁴` is **also central** in `Bₙ` (`Z(Bₙ) = ⟨Δ²⟩` for `n ≥ 3`, Chow 1948, so `Δ⁴ ∈ Z(Bₙ)`). If
centrality were sufficient, `θ = ρ(Δ⁴)` would be a valid balanced structure.

**CHECKED: it is not.** `θ = Δ⁴` is REJECTED at `m+n = 2`. Centrality buys you *naturality* and
stops there; the tensor-compatibility half carries independent content.

So: **no, the certificate does not collapse to centrality/Schur** — and the reason is a concrete
central element that fails.

### 1d. The byte-lockability argument runs the **opposite** way

The brief's strongest practical hypothesis: *"An infinite-rank object cannot have its matrix entries
pinned in a golden vector; a rank `n−1` … matrix over a Laurent ring can."*

The premise is true and the conclusion does not follow, because **`⟨V⟩` is already byte-locked across
four oracles.** `src/Core.TypeScript/braid/golden-vectors.json` (3,485 bytes) pins the Artin action
for 14 braids in `B₅` — including `Δ₅ = [1,2,3,4,1,2,3,1,2,1]` — and is replayed by
`tests/Tests.FSharp/Braid.GoldenVectors.Tests.fs`, `src/Core.Rust.Braid/tests/golden_vectors.rs`, and
`src/Core.TypeScript/braid/golden-vectors.test.ts`.

The representation has infinite rank; its **value on any given braid** is a finite tuple of short
free-group words. Infinite rank ≠ un-byte-lockable. §6 prices it: the current object is the
**cheapest** byte-lock of the four, by an exponential margin.

***

## 2. The rank equation — a structural exclusion, not a count coincidence

`numerology-vs-number-theory` cuts both ways: a matching count never *identifies*, but a
**mismatching invariant does exclude**, and that is what this is.

Let `C` be a braided monoidal category and `V ∈ C` the generating object, so the braid-group
representation lives on `V^⊗n` (this is what "the braid category is the free braided monoidal
category on one object" means — Joyal–Street 1993). Suppose `V` is **dualizable** in `Mod_R`. Over
`ℤ` (a PID) dualizable ⟺ finitely generated projective ⟺ finitely generated free, so `V` has a
well-defined rank `r`, and rank is multiplicative under `⊗`:

```
rank(V^⊗n) = rⁿ
```

Now check the candidates:

| candidate | `rank ρₙ` | is it `rⁿ` for a fixed `r`? |
|---|---|---|
| reduced Burau | `n − 1` | `n=2 ⇒ r²=1 ⇒ r=1`; `n=3 ⇒ r³=2`. **No integer `r`.** |
| Lawrence–Krammer–Bigelow | `n(n−1)/2` | `n=2 ⇒ r=1`; `n=3 ⇒ r³=3`. **No integer `r`.** |
| rank-`r` R-matrix object | `rⁿ` | yes, by construction |

**Conclusion (CHECKED, arithmetic):** neither Burau nor LKB is `V^⊗n` for any dualizable `V`. They
are not monoidal. There is no `⊗` to give them; "make Burau the new object" is not a thing that can
be attempted and fail — it is not well-typed.

**Honest scope of the exclusion.** This rules them out as the *generating object's tensor powers*. It
does **not** rule them out as **summands** of `V^⊗n` for some other `V`, and that loophole is real and
interesting: Jackson & Kerler (2011) realize LKB inside a weight space of a tensor power of the
`U_q(sl₂)` **Verma** module. *(CONJECTURE tier — cited from standing knowledge, **not** page-checked,
and nothing below rests on it.)* If it is right, it closes the loop in the most satisfying possible
way: **the monoidal home of the faithful representation is itself infinite-rank.** You do not get
faithfulness and a finite-rank generating object at the same time.

***

## 3. What `ρ(Δₙ²)` actually is on each candidate — CHECKED

All four computations below are exact (dict-of-monomials Laurent polynomials over `ℤ`, integer
coefficients, no floating point) and each carries planted mutants, because a check nothing can fail
is not a check.

### 3a. Reduced Burau over `ℤ[t^{±1}]` — **scalar, `tⁿ`**

Self-validation first: braid relations `σᵢσᵢ₊₁σᵢ = σᵢ₊₁σᵢσᵢ₊₁` and far commutation **hold** for
`B₃…B₇`, and `σᵢσᵢ⁻¹ = I`. Four planted mutants (diagonal `t` instead of `−t`; subdiagonal dropped;
subdiagonal sign flipped; superdiagonal dropped) **all REJECTED** at every `n` tested. *(This
independently reproduces PR #10540's §3b mutant result on a separate implementation.)*

```
n=2  |Δ²|= 2   ρ_red(Δₙ²) = t^2 · I
n=3  |Δ²|= 6   ρ_red(Δₙ²) = t^3 · I
n=4  |Δ²|=12   ρ_red(Δₙ²) = t^4 · I
n=5  |Δ²|=20   ρ_red(Δₙ²) = t^5 · I
n=6  |Δ²|=30   ρ_red(Δₙ²) = t^6 · I
n=7  |Δ²|=42   ρ_red(Δₙ²) = t^7 · I
```

**`ρ_red(Δₙ²) = tⁿ · I`.** And the discriminating control: `ρ_red(Δₙ)` is **NOT scalar** for `n ≥ 3`
(scalar `−t` only at `n = 2`, where `B₂ ≅ ℤ` is abelian) — which is right, since `Δ` is not central
for `n ≥ 3`.

### 3b. Lawrence–Krammer–Bigelow over `ℤ[q^{±1}, t^{±1}]` — **scalar, `q^{2n} t²`**

Krammer's formulas, rank `n(n−1)/2`. Self-validation: braid relations **hold** for `B₃…B₆` (ranks
3, 6, 10, 15). Three planted mutants (`+tq²` instead of `−tq²` on the `i = j = k−1` case; `−tq`
instead of `−tq²`; the `t` dropped from the `i = k−1` case) **all REJECTED**.

```
n=2  rank= 1   ρ_LKB(Δₙ²) = q^4  t^2 · I
n=3  rank= 3   ρ_LKB(Δₙ²) = q^6  t^2 · I
n=4  rank= 6   ρ_LKB(Δₙ²) = q^8  t^2 · I
n=5  rank=10   ρ_LKB(Δₙ²) = q^10 t^2 · I
n=6  rank=15   ρ_LKB(Δₙ²) = q^12 t^2 · I
```

**`ρ_LKB(Δₙ²) = q^{2n} t² · I`.** Again `ρ_LKB(Δₙ)` is NOT scalar for `n ≥ 3`.

**So Aaron's Schur prediction is exactly right for these two objects.** Both reduced Burau and LKB
are irreducible for generic parameters, and the central `Δ²` therefore acts by a scalar, and I can
give the scalar in closed form. The prediction is correct **and it does not help**, because §2 says
these are not objects of the ladder — and §3d says the moment you *do* take an object of the ladder,
the scalar goes away.

### 3c. `⟨V⟩` (the current object) — **no scalars exist**, and `θ = id` is refuted

See §1b. `End(I) = {id}`, so the only available scalar is `1`, and `θ = id` is mechanically rejected
(§4, mutant 1). `ρ(Δₙ²)` is the Artin automorphism `xⱼ ↦ w xⱼ w⁻¹` with `w = x₁x₂⋯xₙ` — conjugation
by the total word. **CHECKED:** the longest image word is exactly `2n+1` letters for every `n` tested
(`n=2 ⇒ 5`, `n=3 ⇒ 7`, …, `n=14 ⇒ 29`). This is why the `Δ²` case escapes PR #10540 §3a's exponential
blowup entirely: **the full twist is periodic, not pseudo-Anosov**, so its Artin image grows
linearly, not geometrically. That is load-bearing for §6.

### 3d. The rank-2 R-matrix object — **dualizable, and `ρ(Δₙ²) is NOT scalar**

This is the honest object of the ladder: `V` free of rank 2 over `ℤ[A^{±1}]`, hence **dualizable**;
`R = A·I₄ + A⁻¹·E` with `E` the Temperley–Lieb cup-cap

```
E = [[0, 0,    0,      0],
     [0, −A²,  1,      0],
     [0, 1,    −A⁻²,   0],
     [0, 0,    0,      0]]
```

and `ρₙ(σᵢ) = id^{⊗(i−1)} ⊗ R ⊗ id^{⊗(n−i−1)}` — the *local* form, which is what makes it monoidal.

Self-validation: `E² = δE` with `δ = −A² − A⁻²` **holds**; the **Yang–Baxter equation holds**;
`R·R⁻¹ = I`; braid relations hold on `V^⊗3`, `V^⊗4`, `V^⊗5` (ranks 8, 16, 32). Mutant `E`-coefficient
`A⁻²` instead of `A⁻¹`: YBE **fails → REJECTED**. *(One planted mutant, "swap `A ↔ A⁻¹`", **survived**
— and that is correct, not a hole: the swap yields `R⁻¹`, which is the mirror braiding and a
legitimate solution. Recorded as an unconstrained dimension, per
`2026-08-11-mutants-coexist-a-survivor-is-an-unconstrained-dimension-not-a-kill-target`.)*

Now the Schur test on the object that actually satisfies rigidity:

```
n=2  rank= 4   ρ(Δₙ²) NOT SCALAR   (3 distinct diagonal entries)
n=3  rank= 8   ρ(Δₙ²) NOT SCALAR   (4 distinct)
n=4  rank=16   ρ(Δₙ²) NOT SCALAR   (10 distinct)
n=5  rank=32   ρ(Δₙ²) NOT SCALAR   (14 distinct)
```

Explicitly at `n = 2`:

```
R² = [[A²,      0,        0,               0],
      [0,       A⁻²,      1 − A⁻⁴,         0],
      [0,       1 − A⁻⁴,  A² − A⁻² + A⁻⁶,  0],
      [0,       0,        0,               A²]]
```

`tr(R²) = 3A² + A⁻⁶` **CHECKED** against the eigen-prediction: `E` has rank 1, so `R` has eigenvalue
`A` with multiplicity 3 and `A + A⁻¹δ = −A⁻³` with multiplicity 1; `R²` therefore has `A²` (mult 3)
and `A⁻⁶` (mult 1). **Two distinct eigenvalues ⇒ not scalar.**

**This is the general fact, and it is the answer to the technical question.** `V^⊗n` is *reducible*
for `r ≥ 2` (here `V ⊗ V = V_{spin 1} ⊕ V_{spin 0}`), so Schur applies **on simple summands only**. In
a ribbon category the twist is scalar on each simple and a non-scalar direct sum on `V^⊗n`. That is
not a defect — it is what a ribbon twist *is*.

**The scalar that IS forced, and it is a pleasing check.** Assume `θ_V = λ·id` (legitimate here: `V`
is simple, so Schur *does* apply to it). The balanced axiom gives `θ_{V⊗V} = λ²·R²`. Ribbon requires
the twist to be `1` on the **trivial** summand, on which `R²` acts by `A⁻⁶`:

```
λ² · A⁻⁶ = 1   ⟹   λ² = A⁶   ⟹   θ_V = ±A³
```

and the standard Kauffman-bracket framing factor is `−A³` (Kauffman 1987). Consistency check: the
twist on the spin-1 summand is then `A⁶·A² = A⁸`, on the trivial summand exactly `1`. **It closes.**

Note what just happened, because it answers the brief's Q2 as a side effect: on this object
`θ_V = −A³ ≠ id`. **The finite-rank R-matrix object carries the framing datum automatically** — the
"framed promotion" Q2 asked for is not something you bolt on, it is what `θ_V ≠ id` means, and it
arrives free the moment the object is dualizable.

***

## 4. The tensor half, verified to `m+n ≤ 14` (was 7), with seven mutants

Independent of everything above, I extended the concrete-model check the brief describes. The
balanced axiom in `⟨V⟩` is the braid-word identity

```
Δ²_{m+n}  =  (Δ²_m ⊗ Δ²_n) · c_{m,n} · c_{n,m}
```

decided by **Artin's faithful action** on `Fₙ` (Artin 1925) — exact free-group words, integer only.
`c_{m,n}` is the block transposition, permutation-verified against the target permutation before use.

```
m+n= 2 : Y            m+n= 9 : YYYYYYYY
m+n= 3 : YY           m+n=10 : YYYYYYYYY
m+n= 4 : YYY          m+n=11 : YYYYYYYYYY
m+n= 5 : YYYY         m+n=12 : YYYYYYYYYYY
m+n= 6 : YYYYY        m+n=13 : YYYYYYYYYYYY
m+n= 7 : YYYYYY       m+n=14 : YYYYYYYYYYYYY
m+n= 8 : YYYYYYY
```

**All 91 splits hold.** Mutants:

| mutant | outcome |
|---|---|
| `θ = id` | REJECTED at `m+n=2` |
| `θ = Δ` | REJECTED at `m+n=2` |
| **`θ = Δ⁴` (central!)** | **REJECTED at `m+n=2`** |
| single block swap (one `c` only) | REJECTED at `m+n=2` |
| both swaps same direction | REJECTED at `m+n=3` |
| `θ_A` dropped from the RHS | REJECTED at `m+n=3` |
| one swap inverted | REJECTED at `m+n=2` |

The third row is §1c's witness. The cost is polynomial (max image word `2n+1`, §3c), so pushing this
to `m+n = 30` is minutes, not a project — but there is no reason to, because #10623 already has the
general case abstractly. **The value of this sweep is that it tests the *concrete model*, which is
exactly the half #10623's docstring says it does not certify.**

***

## 5. Byte-lockability — priced, and the answer inverts the hypothesis

Size of the golden vector for `ρ(Δₙ²)`, in the natural units of each object:

| object | n=4 | n=6 | n=8 | n=10 | growth |
|---|---:|---:|---:|---:|---|
| **`⟨V⟩ = ℤ[Fₙ]`, Artin action** | **34** | **76** | **134** | **208** | `O(n²)` small ints |
| rank-2 R-matrix, `2ⁿ × 2ⁿ` | 256 | 4,096 | 65,536 | 1,048,576 | `O(4ⁿ)` Laurent polys |
| reduced Burau | 1 | 1 | 1 | 1 | 1 monomial (`tⁿ·I`) |
| LKB | 1 | 1 | 1 | 1 | 1 monomial (`q^{2n}t²·I`) |

Three readings, and the third is the one that decides:

1. **The current object already wins against the only real alternative.** `O(n²)` vs `O(4ⁿ)`. Moving
   to the dualizable ladder object makes the byte-lock exponentially *worse*.
2. **Burau's and LKB's "1" is not a win — it is a vacuity warning.** A golden vector pinning
   `tⁿ · I` can catch a bug in the `Δ` word construction and **nothing else**. It cannot detect a
   wrong braiding, a wrong `R`, or a wrong composition order, because every one of those still lands
   on a scalar. *A byte-lock that cannot fail on the property you care about is the vacuity class.*
   This is the same failure shape as `numerology-vs-number-theory`'s hardcoded `D_f = 1.322`.
3. **And it was never unfalsifiable to begin with.** The brief's framing — *"does moving to a
   dualizable object convert an unfalsifiable structural claim into a four-oracle byte-lock?"* — has
   a false premise. It is already a four-oracle byte-lock (§1d): four languages, 14 vectors, `Δ₅`
   among them, replayed in CI today.

**Correction to the brief, stated plainly: this was the strongest practical argument for the move,
and it is the one that most clearly runs backwards.**

***

## 6. Does a faithful representation change the calculus? — measured, and Garside still wins

The handoff says ribbon's Markov trace is *strictly weaker than what we already have*. **I did not
find evidence against that and I am not contradicting it.** A Markov trace is a scalar invariant of
the *closure*; `Braid.equal` decides the braid. Weaker, confirmed.

But Aaron asked the sharper question: does *faithfulness* (LKB) change anything? PR #10540 answered
"it buys a polynomial-size certificate where ours is exponential — a real gap — but it is the wrong
tool." I put numbers on that, because it was asserted and not measured.

Certificate bit-size for `ρ(wᵏ)`, `w = σ₁σ₃σ₂σ₂σ₂ ∈ B₄` (a positive, genuinely expanding word — found
by scanning positive words for exponential Artin growth; exact integer coefficients throughout):

| `k` | `|wᵏ|` | LKB bits | Artin bits | Garside bits (analytic bound) |
|---:|---:|---:|---:|---:|
| 2 | 10 | 6,080 | 360 | 50 |
| 4 | 20 | 34,228 | 4,500 | 100 |
| 6 | 30 | 102,765 | 61,056 | 150 |
| 8 | 40 | 230,724 | 847,692 | 200 |
| 10 | 50 | 437,187 | 11,803,032 | 250 |
| 12 | 60 | 741,446 | 164,390,148 | 300 |
| 14 | 70 | **1,163,138** | **2,289,653,424** | **350** |

- **LKB log-log slope = 2.921 → `O(|w|³)`, polynomial.** CHECKED. So the gap is real: LKB genuinely
  delivers a polynomial-size certificate. Its monomial count grows quadratically and its *coefficients*
  grow geometrically, and `log` of geometric is linear — hence cubic total, not exponential.
- **Artin ratio `size(k=14)/size(k=12) = 13.93` → geometric.** CHECKED. Exponential, as PR #10540 §3a
  found.
- **Crossover at `|w| ≈ 30`.** Below that the Artin action is smaller; above it LKB wins and the margin
  compounds — 2,000× by `|w| = 70`.
- **Garside beats both by three-plus orders of magnitude and is linear.** *(ANALYTIC BOUND, not
  measured: left-greedy normal form has canonical length ≤ word length, each factor a permutation of
  `n` letters — Epstein et al. 1992 ch. 9. I did not implement it.)*

**So: faithfulness changes the calculus exactly as much as PR #10540 said, and no more.** The gap it
addresses is real, quantified here for the first time — and the right tool for that gap remains
Garside normal form, which is linear where LKB is cubic, needs no new number type, and was already on
the board. **No recommendation changes.**

***

## 7. MTC — Aaron has it right, with one refinement

**Confirmed.** MTC is false, not open: `V` has infinitely many simples, and the fix is a **functor**
(semisimplification at a root of unity — quotient by negligible morphisms; Temperley–Lieb at
`δ = 2cos(π/(k+2))`, equivalently `U_q(sl₂)` tilting modules mod negligibles), **not** a better object
choice. Anchors as Aaron gives them: Jones 1985, Reshetikhin–Turaev 1991, Andersen.

**The refinement.** The functor cannot be applied to `⟨V⟩`. Semisimplification quotients by an ideal
of *negligible morphisms*, which presupposes an additive (in fact `k`-linear) category — hom-sets you
can add, a trace to compute, an ideal to quotient by. `⟨V⟩` has none of that: its hom-sets are groups
of basis bijections (§1b). **There is nothing to take negligibles of.**

So the honest statement is: *the fix is a functor, and it applies to a linear category built from a
finite-rank R-matrix object — which is §3d's object, which we would have to build first.* The order
matters: object, then functor. Not functor instead of object.

A supporting note that closes a loop with PR #10540 §7ii: the root-of-unity values are **cyclotomic**,
so `ℤ[ζ_N]` is an exact, byte-lockable home — `δ = 2cos(π/(k+2))` never has to be a float. That was
already recorded there as PROPOSED; §3d's computation is consistent with it (everything lives in
`ℤ[A^{±1}]` until you specialize `A`).

***

## 8. Which candidate earns `metered` fastest, and the falsifier

**None of the new objects. The fastest promotion available is on the object we already have**, and
it is small:

> **Candidate: the concrete-model instance of `dbl_cocycle`** — `Δ²_{m+n} = (Δ²_m ⊗ Δ²_n)·c_{m,n}·c_{n,m}`
> in `Bₙ`, decided by the shipped `Braid.equal`, as an F# test in `tests/Tests.FSharp/`.
>
> **Falsifier (it convicts and never acquits — the mutant battery is the check, not the pass):** the
> seven mutants of §4, and specifically **`θ = Δ⁴` must be rejected**. A test suite in which the
> *central* mutant survives has verified centrality and called it the balanced axiom. That is the
> vacuity class, and it is the exact error this doc's §1c exists to prevent.
>
> **Cost:** ~40 lines against `Braid.fs`, no new number type, no Laurent ring, no category theory.
> **What it earns:** the half `MenoBalancedTwist.lean` explicitly does not certify (that `⟨V⟩` *is*
> such a category), pushed from `m+n ≤ 7` to `m+n ≤ 14` with a live mutation guard.

**Recorded, not recommended.** I am not proposing this as work; it is the answer to "what would earn
`metered` fastest", and the honest follow-up is that the marginal value over #10623 is modest. If
nobody picks it up, nothing is lost.

**Everything about the rank-2 R-matrix object stays `toy`.** It is implemented and checked here and
has no falsifier in the repo, and it should acquire one only if someone ever wants the Jones
polynomial — which Q4 already refused.

***

## 9. What I did not do

- **Did not page-check any anchor.** All citations are from standing knowledge. Where the *content*
  of an anchor is load-bearing I re-derived it computationally instead (Burau relations, LKB
  relations, YBE, the Garside identity) — that is the check; the citation is provenance.
- **Did not implement Garside normal form.** §6's Garside column is an analytic bound.
- **Did not verify Jackson–Kerler** (§2). Marked CONJECTURE; nothing rests on it.
- **Did not commit the computation as code.** The formulas are reproduced verbatim above and are ~200
  lines in any language; committing scratch Python would add an unmetered artefact with no CI home,
  and §8 names the one place a *maintained* check would belong instead.
- **Did not re-derive PR #10540.** Its Burau-at-`t=−1` result is reproduced incidentally by an
  independent implementation here (§3a mutants) and agrees.

***

## 10. Anchors

Named human + paper, old and modern. **Cited from standing knowledge, not page-checked** — see §9.

- **Artin, E.** (1925) *Theorie der Zöpfe*; (1947) *Theory of braids* — the faithful action on `Fₙ`
  that decides §4. This is the one anchor whose content is *checked* here: §4's sanity block
  re-derives `σ₁σ₂σ₁ = σ₂σ₁σ₂`, `σ₁σ₂ ≠ σ₂σ₁`, and centrality of `Δ₃²` from the action alone.
- **Garside, F. A.** (1969) *The braid group and other groups* — `Δ`, the full twist `Δ²`. **Chow,
  W.-L.** (1948) — `Z(Bₙ) = ⟨Δ²⟩` for `n ≥ 3`; §1c's `Δ⁴` witness is a direct consequence.
- **Joyal, A. & Street, R.** (1993) *Braided tensor categories*, Adv. Math. 102 — the braid category
  as the free braided monoidal category on one object (§2's premise), the balanced axiom, and the
  tortile/ribbon-braid statement behind §3d's `θ_V ≠ id` remark.
- **Burau, W.** (1936) — the representation of §3a. **Bigelow, S.** (1999) Geom. Topol. 3;
  **Moody, J.** (1991); **Long, D. & Paton, M.** (1993) — non-faithfulness for `n ≥ 5`, which is why
  §6 never proposes Burau as a decision procedure.
- **Lawrence, R.** (1990) CMP 135; **Bigelow, S.** (2001) *Braid groups are linear*, J. AMS 14;
  **Krammer, D.** (2002) *Braid groups are linear*, Ann. Math. 155 — LKB and its faithfulness. §3b's
  matrices are Krammer's formulas, validated by the braid relations rather than by the citation.
- **Jackson, C. & Kerler, T.** (2011) *The Lawrence–Krammer–Bigelow representations of the braid
  groups via `U_q(sl₂)`*, Adv. Math. — §2's loophole. **CONJECTURE tier, not page-checked.**
- **Temperley, H. & Lieb, E.** (1971); **Kauffman, L.** (1987) *State models and the Jones
  polynomial*, Topology 26 — the `E`, `δ`, and the `−A³` framing factor of §3d.
- **Jones, V.** (1985) Bull. AMS 12; **Reshetikhin, N. & Turaev, V.** (1991) Invent. Math. 103;
  **Andersen, H. H.** (1992) — the semisimplification functor of §7.
- **Turaev, V.** (1988) Invent. Math. 92 — enhanced YB operators; PR #10540 §4c showed the partial
  trace `tr₂` *is* the rigidity requirement, which is why §3d had to supply a genuinely dualizable
  `V` rather than route around it.
- **Epstein, D. et al.** (1992) *Word Processing in Groups* ch. 9 (Thurston's greedy normal form);
  **Birman, Ko & Lee** (1998); **Dehornoy, P.** (1997) — §6's Garside column.
- **Fox, R.** (1976) — cartesian ⟺ natural comonoid; why `⟨V⟩` must never admit copy/discard, which is
  the same structural fact that makes §1b's "no scalars" true.

***

## 11. Pointers

- `docs/handoffs/2026-08-13-meno-braid-brief-for-manus.md` — the brief this answers (already marked
  ANSWERED; §1a of this doc retires one more of its open items).
- `docs/research/2026-08-14-no-rung-and-one-sideways-step-what-a-finite-rank-braid-representation-actually-buys-lumen.md`
  — Lumen's scoping answer. **Read it first.** This doc agrees with every one of its verdicts and adds
  three things it did not have: the rank equation (§2), the Schur answer (§3), and the measured
  LKB/Artin/Garside cost table (§6).
- `src/Core.Lean4/Lean4/MenoBalancedTwist.lean` (PR #10623) — the general-`n` certificate §1a reports
  as already merged; its docstring states the remaining gap precisely and honestly.
- `src/Core/MenoBraided.fs` — `Hom` as a braid word, the `Assembly`-scoped constructor; §1b's
  "no scalars" is a reading of this design, not a new claim about it.
- `src/Core.TypeScript/braid/golden-vectors.json` + the F#/Rust/TS replays — the four-oracle byte-lock
  §1d and §5 price against.
- `workitems/done/2026/08/081KZZVC3DD087G0R0035SZN58-*` (VERIFIED present on `origin/main`) ·
  `workitems/081KZZVC6SE087G0R001SXE8BV-*` (VERIFIED present, still open).
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §3d stays `toy` and §8 names its
  falsifier before proposing anything.
- `.claude/rules/numerology-vs-number-theory.md` — §2 is an *exclusion by invariant*, which is the
  legitimate direction; §5's reading 2 is the vacuity warning in its byte-lock form.
