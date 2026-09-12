# The belief pair `(trueChance, falseChance)` as a weight for the universal tensor — where it fits, where it fails, and why the regulariser is a third parameter

Date: 2026-09-11
Author: Lumen (mathematical-physics hat)
Operational status: research-grade, advisory
Lifecycle: active
Scope: algebraic admissibility of an independently-floating true/false pair as a `WSet` weight; the identification of its residual; the boundary-operator question. Not an audit of Zeta's belief code.
Code baseline: `8509bd61e6` (read-only, shared checkout).
Pairs with: `docs/research/2026-09-06-simplex-wset-comparison-and-stack-verdicts.md` (whose register standard this document adopts), `src/Core/WSet.fs`, `src/Core/Semiring.fs`, `src/Core/SoftValue.fs`.

---

## 0. Result first

1. **The natural, logically-motivated algebra on `(t,f)` is NOT a lawful semiring.** Distributivity fails, with a two-line witness. So it is *not* admissible as a weight for the universal tensor under the free-semimodule theorem. **[STRUCTURAL — proven below, arithmetic checkable by hand]**

2. **A lawful one exists and is already named in the literature**: the possibilistic / Viterbi structure. `([0,1], max, ×)` is a lawful commutative semiring, closed in the unit square, and componentwise products of lawful semirings are lawful — so `(t,f)` *is* admissible under that choice. The cost is that `⊕` becomes idempotent, which means **it cannot accumulate evidence**. **[STRUCTURAL]**

3. **That cost is the same wall `BeliefConvergence.fs` already hit**, from the other side: *"an idempotent group is trivial — `a + a = a ⇒ a = e` — so a single operator cannot be both redelivery-safe and retraction-capable."* The belief pair does not escape it. Two structures are needed, not one. **[STRUCTURAL — in-repo, reused not re-derived]**

4. **The pair has an exact structural identification, and it is not Dempster–Shafer.** It is the **interlaced bilattice** `[0,1] ⊙ [0,1]` (Ginsberg 1988; Fitting 1991; Avron 1996), whose four extreme points are Belnap's `{none, true, false, both}` and whose *second* order — the knowledge order — is precisely the "when they don't add to 1" axis Aaron named as signal. The identification passes the number-theory test (two interlaced orders + an order-2 negation), not merely the four-corner count test. **[STRUCTURAL]**

5. **The residual `r = 1 − t − f` has a units-bearing, classical meaning, and the anchor is Boole (1854) and de Finetti (1937), not Wigner.** `r` is the slack in Boole's *conditions of possible experience*. `r > 0` is a bid–ask spread (imprecision). `r < 0` is an incoherence, and its magnitude is **a guaranteed Dutch-book loss per unit stake** — a real, metered quantity with dimensions. **[STRUCTURAL]**

6. **The quantum / negative-probability link is ANALOGY, and I recommend saying so plainly.** The *shape* (a probability outside `[0,1]`) matches; the *generating mechanism* (no non-negative joint reproducing a set of mutually-incompatible marginals) is absent here. Wigner negativity is a contextuality witness; `t+f>1` is two sources disagreeing about one proposition. **[ANALOGY — decoration until a contextuality-shaped constraint is exhibited; promotion criterion given in §8]**

7. **Aaron's third type parameter is right, and his "parametrized on the disagreement" is an existing published family** — the conflict-redistribution family of Lefèvre–Colot–Vannoorenberghe (2002) and Florea et al. (2009), in which Dempster, Yager, Dubois–Prade and Smets are four *points*, indexed by the conflict mass. His conjecture arrives at a named object. **[STRUCTURAL — established elsewhere, checked; the application to `WSet` is new]**

8. **The strong form of the coordinator's question — "is the boundary derivable from the ring?" — is REFUTED by a witness already in the literature the repo cites.** The `ℝ≥0` corner has *two* shipped boundary operators (KL forward vs. reverse: moment-matching EP vs. mode-seeking VB), same ring, same target family, different results. One ring, two boundaries, both legitimate ⇒ the ring does not determine the boundary. **[REFUTATION — witness-based]**

9. **But the parameter belongs in the boundary's RESULT type, not as a third parameter on the container.** `WSet` already passes its boundaries as *values* (`consolidate` takes `isZero`; `bornProb` takes `magSq`). The missing half is not `WSet<'K,'W,'R>` — it is that a boundary must return `(verdict, residual)` as a pair, so that discarding the residual is a visible act in a signature rather than an invisible one. **[DESIGN — argued, not proven; §7]**

---

## 1. What the universal tensor actually requires

The precise sense of "universal" is already established in-repo and needs no new claim. From `docs/research/2026-09-06-simplex-wset-comparison-and-stack-verdicts.md` §"What can legitimately be universal":

> For a lawful commutative semiring R, finite-support functions K → R form the free R-semimodule on K. Given a function f: K → M into an R-semimodule, its unique linear extension is `F(v) = Σ_k v(k) f(k)`.

This is a **universal property in the category-theoretic sense** — the free object over `K` in `R`-semimodules — so admissibility of a new weight is a *checkable* statement and not an arguable one:

> **Admissibility test.** A proposed weight structure `'W` is an object of the weight category iff it is a **lawful commutative semiring**: `(W, ⊕, 0)` a commutative monoid, `(W, ⊗, 1)` a commutative monoid, `⊗` distributes over `⊕`, and `0` annihilates.

`WSet.fs` itself demands exactly this and no more for the linear ops (`#ISemiring`), and demands `#IRing` (additive inverse) only for `negate` and `FourCornerTrace`. The tower is `IStarRing :> IRing :> ISemiring`.

Two standing caveats carried forward from that doc, because they bind everything below:

- `WSet` realises the free semimodule **only modulo consolidation, assuming exact zero recognition and lawful arithmetic.** Float weights with a caller-supplied `isZero` epsilon do not inherit the theorem. `ClaimLane.fs` records the live instance: `AmplitudeEmu`'s `EPS = 1e-12` drop breaks associativity for general amplitudes, and is safe for Z-set weights *only because small integers are exact*. A `[0,1]`-valued belief weight is in the unsafe class, not the safe one.
- `tensor` is **bilinear, not jointly linear**. Nothing below changes that.

---

## 2. What the operations must mean before the algebra can be checked

The verdict depends entirely on the *declared* semantics of `⊕` and `⊗`, and the analysis is void without it. I take the reading the tensor's existing instances use:

- **`⊗` (Mul)** — series / path composition. Used by `apply` (a linear operator's matrix entry times an incoming weight) and `tensor` (Kronecker). Logically: **conjunction**.
- **`⊕` (Add)** — alternative routes converging on the same key; the thing `consolidate` folds. Logically: **accumulation of independent support**.

**A different declared semantics gives a different verdict.** This scope statement is load-bearing: everything in §3 is a theorem about *these* operations, not about the pair as such.

### 2.1 The `f` coordinate is order-dual, and that fixes the coordinates

For independent propositions `A`, `B`:

- `t(A ∧ B) = t(A)·t(B)` — componentwise.
- `f(A ∧ B) = 1 − (1−f(A))(1−f(B)) = f(A) + f(B) − f(A)f(B)` — **not** componentwise.

So the natural semantics is componentwise only after the reparameterisation

> **`u = t`, `v = 1 − f`.**

In `(u,v)` coordinates, conjunction is componentwise multiplication and accumulation is componentwise probabilistic sum. And `(u,v)` has a name: **`u` is a necessity and `v` is a possibility** — `N(A) = t`, `Π(A) = 1 − f` — with the duality `N(A) = 1 − Π(¬A)` holding by construction (Zadeh 1978; Dubois & Prade 1988). Equivalently `[u,v] = [t, 1−f]` is a **lower/upper probability interval** (Walley 1991; Smith 1961).

That the "two independent floats" reparameterise to an interval is not a coincidence of counts — it is forced by the requirement that conjunction be a homomorphism. **[STRUCTURAL]**

**In-repo precedent, and it is a warning.** `src/Core/Semiring.fs` already carries a two-coordinate weight, `IntervalWeight`, and it is **DEMOTED** with a substrate-honest exception on file (`081KWGA0C7`): under Moore arithmetic intervals are not a ring *and not a lawful semiring* — negation is no additive inverse, and distributivity fails (Moore 1966 sub-distributivity), witnessed in `SemiringRing.Laws.Tests.fs`. That demotion does not transfer automatically (its `Add` is interval addition, not our accumulation), but the *shape* is the same and the repo has already measured that this shape is where laws go to die. Check, do not assume.

---

## 3. The algebra: one refutation, one lawful survivor

### 3.1 The independence-motivated algebra is not a semiring

With `⊕` = probabilistic sum and `⊗` = product on each `(u,v)` coordinate, distributivity fails. Witness, in one coordinate (the failure lifts to the product because coordinate projection is a homomorphism):

```
a = 1/2,  b = c = 1
a ⊗ (b ⊕ c) = (1/2) · (1 + 1 − 1·1) = 1/2
(a ⊗ b) ⊕ (a ⊗ c) = 1/2 ⊕ 1/2 = 1/2 + 1/2 − 1/4 = 3/4
1/2 ≠ 3/4
```

**[STRUCTURAL — REFUTED. The free-semimodule theorem does not apply. `WSet`'s linear ops would still typecheck and would still compute; they would simply not be computing a linear extension, and `consolidate` would depend on grouping order.]**

Two neighbouring candidates fail for the same reason, and are worth locking as regression witnesses because each is the "obvious" fix someone will reach for:

- **Łukasiewicz / MV** (`a ⊕ b = min(1, a+b)`, `a ⊗ b = max(0, a+b−1)`; Łukasiewicz 1920; Chang 1958). Witness `a=b=c=1/2`: LHS `= 1/2`, RHS `= 0`.
- **Plain sum-product on `[0,1]`.** Lawful as a semiring but **not closed**: `0.6 + 0.7 = 1.3 ∉ [0,1]`.

> **This is the mechanical explanation of the phenomenon Aaron named.** "Probabilities greater than one" is not a quantum pathology leaking in. It is the ordinary failure of `[0,1]` to be closed under semiring addition. And "negative probabilities" is what you get when you demand additive inverses of a structure that has none — the group completion of `(ℝ≥0, +)` is `ℝ`, and you have left the unit interval by construction, not by accident. **[STRUCTURAL]**

### 3.2 The lawful survivor: the possibilistic / Viterbi semiring

Replace the accumulating `⊕` with an idempotent one:

> `([0,1], max, ×, 0, 1)` — the **Viterbi semiring**. `max` is a commutative idempotent monoid with identity `0`; `×` is a commutative monoid with identity `1`; `a·max(b,c) = max(ab,ac)` holds because multiplication by `a ≥ 0` is monotone; `a·0 = 0`. **Closed in `[0,1]` under both operations.** Lawful, commutative.

`([0,1], max, min)` — the **Gödel / bounded distributive lattice** — is equally lawful and equally closed.

Componentwise products of lawful commutative semirings are lawful commutative semirings. Therefore:

> **`[0,1]²` under componentwise `(max, ×)` in `(u,v) = (t, 1−f)` coordinates IS an admissible weight for the universal tensor, and the free-semimodule theorem applies to it verbatim.** **[STRUCTURAL]**

Written back in `(t,f)`: `Zero = (0,1)` (*false*), `One = (1,0)` (*true*), `⊕ = (max t, min f)`, `⊗ = (t₁t₂, f₁+f₂−f₁f₂)`. All four Belnap corners are present in the carrier: `(1,0)` true, `(0,1)` false, `(0,0)` none, `(1,1)` both.

### 3.3 The cost, and the in-repo theorem that says the cost is unavoidable

Idempotent `⊕` means **ten weak witnesses never outweigh one strong one**. That is a real loss and it is the whole price of lawfulness.

It is also not news here. `ClaimLane.fs` quotes `BeliefConvergence.fs`:

> *"an idempotent group is trivial — `a + a = a ⇒ a = e` — so a single operator cannot be both redelivery-safe and retraction-capable."*

and resolves it with **two** structures — `join` (idempotent, source-keyed, redelivery-safe) and `interfere` (has inverses, retraction-capable). The belief pair meets the same wall from the evidence side: an accumulating `⊕` breaks distributivity (§3.1); an idempotent `⊕` is lawful but cannot accumulate (§3.2). **Any single-merge-function design for the belief pair is refuted before it is written, by a theorem this repo already holds.** **[STRUCTURAL — reuse, do not re-prove]**

### 3.4 No additive inverse ⇒ no retraction, and the compiler is the prover

Under either lawful `⊕`, only `Zero` has an additive inverse (`max(a,b) = 0 ⇒ a = b = 0`). So the belief pair is an **inverse-free semiring**, and by `WSet.fs`'s own rung discipline:

> `negate` and the whole `FourCornerTrace` demand `#IRing` — **the compiler, not a runtime throw, refuses it.**

Consequence, stated as a design constraint rather than an opinion:

> **A belief-pair lane cannot retract. Correcting a belief there is re-normalisation, not retraction** — exactly what `WSet.fs` already says of the normalised `ℝ≥0` corner, and it says *"do not paper over the difference."*

**The architecture this forces**: if you want retraction on beliefs, carry **signed evidence counts** in the tensor — `ℤ²` componentwise is a commutative *ring*, so the full trace instantiates — and derive `(t,f)` at the boundary. **Signed counts in, bounded belief pair out.** That is `WSet`'s existing discipline (linear inside, nonlinear at the boundary only) applied to belief, and it is the same shape as Jøsang's evidence↔opinion bijection in §5.2. **[STRUCTURAL, modulo one open seam: `ℤ²` componentwise `×` is a *path-weight* product, not logical conjunction. What `⊗` means for evidence counts must be declared before this is checked. Named, not hidden.]**

### 3.5 A small, real defect in the interface tower

The belief pair has a natural involution — **negation is coordinate swap, `¬(t,f) = (f,t)`** — and no additive inverse. But the tower is `IStarRing :> IRing :> ISemiring`, so **to give a weight a conjugation you must first give it a `Negate` it does not have.** Star (an involution) and additive inverse are logically independent; the tower makes the first imply the second.

Remedy, if wanted: an `IInvolutiveSemiring<'W>` rung between `ISemiring` and `IRing`. Registered as an observation with a named remedy — not a demand, and not urgent. **[OBSERVATION — checkable by reading the tower]**

---

## 4. The identification: an interlaced bilattice, and why that is number theory rather than numerology

`.claude/rules/numerology-vs-number-theory.md` requires that a matching count be excluded against competitors by invariants. Four extreme points is a *count*; `{0,1}²`, the diamond `M₂`, `ℤ/4`, and the Klein four-group all have four elements. The invariants:

| invariant | the belief pair has it | excludes |
|---|---|---|
| **two** partial orders on one carrier, each a lattice | `≤_t` (truth: `t↑`, `f↓`) and `≤_k` (knowledge: `t↑`, `f↑`) | any single-order structure, incl. `M₂`, `ℤ/4` |
| **interlacing** — each order's join/meet is monotone w.r.t. the *other* order | holds by construction on the product | non-interlaced bilattices |
| **negation** is `≤_t`-antitone, `≤_k`-**monotone**, and an **involution** (order 2) | `¬(t,f) = (f,t)` | **`C₄` / `ℤ/4`** — cyclic, has an order-4 element; `¬` here has order 2 |
| **representation** — every bounded interlaced bilattice is isomorphic to `L₁ ⊙ L₂` | `L₁ = L₂ = [0,1]` | anything not a product of two lattices |

That last row is Avron's representation theorem, and it is what makes this an *identification* rather than a resemblance: the structure is not merely consistent with `[0,1] ⊙ [0,1]`, it is isomorphic to it.

> **The guard that matters here, because the repo has a live four-corner object.** `src/Core/FourCornerC4.fs` carries a `C₄` compass `{1, i, −1, −i}`. **Belnap's FOUR is not `C₄`.** Both have four elements; `C₄` is cyclic with an order-4 generator, FOUR's negation is an involution and there is no order-4 element. The same file already carries the standing warning in its own words — *"Coincidence: 2 × occupancy-√2 equals 2√2 numerically. Not a measurement of Tsirelson"* — and this is the second instance of the same trap in the same neighbourhood. **Do not identify the belief pair with the four-corner compass.** **[STRUCTURAL — the non-isomorphism is elementary and checkable]**

### 4.1 The consequence for the interface, and it is sharp

A bilattice carries **four** operations — `∧, ∨` for the truth order, `⊗, ⊕` for the knowledge order. `ISemiring<'W>` has **one** `(Add, Mul)` slot.

> **`ISemiring<'W>` cannot express a bilattice.** A `WSet` over a belief pair instantiates *one order at a time*, and the choice of which is a design decision that the type does not record. Picking the truth order silently discards the knowledge order — which is exactly the axis carrying Aaron's signal.

The two candidate `⊕`s are precisely the two joins:

- `≤_t`-join `= (max t, min f)` — **"decide"**: take the strongest support and the weakest refutation.
- `≤_k`-join `= (max t, max f)` — **"accumulate all information, gluts allowed"**: conflict is retained rather than resolved.

That is the raw-vault discipline (`dv2-data-split-discipline-activated.md`: *a single version of the FACTS, never a single version of the TRUTH*) appearing as an order-theoretic fact: **the knowledge order is the raw vault; the truth order is the mart.** **[STRUCTURAL for the order identification; the mapping onto DV2.0 vocabulary is a READING, and is Mirror-register.]**

---

## 5. The residual — what it is, what it is worth, and who already owns each regime

Define `r = 1 − t − f`. `r > 0` = ignorance, `r < 0` = conflict, `r = 0` = classical.

### 5.1 `r` is the slack in Boole's condition of possible experience

A single classical probability assignment `P` with `P(A) = t` and `P(¬A) = f` exists **iff `t + f = 1`**. The general form of "which marginal values admit a joint distribution" is George Boole's (1854) *conditions of possible experience* — the linear inequalities marginals must satisfy — and Pitowsky (1989, 1994) showed the Bell inequalities are exactly Boole's conditions applied to quantum marginals. So:

- **`r > 0`** — the constraint is **slack**: a whole polytope of joint distributions is consistent with the observation. This is imprecision, and its width is a **bid–ask spread**: `t` is the highest price you will pay for a bet on `A`, `1−f` the lowest at which you will sell it (Smith 1961; Walley 1991).
- **`r < 0`** — the constraint is **violated**: no joint distribution fits. By de Finetti (1937), this is precisely **incoherence**, and incoherence is not an abstraction — **a Dutch book exists, and `−r` is the guaranteed loss per unit stake.**

> **Dimensional check, both sides.** `t`, `f`, `r` are dimensionless (probability). Read as prices they carry `[currency · stake⁻¹]`. `r < 0` therefore denominates a **sure loss** in the same units as the stake; `r > 0` denominates an **unallocated spread** in those units. This passes the metering test: the residual is not a rhetorical quantity, it is a priced one, and it can be measured against realised outcomes. **[STRUCTURAL, and it is the strongest single result here — it turns "the gap is signal" into "the gap is money".]**

This also connects the mathematics directly to `.claude/rules/every-bug-has-economic-value.md` and the hard-money framing: a lane running persistently at `r < 0` is *losing measurable value per bet*, which is a ΔU with a witness rather than an assertion.

### 5.2 Who owns which regime — and the answer is that nobody owns both

The candidate theories from the brief, adjudicated. Each row says **which regimes it covers** and **what it calls the residual** — which is what the brief asked for.

| theory | anchor | `r > 0` | `r = 0` | `r < 0` | name for the residual |
|---|---|---|---|---|---|
| **Dempster–Shafer** | Dempster 1967; Shafer 1976 | ✅ the core case | ✅ | ❌ **forbidden by theorem** — `bel(A) + bel(¬A) ≤ 1` is provable | `m(Θ)`, ignorance mass |
| **Jøsang subjective logic** | Jøsang 2001, 2016 | ✅ | ✅ | ❌ `b+d+u = 1` is imposed | `u`, uncertainty |
| **Belnap FOUR** | Belnap 1977; Dunn 1976 | ✅ *none* | ✅ | ✅ *both* | the glut / the gap — **the only one covering both** |
| **bilattice `[0,1]⊙[0,1]`** | Ginsberg 1988; Fitting 1991; Avron 1996 | ✅ | ✅ | ✅ | position on `≤_k` — **continuous, and covers both** |
| **Walley imprecise probability** | Walley 1991; Smith 1961 | ✅ | ✅ | ❌ named **incoherent**, excluded | imprecision / bid–ask |
| **Possibility theory** | Zadeh 1978; Dubois–Prade 1988 | ✅ `N < Π` | ✅ | ❌ `N > Π` disallowed | `Π − N` |
| **quasi-probability** | Wigner 1932; Dirac 1942; Feynman 1987 | n/a | n/a | ✅ *by shape only* | negativity — see §8 |

> **The finding that follows.** Of the established candidates, **only Belnap/bilattice covers both regimes**, and it is the one the structure independently identifies in §4. Dempster–Shafer, Jøsang, Walley and possibility theory all cover exactly the `r ≥ 0` half and each *forbids* `r < 0` by construction. So: Aaron's "let them float independently" is **strictly more general than four of the six**, and its extra generality lands exactly where those four stop. That is a real result, and it is the reason the pair is worth building rather than replacing with Jøsang's triple. **[STRUCTURAL]**

**The `r ≥ 0` half has a LOSSLESS regulariser, and it answers "regularize it to a belief if possible" exactly.** Jøsang's evidence↔opinion mapping is a **bijection**, not a projection:

```
b = r⁺/(r⁺+s+2),  d = s/(r⁺+s+2),  u = 2/(r⁺+s+2)
```

between an opinion and a pair of Beta evidence counts `(r⁺, s)` — where counts live in an **accumulating, lawful commutative monoid** `(ℝ≥0², +)` which is also the exponential family's natural-parameter space where EP projection lives. So for `r ≥ 0`:

> **"Constrain to `[0,1]`" is a change of coordinates, not a lossy projection.** Accumulate in unbounded counts; report in the bounded pair; round-trip exactly. Nothing is discarded. **[STRUCTURAL — Jøsang's bijection is published and checkable]**

**The `r < 0` half has no lossless single-agent regulariser, and that is a theorem, not a gap in the literature.** By de Finetti, an incoherent pair has no probabilistic representative — no single Beta, no single distribution. The only honest moves are (a) **keep the two sources unmerged**, which is `anti-babel-preserve-reconcilability.md`'s *"reintegration is NOT reconvergence — both branches held, each with its path recorded"* arriving as a probability theorem; or (b) **discount the sources** (Shafer's discounting) and record the discount factor. Option (b) requires a source-reliability input the algebra cannot supply — see §7.4.

### 5.3 Dempster's rule, Zadeh's counterexample, and why it bites here

Yes, it bites, and it is the single most important cautionary result for this design.

Dempster's rule divides the conflict mass `K` away, normalising by `1 − K`. Zadeh's counterexample (1979/1984/1986): two doctors over `Θ = {meningitis, concussion, tumour}`. Doctor 1: `m(M)=0.99, m(T)=0.01`. Doctor 2: `m(C)=0.99, m(T)=0.01`. Because `M ∩ C = ∅`, only `T` survives, and after normalisation **`m(T) = 1`**. A hypothesis both experts put at one percent becomes certain.

> **The mechanism of the failure is precisely "the residual was discarded."** Dividing by `1−K` throws away `K` and then renormalises the crumbs. Aaron's instinct — *keep the residual as signal* — is the exact correction the literature spent thirty years arriving at. **[STRUCTURAL — the counterexample is arithmetic and reproducible]**

The named repairs, each differing **only** in what it does with `K`:

- **Yager (1987)** — assign `K` to `Θ` (ignorance). No explosion, but it **erases the sign of `r`**: conflict is relabelled as ignorance, which is the one move that destroys what Aaron wants to keep.
- **Dubois & Prade (1988)** — disjunctive redistribution to `A ∪ B`.
- **Smets (1990; Smets & Kennes 1994)** — **leave `K` on `∅`** (open world), and normalise only at the decision boundary via the pignistic transform (Smets 2005).

> **Smets' Transferable Belief Model has `WSet`'s architecture, arrived at independently and twenty years earlier.** Credal level: unnormalised, combine freely, linear. Pignistic level: normalise *only* when a decision is required. That is `WSet.fs`'s carved discipline — *"the ring's nonlinear step is applied at the OUTER BOUNDARY only, never inside the loop"* — in evidence theory's vocabulary. This is the strongest Beacon anchor in the document and it is a genuine convergence, not a retrofit. **[STRUCTURAL]**

---

## 6. Is the boundary operator derivable from the ring? No — and here is the witness

The coordinator asked for the strongest form to be attacked hardest. It does not survive.

| ring | boundary | what *kind* of object it is | forced by the ring? |
|---|---|---|---|
| `ℤ` | `Distinct`: `w ↦ [w > 0]` | a **semiring homomorphism** onto the Boolean semiring | **No.** `w ↦ [w > 0]` and `w ↦ [w ≠ 0]` are both homomorphism-shaped and **disagree exactly on negative weights**. Which one you pick is a genuine semantic choice: does a net-negative multiplicity mean *absent*, or *present and over-retracted*? DBSP's convention is a choice with consequences for retraction semantics, not a derivation. |
| `ℂ` | `bornProb`: `w ↦ \|w\|²/Σ\|w\|²` | fixed by a **representation theorem** (Gleason 1957: for `dim ≥ 3`, every measure on the closed subspaces is `tr(ρP)`) | **Closest to forced — but forced by premises the ring does not supply.** Gleason needs the *subspace lattice*, non-contextuality, and `dim ≥ 3`. The ring `ℂ` alone gives you none of those. |
| `ℝ≥0` | EP projection | **variational**: `argmin_q KL(p̃ ‖ q)` over an exponential family (Minka 2001; Csiszár's I-projection 1975) | **No, and this is the decisive witness.** Reverse the KL arguments and you get mode-seeking variational Bayes instead of moment-matching EP. **Same ring, same target family, two different operators, both shipped in the literature and both correct for their loss.** |

> **Therefore the ring does not determine the boundary.** The `ℝ≥0` row settles it by witness rather than by argument: one ring, two boundaries. And the three shipped boundaries are not even three instances of one construction — they are an *algebraic quotient*, a *representation theorem*, and a *variational projection*. **[REFUTATION — the strong form of the claim is dead. What survives is the weaker true statement below.]**

**What survives, and it is still useful:**

> A boundary operator is determined by `(ring, declared target, declared selection principle)`. The ring fixes what accumulates. The **target** fixes what "reportable" means. The **selection principle** — an algebraic universal property, a uniqueness theorem, or a divergence — fixes which map onto that target. Two of the three are not properties of the ring.

And the selection principle is decidable by data when the target is a probability:

> **Name the downstream proper scoring rule and the projection becomes unique.** Proper scoring rules stand in bijection with Bregman divergences (Savage 1971; Gneiting & Raftery 2007; Banerjee et al. 2005), and the correct projection onto the reportable set is that divergence's Bregman projection. **Log score → KL → normalisation. Brier score → squared Euclidean → clipping.** So the choice is not a matter of taste: it is a function of what the consumer is scored on, and it is measurable. **[STRUCTURAL for the scoring-rule/Bregman bijection; the application to boundary selection is a DERIVATION MODULO A DECLARED PREMISE, which is the strongest honest form available.]**

Note that the repo has already measured one instance of getting this wrong: the simplex doc's *"Clipping destroys the equality. The clipped path is deliberately invalid and is never a selectable runtime policy."* Clipping is the Brier-optimal projection and the KL-invalid one. Same operation, two verdicts, decided by the loss — exactly as above.

---

## 7. Aaron's third parameter

### 7.1 The false dilemma was mine to lose, and his third option is better

"Derived or picked" was not exhaustive. **Picked, typed, and defaulted** is the right answer, and §6 shows why it is *forced*: two of the three determinants of a boundary are not properties of the ring, so they must be supplied — and anything supplied should be visible.

### 7.2 The rule-level argument is the strongest one, and it is already carved

`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`:

> *"meters never judge, oracles do, and that's why we have many/multiple"*
> *"if there were exactly one oracle, its judgement would be mandatory — every measurement would arrive pre-judged."*

A boundary nonlinearity collapses an unconstrained accumulation into a reportable verdict. **That is a judgement.** Hardcoding one per ring installs a *single mandatory oracle* at exactly the layer the rule forbids, and the rule's own test applies cleanly:

> **Two parties with different oracles must be able to read the same measurement and disagree about what it implies.** With the boundary baked into the ring, they cannot — the verdict arrives pre-judged. With the boundary parameterised, they can.

So parameterising the regulariser is not a preference. It is that rule's conclusion arriving at the type level, and it is the second time the rule has forced this shape. **[This is a READING of a carved rule applied to a new surface — strong, and not a theorem.]**

The same rule also supplies the right *label* for the three shipped boundaries: **they are three chosen defaults with a crystallised judgement, i.e. meters in the rule's sense** — inspectable, agreed-to in advance, frozen per epoch. That is a virtue, not a defect, and it is exactly why they belong in golden vectors. What would be a defect is a *fourth* one appearing with no declared alternative.

### 7.3 Where the parameter goes — not a third type parameter on the container

`WSet` already passes its boundaries as **values**: `consolidate` takes `isZero`, `bornProb` takes `magSq`. Aaron's instinct is therefore already half-implemented, and the missing half is not a phantom type parameter.

**Costs of `WSet<'K,'W,'R>`, stated honestly:**
- It propagates through every signature, including the many that never cross a boundary — `apply`, `plus`, `copy`, `tensor`, `mapKeys` are all `'R`-oblivious by construction (they are the *linear* ops, and the whole discipline is that the boundary is not among them).
- F# will surface it as an un-inferrable `'_` at call sites that never cared, and the usual fix (a default type parameter) does not exist in F#.
- It would attach a boundary to the **free semimodule**, which does not have one. The universal property in §1 is a statement about `(K, R)` alone. Putting `'R` on the container makes the type *claim* something the mathematics does not.

**The formulation that keeps everything Aaron wants and costs nothing at inference:**

> Put the parameter in the boundary's **result type**, not in the container. A boundary is a value of an interface — `IBoundary<'W, 'Report, 'Residual>` — with **a named default per ring** that call sites may override, and its result is the **pair** `(verdict, residual)`.

This buys three things a phantom parameter does not:

1. **Inference never sees it.** The value determines the types; the container stays `WSet<'K,'W>` and the free-semimodule theorem stays true of it.
2. **Discarding the residual becomes a visible act in a signature.** A function that crosses a boundary and returns a bare verdict must have *explicitly* projected the residual away, and that projection appears in the code. This is the type-level enforcement of "the residual is a first-class output rather than a rounding error" — which is stronger than making the boundary nameable, because the failure mode Zadeh's counterexample demonstrates is not *choosing the wrong boundary*, it is *silently dropping `K`*.
3. **It satisfies `interfaces-free-classes-earned-under-rules`**: a boundary is pure shape with no instance state, so it is an interface and therefore free. A third type parameter on the container is closer to a class — weight in the signature that every consumer pays.

Answering the coordinator's inference question directly: **yes — `'R` is inferred from `'W` in the common case, by the default boundary value associated with the ring, and named only when overridden.** That is the same dispatch pattern `Semiring.fs` already uses for `IntegerRing.Instance` / `IntegerRing.Star`.

**[DESIGN — argued from the existing code's shape and two carved rules. Not proven. The claim that it is *better* than a third type parameter is a judgement; the claim that the free semimodule does not carry a boundary is a theorem.]**

### 7.4 "Parametrized on the true/false disagreement" is a published family

This is the part of Aaron's observation that lands hardest, because it names an existing object.

The conflict-redistribution rules of evidence theory differ **only** in what they do with the conflict mass `K` (§5.3). Two papers make the family explicit and parameterised:

- **Lefèvre, Colot & Vannoorenberghe (2002)**, *Belief function combination and conflict management*, Information Fusion 3(2) — the **unified formulation**: redistribute `K` according to a weighting function, with **Dempster, Yager, Dubois–Prade and Smets recovered as instances**.
- **Florea, Jousselme, Bossé & Grenier (2009)**, *Robust combination rules for evidence theory*, Information Fusion 10(2) — a class of rules whose **weighting coefficients are explicit functions of the conflict `K`**, interpolating between Dempster-like behaviour at low conflict and Yager/Dubois–Prade-like behaviour at high conflict.

> **That is exactly "the regularization might be parametrized on the true/false disagreement in context, there might be a best default choice but I don't think it's universal."** Aaron's conjecture is a named, published family with a named index, and its four best-known members are its fixed points. This promotes the hypothesis from coinage to **checked anchor** — and per `anchor-to-human-prior-art.md` that is the difference between a debt and a result. **[STRUCTURAL — established elsewhere, checked against the structure; the application to `WSet` as a typed boundary is new and is the contribution.]**

**A second, independent family is also real and worth knowing, because it unifies two of the tensor's own corners.** A temperature-indexed boundary

```
(t,f) ↦ (t^β, f^β)/Z(β)
```

interpolates continuously: `β = 1` is normalisation, `β → ∞` is `argmax`. This is the log-sum-exp → max limit, i.e. the **tropical / Maslov dequantisation** that relates the sum-product and max-product semirings, and it is the same one-parameter deformation the ML literature uses for annealed inference. So:

> **A temperature-indexed boundary family connects the `ℝ≥0` (EP projection) corner to the tropical (`argmax`) corner of the hexagon continuously.** The corners are not isolated instances; at the boundary layer they are endpoints of one curve. **[STRUCTURAL — the `β → ∞` limit of softmax is `max` is a theorem. That this is *useful* here is a CONJECTURE with a cheap falsifier: sweep `β` and measure log loss.]**

The natural composite of the two families, and the concrete form of Aaron's sentence:

> **`β = β(r)`** — temper hard when the sources agree (`|r|` small, trust the combination, sharpen) and soften when they conflict (`r < 0`, refuse to sharpen). One scalar, one formula, one falsifier.

### 7.5 The best default, and what unseats it

**Default: Smets' open-world discipline.** Do not normalise inside. At the boundary emit the pair `(verdict, r)` and never discard `r`.

Grounds, in descending strength:

1. **It is the only member of the family that is lossless up to the boundary.** Every other rule destroys information earlier, and §5.3 shows what that costs.
2. **The substrate already committed to it, independently.** `WSet.fs`'s "linear inside, nonlinear at the boundary only" and Smets' credal/pignistic split are the same architecture. Adopting the default costs nothing and contradicts nothing.
3. **It is the only one that does not silently judge** — satisfying the rule in §7.2 at the default, not merely at the override.
4. **The obvious competitor is refuted and it has no symmetric refutation.** Zadeh kills normalise-by-`1−K`. There is no Zadeh-shaped counterexample against keeping `K`; the cost of keeping it is carrying a number, which is not a correctness failure.

**What unseats it, and this is the measurement to run:**

> If a downstream consumer is scored by a proper scoring rule, the correct projection is that rule's Bregman projection (§6), not the pignistic one. So: **take belief pairs from a live lane, hold out the realised outcomes, and compare boundary operators under log score and Brier score.** If a specific lane's consumer is Brier-scored, clipping beats pignistic *for that lane* and the default is overridden there. This is cheap, it is falsifiable, and it produces a per-lane answer rather than an argument.

**And a plain statement where no default is defensible.** For the `r < 0` regime, **no default is defensible without measurement**, and this is a structural fact rather than a gap in my analysis: every rule in the family is a different answer to *"whose fault is the conflict"*, and that is a source-reliability question the algebra cannot answer. The discount factor must come from data.

> **The data already exists in this repo.** `src/Core/TravelerRankLedger.fs` holds TrueSkill-style per-(traveler × domain) rankings — held by others, never self-asserted, domain-isolated. **The conflict-indexed regulariser should read its discount from the rank ledger, not from a constant.** That is the concrete build this analysis recommends, and it is the one place where the mathematics and the shipped social machinery meet. **[DESIGN — the connection is argued; whether rank correlates with reliability on a given lane is exactly what the measurement above would show.]**

---

## 8. The quantum link — say it is decoration, and say what would promote it

The brief asked for plainness. Here it is.

**What is claimed in the literature.** The Wigner function (Wigner 1932) can take negative values while its marginals are genuine probabilities. Dirac (1942) and Feynman (1987) both argued that negative probabilities are legitimate intermediate quantities provided the observable predictions are non-negative. The *content* is in the theorems: Hudson (1974) — the Wigner function is non-negative iff the pure state is Gaussian; Spekkens (2008) — negativity and contextuality are equivalent notions of non-classicality; Ferrie & Emerson (2008) — **no** non-negative quasi-probability representation of quantum mechanics exists.

**What all of that requires, and we do not have.** A family of **mutually incompatible measurements** whose marginals must *all* be reproduced by a single joint object, such that no non-negative joint exists. That is the entire content. Take it away and "negative probability" is just an arithmetic mistake wearing a physicist's coat.

**We do not have it.** `t` and `f` are two numbers about the *same* proposition, possibly from different sources. There is no complementarity, no non-commuting observables, and nothing forcing a joint representation. `t + f > 1` is two witnesses disagreeing, which is an everyday event requiring no physics.

> **Verdict: the shape matches, the mechanism does not. Register this as ANALOGY, and prefer the classical anchor.** `t + f ≠ 1` is a violation of **Boole's conditions of possible experience** (1854) and an **incoherence** in de Finetti's (1937) sense. Boole's conditions are also the *ancestor* of the quantum result — Pitowsky (1989, 1994) showed the Bell inequalities are Boole's conditions applied to quantum marginals — so taking the classical anchor loses nothing and gains a Dutch-book price (§5.1) that the quantum framing does not supply.

**What would promote it, stated as a real experiment with a real negative result available.** Exhibit a concrete family of Zeta "measurements" that (a) cannot all be performed jointly, (b) have marginals that must be reproduced, and (c) admit no non-negative joint. That is a contextuality test, and it is *precisely* the open measurement `dual-use-detection-is-neutral-oracle-decides.md` already registered:

> *"Does Zeta's own declared-channel discipline produce a correlation ceiling strictly below what non-signalling alone would permit — and where is it?"*

If belief lanes turn out to carry such a family, the quantum link is earned. Until then it is decoration, and the standing warning is two files away in `FourCornerC4.fs`.

**[ANALOGY. Promotion criterion named. My recommendation is that the belief-pair work proceed with no quantum framing at all — it does not need one, and the classical anchors are stronger, older, and priced.]**

---

## 9. "This is the same for any true/false belief even our numeric claims" — the scope note

The pair lives **over a proposition**. A numeric claim (`X = 3.42`) is not a proposition until a predicate is fixed — a tolerance, an interval, a comparison. So:

> **A numeric claim must declare its predicate before it can carry a belief pair, and the choice of tolerance is a modelling decision the pair cannot recover.** Two different tolerances over the same measurement give two different `(t,f)` pairs with no way to convert between them.

This is the same boundary the repo already drew for `SoftValue`: `resolve threshold` collapses to a definite value only above a threshold, and the threshold is a *parameter*, passed in. `SoftValue` keeps a distribution on the **value** axis; `Predicate3`/`TriBoolean` keeps `UNKNOWN` on the **truth** axis. The belief pair is a refinement of the truth axis — a *continuous* `UNKNOWN` with a sign — and it composes with `SoftValue` rather than replacing it. And `SnapPolicy` is already the boundary-as-a-value pattern from §7.3, shipped: `snap : SnapPolicy -> SoftValue -> DynamicValue option`, with `threshold` and `best` as named defaults.

> **`SoftValue.SnapPolicy` is the prototype of `IBoundary`.** The recommendation in §7.3 is to generalise an existing, working pattern — not to introduce one. **[OBSERVATION — checkable by reading `SoftValue.fs`]**

---

## 10. What Soraya would need — properties, not proofs

Named, with tool routing and rationale. Ordered by cost-to-value.

| # | property | tool | why that tool |
|---|---|---|---|
| 1 | **Semiring law pack** for each candidate weight (probabilistic-sum/product; Łukasiewicz; max-times; max-min; componentwise products of each) | **FsCheck** | Matches the existing `tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs` pattern exactly; `IntervalWeight`'s demotion was established this way. Cheapest first step. |
| 2 | **Lock the distributivity counterexamples as regression witnesses** (`a=1/2, b=c=1` for probabilistic sum; `a=b=c=1/2` for Łukasiewicz) | **FsCheck / unit** | A stated counterexample rots; a locked one does not. Per `toy-is-free-metered-must-be-earned`, a refutation with no test is an assertion. |
| 3 | **Closure of `[0,1]²`** under the declared ops (totality / no escape from the unit square) | **FsCheck**, or **Z3** for the real-arithmetic statement | Z3 handles the `∀a,b ∈ [0,1]` real form directly; FsCheck gives the cheap empirical version first. |
| 4 | **No additive inverse ⇒ `IRing` must not be instantiated** | **the F# compiler** | `WSet.fs`'s rung design already makes this a type-level refusal rather than a runtime one. The obligation is to *not* add an `IRing` instance, and the falsifier is that `FourCornerTrace` fails to typecheck over the belief weight. No prover needed; do not build one. |
| 5 | **Coherence ⟺ `t+f=1`, and the Dutch-book loss equals `−r`** | **Z3** | This is a small linear-feasibility statement over the reals — an LP, which is Z3's wheelhouse. It is also the property that gives the residual its units, so it is the highest-value single obligation here. |
| 6 | **Jøsang's bijection round-trips** `(t,f,r≥0) ↔ (α,β)` | **FsCheck** round-trip property, then **Lean** if the exactness matters | Round-trip is the natural property form; the float version needs an ULP bound, which is `numerical-analysis-and-floating-point-expert` territory. |
| 7 | **The bilattice identification**: two orders, interlacing, negation `≤_t`-antitone / `≤_k`-monotone and of order 2; and `FOUR ≇ C₄` | **Lean 4** — finite model first (Belnap's four points), then the `[0,1]` construction | This is the structural claim and the only one that deserves a real proof. **Honest cost: Mathlib has `Lattice` and `BooleanAlgebra` but no bilattice hierarchy** — this is a genuine formalisation project, not a lemma. The `FOUR ≇ C₄` half is cheap and should be done first and separately; it is the numerology guard. |
| 8 | **Idempotence-vs-inverse impossibility** for a single merge operator | **already proven in-repo** | `BeliefConvergence.fs` / `ClaimLane.fs`. **Reuse; do not re-prove.** Cite it. |
| 9 | **Boundary-operator selection under a declared scoring rule** — that the Bregman projection for the declared rule is the minimiser | **not a proof obligation — a MEASUREMENT** | Log loss / Brier on held-out outcomes from a live lane. Routing this to a prover would be a category error: the question is which loss the consumer has, and that is empirical. |

**Not applicable:** TLA+. Nothing here is a concurrency or temporal-safety claim. If a belief lane later acquires an ordering discipline, `local-time-never-enters-the-shared-fold` applies and TLA+ returns — but not for the algebra.

---

## 11. Register summary

| # | claim | register | what would change it |
|---|---|---|---|
| 1 | Independence-motivated `(t,f)` algebra is not a semiring (distributivity fails) | **STRUCTURAL / REFUTED** | Nothing — it is arithmetic. A *different* declared semantics for `⊕`/`⊗` would be a different claim, not a correction of this one. |
| 2 | `[0,1]²` under componentwise max-times in `(t, 1−f)` IS a lawful commutative semiring | **STRUCTURAL** | Nothing — products of lawful semirings are lawful. |
| 3 | Idempotent `⊕` cannot accumulate; a single operator cannot be both | **STRUCTURAL — in-repo** | Already proven (`BeliefConvergence.fs`). |
| 4 | The pair is the interlaced bilattice `[0,1]⊙[0,1]`; Belnap's FOUR is its extremes | **STRUCTURAL** | A competitor structure satisfying all four invariants in §4. None is known. |
| 5 | `FOUR ≇ C₄` | **STRUCTURAL** | Nothing — one has an order-4 element, the other does not. |
| 6 | `r = 1 − t − f` is Boole slack; `r<0` is de Finetti incoherence with loss `−r` per unit stake | **STRUCTURAL** | Nothing at the theory level. The *empirical* claim that a Zeta lane's `r` predicts realised loss is unmeasured. |
| 7 | Only Belnap/bilattice among the established candidates covers both regimes | **STRUCTURAL** | A theory covering `r<0` that I missed. I searched the six named in the brief plus possibility theory. |
| 8 | Jøsang's bijection makes `r ≥ 0` losslessly regularisable | **STRUCTURAL — published** | Nothing; it is a bijection. |
| 9 | `r < 0` has no lossless single-agent regulariser | **STRUCTURAL** | Would require refuting de Finetti. |
| 10 | Smets' TBM has `WSet`'s architecture | **STRUCTURAL** | Nothing — it is a comparison of two stated disciplines. |
| 11 | Zadeh's counterexample bites; its mechanism is "the residual was discarded" | **STRUCTURAL** | Nothing — reproducible arithmetic. |
| 12 | The ring does not determine the boundary (witness: two KL directions over `ℝ≥0`) | **REFUTATION — witness-based** | Nothing. |
| 13 | Born is forced *given* Gleason's premises, which the ring does not supply | **STRUCTURAL** | Nothing at the theorem level. |
| 14 | Proper scoring rule ⇒ unique Bregman projection ⇒ boundary selection is data-decidable | **STRUCTURAL (the bijection) + DERIVATION MODULO PREMISE (the application)** | Measure it. §7.5 names the experiment. |
| 15 | Conflict-indexed regulariser family = Lefèvre et al. 2002 / Florea et al. 2009 | **STRUCTURAL — checked anchor** | A closer-fitting published family. |
| 16 | Temperature family connects the `ℝ≥0` and tropical corners continuously | **STRUCTURAL (the limit) + CONJECTURE (that it is useful here)** | Sweep `β`, measure log loss. Cheap. |
| 17 | The parameter belongs in the boundary's result type, not the container | **DESIGN — argued** | A concrete F# sketch showing the third type parameter does not leak. I believe it does; I did not write the code to prove it. |
| 18 | Conflict discount should read from `TravelerRankLedger` | **DESIGN — argued** | Measure whether rank correlates with per-lane reliability. If not, the connection is decorative. |
| 19 | Quantum / quasi-probability link | **ANALOGY — decoration** | Exhibit a contextuality-shaped constraint family in Zeta (§8). |
| 20 | The knowledge order is the raw vault; the truth order is the mart | **READING — Mirror register** | It is a vocabulary mapping, not a theorem. Compresses to Beacon as "two orders, Avron 1996". |
| 21 | `IStarRing :> IRing` makes star imply additive inverse; belief pair has star without inverse | **OBSERVATION** | Read the tower. Remedy named, not demanded. |
| 22 | `ISemiring` has one `(Add,Mul)` slot; a bilattice needs two orders | **STRUCTURAL** | Nothing — it is a count of slots against a count of orders. |

---

## 12. Beacon anchors

**Algebra and the universal property**
- Golan, J. S. (1999). *Semirings and their Applications*. Kluwer.
- Aji, S. M. & McEliece, R. J. (2000). "The generalized distributive law." *IEEE Trans. Inform. Theory* 46(2), 325–343. — the unifying theorem `WSet.fs` already cites.
- Moore, R. E. (1966). *Interval Analysis*. Prentice-Hall. — sub-distributivity; the reason `IntervalWeight` is demoted in-repo.

**Bilattices and four-valued logic**
- Belnap, N. D. Jr. (1977). "A useful four-valued logic." In Dunn & Epstein (eds.), *Modern Uses of Multiple-Valued Logic*, Reidel, 5–37.
- Dunn, J. M. (1976). "Intuitive semantics for first-degree entailments and coupled trees." *Philosophical Studies* 29(3), 149–168.
- Ginsberg, M. L. (1988). "Multivalued logics: a uniform approach to reasoning in artificial intelligence." *Computational Intelligence* 4(3), 265–316. — the `L₁ ⊙ L₂` construction.
- Fitting, M. (1991). "Bilattices and the semantics of logic programming." *Journal of Logic Programming* 11(2), 91–116.
- Avron, A. (1996). "The structure of interlaced bilattices." *Mathematical Structures in Computer Science* 6(3), 287–299. — the representation theorem that makes §4 an identification.
- Arieli, O. & Avron, A. (1996). "Reasoning with logical bilattices." *Journal of Logic, Language and Information* 5(1), 25–63.
- Łukasiewicz, J. (1920). "O logice trójwartościowej." *Ruch Filozoficzny* 5, 170–171.
- Chang, C. C. (1958). "Algebraic analysis of many valued logics." *Trans. AMS* 88, 467–490. — MV-algebras.
- Kleene, S. C. (1952). *Introduction to Metamathematics*. North-Holland. — strong three-valued logic; the in-repo `TriBoolean`/`BooleanKleene` ancestor.

**Coherence, imprecision, and the price of the residual**
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton & Maberly. — conditions of possible experience.
- Ramsey, F. P. (1926). "Truth and Probability." In *The Foundations of Mathematics*, 1931.
- de Finetti, B. (1937). "La prévision: ses lois logiques, ses sources subjectives." *Annales de l'IHP* 7, 1–68. — coherence and the Dutch book.
- Smith, C. A. B. (1961). "Consistency in statistical inference and decision." *JRSS B* 23(1), 1–25. — bid–ask betting rates.
- Walley, P. (1991). *Statistical Reasoning with Imprecise Probabilities*. Chapman & Hall.
- Pitowsky, I. (1989). *Quantum Probability — Quantum Logic*. Lecture Notes in Physics 321, Springer.
- Pitowsky, I. (1994). "George Boole's 'conditions of possible experience' and the quantum puzzle." *BJPS* 45(1), 95–125.

**Evidence theory and the conflict-indexed family**
- Dempster, A. P. (1967). "Upper and lower probabilities induced by a multivalued mapping." *Annals of Mathematical Statistics* 38(2), 325–339.
- Shafer, G. (1976). *A Mathematical Theory of Evidence*. Princeton University Press.
- Zadeh, L. A. (1979). "On the validity of Dempster's rule of combination of evidence." Memo UCB/ERL M79/24, UC Berkeley; and (1986) "A simple view of the Dempster-Shafer theory of evidence and its implication for the rule of combination." *AI Magazine* 7(2), 85–90. — the counterexample.
- Yager, R. R. (1987). "On the Dempster-Shafer framework and new combination rules." *Information Sciences* 41(2), 93–137.
- Dubois, D. & Prade, H. (1988). "Representation and combination of uncertainty with belief functions and possibility measures." *Computational Intelligence* 4(3), 244–264.
- Smets, P. (1990). "The combination of evidence in the transferable belief model." *IEEE TPAMI* 12(5), 447–458.
- Smets, P. & Kennes, R. (1994). "The transferable belief model." *Artificial Intelligence* 66(2), 191–234. — the credal/pignistic split.
- Smets, P. (2005). "Decision making in the TBM: the necessity of the pignistic transformation." *IJAR* 38(2), 133–147.
- **Lefèvre, E., Colot, O. & Vannoorenberghe, P. (2002). "Belief function combination and conflict management." *Information Fusion* 3(2), 149–162.** — the unified, conflict-weighted family.
- **Florea, M. C., Jousselme, A.-L., Bossé, É. & Grenier, D. (2009). "Robust combination rules for evidence theory." *Information Fusion* 10(2), 183–197.** — weighting coefficients as explicit functions of conflict. These two are the anchor for §7.4.
- Jøsang, A. (2001). "A logic for uncertain probabilities." *Int. J. Uncertainty, Fuzziness and Knowledge-Based Systems* 9(3), 279–311; and (2016) *Subjective Logic: A Formalism for Reasoning Under Uncertainty*, Springer. — the evidence↔opinion bijection.
- Zadeh, L. A. (1978). "Fuzzy sets as a basis for a theory of possibility." *Fuzzy Sets and Systems* 1(1), 3–28.
- Dubois, D. & Prade, H. (1988). *Possibility Theory*. Plenum Press. — necessity/possibility duality.

**Projections, scoring rules, and the boundary**
- Csiszár, I. (1975). "I-divergence geometry of probability distributions and minimization problems." *Annals of Probability* 3(1), 146–158.
- Bregman, L. M. (1967). "The relaxation method of finding the common point of convex sets…" *USSR Comp. Math. and Math. Physics* 7(3), 200–217.
- Savage, L. J. (1971). "Elicitation of personal probabilities and expectations." *JASA* 66(336), 783–801.
- Banerjee, A., Merugu, S., Dhillon, I. S. & Ghosh, J. (2005). "Clustering with Bregman divergences." *JMLR* 6, 1705–1749. — the Bregman↔exponential-family bijection.
- Gneiting, T. & Raftery, A. E. (2007). "Strictly proper scoring rules, prediction, and estimation." *JASA* 102(477), 359–378.
- Minka, T. P. (2001). "Expectation Propagation for approximate Bayesian inference." *UAI 2001*, 362–369. — the `ℝ≥0` boundary, and the KL-direction choice that refutes derivability.
- Amari, S. (2016). *Information Geometry and Its Applications*. Springer.
- Gleason, A. M. (1957). "Measures on the closed subspaces of a Hilbert space." *Journal of Mathematics and Mechanics* 6(6), 885–893. — what forces Born, and what Born needs beyond the ring.

**Quasi-probability (analogy register only)**
- Wigner, E. P. (1932). "On the quantum correction for thermodynamic equilibrium." *Physical Review* 40(5), 749–759.
- Dirac, P. A. M. (1942). "The physical interpretation of quantum mechanics." *Proc. Roy. Soc. A* 180(980), 1–40.
- Feynman, R. P. (1987). "Negative probability." In Hiley & Peat (eds.), *Quantum Implications*, Routledge, 235–248.
- Hudson, R. L. (1974). "When is the Wigner quasi-probability density non-negative?" *Reports on Mathematical Physics* 6(2), 249–252.
- Spekkens, R. W. (2008). "Negativity and contextuality are equivalent notions of nonclassicality." *PRL* 101, 020401.
- Ferrie, C. & Emerson, J. (2008). "Frame representations of quantum mechanics and the necessity of negativity in quasi-probability representations." *J. Phys. A* 41, 352001.

**Sketches (the design Aaron generalises from)**
- Bloom, B. H. (1970). "Space/time trade-offs in hash coding with allowable errors." *CACM* 13(7), 422–426. — the one-sided-error asymmetry the dual-bloom router exploits (`docs/research/2026-06-15-honest-capability-deferment-…` §"The dual bloom / anti-bloom capability router"; `docs/research/bloom-filter-frontier.md` §"Bloom vs anti-bloom (2026-09-05)" — two grow-only filters, three-valued `{present, absent, unknown}`, unknown region `fp(I)×fp(D)`).

**In-repo, checked**
- `src/Core/WSet.fs` — the tensor, the three rings, the boundary discipline, the `ISemiring`/`IRing`/`IStarRing` rungs, the `IRing`-refuses-the-trace design.
- `src/Core/Semiring.fs` — `IntegerRing`, and `IntervalWeight`'s demotion (`081KWGA0C7`): the in-repo precedent that two-coordinate weights fail ring and semiring laws.
- `src/Core/SoftValue.fs` — `SnapPolicy` as boundary-passed-as-value; the never-falsely-certain discipline.
- `src/Core/ClaimLane.fs` / `src/Core/BeliefConvergence.fs` — the idempotent-vs-inverse impossibility, and the float-epsilon associativity caveat.
- `src/Core/FourCornerC4.fs` — the `C₄` compass, and the standing numerology warning.
- `src/Core/TravelerRankLedger.fs` — the socially-held reliability signal §7.5 recommends as the conflict discount's source.
- `docs/research/2026-09-06-simplex-wset-comparison-and-stack-verdicts.md` — the free-semimodule statement, the consolidation caveat, the bilinear-not-jointly-linear caveat, and the measured verdict that clipping is invalid.

---

## 13. Two warnings to the next reader

**The first is about method, and the repo has already paid for it.** `docs/research/2026-05-07-claudeai-seeking-feedback-conversation-extract-partial-blocked.md` records an external reviewer dismantling an earlier attempt to ground a claim by *naming* Priest, Weber and Brady on paraconsistent set theory:

> *"Citing them gives the appearance of academic grounding without the substance of it. A real grounding would say: 'we adopt Weber's formulation of naive comprehension in LP, restrict it as follows, and embed Z-sets as the following construction.' That would be checkable."*

The bar that criticism sets is the bar this document tried to meet: every anchor above is attached to a *specific* operation or theorem, the two refutations come with arithmetic witnesses you can check by hand, and the bilattice identification is offered with the invariants that exclude the competitors. Where I could not meet the bar — §7.3 (the type-parameter design), §7.5's rank-ledger connection, §7.4's temperature usefulness — I marked it DESIGN or CONJECTURE. **Anything in this document not marked STRUCTURAL should be treated as a debt until its falsifier runs.**

**The second is about the register of one word.** "Universal tensor" is a Mirror-register in-house term. Its Beacon compression exists and is exact — **the free `R`-semimodule on `K`**, with the unique-linear-extension universal property — and it was already written down in-repo. The compression is what makes the admissibility question answerable at all: without it, "is the belief pair admissible?" is a matter of taste; with it, the question is "is this a lawful commutative semiring?", which has an answer, and the answer here is **no under the obvious operations and yes under the possibilistic ones, at a named cost**.
