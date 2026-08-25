# Banana split on the Cayley–Dickson lattice ladder: one generator, plus a three-valued _choice_ — and what "generator + join" forbids

**Date:** 2026-08-25
**Work item:** `081M0X4PNFN087G0R0034MZVZ4`
**Predecessors:** #15415 (Kira, adversarial) · #15417 (Lumen, adjudication). Both read in full before this
was started; both are cited by section below.

**Register.** Every number in this document is produced by
`src/Core.TypeScript/research/banana-split/cd-order-ladder.ts` and pinned by 25 tests (286 assertions) in
`cd-order-ladder.test.ts`, **wired into the `full-verify` job of `.github/workflows/gate.yml`** — which
is in the required floor. That is the one thing both predecessors could not say: #15417 explicitly
self-labelled `unmetered` because its arithmetic "ran in a scratch worktree, not committed and not in
CI." The arithmetic here is exact rational arithmetic over `BigInt`; there is no floating point and
no tolerance anywhere in the module. Claims that are **not** computed are labelled UNVERIFIED inline,
and there are four of them (§9).

---

## 0. The verdict, first

Aaron asked whether the most abstract form of Meijer's banana split, applied to the ladder, leaves
**one object** or splits it into **several irreducible objects plus one**.

> **It splits into ONE irreducible object plus one thing that is not an object of the same kind.**
>
> The Cayley–Dickson doubling is a genuine catamorphism — total, uniform, natural, infinite. The
> maximal-order completion is **not a catamorphism, not a functor, and not a natural transformation**.
> At the quaternion rung it is a unique least upper bound; at the octonion rung it is a **three-valued
> choice with no canonical element**, and at the sedenion rung it does nothing at all. So the pair is
> **not a banana split** (the split condition is unsatisfiable), and it is **not even a zygomorphism**
> (the second component is not a function). The "plus one" Aaron predicted is real and sits exactly
> where he predicted — but it is a **selection**, and its honest algebraic type is _choice plus a
> recorded witness_, not _join_.

| #   | question                                             | verdict                                                                                    | the invariant that decides it                                                              | §        |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------- |
| 1   | Is "banana split" load-bearing here, or a metaphor?  | **LOAD-BEARING — but only over the infinite carrier**                                      | over the 4-rung ladder the law is _vacuous_: every map out of a finite coproduct factors   | §2       |
| 2   | Is CD doubling a catamorphism?                       | **YES**                                                                                    | it is the iterator for `F X = 1 + X`, i.e. the cata out of ℕ; total and uniform            | §3       |
| 3   | Is the lattice ladder a catamorphism?                | **NO — the step is not a function of the lattice**                                         | same ℤ⁴, same Gram, two ambients, two different completions (index 2 vs index 1)           | §4       |
| 4   | Then is it a _zygomorphism_ (reads the algebra)?     | **NO — the step is not a function at all**                                                 | 3 multiplicatively-closed unimodular completions at the 𝕆 rung, not 1                      | §5       |
| 5   | Does Kira's uniform natural `?` exist?               | **NO — refuted, not merely unconstructed**                                                 | an automorphism of the input data permutes the three completions with no fixed point       | §6       |
| 6   | Kira's unrun rank-16 control                         | **RUN — the routes provably diverge**                                                      | CD gives E₈⊕E₈ (2 root components); D₁₆⁺ (1 component) is unreachable. Both have 480 roots | §7       |
| 7   | Is `generator + join` the ana/cata pair?             | **NO — both end in a fold; only one begins with an unfold**                                | the difference is _idempotence + commutativity_, not associativity                         | §8.1     |
| 8   | What does "everything is generators + joins" forbid? | **In its strong form: three things — and both of Aaron's own exemplars violate the third** | the poset of orders above D₄⊕D₄ has three maximal elements and **no top**                  | §8.2–8.4 |

**The single most useful sentence:** _`ace.lock` and the half-integer glue vectors are the same object._
Both are the recorded witness of a selection that a least upper bound would have made unnecessary. If
"generator + join" were literally true, neither would need to exist.

---

## 1. The law, stated properly

Meijer, Fokkinga & Paterson, _Functional Programming with Bananas, Lenses, Envelopes and Barbed Wire_
(FPCA 1991). For an initial `F`-algebra `(μF, in)`, with `⦇φ⦈` the unique algebra homomorphism out of
it and `△` the pairing:

```
    ⦇φ⦈ △ ⦇ψ⦈  =  ⦇(φ ∘ F π₁) △ (ψ ∘ F π₂)⦈
```

Categorically this is two facts at once: the forgetful functor `Alg(F) → C` **creates products**, and
`hom(μF, −)` — being hom out of an initial object — **preserves** them. The usual reading is an
optimisation (two traversals fuse into one). **The reading we need is the converse**, and it is the
part that carries information:

> A catamorphism into a product carrier `⦇χ⦈ : μF → A × B` factors into a **pair of independent
> catamorphisms** exactly when `(A × B, χ)` is a product _in `Alg(F)`_ — equivalently, when both
> projections are algebra maps:
>
> ```
>     π₁ ∘ χ = φ ∘ F π₁          π₂ ∘ χ = ψ ∘ F π₂          (THE SPLIT CONDITION)
> ```

The split condition is a decision procedure, and it has three outcomes, all of which are real named
things in this literature:

| both projections           | name                                           | shape                                  | Aaron's phrasing               |
| -------------------------- | ---------------------------------------------- | -------------------------------------- | ------------------------------ |
| both hold                  | **banana split** (MFP 1991)                    | two independent objects                | "multiple irreducible objects" |
| one holds                  | **zygomorphism** (Malcolm 1990; Fokkinga 1992) | one object + one _dependent_ component | "…plus one"                    |
| the step is not a function | **not a catamorphism at all**                  | no fold exists                         | —                              |

**This is not an imported metaphor.** `src/Core/DynamicValueFold.fs` already carries `cata`, `ana`, and
a `bananaSplit` with exactly this anchor ("the unique algebra homomorphism out of the initial algebra
— the fold (Meijer/Fokkinga/Paterson 1991)"). The tool Aaron reached for is a tool the repo already
holds; this document is the first time it has been pointed at the lattice ladder.

---

## 2. The carrier — and where the law goes vacuous

**What is the initial algebra being folded?**

The CD tower is `A(n) = D^n(ℝ)`, where `D` is the doubling endofunctor on real `*`-algebras,
`D(A) = A ⊕ A` with `(a,b)(c,d) = (ac − d̄b, da + bc̄)`. The map `n ↦ D^n(ℝ)` is the **iterator**, and
the iterator is precisely the catamorphism for `F(X) = 1 + X`, whose initial algebra is
`(ℕ, [zero, succ])`:

```
    ⦇c, f⦈(n) = fⁿ(c)                so     A = ⦇ℝ, D⦈
```

So the carrier is `ℕ = μ(1 + X)`, and the product carrier is `Algebras × Lattices`.

**And here is a result worth stating before any of the arithmetic, because it disciplines the whole
exercise:**

> **Over the finite ladder, the banana split law is VACUOUS.** If you take the carrier to be the four
> rungs ℝ, ℂ, ℍ, 𝕆 — and Hurwitz (1898) says the tower of _normed_ algebras genuinely stops there —
> then `μF = 1 + 1 + 1 + 1`, a finite discrete object. Every function out of a finite coproduct
> factors through anything you like; there is no fusion content, no obstruction, and no information
> in the answer. Applying the law there and reporting "it splits" would be the vacuity class in its
> purest form: a check that cannot fail.

The law has content here **only** because the CD tower is genuinely infinite: `D^n(ℝ)` exists for
every `n`, and the module measures the sedenion rung (n = 4) to confirm it is a real algebra and not
a boundary artefact. It is the **lattice** leg, not the algebra leg, that runs out — and _that
asymmetry is itself the result_.

---

## 3. π₁ — the doubling is a genuine catamorphism

`D` is total, uniform, and reads only its argument. Measured, not assumed
(`profileCdRung`, exhaustive over basis elements **and every sum `eᵢ + eⱼ`**):

| rung | dim | commutative | associative | alternative | norm multiplicative |
| ---- | --- | ----------- | ----------- | ----------- | ------------------- |
| ℂ    | 2   | yes         | yes         | yes         | yes                 |
| ℍ    | 4   | **no**      | yes         | yes         | yes                 |
| 𝕆    | 8   | no          | **no**      | yes         | yes                 |
| 𝕊    | 16  | no          | no          | **no**      | **no**              |

**Why the test elements matter, stated because getting this wrong is easy.** Restricted to _basis_
elements the same profile reports the sedenions as normed **and** alternative — both false. On basis
vectors `N = 1` identically, so `N(xy) = N(x)N(y)` holds trivially, and `(eᵢeᵢ)eⱼ = eᵢ(eᵢeⱼ)` holds
too. The sedenion zero divisors live on sums. There is a **control test in the suite** that asserts
the basis-only version passes for dimension 16, so that if the real check ever loses its teeth, the
control goes red and says so.

The split condition therefore **holds on the left**: `π₁ ∘ χ = D ∘ π₁`. One irreducible object,
earned.

**One structural fact about the generator, which the rest of the document turns on** (asserted as a
test on the Gram matrix, not by inspection):

> **The CD generator's lattice output is always an ORTHOGONAL DIRECT SUM.** `D(L) = L ⊕ Lℓ` has a
> block-diagonal Gram by construction, so its root system always has **at least two components**. The
> generator can never, at any rung, produce an indecomposable lattice. Whatever fuses the components
> is not the generator.

---

## 4. π₂ fails the split condition — the lattice step reads the algebra

This is the load-bearing computation, and it is small enough to state completely.

Take the ℤ-module `ℤ⁴` with the quadratic form `Q(x) = 2 Σ xᵢ²` (Gram `2·I₄`, 8 roots, root system
`A₁⁴`). Put it in two different ambient algebras:

| ambient                                   | what ℤ⁴ is there        | maximal integral order containing it        | index |
| ----------------------------------------- | ----------------------- | ------------------------------------------- | ----- |
| **ℍ** (Hamilton quaternions)              | the **Lipschitz** order | the **Hurwitz** order (D₄, det 4, 24 units) | **2** |
| **ℂ × ℂ** (the commutative split algebra) | `ℤ[i] × ℤ[i]`           | **itself** — already maximal                | **1** |

Same ℤ-module. Same quadratic form. Same root system. **Different successor.**

The witness is one element: `ω = (1 + i + j + k)/2`. In ℍ it satisfies `Tr(ω) = 1`, `N(ω) = 1`, so it
is an algebraic integer and the Lipschitz order is not maximal. In ℂ × ℂ its first component is
`(1+i)/2`, which is not a Gaussian integer, so it is not integral and `ℤ[i] × ℤ[i]` _is_ maximal.

> **Therefore `π₂ ∘ χ = ψ ∘ F π₂` is unsatisfiable.** No `ψ` can exist, because `ψ` would have to
> return two different values for the same input. **The ladder is not a banana split.**

This is the precise, computed form of #15417's finding that "the ladder does not commute with
doubling." That document showed the _indices_ disagree (2, then 4); this shows _why no repair is
possible_: the missing information is not in the lattice at all.

---

## 5. …and it is not a zygomorphism either, because the step is not a function

A zygomorphism would be the graceful fallback: one honest catamorphism (`D`) plus a second component
that legitimately reads the first. That is exactly Aaron's "N plus one", and it is what I expected to
find. It fails, and the failure is sharper than the fallback.

`integralOverlattices` enumerates **every** integral overlattice exhaustively — every isotropic
subgroup of the discriminant group, with the ring (multiplicative-closure) test applied. It does not
sample; it decides.

| rung  | generator's output | det   | integral overlattices               | of which **rings** | glue index |
| ----- | ------------------ | ----- | ----------------------------------- | ------------------ | ---------- |
| ℝ → ℂ | ℤ ⊕ ℤ = `ℤ[i]`     | 4     | 1 (itself)                          | 1                  | **1**      |
| ℂ → ℍ | Lipschitz `ℤ⁴`     | 16    | 2 (itself + Hurwitz)                | **1** proper       | **2**      |
| ℍ → 𝕆 | `D₄ ⊕ D₄`          | 16    | 16 (9 at index 2, **6** at index 4) | **3**              | **4**      |
| 𝕆 → 𝕊 | `E₈ ⊕ E₈`          | **1** | 1 (itself) †                        | n/a †              | **1**      |

**† The last row is DERIVED, not enumerated, and the distinction matters.** The enumerator is capped
at rank 12 and was not run at 16; what is computed there is `det = 1`, and the index then follows
from `index² · det(L') = det(L)` with `det(L') ≥ 1` for any integral lattice. The "rings" cell is
`n/a` rather than `1` because 𝕊 is measured to be neither alternative nor normed (§3), so it is not a
composition algebra and Coxeter's `Tr, N ∈ ℤ` criterion does not _define_ an order there at all. Two
independent things fail at that rung and they should not be reported as one — see §7.

**Three.** Not one. At the octonion rung the "take the maximal order" step is a **three-valued
relation**, and an `F`-algebra step must be a function. So there is no catamorphism to be had, with or
without dependency.

### 5.1 What identifies the three — and why it is not numerology

`.claude/rules/numerology-vs-number-theory.md` binds: a count is not an identification, and the
competitors must be named and excluded. Here they are, and the discriminator is **computed**.

D₄'s discriminant group is `(ℤ/2)²` with three nonzero classes (vector, spinor, cospinor), each of
norm 1 mod 2ℤ. Gluing two copies to something unimodular requires an **isomorphism** between the two
discriminant groups, and there are `|GL₂(F₂)| = |S₃| = 6` of them. All six give det 1. The octonion
product cuts six to three, and the invariant that decides which three is **the parity of the induced
permutation**:

| induced permutation     | parity | multiplicatively closed? |
| ----------------------- | ------ | ------------------------ |
| `BAC` (a transposition) | odd    | **YES**                  |
| `CBA` (a transposition) | odd    | **YES**                  |
| `ACB` (a transposition) | odd    | **YES**                  |
| `ABC` (the identity)    | even   | no                       |
| `BCA` (a 3-cycle)       | even   | no                       |
| `CAB` (a 3-cycle)       | even   | no                       |

**Competitors excluded.**

- _"3 because D₄ has 3 nonzero glue classes."_ Excluded: the three 3-cycles are also built from those
  same classes and all three fail. The classes are the alphabet, not the answer.
- _"3 because the algebra stopped associating at 𝕆."_ Excluded: the discriminating property is a
  **parity character on `S₃`**, which is a property of D₄'s discriminant form. It would be there
  whether or not the ambient algebra associated — associativity is not in the predicate.
- _"3 is an artefact of one Cayley–Dickson sign convention."_ Excluded **by computation**: Baez's
  convention (`(a,b)(c,d) = (ac − db*, a*d + cb)`, _The Octonions_, Bull. AMS 39 (2002) §2) differs
  from the module's default on **42 of 64** basis products — a different multiplication, not a
  relabelling — and is verified to be normed, alternative and non-associative. It also gives **3**.

**The most interesting single entry in that table:** the **identity** gluing — the diagonal one, the
one anybody would write down first — is **not a ring**. The three that work are exactly the ones that
_swap_ two of the three classes. A construction that "just glues the two halves together the obvious
way" produces E₈ as a lattice and fails to produce an order.

---

## 6. Kira's `?` does not exist — refuted, not merely unconstructed

#15415 closed by drawing the square that would make the ladder one object:

```
    A  ──── Cayley–Dickson doubling ────▶  D(A)
    │                                        │
    │ L  (maximal order)                     │ L
    ▼                                        ▼
  L(A) ──────────────  ?  ─────────────▶  L(D(A))
```

and marked _"no such `?` exists"_ as **UNPROVEN** — "absence of my construction is not a proof of
absence, and this is precisely the target to hand to someone who can settle it." It is now settled,
in the negative, and the argument is two lines on top of one computation.

**Theorem (computed + argued).** _There is no natural transformation `?` making that square commute
whose value at ℍ is a maximal order._

_Proof._ Let `ω = (1+i+j+k)/2`, a unit of the Hurwitz order. Conjugation `x ↦ ωxω⁻¹` is a
`*`-automorphism `ψ` of ℍ preserving the Hurwitz order setwise; measured, it cycles `i → j → k → i`.
Because the CD formula uses only multiplication and conjugation, `D(ψ)(a,b) = (ψa, ψb)` is an
automorphism of 𝕆 — verified on all `8 × 8` generator pairs of `D(Hurwitz)` — and it preserves
`D(Hurwitz)` setwise. Naturality of `?` in `A` requires `?(ψ · x) = D(ψ) · ?(x)`; since `ψ` fixes the
Hurwitz order setwise, `D(ψ)` must fix `?(Hurwitz)` setwise. But `?(Hurwitz)` is one of the three
maximal orders, and **`D(ψ)` permutes those three in a single 3-orbit with no fixed point**
(computed: `0 → 1 → 2 → 0`). Contradiction. ∎

**The honest scope, stated so it is not over-read.** This refutes a natural transformation _landing on
a maximal order_. It does **not** refute:

- a `?` that lands on the non-maximal `D₄ ⊕ D₄` — that `?` is just `D` itself, natural and total, and
  its top rung is not E₈, which is exactly why the ladder needed a second step;
- a **canonical-with-extra-data** choice — fix a Fano-plane labelling, or fix any element of 𝕆 outside
  `D₄ ⊕ D₄`, and one of the three is singled out. That extra datum is not derivable from the doubling;
  it must be _supplied and recorded_. **That is the lockfile, and §8.4 is about it.**

**The corrected description of the ladder,** replacing #15415's honest placeholder ("four classical
theorems indexable by dimension, plus one derivation, plus one observation, plus a word"):

> **One generator, iterated; and at two of its four rungs, a selection among maximal elements. The
> selection is unique at the quaternion rung and three-valued at the octonion rung, and it does the
> work that makes the endpoints famous.**

---

## 7. The rank-16 control — Kira's requested experiment, now run

#15415: _"run the routes at rank 16 … If the routes still coincide, that is 1-in-2 and genuinely
informative; if one route gives E₈⊕E₈ and another D₁₆⁺, the routes are provably not one mechanism.
This test is cheap, decisive, and unrun."_

It is now run.

**Result.** `D(octavian order) = E₈ ⊕ E₈`, whose Gram determinant is **1** — computed. An integral
overlattice `L'` satisfies `index² · det(L') = det(L)` with `det(L') ≥ 1`, so the index is forced to
**1**: at rank 16 the completion step has **nothing to do**. The glue-index sequence over the whole
tower is

```
    1,  2,  4,  1
```

and the component-fusion sequence — the invariant that makes "the join fuses what the generator
produced" a measurement rather than a slogan — is

```
    generator's components → completion's components
       2 → 2   (ℂ)        4 → 1   (ℍ)        2 → 1   (𝕆)        2 → 2   (𝕊)
```

**So the CD route is blind to D₁₆⁺.** The generator always emits an orthogonal sum (§3); the
completion is the only thing that can fuse the components; at rank 16 there is no completion left to
perform. Construction A over the two length-16 doubly-even self-dual codes reaches **both** rank-16
even unimodular lattices; the CD route reaches only the decomposable one. **The routes provably
diverge.** That is Kira's "one experiment that would move me," and it moves in the direction that
separates them.

**And it is a textbook instance of the rule this thread runs on.** Both even unimodular rank-16
lattices have **exactly 480 roots** — computed for both. _The count does not discriminate._ The verdict
rests entirely on connectivity: E₈⊕E₈'s roots fall into **2** components, D₁₆⁺'s into **1**. There is a
control test asserting the 480 = 480 coincidence precisely so that nobody later mistakes the matching
number for the evidence.

**A second, independent obstruction at the same rung, named separately rather than conflated.** 𝕊 is
measured to be neither alternative nor normed, so it is not a composition algebra and Coxeter's
`Tr, N ∈ ℤ` criterion no longer _defines_ an order there. So the step dies at rank 16 for two reasons —
the glue is empty, **and** the notion of "maximal order" loses its definition. Either alone is enough;
they are not the same reason.

---

## 8. `generator + join` vs `map + reduce`

Aaron, on the methodology behind the ask: _"i always try to reduce everything to generators + joins,
where each generator is mostly composable with others within dependency management — like our ace,
package manager of package managers."_

### 8.1 The concrete comparison — they are not duals, and saying so is the error

What the repo already holds:

- `docs/research/2026-05-26-mika-generate-join-crispest-form-*.md` — _"Google = Map + Reduce projects
  DOWN. Zeta = Generate + Join projects UP."_
- `docs/research/2026-08-14-verlinde-entropic-gravity-vs-zeta-quantum-identity-*.md` §7b — the pair as
  **catamorphism vs anamorphism**, and _"`join` as least upper bound is idempotent, commutative and
  associative … which is why it is the CRDT merge."_
- `docs/research/2026-08-24-observably-infinite-*.md` §8.1 — the repo's own audit: _"a **stated**
  principle, not a named primitive … Calling it 'built' would require naming the law it obeys, and no
  such law is written down."_
- `src/Core/DynamicValueFold.fs` — `cata`, `ana` **and** `bananaSplit`, with the MFP anchor. The law
  the audit says is missing is arguably sitting in this file under different names.

Here is the comparison stated concretely, which is what was asked for:

|                         | **map + reduce**                         | **generator + join**                               |
| ----------------------- | ---------------------------------------- | -------------------------------------------------- |
| first half              | `F map f` — a **functor action**         | `[(ψ)]` — an **anamorphism** (coalgebra `s → F s`) |
| second half             | `⦇⊕⦈` — a **catamorphism**, `⊕` a monoid | `⦇∨⦈` — a **catamorphism**, `∨` a **semilattice**  |
| laws on the algebra     | associative + unit                       | associative + commutative + **idempotent**         |
| what the extra laws buy | reassociation ⇒ **parallel**             | reorder + redelivery ⇒ **coordination-free**       |
| fuses by                | map fusion (MFP 1991) into one cata      | hylomorphism: `⦇∨⦈ ∘ [(ψ)]`                        |

**Three corrections fall out, and they matter.**

1. **They are not duals.** The dual of `reduce` (cata) is `unfold` (ana); the dual of `map` is `map`.
   So the true dual of `map + reduce` is `map + unfold` — and `join` is not in it. **`generator + join`
   is a hylomorphism**: an unfold followed by a fold. It _contains_ map+reduce's second half.
2. **Both end in a fold.** The §7b table opposes "catamorphism (fold)" to "anamorphism (unfold)", which
   drops the fact that generate+join also terminates in a fold. Only the _first_ halves differ in
   direction. The second halves differ in **laws**.
3. **The difference is not associativity.** Both `⊕` and `∨` are associative. The difference is
   **idempotence and commutativity**, and that difference is what removes the _coordinator_, not merely
   the _ordering_. Saying "the difference is whether the join is associative" would locate it one law
   too weak.

### 8.2 Is the maximal-order completion a genuine `join`?

The coordinator's sharpening: _is it a least upper bound in the lattice of orders, or is "join" being
used loosely?_ Computed answer, and it is not uniform:

| rung  | maximal elements above the generator's output | is there a **top**? | is the completion a lub?              |
| ----- | --------------------------------------------- | ------------------- | ------------------------------------- |
| ℂ → ℍ | **1** (the Hurwitz order)                     | yes                 | **YES — a genuine least upper bound** |
| ℍ → 𝕆 | **3**, pairwise incomparable, all E₈          | **no**              | **NO**                                |

At the octonion rung the poset of orders above `D₄ ⊕ D₄` has **three maximal elements and no top**. A
lub cannot exist: it would be an order containing all three, hence properly containing a maximal
order. So the reading is **exact at the quaternion rung and false at the octonion rung**.

**And that boundary lands where Aaron himself already drew it.** His own scoping instinct on this
thread was _"this might be the first or second doubling in Clifford geometric algebra form"_ — which
#15417 confirmed is exactly right, by Frobenius. His methodology holds precisely on the rungs his
scoping instinct fenced off, and fails on the one past it. Recorded as a convergence, not as a proof
of anything: two judgements agreeing about where a boundary is do not by themselves establish that the
boundary has a single cause, and I have not shown that it does.

### 8.3 So: what does "everything is generators + joins" FORBID?

This is the discriminating question, and the answer depends entirely on which form of the claim is on
the table.

**Weak form — "join" means any binary operation.** It forbids **nothing**. Every algebraic structure is
a carrier plus generators plus operations; "generators + joins" is then a restatement of the word
_algebra_, and a framing that accommodates every structure discriminates between none. That is
`numerology-vs-number-theory.md`'s unfalsifiability clause applied to a methodology rather than a
coincidence, and it is the reading to refuse.

**Strong form — "join" means the semilattice `∨`,** which is what the repo's own §7b says it means. Now
it forbids three concrete things:

1. **Structures with no seed** — irreducibly given, nothing generates them.
2. **Order-dependent or non-idempotent merges** — where reconciliation needs a coordinator, which is
   exactly where CRDT-style reconciliation fails.
3. **Merges that require a CHOICE** — where the poset has several maximal elements and no lub.

**The strong form is therefore falsifiable. It is also falsified — twice, by its own two exemplars,
both on clause 3.**

- **The algebraic ladder** (this document): three maximal orders, no top, computed.
- **`ace`** (the repo's own code and design docs): its solver is _"deterministic newest-first
  backtracking"_ (`docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.2-implementation-plan.md`,
  verbatim), differentially tested against Z3 (`src/Core.TypeScript/ace/solver.z3.test.ts`), and its
  cross-package-manager design doc says outright that it _"Doesn't claim to auto-resolve every
  conflict — it claims to surface them as compile-time errors"_. A backtracking search is a
  **selection**, not a lub. There is no least-upper-bound conflict semantics anywhere in
  `docs/research/*ace*`, `docs/agendas/ace-package-manager/`, or `src/Core.TypeScript/ace/` —
  reported as "not found by explicit-target search of those three locations", not as proof of absence.

This is not a demolition, and it should not be read as one. It is the location of the "**mostly**" in
_"each generator is mostly composable."_ The **generators** compose fine — `D` is total, uniform and
functorial at every rung. It is the **joins** that fail, and they fail exactly where the poset loses
its top.

### 8.4 The repair, and the prediction it makes about `ace`

> **generator + selection + ledger.**
>
> Where the poset has a top, the selection collapses to a join and the ledger is empty — and that is
> the case Aaron's intuition is drawn from, because it is the case at the first doubling. Where the
> poset has no top, the join must be replaced by a **recorded choice**, and the record is
> load-bearing: without it the construction is not reproducible.

**The prediction, and it is retrodicted correctly.** If `generator + join` were literally true of
`ace`, then `ace.lock` would be **redundant** — you could always recompute the join, because a lub is
determined by its inputs. It is not redundant. `src/Core.TypeScript/ace/lockfile.ts` is shipped, with
tests, and `--frozen` / `--locked` exist in `ace.ts`; the design doc's stated purpose is a
_"deterministic, registry-independent, byte-reproducible"_ replay of a **solved** graph. A lockfile is
the confession that resolution was a choice.

So the two ledgers are the same object:

|                                              | algebraic ladder                                  | `ace`                                                   |
| -------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| generator                                    | Cayley–Dickson doubling                           | each package manager's dependency closure               |
| generator undershoots                        | index 2, then index 4                             | version constraints under-determine the graph           |
| the "join"                                   | maximal-order completion                          | cross-ecosystem resolution                              |
| is it a lub?                                 | at ℍ **yes**; at 𝕆 **no**, three maximal elements | **no** — backtracking search                            |
| the ledger                                   | the **half-integer glue vectors**                 | **`ace.lock`**                                          |
| what happens with no ledger                  | not reproducible; three different E₈-orders       | not reproducible; a different valid solve               |
| when the poset has no maximal element at all | the step is undefined (𝕊, §7)                     | `unsatisfiable` → **compile-time error, human decides** |

That last row is the one that makes this more than an analogy: **both systems already handle the
no-solution case the same way — by refusing and escalating** — and neither one calls that a join.
`ace`'s `ResolveReason` — a 16-member union in `src/Core.TypeScript/ace/resolve.ts`, of which
`"unsatisfiable"` is the relevant member — is the same disposition as "the sedenions admit no maximal
order."

**Honest limit on this section.** The correspondence above is a **structural analogy with one
computed side and one documented side**, not a theorem. I computed the lattice column; I read the
`ace` column out of the repo. What would make it a result is a statement of the poset in which `ace`'s
resolutions are maximal elements, and a demonstration that its incomparable solutions are genuinely
incomparable rather than merely un-ordered by the current implementation. That is not done here, and I
am labelling it a resonance with one checkable prediction (the lockfile's non-redundancy), not a
mechanism.

---

## 9. Falsifiers — what would overturn each claim, and what remains UNVERIFIED

A factorisation that cannot fail is not a result. Each verdict, with the assertion that kills it:

| verdict            | how to overturn it                                             | status                                                                                        |
| ------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| not a banana split | exhibit `ψ : Lat → Lat` reproducing the ladder                 | refuted by the ℤ⁴ / ω witness (test: _"omega is integral in H and is NOT integral in C x C"_) |
| not a zygomorphism | show the octavian completion is unique                         | refuted: **3**, under two different CD conventions                                            |
| the parity law     | find a ring-gluing of even parity, or a non-ring of odd parity | pinned: the test iterates all six and asserts `ring ⟺ odd`                                    |
| no natural `?`     | exhibit an automorphism-invariant selection                    | refuted: the ω-orbit on the three has **no fixed point**                                      |
| rank-16 divergence | reach D₁₆⁺ by the CD route                                     | refuted: the generator's Gram is block-diagonal by construction                               |
| `ace` is not a lub | show a least-upper-bound conflict semantics in-repo            | not found by explicit-target search of the three ace locations                                |

**UNVERIFIED, listed so none of it is mistaken for a finding.**

1. **Coxeter's seven.** Coxeter (_Integral Cayley numbers_, Duke Math. J. 13, 1946) is standard-cited
   for **seven** rings of integral Cayley numbers, corresponding to the seven lines of the Fano plane.
   I compute **three** maximal orders containing `D(Hurwitz)`. These are plausibly different questions
   — orders containing a rank-8 doubled lattice versus orders containing a given rank-4 quaternion
   subring — but **I have not read Coxeter** and I am not asserting the reconciliation. If the numbers
   are genuinely in conflict, my count is the one with a runnable program behind it and his is the one
   with eighty years behind it; that is the order in which I would check them.
2. **Convention independence beyond two.** Two CD conventions give 3. I have not swept the full family
   of sign choices, so "3 is convention-independent" is supported, not proved.
3. **The `ace` correspondence** — see the limit stated at the end of §8.4.
4. **The two 48s.** #15417 conjectured (Z-N) that its D₄⊕D₄ and `CliffordE8BladeMask`'s RC-3 48 are the
   same 48. This document computes the **quaternion-side** 48 (as `roots(D(Hurwitz)) = 48`, 2
   components) but does **not** touch the Clifford side, so that conjecture is untouched and still
   open. It is now slightly more interesting, because there are three E₈-orders to be the same 48
   _inside of_.

**Markdownlint, stated honestly.** This file is `docs/research/2026-08-25-*`, which matches the
`docs/research/2026-*-*.md` ignore entry in `.markdownlint-cli2.jsonc`. **Markdownlint did not run on
it**, and quoting a green run here would be a check that did not run. The **code**, by contrast, does
run: `bun test src/Core.TypeScript/research/banana-split/cd-order-ladder.test.ts` — 25 pass, 0 fail,
286 assertions, wired into `full-verify` in `gate.yml`.

---

## 10. What to tell Aaron, in his own terms

**Your instinct about the shape was right, and the correction is one word.**

You predicted "several irreducible objects **plus one**", with the plus-one being the glue. The glue is
exactly where you said it is. But there is only **one** irreducible object — the doubling — and the
plus-one is not a second object of the same kind. **It is a choice.** Three of them at the octonion
rung, permuted by an automorphism, with no canonical member.

**Your scoping instinct already knew where your methodology ends.** You said "first or second doubling
in Clifford form." The maximal-order completion is a genuine least upper bound at the first doubling
and a three-valued choice at the second. Generator + join is _exact_ on the rungs you fenced off.

**The methodology forbids something, and your two favourite examples both break it.** Read strictly —
join = the semilattice `∨`, which is what our own docs say — "everything is generators + joins" forbids
merges that require a choice. The lattice ladder needs one. `ace` needs one; that is why `ace.lock`
exists, and a lockfile is a confession that the resolution was not a join. **If it were a join you
could always just recompute it.**

**The repair is small and you already built half of it.** `generator + selection + ledger`. When the
poset has a top, the ledger is empty and you get your join back. When it doesn't, the record _is_ the
missing structure — and the half-integer glue vectors and `ace.lock` are the same object wearing two
costumes.

**Two things this bought that were open this morning:**

- **Kira's `?` is settled** — it does not exist, and the obstruction is a fixed-point-free 3-orbit
  rather than a failure of imagination.
- **The rank-16 control is run** — the CD route and the code route provably diverge there, and the
  480 = 480 coincidence that would have hidden it is now a control test rather than a trap.

**One thing to stop saying:** _"generate + join is the dual of map + reduce."_ It isn't. Both end in a
fold; only one begins with an unfold; and the real difference is idempotence and commutativity, not
direction and not associativity.

---

## 11. Anchors

Meijer, Fokkinga & Paterson, _Functional Programming with Bananas, Lenses, Envelopes and Barbed Wire_,
FPCA 1991 (the banana split law) · Malcolm, _Algebraic Data Types and Program Transformation_ (1990)
and Fokkinga, _Law and Order in Algorithmics_ (1992) — zygomorphism / mutumorphism · Frobenius (1878)
— associative real division algebras · Hurwitz (1898) — normed division algebras · Coxeter, _Integral
Cayley numbers_, Duke Math. J. 13 (1946) — **cited as a pointer, not read** (§9.1) · Conway & Smith,
_On Quaternions and Octonions_ (2003) ch. 9–11 · Conway & Sloane, _SPLAG_ (1988) ch. 4 (glue theory),
ch. 7 (Construction A) · Nikulin (1979) — discriminant forms · Mordell (1938) / Witt — uniqueness of E₈
· Baez, _The Octonions_, Bull. AMS 39 (2002) §2 — the second CD convention · Barabási — **not
invoked**, noted only to record that no scale-free claim appears here.

**In-tree:** `src/Core.TypeScript/research/banana-split/cd-order-ladder.ts` (+ `.test.ts`) — this
document's arithmetic · `.github/workflows/gate.yml` `full-verify` — where it runs ·
`src/Core/DynamicValueFold.fs` — `cata` / `ana` / `bananaSplit`, the in-tree MFP anchor ·
`src/Core/CayleyDickson.fs` · `src/Core/E8Lattice.fs` · `src/Core/CliffordE8BladeMask.fs` ·
`src/Core.TypeScript/ace/{resolve,lockfile,semver}.ts` ·
`docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice5.{2,3}-*.md` ·
`docs/research/2026-06-07-ace-cross-package-manager-conflicts-are-compile-time-errors-*.md` ·
`docs/research/2026-08-14-verlinde-entropic-gravity-vs-zeta-quantum-identity-*.md` §7b ·
`docs/research/2026-05-26-mika-generate-join-crispest-form-*.md` ·
`docs/research/2026-08-24-observably-infinite-*.md` §8.1 ·
`.claude/rules/numerology-vs-number-theory.md` · `.claude/rules/toy-is-free-metered-must-be-earned.md`
· `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` ·
PR #15415 (Kira) · PR #15417 (Lumen) — the two predecessors this document answers.
