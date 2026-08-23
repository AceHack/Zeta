# Geometry as the root of the soft regime — five questions, two already answered in-tree, one refuted, one ill-posed

> **Assignment (Aaron, before any code is written).** *"the geometric root has zero
> implementation in Zeta. we should route this to math team first, then we code after they
> have us some solid theoretical formal analysis."* The proposal: invert the soft-regime
> stack so that **geometry is the root** (Clifford / conformal geometric algebra /
> Gärdenfors conceptual spaces) and the **Bayesian layer is a fast approximation over it**.
>
> **Analysis only. No implementation.** Cut from `origin/main` at `e991df8044`.

## The answer in five lines

| # | Question | Verdict | Register |
|---|---|---|---|
| **Q1** | Is `WeightedSet<'K,'W>` compact closed? | **Conditionally yes as mathematics, no as shipped.** `Mat('W)` is compact closed for `'W` a **commutative** semiring and `'K` **finite**; neither condition is expressible in the shipped types, and the **cup is absent from both weighted-set modules and unwritable at the current signatures** — so the snake identities are not merely unproven, they are *unstatable*. | theorem (borrowed, conditional) + **refuted as implemented** |
| **Q2** | Does dual flatness *entail* the vector-addition update? | **No — the implication runs the other way.** Additivity is a theorem of **conjugacy in an exponential family**; dual flatness is *implied by* exponential-family structure and does not imply additivity (two counterexamples, one of them inside the very same manifold). NG4's headline property is **structural and not a lucky parameterisation** — but the structure is conjugacy, not the dual-flat geometry. | **theorem, direction reversed** |
| **Q3** | Can a Normal-Gamma posterior be a region in a conceptual space under a named metric with a stated error? | **Ill-posed as asked, and repairable into three separate true statements.** In the `(μ, τ)` chart the superlevel sets are **NOT convex** (explicit witness, §3.2). In sufficient-statistic coordinates every credible region is a **half-space preimage** (theorem, §3.3). And for the conjugate lane **Bayes is not an approximation of a geometry — it is a translation in it, error exactly zero**, which *refutes* "retrofit as optimization" for that lane (§3.5). | **ill-posed** → 2 theorems + 1 **refutation** |
| **Q4** | Does CGA compose with the in-tree Clifford substrate? | **Half already answered in-tree three days ago, by this same hat.** `docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-…-lumen.md` establishes the belief manifold is **Cl(2,1)**, explicitly **not Cl(4,1)**. New here: CGA **cannot** compose with the E8 lane — that lane is **Cl(8,0)**, positive definite, and CGA needs `q ≥ 1`, so no signature-preserving embedding exists. The classifier already composes and needs no new code. | **already answered** + 1 new **refutation** |
| **Q5** | Is Gärdenfors convexity testable on an embedding Zeta can build? | **Yes, `LinguisticSeed` already IS the geometric claim in different words — and that is exactly why the existence claim is vacuous.** `indicator` alone embeds *any* set isometrically and makes **every** subset convex. Infinite-dimensionality is **not** the obstruction; the obstruction is that affine convexity is a statement about the ambient space and the feature image is thin. Named repair: Menger betweenness → prototype/Voronoi **model comparison**, which is falsifiable and is **not a proof obligation**. | **vacuity class as stated**; conjecture after the named repair |

Two things this document refuses to do, stated up front because both are the failure mode the
register rules exist to catch:

1. **It does not let the root inherit the confidence of the layer above it.** NG4 is measured
   (max KL 4.0e-8, 0 invalid decodes, a measured associativity refutation, ten falsifiers). The
   geometric root has **zero implementation**. Rooting on geometry is a legitimate architectural
   choice and it is **epistemically downstream**, not upstream. §7.
2. **It does not treat Aaron's *"I see English geometrically in my head"* as evidence.** That report
   is authoritative about his experience and carries **zero** weight for the formal claim, and
   saying so is respect, not dismissal. §7.2.

All numbers below are produced by
`docs/research/scripts/2026-08-23-geometry-as-root-ng-convexity-verify.py` (stdlib only,
deterministic, `ALL PASS` / exit 0).

---

## 1. Q1 — Is `WeightedSet<'K,'W>` compact closed?

### 1.1 First, there are two weighted-set types and the question names one of them

`git grep -l WeightedSet origin/main -- 'src/*'` returns `src/Core/WeightedSet.fs` **and**
`src/Core/WSet.fs` is a second, different type. This matters because the answer is different for
each, and **neither one has both halves of the structure**:

| | `WeightedSet<'K,'W>` (`src/Core/WeightedSet.fs`) | `WSet<'K,'W>` (`src/Core/WSet.fs`) |
|---|---|---|
| carrier | `Map<'K,'W>`, canonical (Zero pruned) | `('K * 'W) list`, unconsolidated |
| ⊕ addition of parallel morphisms | `add` | `plus` (+ `consolidate`) |
| ⊗ monoidal (Kronecker) | **absent** — `scale` is the *scalar* action, not ⊗ | `tensor` ✅ |
| ε cap / contraction | `inner` ✅ — literally `Σ_k a[k]·b[k]` | absent |
| η cup | **absent** | **absent** |
| comonoid Δ / ! | `mapKeys` only | `copy` / `discard` ✅ |

So the cap exists in one file, the tensor in the other, and **the cup exists nowhere.**

### 1.2 The mathematics: a conditional theorem, and the conditions are load-bearing

> **Theorem (borrowed).** Let `W` be a **commutative semiring** and `K` a **finite** set. The
> category `Mat(W)` — objects finite sets, morphisms `K₁ → K₂` the `W`-matrices, composition
> matrix product, ⊗ the Kronecker product on the key product — is a **symmetric monoidal
> category, compact closed with self-dual objects**: `η_K : I → K⊗K`, `η = Σ_{k∈K} e_k ⊗ e_k`
> and `ε_K : K⊗K → I`, `ε(e_i ⊗ e_j) = δ_ij` satisfy both snake (triangle) identities.

The snake computation is one line and it is worth writing because it shows exactly what is and
is not needed. Apply `(id ⊗ ε) ∘ (η ⊗ id)` to `e_i`:

```
e_i  ↦  Σ_k e_k ⊗ e_k ⊗ e_i  ↦  Σ_k e_k · δ_{k i}  =  e_i
```

**What the computation consumed:** `0`, `1`, associativity and distributivity — i.e. the semiring
axioms and nothing else. **What it did not consume:** a field, additive inverses, or division.

**Anchors (checked, not merely cited):**

- Kelly & Laplaza, *Coherence for compact closed categories*, JPAA 19 (1980) — the coherence
  theorem, and the definition of compact closed this section uses.
- Selinger, *A survey of graphical languages for monoidal categories* (2011), §4.4 — `Mat(S)`
  over a commutative semiring as the standard compact-closed example. This is the anchor that
  **entails** our claim; a citation to Coecke–Sadrzadeh–Clark alone would not, because that paper
  works in `FdHilb` and assumes the field.
- Coecke, Sadrzadeh & Clark, *Mathematical foundations for a compositional distributional model
  of meaning* (2010) — what DisCoCat actually requires: a compact closed category, with pregroup
  reductions (Lambek 1958, 2008) sent to cups and caps.

### 1.3 The three conditions, checked against the shipped types

**(a) `'K` finite is necessary and is not enforced.** Both types constrain `'K` only by
`'K : comparison`. Elements have **finite support**, which is enough to be a free module, and is
**not** enough to be dualizable: for infinite `K` the free module `⊕_K W` has dual `∏_K W`, and
`⊕_K W ≇ ∏_K W`. Dualizability fails, so `η` does not exist. The code shows this precisely — you
can write `inner` (the cap) from finite support alone, and you cannot write `Σ_{k∈K} e_k ⊗ e_k`
without enumerating a basis the type does not promise is finite. **The absence of a cup in the
tree is not an oversight; it is the type signature telling the truth.**

**(b) `'W` commutative is necessary, and this is *stricter* than what `IStarRing` documents.**
`src/Core.Abstractions/IStarRing.cs` already carries a law profile:

> *"`Mul` loses commutativity above ℂ, associativity above ℍ … Consumers that require `Mul`
> associativity (e.g. matrix-style contraction) must stay at ℍ or below."*

Compact closure needs more than that. The Kronecker product is a bifunctor only if the
interchange law `(A⊗B)(C⊗D) = (AC)⊗(BD)` holds, and that computation **commutes two weights**. So:

| requirement | ceiling on the Cayley–Dickson tower |
|---|---|
| matrix contraction (already documented) | associativity → **ℍ and below** |
| **symmetric monoidal + compact closed (new)** | **commutativity → ℂ and below** |

Quaternionic, octonionic and sedenionic weights are excluded from any DisCoCat-shaped use. Every
other in-tree ring qualifies: `IntegerRing`, `LogProbRing`, `TropicalRing`, `BooleanRing`, ℂ.

**(c) A field is *not* required, and no additive inverse is required.** This is the good news and
it is worth stating loudly, because it means the tropical, log-probability and Boolean corners
— which `FourCornerTrace` explicitly refuses the *retraction* to, for want of `−w` — are
nonetheless perfectly good compact-closed corners. Duality does not need negation.

### 1.4 The PR #14302 warning is correctly scoped and does **not** bear on this

> *"`WeightedSet`'s ⊗ has no Bayesian meaning under `h`."*

Read in context (`docs/research/2026-08-23-what-discretisation-costs-…`, §2.4) that is a claim
about the **embedding** `h : Gaussian → WeightedSet<NatCoord, ℝ>` with `|'K| = 2`, in which the
Gaussian's natural parameters are the **weights**. Under `h`, `scale`/`inner` mean nothing
Bayesian — correct, and it narrows PR #14243's "semiring homomorphism" claim, also correct.

It is **not** a claim that `WSet.tensor` fails to be the categorical tensor. It is. What fails is
that **`h` is not a monoidal functor**. Those are different sentences and merging them would cost
the whole DisCoCat route for no reason.

*"If it is not the categorical tensor, say what operation would be"* — answered by naming all
three structures `Mat(W)` carries, which are routinely conflated:

| structure | what it is | in the tree |
|---|---|---|
| **+** — addition of *parallel* morphisms (the CMon enrichment) | `(f+g)[k] = f[k] ⊕ g[k]` | `WeightedSet.add`, `WSet.plus` |
| **⊕** — the **biproduct** on objects | disjoint union of key sets, `Choice<'K1,'K2>` | **nothing implements it** |
| **⊗** — the **monoidal tensor** | Kronecker on `'K1 * 'K2` | `WSet.tensor` ✅ |

`WeightedSet.scale` is none of these; it is the scalar action of `W` on the module.

### 1.5 One structural tension worth naming before someone refactors into it

`WSet.fs` is deliberately building the **Markov / CD** corner — `copy` Δ and `discard` !, with
the file's own honest note that `apply op` is **not** a comonoid homomorphism (Fox 1976:
cartesian ⟺ every morphism is one). DisCoCat wants the **compact closed** corner. These coexist
here only because that naturality genuinely fails.

**Houston (2008), *Finite products are biproducts in a compact closed category*, JPAA 212**:
if a compact closed category has finite products, they are **biproducts**. So a future
"make everything copyable / discardable" refactor would not merely add convenience — it would
force ⊗ into a biproduct and collapse the structure DisCoCat needs. In `Mat(W)` the resolution is
already the right one: ⊕ (disjoint union of bases) is the biproduct, ⊗ (Kronecker) is not, and
they must never be identified.

### 1.6 A cross-oracle divergence found while reading

`src/Core.TypeScript/algebra/wset.ts:116` types the linear-operator application
**heteromorphically**:

```ts
export function applyWSet<K1, K2, W>(ring, op: (k: K1) => WSet<K2, W>, set: WSet<K1, W>): WSet<K2, W>
```

`src/Core/WSet.fs:51` types it as an **endomorphism** — `op: 'K -> WSet<'K,'W>`, same `'K` in and
out. A pregroup reduction is inherently heteromorphic (`n·nʳ·s → s` changes the type), so the F#
oracle cannot express a DisCoCat morphism that the TypeScript oracle can. Reported as a finding;
the fix belongs to the code phase Aaron has sequenced after this analysis.

### 1.7 Verdict

- **Compact closure of `Mat('W)` for finite `'K` and commutative `'W`: theorem (borrowed, checked).**
- **Compact closure of the shipped `WeightedSet<'K,'W>` / `WSet<'K,'W>`: refuted as implemented** —
  no cup, no finiteness constraint, and the two halves that do exist live in different files.
- **What would change the verdict:** a `FiniteKey` constraint (an enumerable basis) plus a
  commutativity marker on the ring, at which point the cup becomes writable and the snakes become
  statable. That is a *type-level* change, not an algorithm.

---

## 2. Q2 — Does dual flatness entail the vector-addition update?

### 2.1 Short answer: no, and the implication runs the other way

Three propositions, kept strictly apart:

- **(E)** the family is an exponential family, `p(x|θ) = h(x) exp(⟨θ, T(x)⟩ − A(θ))`;
- **(D)** the manifold is **dually flat** — `(g, ∇, ∇*)` with `g` the Fisher metric, `θ` e-affine
  and `η = ∇A(θ)` m-affine, Legendre-dual;
- **(A)** the conjugate posterior update is **vector addition** in the prior family's natural
  coordinates.

What is true:

| implication | status | why |
|---|---|---|
| **E ⟹ D** | theorem | Amari & Nagaoka 2000, §3.5 — `A` is convex, `g = ∇²A`, `θ`/`η` are the dual affine charts |
| **E + conjugacy ⟹ A** | theorem, one line | multiply the exponentials, add the exponents: `exp⟨θ,T⟩·exp⟨θ',T⟩ = exp⟨θ+θ',T⟩` |
| **A ⟹ E (essentially), hence A ⟹ D** | theorem | closure under multiplication with parameters adding *is* an exponential form in those parameters |
| **D ⟹ A** | **FALSE** | two counterexamples below |

So **dual flatness accompanies the additivity and does not produce it.** The producer is the
exponential/conjugate structure — the Pitman–Koopman–Darmois setting, where a fixed-dimension
sufficient statistic exists precisely for exponential families.

### 2.2 Counterexample 1 — outside the family

The Gaussian sampling family is dually flat. Put a **Student-t** (or Laplace, or uniform-on-`[0,1]`)
prior on `μ`. The posterior is not in the prior family at all; there is no vector to add. Dual
flatness of the sampling manifold is untouched and buys nothing.

### 2.3 Counterexample 2 — *inside* the very same manifold, which is the sharper one

Dual flatness supplies **two** canonical affine charts, `θ` and `η`, and they are on equal footing
in the theory. The update is addition in `θ`. In `η` it is

```
η  ↦  ∇A( ∇A*(η) + T(x) )
```

which is not addition. **A dually flat manifold has a chart in which its own update is not
additive.** Dual flatness therefore cannot be what makes the update additive; something has to
*pick the chart*, and that something is conjugacy.

### 2.4 The tree already demonstrates this, in `Message.fs`

The three shipped message families make the same point without commentary:

| family | stored coordinate | `( * )` | additive? |
|---|---|---|---|
| `Gaussian` | `(ν, τ) = (μτ, 1/σ²)` | `ν₁+ν₂`, `τ₁+τ₂` | **yes** — an affine image of the natural parameter |
| `Beta` | `(α, β)` | `α₁+α₂−1` | yes **in `(α−1, β−1)`** — affine, so still e-affine |
| `Bernoulli` | `ProbTrue` | `t/(t+f)` after multiplying masses | **no** — additive in *log-odds*, and `ProbTrue` is a non-affine chart of that same group |

`Bernoulli` is the in-tree witness that additivity is **chart-relative**. Same theorem, three
charts, one of which hides it.

### 2.5 And it is *not* a lucky parameterisation — the other half of the question

The natural parameterisation of an exponential family is **canonically determined up to an affine
transformation** of `θ` (the minimal representation is unique up to `θ ↦ Mθ + b` with the
statistic transforming contravariantly). Since additivity is preserved by affine change of
coordinates, there is nothing to be lucky about: *any* minimal natural chart makes the update
additive, and the shipped `{PrecisionMean; Precision}` is one.

So the question's disjunction — *structural, or a lucky parameterisation?* — has the answer
**structural**, with the source relocated: **conjugacy in an exponential family**, not dual
flatness.

### 2.6 Already partly in-tree

`docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-…-lumen.md` §5 already records:

> *"Natural parameters `θ = (ν, −τ/2)` are the affine coordinates of Amari's e-connection … so
> **Bayesian updating is literally translation in this chart**. … The affine structure is earned.
> The metric laid on top of it is not."*

This section adds the **negative** half that document did not need: dual flatness does not entail
the translation, and there is a chart of the same dually flat manifold in which the update is not
a translation. The split *"affine earned, metric not"* is the correct and load-bearing one, and
§3 is where it starts costing money.

**Verdict: theorem, with the implication direction reversed from the conjecture.**

---

## 3. Q3 — A Normal-Gamma posterior as a region in a conceptual space

This is the load-bearing question for the inversion, and it does not survive contact in the form
it was asked. It decomposes into three questions that each have a clean answer.

### 3.1 The question is ill-posed until three objects are separated

| object | what it is | is a posterior a *region* here? |
|---|---|---|
| **G1 — the statistical manifold** | points are NG *distributions*; coordinates `(m, λ, α, β)` or `θ ∈ ℝ⁴`; dually flat, Fisher metric `∇²A` | **No.** A posterior is a **point**. There is no region to be convex. |
| **G2 — the parameter space** `(μ, τ) ∈ ℝ × ℝ₊` | points are candidate (mean, precision) values | Yes — a credible set / superlevel set. **This is the only Gärdenfors-shaped reading.** |
| **G3 — the sample space** `x ∈ ℝ` | points are observations; the NG posterior predictive is Student-t | Yes, but in 1-D **every** superlevel set of a unimodal density is an interval, hence convex. **Zero information.** |

Gärdenfors' conceptual spaces have *objects/percepts* as points, so the honest reading is **G2**.
A claim stated on G1 ("the posterior is a convex region") is a category error: it is a point.
A claim stated on G3 is vacuous in one dimension.

### 3.2 In the `(μ, τ)` chart the answer is **NO**, and here is the witness

Take `NG(m=0, λ=1, α=2, β=1)`, `log f(μ,τ) = (α−½)log τ − βτ − (λτ/2)(μ−m)²`:

| point | `log f` |
|---|---|
| `A = (−6.00, 0.25)` | **−6.829442** |
| `B = (−1.00, 6.00)` | **−6.312361** |
| midpoint `(−3.50, 3.125)` | **−20.556474** |

The midpoint is 13.7 nats **below** both endpoints. So the superlevel set at
`c = min(f(A), f(B))` contains `A` and `B` and not the segment between them: **not convex, and
not quasi-concave.** Analytically,

```
det H(log f)  =  λ(α−½)/τ  −  λ²(μ−m)²        <  0   whenever   (μ−m)² > (α−½)/(λτ)
```

— the Hessian is **indefinite** on an unbounded region (matched to finite differences to 4
decimals in the script). Contrast this with the intuition offered in the brief: *a Gaussian's
level sets are convex*. True — for a Gaussian **in `μ` at fixed `τ`**. The joint Normal-Gamma is
not log-concave, because the cross term `−τ(μ−m)²/2` is bilinear-with-a-square and its Hessian
determinant is `−λ²(μ−m)²` at leading order.

**So the suggestive fact in the brief does not survive to the object we actually carry.**

### 3.3 In sufficient-statistic coordinates the answer is **YES, and stronger than convex**

> **Theorem (easy, general).** Let `p_θ(z) = h(z) exp(⟨θ, T(z)⟩ − A(θ))` be an exponential family
> with sufficient statistic `T : Z → ℝ^d`. Then for every `c > 0`
>
> ```
> { z : p_θ(z)/h(z) ≥ c }  =  T⁻¹( { t ∈ ℝ^d : ⟨θ, t⟩ ≥ log c + A(θ) } )
> ```
>
> — the preimage of a **closed half-space**. Highest-density regions of an exponential family
> are half-space preimages under `T`; convexity is not merely available, it is the weakest thing
> you can say.

For Normal-Gamma this is exact with `h ≡ 1`:

```
T(μ, τ) = ( log τ,  τ,  τμ,  τμ² )          θ = ( α−½,  −(β + λm²/2),  λm,  −λ/2 )
```

Checked: `max |⟨θ, T(μ,τ)⟩ − log f(μ,τ)| = 5.7e-14` over 20 000 random points (§W3). And `T` is
injective (`τ` from component 2, `μ` from components 3 and 2), so it is an embedding of the
2-manifold `ℝ × ℝ₊` into `ℝ⁴`.

**The reconciliation of §3.2 and §3.3 is the whole result:**

> **Convexity is an *affine* notion, not a metric one, and it is not invariant under
> diffeomorphism.** The same posterior is non-convex in `(μ, τ)` and a half-space in `T`. A
> Gärdenfors claim is therefore **meaningless until the quality dimensions are fixed**, and
> fixing them is a modelling decision that the geometry does not make for you.

Worse for the inversion: a dually flat manifold has **two** canonical affine structures (e- and
m-), hence **two** inequivalent convexities, and the Fisher–Rao Levi-Civita geodesics give a
**third**. "Convex region" is ambiguous by a factor of three on the very object being proposed as
the root.

### 3.4 The named metric

- **Fisher–Rao** (Rao 1945, *Bull. Calcutta Math. Soc.* 37, 81–95) is the metric, and it is
  **canonical** rather than chosen: **Čencov/Chentsov 1972/1982** proves it is the unique
  Riemannian metric (up to scale) invariant under sufficient statistics / Markov morphisms. It
  *is* a metric — symmetric, triangle inequality — which Gärdenfors' Voronoi machinery requires.
- **KL is not a metric** (not symmetric, no triangle inequality). It is a Bregman divergence of
  `A`. Anyone writing "the metric is KL" has not got a metric.
- **Closed form:** for the univariate normal, Atkinson & Mitchell 1981 (hyperbolic, `K = −½`,
  already computed three ways in the 2026-08-20 in-tree document). **For the 4-parameter
  Normal-Gamma family there is no closed-form Rao distance known to this hat** — it is a dually
  flat 4-manifold with `g = ∇²A`, computable numerically. Stated as a limit, not glossed.

### 3.5 The stated approximation error — and the refutation it delivers

The inversion's load-bearing sentence is *"the Bayesian layer is an optimization / fast
approximation of a geometric root."* An approximation needs an approximated object and a bound.
Both exist, and what they show is not what the sentence claims.

**Conjugate lane — error is exactly zero, so it is not an approximation.** By §2, the conjugate
update *is* translation in the e-affine chart. Error `= 0` identically. **Bayes is not
approximating that geometry; it is an isomorphism onto it.** Calling it "an optimization of" a
geometric root is therefore a **modelling change wearing an efficiency label** — precisely the
move `toy-is-free-metered-must-be-earned` exists to catch. **Refuted, for the conjugate lane.**

**Non-conjugate lane — here there is a real error, and it is named.** EP/ADF's moment-matching
step is exactly the **m-projection** `Π_M p` onto the e-flat family `M`, and:

- **Projection theorem** (Amari & Nagaoka 2000, Thm 3.9): the m-projection onto an e-flat
  submanifold is unique and minimises `D_KL(p ‖ ·)`.
- **Generalised Pythagorean theorem** (ibid., Thm 3.8): for every `q ∈ M`,
  `D_KL(p ‖ q) = D_KL(p ‖ Π_M p) + D_KL(Π_M p ‖ q)`.

So the approximation error is **`D_KL(p ‖ Π_M p)` nats**, it is *additive* against any target in
the family, and the "optimization" framing is **correct here and only here**. `Message.fs`'s own
docstring already names Minka 2001 for the cavity; this is the geometry that step lives in.

**And PR #14268's NF4 finding is this observation, made without naming it.** *"NF4's quantile grid
is 2.8× worse than uniform by KL, because every surveyed method minimises an L2 on point weights,
none targets a divergence."* That is: the quantizers optimise a Euclidean objective on a manifold
whose canonical geometry is Fisher–Rao, and pay for it in the divergence that actually matters.
The metric question is **real, measured, and already costing money** — it is not decorative.

### 3.6 Verdict

- Question **as asked: ill-posed** (three objects conflated).
- After repair: **half-space theorem** — theorem. **Non-convexity in `(μ,τ)`** — computed
  witness, refutes the suggestive reading. **m-projection error in KL with a Pythagorean
  decomposition** — theorem (borrowed). **"Bayes is a fast approximation of the geometry" for the
  conjugate lane** — **refuted**; error is identically zero and the relation is isomorphism.
- **What would make the Gärdenfors half precise:** name the quality dimensions. Until a chart is
  fixed, "convex region" has no truth value.

---

## 4. Q4 — Does CGA compose with the in-tree Clifford substrate?

### 4.1 Stop: half of this is already answered in-tree, three days ago

`docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-and-the-flat-rotor-verdict-moves-with-the-units-lumen.md`
§1 already settles the CGA question for the belief lane, with a table of **invariants** rather
than counts (compactness of the rotor group; zero divisors in the even subalgebra; bivector
squares):

> *"**Not Cl(4,1).** … `Cl(4,1)` is CGA of ℝ³ — a five-dimensional algebra for a three-dimensional
> flat space … Our parameter manifold is **two**-dimensional. … **Cl(2,1)** … the conformal group
> of the **sample space** ℝ¹ is `Cl(2,1)`, and the Poincaré extension theorem says the conformal
> group of ℝⁿ *is* `Isom(H^{n+1})`."*

So: **CGA does compose with the belief lane, at signature (2,1), by a named isomorphism** — and
the specific algebra the question proposes, `Cl(4,1)`, is the wrong one for a reason already on
the record. Per the assignment's own instruction, this half stops here rather than being
re-derived.

### 4.2 New: CGA **cannot** compose with the E8 lane, and the reason is a one-line refutation

`src/Core/CliffordE8Roots.fs:20` is explicit about its algebra:

> *"we treat each of the 8 coordinates as a grade-1 generator of a Euclidean Clifford algebra
> **Cl(8,0)** (all generators square to +1, pairwise anticommuting)."*

CGA of `ℝⁿ` is `Cl(n+1, 1)` and **requires `q ≥ 1`** — the null vectors `n₀`, `n∞` that make
points into null blades exist only because there is a negative direction.

> **A positive-definite quadratic form has no anisotropic vector of negative norm. Therefore
> there is no signature-preserving embedding of `ℝ^{p,1}` into `ℝ^{8,0}` for any `p`, and the CGA
> construction cannot be realised inside the E8 lane's algebra.**

They are **different objects sharing the word "Clifford"** — 32-dimensional `M₄(ℂ)` versus
256-dimensional `M₁₆(ℝ)`, non-isomorphic, different signature classes on the mod-8 clock
(`s = 3` versus `s = 0`).

### 4.3 What *does* compose — two things, and both are already built

**(i) The classifier composes trivially, and needs no new code.**
`src/Core/CliffordPeriodicity.fs:84` `classify` is signature-general. CGA is already on the clock:

| signature | `s = p−q mod 8` | Morita type | `dim_ℝ` | in-tree role |
|---|---|---|---|---|
| `Cl(4,1)` — CGA of ℝ³ | 3 | `M₄(ℂ)` | 32 = 2⁵ | the algebra the 08-20 doc **excluded** |
| `Cl(2,1)` — CGA of ℝ¹ ≅ `Isom(H²)` | 1 | `M₂(ℝ) ⊕ M₂(ℝ)` (split) | 8 = 2³ | the algebra it **selected** |
| `Cl(3,0)` — shipped `Cl3.fs` | 3 | `M₂(ℂ)` | 8 = 2³ | shipped, and wrong for the belief metric |
| `Cl(8,0)` — E8 root lane | 0 | `M₁₆(ℝ)` | 256 = 2⁸ | `CliffordE8Roots` |

Note the numerology trap that this table defuses: `Cl(2,1)` and `Cl(3,0)` are **both**
8-dimensional with **both** 3-dimensional rotor groups. Dimension excludes neither; the split-real
versus complex row does.

**(ii) The genuine shared mechanism is bivectors ⇒ `so(p,q)`, which is the *uncoded* route.**
`CliffordPeriodicity.bivectorDim` is exactly `dim Λ²(ℝⁿ) = n(n−1)/2 = dim so(n)`, and the module's
"second tower" reaches `e₈ = so(16) ⊕ Δ⁺₁₆` (120 + 128 = 248) by that construction. CGA's rotor
group `Spin⁺(n+1,1)` is the **same** construction at a different signature: the bivectors of
`Cl(n+1,1)` are `so(n+1,1)`, the conformal Lie algebra.

**So CGA composes with the *uncoded* (spinor/bivector) route's mechanism, and with *nothing* in
the *coded* route.** Construction A takes a doubly-even self-dual binary code to an even
unimodular **lattice**; there is no CGA analogue of a binary code, and the E8 **lattice** is not
the E8 **Lie algebra**. That distinction is hard-won (`CliffordPeriodicity.fs:172-231`) and this
section does not blur it: CGA touches the Lie-algebra side only.

### 4.4 One small finding in the classifier, reported not filed

`evenSubalgebraClass` implements `Cl⁰(p,q) ≅ Cl(p, q−1)` and returns `Error` when `q = 0`, calling
it *"a refusal rather than a wrap"*. The refusal is honest but avoidable: the standard
isomorphism has a **second form**, `Cl⁰(p,q) ≅ Cl(q, p−1)` (Lawson & Michelsohn, *Spin Geometry*,
I.3), which covers `q = 0`. The case it declines is not exotic — it is `Cl(3,0)`, the algebra
`Cl3.fs` ships, whose even subalgebra is `Cl(0,2) ≅ ℍ` (and the 08-20 document already uses that
fact in its exclusion table). Reported here; the fix belongs to the code phase.

### 4.5 Verdict

- **Belief lane × CGA: already answered in-tree** (Cl(2,1), 2026-08-20). Stop.
- **E8 lane × CGA: refuted** — no signature-preserving embedding into a positive-definite algebra.
- **Classifier × CGA: already composes**, zero new code.
- **Shared mechanism: bivectors ⇒ `so(p,q)`** — theorem, and it is the *uncoded* route only.

---

## 5. Q5 — Is Gärdenfors convexity testable on an embedding Zeta can build?

### 5.1 Yes, `LinguisticSeed` is already the geometric claim — and the anchor needs correcting

`src/Core/LinguisticSeed.fs` exposes exactly a Mercer-closed kernel algebra: base kernels
(`constant c≥0`, `feature`, `dot`, `indicator`) and closure operations (`sum`, `product` via Schur,
nonneg `scale`, `pullback`), plus `gram` / `quadForm` as the PSD witness. The claim "PSD by
construction" is sound: each base is PSD and each combinator provably preserves PSD.

> **Theorem (borrowed).** A positive semi-definite kernel `k : X × X → ℝ` determines a unique
> reproducing-kernel Hilbert space and a feature map `φ : X → H` with `k(a,b) = ⟨φa, φb⟩`
> (**Moore–Aronszajn 1950**), and `d(a,b) = √(k(a,a) − 2k(a,b) + k(b,b))` is a pseudo-metric on
> `X` isometrically embedded in `H` (**Schoenberg 1938**).

**So yes — "English (or a closed subset of it) is geometric" and "the linguistic seed is a
Mercer kernel" are the same statement.** That is a real answer to the question as asked.

**Anchor correction, in the spirit of `anchor-to-human-prior-art`'s *checked, not cited*:** the
module names **Mercer's theorem** (1909), which gives a *spectral eigenfunction expansion* and
requires a **continuous** kernel on a **compact** domain. `Kernel<'x> = 'x -> 'x -> float` has an
arbitrary `'x` with no topology, so Mercer's hypotheses are not available. The theorem that
actually entails the module's claim is **Moore–Aronszajn**, which needs only PSD. The
`Mercer-closure` naming for the *combinator closure* is fine and standard; the *existence of the
geometry* should cite Moore–Aronszajn. This is a one-word docstring fix in the code phase.

### 5.2 And that is exactly why the existence claim is vacuous

`LinguisticSeed.indicator` is `k(a,b) = 1 if a = b else 0`. Its feature map sends every `x` to a
distinct **orthonormal basis vector** `e_x`. Then for any subset `C ⊆ X`:

```
conv{ e_x : x ∈ C }  ∩  { e_y : y ∈ X }  =  { e_x : x ∈ C }
```

because a convex combination of distinct basis vectors with more than one nonzero coefficient is
never a basis vector. **Every subset of every set is convex under `indicator`.** No categorisation
of English — natural, arbitrary, or adversarial — can fail.

This is the vacuity class in its purest form, and it is reachable with a function that is already
in the tree. It also generalises: **the existence of a geometry is free**, because any set at all
admits `indicator`. So "English is geometric" cannot be false, and therefore carries no
information. **All the content must live in *which* kernel, and in what that kernel predicts.**

(Sharper still: `composePacks []` reduces to `constant 0.0`, whose induced pseudo-metric is
identically zero — every subset is convex *and* every subset is a ball.)

### 5.3 The obstruction is **not** infinite-dimensionality — a correction to the question

The brief asks whether *"the RKHS's infinite-dimensionality makes convexity vacuous or
untestable."* It does not, and the diagnosis matters because it changes the repair.

The obstruction is that **affine convexity is a statement about the ambient space, while the data
live on a thin curved image `φ(X) ⊂ H`.** Generic points of `conv(φ(C))` are not in `φ(X)` at all,
so the membership test "every point between two members is a member" has an empty antecedent and
passes by default. That is true in `ℝ³` for a curved surface just as it is in an infinite-
dimensional Hilbert space. Dimension is a red herring.

### 5.4 The two repairs, and only one of them has teeth

**Repair A — Menger betweenness (Menger 1928).** State convexity metrically:
`C` is convex iff for all `a, b ∈ C` and all `c ∈ X` with `d(a,c) + d(c,b) = d(a,b)`, `c ∈ C`.
This is computable from `k` alone, and it *can* fail — so it is at least **statable**. But in a
strictly convex Hilbert space exact betweenness holds on a measure-zero set, so on finite data the
test is again near-vacuous unless it is graded to `d(a,c) + d(c,b) ≤ (1+ε)·d(a,b)`, at which point
the verdict is threshold-dependent and the threshold is unprincipled. **Honest, weak.**

**Repair B — the model-comparison form, which is the one to route.** Gärdenfors' own key result
(*Conceptual Spaces*, 2000, §3.9, on Okabe, Boots & Sugihara's Voronoi theory) is that concepts
generated by **prototypes under nearest-neighbour** are convex **automatically**. So convexity is
not the empirical content — it is a *consequence* of the prototype model. The falsifiable question
is therefore:

> **Does a prototype/Voronoi model over the kernel metric predict held-out category membership
> better than a pre-registered set of alternatives (nearest-neighbour-to-all-exemplars, linear
> separator, logistic on `φ`) — on a corpus fixed in advance?**

That can come out negative, it is measured in held-out log-likelihood, and it does not require
proving anything. It converts an unfalsifiable geometric assertion into a model comparison.

### 5.5 A blocking practicality

`LinguisticSeed` exposes `gram` and `quadForm` and **no distance function**. Convexity — under
either repair — is not computable from the module's current API without first writing
`d(a,b) = √(k(a,a) − 2k(a,b) + k(b,b))`. Two lines, and they are not there. Reported; code phase.

### 5.6 Verdict

- **"A Mercer kernel is a geometry" / "`LinguisticSeed` already IS the claim": theorem
  (borrowed)**, with the anchor moved from Mercer 1909 to Moore–Aronszajn 1950.
- **"Natural categories are convex in the RKHS", as affine convexity: vacuity class** —
  demonstrated false-by-triviality on the in-tree `indicator` kernel.
- **After Repair B: conjecture**, and — importantly — **not a proof obligation**. Routing it to
  a theorem prover would itself be the category error.

---

## 6. What goes to Soraya, and with which tool

Per `CLAUDE.md`: this hat has the mapping, `formal-verification-expert` proves it. Tool choice is
hers to confirm; this is the recommendation and the reason.

| # | Obligation | Tool | Why that tool |
|---|---|---|---|
| **S1** | Compact closure of `Mat(W)` for `W` a commutative semiring and finite basis: `η`, `ε`, both snake identities. | **Lean 4** | Purely categorical/equational. Mathlib carries `CategoryTheory.Monoidal.Rigid` (`ExactPairing`, `evaluation`/`coevaluation`), `Matrix`, `Module.Dual`, `Basis`. Z3 cannot express a coherence law. |
| **S2** | The **negative**: `⊕_K W` is not dualizable for infinite `K` (its dual is `∏_K W`). | **Lean 4** | Same library. This is the half that justifies a `FiniteKey` constraint rather than a comment. |
| **S3** | Conjugate exponential-family update = translation in natural coordinates; **and** the non-implication `D ⇏ A` via the η-chart counterexample of §2.3. | **Lean 4** for the algebraic identity; **a computed witness** for the counterexample | The identity is `exp⟨θ,T⟩·exp⟨θ',T⟩ = exp⟨θ+θ',T⟩` — clean equational content. The counterexample needs no prover, only a check that cannot pass by accident. |
| **S4** | `(μ−m)² > (α−½)/(λτ) ⟹ det H(log f_NG) < 0`, i.e. the exact boundary of the non-log-concave region. | **Z3** | Nonlinear real arithmetic over a polynomial inequality — decidable, and exactly Z3's shape. The §3.2 witness becomes a regression test; Z3 supplies the *general* statement. |
| **S5** | The half-space theorem of §3.3, stated for a general exponential family. | **Lean 4** (short) | `{z : ⟨θ,T z⟩ ≥ c}` is a preimage of a half-space — near-trivial in Mathlib, and worth having because it is the *positive* geometric result the inversion can actually stand on. |
| — | **NOT for Soraya:** the Gärdenfors question (Q5). | none | It is an empirical model comparison, not a proof obligation (§5.4). Misrouting it would manufacture a proof of something that is not a theorem. |
| — | **NOT for Soraya:** the Amari–Nagaoka Pythagorean/projection theorems (§3.5). | citation check | Borrowed, published, and already proved. The obligation is `missing-citations` / checked-anchor discipline, not re-proof. |

### 6.1 Filed (theory only — no implementation items; Aaron sequenced code after the analysis)

| work-item | covers | route |
|---|---|---|
| `081M0R1RP76087G0R003YFWNYK` | S1 + S2 — compact closure of `Mat(W)` for a finite basis, non-dualizability for an infinite one | Soraya, **Lean 4** |
| `081M0R1RV1Z087G0R0004SVNXJ` | S3 — the conjugate translation theorem, and the refutation of dual flatness as its source | Soraya, **Lean 4** + a computed witness |
| `081M0R1RV2Y087G0R003W65SGD` | S4 + S5 — the NG non-log-concavity boundary, and the half-space theorem | Soraya, **Z3** + **Lean 4** |
| `081M0R1RV3T087G0R001YAWXNK` | Q5 — pre-register the Gärdenfors question as a **model comparison**, explicitly not routed to a prover | not Soraya |

Three findings are reported in this document and deliberately **not** filed as work-items, because
each is a code change and code is sequenced after the analysis: the F#/TypeScript `apply` arity
divergence (§1.6), `evenSubalgebraClass`'s avoidable `q = 0` refusal (§4.4), and `LinguisticSeed`'s
missing distance function plus its Mercer→Moore–Aronszajn anchor correction (§5.5, §5.1).

---

## 7. The two framing constraints, honoured explicitly

### 7.1 Architectural primacy is not epistemic primacy

The measured layer is the Bayesian one. NG4: max KL **4.0e-8** over 4096 weights, **0** invalid
decodes at `rgba32float`, bit-for-bit associativity, and a **measured refutation** of the
Student-t alternative — plus the honest register that the whole thing is `toy`. The geometric root
has **zero implementation**, and three of the five answers above are negative or ill-posed.

Choosing geometry as the *architectural* root is legitimate — it is a claim about where the
generator sits, and `only-the-irreducible-is-primitive-generate-the-rest` is a real reason to want
it. But the root would then be the **least** evidenced part of the stack, and the layer above it
would be supplying all the confidence. The specific trap: an inversion that quietly re-labels the
measured layer as "an optimization of" the unmeasured one lets the root **inherit** the
measurements without earning them. §3.5 shows that for the conjugate lane the label is not just
unearned but **false** — the error is zero, so there is nothing being optimised.

**The defensible version of the inversion**, on the evidence here:

> The **affine** structure (natural parameters, e-connection, translation-as-update) is earned and
> is already the root — the tree has been building on it since `Message.fs`. What is *not* earned
> is the **metric** laid on top of it, and that is exactly where a geometric root would add
> something: Fisher–Rao is canonical by Čencov, the flat chart is measurably wrong
> (116.57°, verdict swinging 0.9998 → 0.000006 under a unit change), and NF4's 2.8× KL penalty is
> the same defect in the quantiser. **Root the metric, not the update.**

That is a smaller claim than "geometry is the root", it is supported by every measurement in this
document and the two before it, and it is buildable.

### 7.2 The phenomenological report

Aaron's *"I see English geometrically in my head"* is **authoritative about his experience and is
not evidence for the formal claim.** Under
`.claude/rules/engagement-profiles-*` the discipline is *ask, don't infer*, and the report is his
to give; under `numerology-vs-number-theory` a resonance is a **generator**, and a very good one —
it is why Q5 got asked at all, and Q5 produced a real result (§5.1: the claim is already
implemented, in different words). What it cannot do is carry a truth value about RKHS convexity,
because the index stores the resonance and not the evidence. Both halves are true at once and
neither is a slight.

---

## 8. Proposed register rows (§B) — **proposed, not landed**

Advisory scope: `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` is not edited by this PR. These are
offered for the Architect or human sign-off, in the register's own format.

**Z-G1 — Compact closure of the weighted-set substrate.** *Is the finite-basis restriction of
`WeightedSet`/`WSet` over a commutative semiring a compact closed category, with both snake
identities?* **Discharge:** a Lean 4 proof of `η`, `ε` and both triangle identities for `Mat(W)`,
plus the negative for infinite bases (S1, S2). **Falsifier:** exhibit a commutative semiring and a
finite `K` for which a snake fails, **or** show that the shipped types admit no `FiniteKey`
refinement without breaking a current consumer. *Register today: **refuted as implemented** — no
cup exists and no finiteness constraint is expressible.*

**Z-G2 — The metric, not the update, is where geometry is unearned.** *Is every measured defect in
the soft regime attributable to the metric rather than to the affine structure?* Supported by
three independent measurements (the 116.57° chart error and unit-dependent verdict, 2026-08-20;
NF4's 2.8× KL penalty, PR #14268; NG's non-convexity in the natural chart, §3.2). **Falsifier:** a
measured soft-regime defect that is a defect of the *affine* structure — i.e. one that persists
after the metric is corrected to Fisher–Rao. *Register: **conjecture**.*

**Z-G3 — Gärdenfors convexity over the linguistic seed.** *Does a prototype/Voronoi model over the
`LinguisticSeed` kernel metric predict held-out category membership better than a pre-registered
alternative set?* **Falsifier:** the pre-registered baselines win on held-out log-likelihood.
*Register: **conjecture**, and explicitly an empirical one — §5.2 shows the affine-convexity form
is the vacuity class and must never be registered in its place.*

---

## 9. Search terms used (so a miss is a claim about the search, not the repo)

At `e991df8044`, via `git grep -il "<term>" origin/main`:
`WeightedSet`, `discocat|pregroup|compact closed|compact-closed`, `rdenfors|conceptual space`,
`dually flat|dual flat|information geometry|Amari`, `Z-1|Z-2|Z-3`, plus `git ls-tree` over
`docs/research/2026-08-2*`. Found and read in full: the 2026-08-20 belief-manifold document, the
2026-08-23 NG4/RGBA document, the 2026-08-23 discretisation document, the 2026-08-23 latent-geometry
survey. **No in-tree treatment of Gärdenfors conceptual spaces, of compact closure, or of
`Cl(4,1)` as CGA other than the 08-20 exclusion.**

## Pointers

- `src/Core/WeightedSet.fs` · `src/Core/WSet.fs` · `src/Core.TypeScript/algebra/wset.ts` — Q1's subjects.
- `src/Core.Abstractions/IStarRing.cs` — the law profile §1.3(b) sharpens.
- `src/Bayesian/Message.fs` — Q2's three charts, one of which hides the additivity.
- `src/Core/CliffordPeriodicity.fs` · `src/Core/CliffordE8Roots.fs` — Q4's subjects.
- `src/Core/LinguisticSeed.fs` — Q5's subject; no distance function today (§5.5).
- `docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-*.md` — Q4's already-landed half, and Q2 §5.
- `docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-normal-gamma-*.md` — NG4, the measured layer §7.1 refuses to let the root inherit.
- `docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-*.md` — the monoid-not-semiring finding §1.4 scopes.
- `docs/research/scripts/2026-08-23-geometry-as-root-ng-convexity-verify.py` — every number in §3.
- `.claude/rules/numerology-vs-number-theory.md` — why §4.3's table is invariants, not counts.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §3.5 and §7.1 exist.
