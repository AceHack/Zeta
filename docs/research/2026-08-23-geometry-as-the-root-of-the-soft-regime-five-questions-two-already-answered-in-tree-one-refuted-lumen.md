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
- **Addendum (§10):** Aaron's covariance/contravariance route supplies a **second, independent**
  derivation of the error term — the within-fibre Bregman information — and it lands on **exactly**
  this boundary: vacuous on the conjugate lane, exact on the non-conjugate one. It corroborates
  §3.5 and leaves the Gärdenfors half untouched.

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
| `081M0R34AZY087G0R001H9N6YS` | §10 — descent along a coarsening: the exact iff, extensive vs intensive, Pythagorean = within-fibre Bregman information | Soraya, **Lean 4** + a computed witness |
| `081M0R5E1ZG087G0R001RVAQVR` | §13.5 — evidence-set intake for the belief fold (the "if not" half of Aaron's verification request) | not Soraya — design + a falsifier that fails today |
| `081M0R5R1JN087G0R0031FT1C2` | §14.6 — **bug**: `SoftValue` support shrinks by float underflow at 324 observations; *when* a key dies is float-dependent, so oracles can diverge | not Soraya — falsifier first, then confirm on the real F# |

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

---

## 10. ADDENDUM — variance, coarsening, and whether that gives Q3 a proof technique

> Aaron, after the first pass: *"this is exactly the connection to **co- and contravariance in
> type theory from C#** and also similar to **physics** at the same time. After listening to
> **Brian Beckman**, this is where I realise these two converge — and then the geometric language
> stuff makes this even more precise in **Clifford space with geospatial English**."*
>
> Context: a parallel design (naming registry / reverse index) arrived at *"measure DV2.0
> change-rate over a **cluster** instead of an individual item"*, clusters formed by distance in
> an embedding. That is a **coarsening**, and the question is whether variance turns the design
> assertion into a theorem with a discharge condition — and whether the same move gives Q3 a
> computable error term.

**Verdict in four lines.**

| claim | verdict |
|---|---|
| coarsening = quotient; pullback free, pushforward needs constancy on fibres | **theorem — and incomplete.** The dichotomy is *extensive vs intensive*, and BOTH directions are free, in **opposite** variances (§10.1) |
| C# variance and tensor variance are the same functorial notion | **theorem, with the translation written out** (§10.2). Not a shared word — for covectors it is literally the same sentence |
| Clifford/GA makes it "more precise" by unifying the two variances | **refuted as stated.** The **metric** unifies them, not GA; GA makes it **index-free**, which is a notational claim, not a precision claim (§10.3) |
| the route gives Q3 a computable error term | **real, and it reproduces §3.5's boundary exactly** — vacuous on the conjugate lane, exact on the non-conjugate one. It **corroborates**; it does not extend, and it does **not** touch the Gärdenfors half (§10.4) |

Numbers below reproduce from
`docs/research/scripts/2026-08-23-geometry-as-root-bregman-coarsening-verify.py` (`ALL PASS`, exit 0).

### 10.1 The formalisation is right, and the dichotomy needs one more distinction

Let `q : N → C` be the coarsening (names → clusters), surjective, fibres `q⁻¹(c)`.

> **Theorem (universal property of the quotient, `Set`).** For surjective `q` and any `g : N → X`,
> a map `ḡ : C → X` with `ḡ ∘ q = g` exists **iff** `ker q ⊆ ker g` — i.e. iff `g` is constant on
> fibres — and is then unique.

So *"pullback is unconditional, pushforward needs a hypothesis"* is **exactly right**, it is a
theorem and not an analogy, and the hypothesis is an **iff**: for *exact* descent there is no
weaker condition, bounded variation included. Good.

**The distinction the framing is missing, and it changes the answer for the actual design.**
There are two pushforwards, not one, and they have opposite freedom:

| carried object | pull back along `q` | push forward along `q` |
|---|---|---|
| **function** `N → X` (intensive — a *per-item* rate) | **free** (`q*f = f ∘ q`) | needs **constancy on fibres** |
| **measure** on `N` (extensive — a *count*) | needs a disintegration / section | **free** (`q_*μ(c) = μ(q⁻¹(c))`) |

So: *"the change rate of a cluster"* is **already well-defined with no hypothesis** if it means
**total changes per unit time across the cluster** — that is a pushforward of a *measure*, and
measures push forward freely. It needs the coherence hypothesis only if it means **the rate each
member has**, which is a function.

**And this is not a technicality — it is the DV2.0 criterion restated.** DV2.0 partitions by
*change rate*, so a cluster whose members' change rates disagree is precisely a cluster that has
merged a **hub** with a **satellite**. The discharge condition and the design's own purpose are
the same condition:

> **A coarsening is DV2.0-admissible exactly when the change-rate function is (near-)constant on
> its fibres. Within-fibre change-rate dispersion is not noise in the measurement — it is the
> measurement that the cluster is wrong.**

That is a falsifiable statement about the naming-registry design, available before it is built.

**The weaker-than-equality condition, named properly.** For *approximate* descent into a metric
or Bregman geometry the error is the **within-fibre dispersion**, and it has an exact accounting
identity (§10.4). Not "bounded variation" — the right names are the **oscillation** `sup − inf`
(L^∞, minimised by the Chebyshev centre) or the **within-fibre variance** (L², minimised by the
barycentre), and in the Bregman setting the **within-cluster Bregman information**.

### 10.2 The variance word — same notion, labels swapped by exactly one `op`

**The trap is real and the direction stated in the brief is correct.** Written out both ways so
the translation is checkable rather than asserted:

| object | along `f : M → N` | physics index | **physics name** | **categorical name** |
|---|---|---|---|---|
| tangent vector | **pushes forward** `f_*` | upper `V^i` | *contravariant* | **covariant** functor |
| covector | **pulls back** `f*` | lower `ω_i` | *covariant* | **contravariant** functor |

**Both labels are swapped, consistently — and there is a reason, which is what makes this a
translation rather than a coincidence.** Physics names how *components* transform **relative to
the basis**: with `V = V^i e_i` invariant, the components `V^i` must transform *against* the basis
(hence "contra"), while covector components transform *with* it (hence "co"). Category theory
names how the *functor* acts on **morphisms**. A basis change is itself contravariant in the
components, so the two conventions differ by **exactly one application of `op`** — uniform,
invertible, and derivable rather than memorised.

**And for covectors it is not an analogy at all — it is the same sentence.** A covector *is* a map
`V → ℝ`. In C# that is `Func<in T, out TResult>`, and the language's rule says it is
**contravariant in `T`**. So *"covectors pull back"* and *"`Func<in T, ·>` is contravariant"* are
one statement in two vocabularies. Under `.claude/rules/numerology-vs-number-theory.md` this is an
identification by **structure**, not by a matching word, and it passes.

**What does NOT transfer, so the scope is honest:**

- C# variance lives on a **preorder** (subtyping) — no non-trivial composition, no metric, no
  smooth structure. Tensor variance lives on the groupoid of coordinate changes, or on `Man`.
- C#'s variance is decided **syntactically** by position (`in`/`out`). Tensor variance interacts
  with a metric.
- **Decisively: C# has no analogue of raising and lowering indices**, because a subtyping order
  carries no metric. So the *conversion* between the two variances — the operation that makes
  tensor calculus work — **has no C# counterpart at all.**

> **The notion of *direction* is identical. Everything the *metric* supplies exists on one side
> only.** Both halves have to be said, or the identification is doing more work than it earns.

**Anchors.** Mac Lane, *Categories for the Working Mathematician* (2nd ed. 1998) I.2 — a
contravariant functor is a functor on `C^op`; this is the definition both conventions are measured
against. The C# side is the language specification's variance rules for `in`/`out` type
parameters. Brian Beckman is Aaron's stated source for the physics/category convergence and is a
real independent lineage (**his published public lectures**, per
`.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`: public work is
cited, nothing else is); the load-bearing citations above are Mac Lane and the language spec, not
him — an anchor should carry only what it actually entails.

### 10.3 The Clifford half — "unifies" is refuted, "index-free" is true

Two different claims were on offer and only the weaker one survives.

**Does GA *unify* the two variances? No — the metric does, and GA is not needed for it.** The
**musical isomorphisms** `♭ : V → V*, v ↦ g(v, ·)` and `♯ = ♭⁻¹` are exactly index lowering and
raising, and they exist in **any** non-degenerate inner-product space. Riemannian geometry has
them without Clifford algebra anywhere. GA cannot claim the unification; it inherits it.

**Does GA *express* both uniformly? Yes — and that is the real gain.** In `Cl(V,q)` the metric is
inside the product (`a·b = ½(ab + ba)` *recovers* it), so the algebra is naturally **index-free**
and the covariant/contravariant bookkeeping leaves the notation: vectors and covectors are both
grade-1 elements, and the distinction is carried by the product rather than by index placement.

So the accurate word is **"index-free / notation-uniform"**, not *"more precise"* and not
*"unifies"*. Those are three different claims and only the middle one is true.

**Two cautions that cost something later if skipped:**

1. **GA has two distinct dualities and they are not the same map.** The musical isomorphism
   (`V ↔ V*`, grade-preserving, metric) and the **pseudoscalar dual** `A ↦ A·I⁻¹` (grade `k ↦ n−k`,
   Hodge-shaped) are different operations. Conflating them is a live trap in exactly the kind of
   argument this section is evaluating.
2. **The identification `V ≅ V*` is pointwise and not natural.** It depends on the metric at the
   point. On a *statistical* manifold the metric is the **Fisher matrix, which is not constant** —
   the 2026-08-20 document measured its condition number at **508** at `(ν, τ) = (20, 10)`. So
   "vectors and covectors are the same thing" is safe on a flat metric space and is **exactly the
   error that document caught** when carried onto the belief manifold. The Clifford framing does
   not rescue that; it is the same defect in nicer notation.

### 10.4 Does the route give Q3 a computable error term? Yes — and it reproduces §3.5's boundary

This is the substantive half, and it works better than the framing proposed, because the coarsening
in question is not hypothetical — **it is already in the tree, twice, and the two instances are
different operators.**

**The coarsening is the m-projection.** EP/ADF's moment-matching step `Π_M : P → M` is a
retraction whose fibres are `Π_M⁻¹(q) = { p : E_p[T] = E_q[T] }` — the distributions sharing a
sufficient statistic. That is literally *"cluster by having the same moments, then measure over
the cluster"*, so `Π_M` **is** a coarsening `q : N → C` in the sense of §10.1, not an analogy.

**The error term is the within-cluster Bregman information, and it is exact.** For any Bregman
divergence the conditional expectation is the unique optimal representative and the decomposition
is exact (**Banerjee, Guo & Wang 2005**, *On the optimality of conditional expectation as a Bregman
predictor*, IEEE Trans. Inf. Theory 51; **Banerjee, Merugu, Dhillon & Ghosh 2005**, *Clustering
with Bregman divergences*, JMLR 6). Specialised to `φ = A*` so that `D_{A*} = KL`:

```
E_i[ KL(p_i ‖ q) ]  =  E_i[ KL(p_i ‖ p̄) ]  +  KL( p̄ ‖ q )        for every q ∈ M
                       └── fibre-VARYING ──┘    └── DESCENDS ──┘
```

Checked: `max |LHS − RHS| = 5.7e-14` over 2000 random `q`; the within-cluster information is
`0.56922396` nats on the test cluster and **exactly `−0.0`** when the fibre is constant (B3, B4).

Three things follow, and the second is the real result:

1. **The identification the brief hoped for is correct.** The approximation error of the
   pushforward *is* the failure of constancy on fibres, quantified — and **Amari's generalised
   Pythagorean theorem is this decomposition**, because `D(p ‖ Π_M p)` depends only on `p` (varies
   on the fibre, does not descend) while `D(Π_M p ‖ q)` depends on `p` only through `Π_M p`
   (constant on the fibre, descends). With `φ = ‖·‖²` the same identity is the **law of total
   variance**. One theorem, three costumes.
2. **The route independently reproduces §3.5's boundary, which is the strongest corroboration
   available.** On the **conjugate** lane the "coarsening" has **singleton fibres** — the update is
   a translation, a bijection — so the within-fibre information is identically zero and the
   technique says nothing. That is §3.5's refutation of *"Bayes is a fast approximation of a
   geometric root"*, arrived at by a completely different road. On the **non-conjugate** lane the
   fibres are fat and the error is the formula above — which is exactly where §3.5 said the
   "optimization" label was legitimate. **A new method landing on the same boundary is evidence;
   a new method dissolving an inconvenient boundary would have been the warning sign.**
3. **It does NOT rescue the Gärdenfors half.** A coarsening yields a quotient, not a **convex
   region**, and §3.3's problem — convexity is affine and coordinate-relative — is untouched by
   variance. Q3 stays **ill-posed** on that half.

**And the route inherits the same two-fold ambiguity, from the same source — which is the deepest
thing in this addendum.** *"Measure over the cluster"* does not name one operation. The same four
members with the same weights have **two** KL barycentres, and they are far apart (B1):

| barycentre | closed form | what it is | where it already lives in the tree |
|---|---|---|---|
| `argmin_q E[KL(p_i ‖ q)]` (right-KL) | **moment average** — `(0.500000, 4.050000)` | m-projection | **EP moment matching**, `Message.fs`'s lineage (Minka 2001) |
| `argmin_q E[KL(q ‖ p_i)]` (left-KL) | **natural-parameter average** — `(0.947368, 1.052632)` | e-average | **NG4's `mix()`** — log-linear pooling, Genest 1984, already cited in `…-normal-gamma-…md` §5 |

Both match a direct numerical minimisation (B2). **These are two different coarsenings of one
cluster, both already implemented, in different files, under different names** — and a design that
says *"measure the change rate over the cluster"* has not yet said which. This is §3.3's e-versus-m
ambiguity arriving at the coarsening question by a different door, and it means the variance route
**does not dissolve the ill-posedness — it re-derives it**, and names the missing datum:

> **Fix which affine structure is canonical for the purpose. It is a modelling decision, not a
> geometric fact, and no amount of geometry will make it for you.**

### 10.5 What this changes upstream

- **§3's verdict is unchanged**, and is now corroborated by a second, independent technique.
- **§7.1's recommendation is strengthened**, not weakened: *root the metric, not the update.* The
  Bregman machinery is a statement about **which divergence you coarsen under** — a metric-layer
  choice — and it has no content at the affine layer, where the fibres are singletons.
- **One new obligation is filed** (§10.6): the descent theorem, the extensive/intensive split, and
  the Pythagorean-as-fibre-decomposition identification.
- **One design consequence, ready before the naming registry is built:** publish the
  within-cluster dispersion of the change-rate alongside the cluster's rate. A cluster reporting a
  rate without its within-fibre dispersion is a pushforward asserting a hypothesis it has not
  checked — and under `.claude/rules/toy-is-free-metered-must-be-earned.md` that is `unmetered`,
  not `metered`.

### 10.6 Filed

| work-item | covers | route |
|---|---|---|
| `081M0R34AZY087G0R001H9N6YS` | descent along a coarsening: the exact iff, the extensive/intensive split, and Pythagorean = within-fibre Bregman information | Soraya, **Lean 4** (the descent theorem) + a computed witness (the two barycentres) |

---

## 11. ADDENDUM TO THE ADDENDUM — is "a count is CRDT, a condition is CASPaxos" a theorem?

> Aaron, on §10's extensive/intensive split: *"for me **a count is CRDT** and **a condition is
> CASPaxos or CASRaft**-ish."*

**Verdict: directionally right, off by one refinement in *each* column — and the refinements are
the useful part. The two conditions are NOT equivalent: they are co-extensive on the examples and
separated by IDEMPOTENCE**, which belongs to the delivery channel rather than to the statistic
(§11.2). The correspondence is a **theorem** where it is stated over commutative monoids (§11.8)
and an **analogy that parts** where it is stated over counts. The left column understates what is needed (a count is a `CmRDT`, not a `CvRDT`);
the right column overstates it (**most intensive quantities need no consensus at all**). The
corrected invariant is **commutativity of the update**, and it is the *same* invariant on both
sides of the correspondence. The four-way agreement is **recorded design recognised in a new place**,
not a coincidence needing triage — checked, with counts, in §11.6.

Numbers from `docs/research/scripts/2026-08-23-geometry-as-root-extensive-crdt-verify.py`
(`ALL PASS`, exit 0).

### 11.1 The one distinction, stated once

> **Descent along a coarsening is free exactly when the aggregation is invariant under the
> symmetries of the fibre.** The fibre is *unordered* ⇒ the aggregation must be **commutative and
> associative**. The fibre arrives over a channel that may **duplicate** ⇒ additionally
> **idempotent**. The fibre is *ordered and the order matters* ⇒ you must **agree the order**, and
> agreeing an order is consensus.

Three tiers, one condition, and everything below is that sentence in a different vocabulary.

### 11.2 Left column — a raw count is a CmRDT, **not** a CvRDT

`+` on counts is commutative and associative and **not idempotent** (`x + x ≠ x`, C1). Those are
the **commutative monoid** axioms, not the **join-semilattice** axioms — the semilattice needs
exactly the one that fails. So:

- **extensive ⇒ concurrent operations commute ⇒ `CmRDT` (op-based).** True, unconditionally.
- **extensive ⇒ `CvRDT` (state-based).** **False** — the state is not a join-semilattice.

The standard repair is the **G-Counter**, and it is *not* a property of counting: it **re-indexes
the fibre by source**, merges with elementwise `max` (which *is* idempotent, C2), and recovers the
count only at **read** time as `Σ`. That is a **change of the carried object** — you decline to
quotient by replica identity — which in §10.1's language is *keeping a section of the coarsening*.

**And `src/Core/Crdt.fs` is the in-tree witness**, exactly this shape: `GCounter` is a `ZSet` keyed
by `replicaId`, `Merge` is elementwise `max`, `Value` is the sum. **The merge and the aggregation
are two different operations on two different objects**, which is precisely where the categorical
condition and the CRDT condition part company.

> **In-tree defect, found by this check.** `src/Core/Crdt.fs:9` reads *"DBSP Z-sets with integer
> weights are already a **signed-multiset join-semilattice** — commutative, associative, with an
> identity."* Those three axioms are the **commutative monoid**; a join-semilattice additionally
> requires **idempotence**, which `ZSet.add` does not have and cannot have (it is a group — it has
> *inverses*, which is the opposite of idempotent). **The code is correct and the comment names the
> wrong structure** — and the tell is that `GCounter.Merge` reaches for `max` precisely *because*
> `+` is not idempotent. Reported for the code phase, not filed as implementation.

**Idempotence is a property of DELIVERY, not of the statistic** (C3): redeliver one increment and
raw `+` reads `10` where the truth is `5`, while keyed-max reads `5`. This is the cleanest
statement of the boundary — commutativity/associativity are about **the meter** (does the answer
depend on how you grouped the fibre?), idempotence is about **the channel** (does it depend on how
many times you heard it?). Which is Aaron's own split from a different thread: *"reproducibility is
where the meter and the communications live."* Two conditions, two halves, and only the first is
what §10's pushforward asks for.

### 11.3 Right column — "intensive ⇒ consensus" is **false**, and the thermodynamics says why

The bigger correction. An intensive quantity that is a **ratio of two extensives** needs **no
coordination whatsoever**: carry both measures, merge both freely, divide at read.

| | value |
|---|---|
| `(sum, count)` merged across two uneven partitions, then divided | **6.2857142857** |
| direct global mean | **6.2857142857** — equal |
| average of the two partition averages | **7.7000000000** — wrong by **1.414** |

*"You cannot average averages"* is true and is **not** an argument for consensus; it is an argument
for **carrying the right pair**. And this is not a trick — it is the thermodynamic definition:
**an intensive quantity IS a ratio of extensives** (density = mass/volume, `T = ∂U/∂S`). So the
older anchor supplies the **repair**, not merely the vocabulary, which is what makes it a checked
anchor rather than a decorative one. Measure-theoretically it is the **Radon–Nikodym derivative**
`dν/dμ`: §10.1 said measures push forward freely, so *any* density recoverable from two
freely-pushing measures inherits that freedom.

**So what actually forces consensus?** **Non-commutativity** (C5): `f(g(s)) = 26 ≠ 23 = g(f(s))`
for a read-modify-write pair, and no merge function repairs an order-dependent result. **CAS is the
canonical non-commutative operation** — its result depends on what was already there — so
**CASPaxos (Rystsov 2018) is the right primitive, reached by the right reason.** Aaron's right-hand
box is correct; its label was.

### 11.4 The corrected table

| | free / wait-free | needs coordination |
|---|---|---|
| **categorical** | aggregation invariant under fibre symmetry | order-dependent aggregation |
| **algebraic** | commutative monoid (+ idempotent ⇒ semilattice) | non-commutative operation |
| **thermodynamic** | extensive, **or** intensive expressed as a ratio of extensives | a quantity with no ratio-of-extensives form |
| **distributed** | `CmRDT` (commuting ops); `CvRDT` after per-source keying | **CASPaxos / CASRaft** |
| **Zeta §2** | **wait-free** | requires coordination |

The one row that changed is the thermodynamic one, and changing it moves a large class of
quantities — every density, every rate, every mean — from the right column to the left.

### 11.5 The practical payoff survives, and gets a lower bound behind it

*"Prefer the extensive formulation because it is wait-free"* (manifesto §2) is **not** a style
preference. Merging a commutative aggregation is wait-free and available **under partition**
(Strong Eventual Consistency, Shapiro et al. 2011). Consensus is **impossible** in an asynchronous
system with a single crash fault (**Fischer, Lynch & Paterson 1985**) and unavailable under
partition (**Gilbert & Lynch 2002**). The gap is a **computability class**, not a message count.

**And the naming-registry consequence converges with a rule already resident.** A *rate* is
`Δcount / Δtime` — the denominator is a **duration**, and agreeing a duration is agreeing a clock,
which is exactly what
[`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
forbids entering the shared fold. So:

> **Carry the count. Never carry the rate.** The count is extensive, merges wait-free, and contains
> no clock. Let the *reader* divide by an agreed phase interval. One design rule satisfying §10's
> pushforward condition and the local-time rule simultaneously, from the same argument — and
> derived from the math rather than imposed on it.

The §10 rider still stands and is now sharper: publish the **within-fibre dispersion** beside the
cluster's count, because that dispersion is what says whether the cluster merged a hub with a
satellite. Dispersion is itself a ratio of extensives (`Σx²`, `Σx`, `Σ1`), so it is **also
wait-free**. Nothing in the DV2.0 measurement needs consensus.

### 11.6 Recognition, not discovery — and the correction I am recording rather than hiding

My first draft of this section triaged the four-way agreement (categorical / algebraic /
thermodynamic / distributed) as a **dense resonance** needing an independence check, per
`.claude/rules/numerology-vs-number-theory.md`. **That applied the right rule to the wrong case.**

> Aaron: *"you don't remember this history — this is one of the **primary things we keep checking
> are correlated, over and over, since the project started**. It's **database and CRDT and DBSP
> oriented**. **Zeta since its conception is a distributed consensus algorithm that gracefully
> degrades to slower operations based on trust gradients.**"*

Checked at `cdc2227156` rather than taken on trust:

| measurement | count |
|---|---|
| files mentioning `CRDT` | **661** |
| files mentioning `DBSP` | **1628** |
| files carrying **both** | **208** |
| `trust gradient` / `gracefully degrades` | `docs/VISION.md`, `docs/PROVEN-CORE-MAP.md`, `docs/DECISIONS/`, four backlog rows, and `rules.bak/useful-output-is-evidence-not-authority.md` — the **L0–L4 absorption ladder**, Amara 3rd ferry, **2026-05-28** |

The rule says a dense resonance is a prompt to check independence. **Here the independence check has
been running since inception, across 208 files.** So the register is **recorded design recognised in
a new place**, not a coincidence requiring triage — and presenting it as evidence would have been
double-counting a commitment the project already made.

I am recording the correction instead of quietly rewriting, because that rule's own worked example
is that *an unlabelled coincidence promoted to a belief is the failure* — and an unlabelled
**correction** is the same defect with the sign flipped.

**What is actually new is small, and it is the part worth having:**

| | status at `cdc2227156` |
|---|---|
| the **architecture** — CRDT/DBSP correlation, graceful degradation on trust gradients | **old and pervasive.** 208 files; the ladder dates to 2026-05-28 |
| the **criterion** — extensive ⇒ wait-free, non-commutative ⇒ consensus | **absent.** `git grep -in "extensive.*intensive"` over `src/`, `docs/`, `.claude/` returns **only this document**; `git grep -in "needs consensus\|requires consensus\|degrade.*consensus"` over `src/` and `.claude/rules/` returns **nothing** |

> **The substrate has been making this call by judgement, and making it well, without a stated
> test.** The contribution is therefore neither a new architecture nor a new correspondence — it is
> a **decision procedure** for a choice that was already being made correctly by hand. The
> architecture being old is what makes the criterion worth writing down, not what makes it
> redundant.

### 11.7 The degradation tier — what the result is *for*

The operational statement is *"Zeta gracefully degrades to slower operations based on trust
gradients."* §10's descent condition is then not an analogy to a coordination requirement — in this
substrate it **selects the degradation tier**:

| statistic | merge | mode | cost | what the trust gradient decides |
|---|---|---|---|---|
| **count** (extensive) | unconditional | **CRDT** | **wait-free** (§2) | nothing — always affordable |
| **ratio of counts** (density / rate / mean / variance) | unconditional, on the pair | **CRDT** | **wait-free** | nothing — §11.3 moved this row *down* |
| **order-dependent update** (a decision, a CAS, a canonical-name election) | none exists | **CASPaxos / CASRaft** | coordination | **whether you can afford the round** |
| duplicating channel, any of the above | per-source keying | **CvRDT** | free | orthogonal — costs no coordination |

**The §11.3 correction earns its keep exactly here.** *"Rate ⇒ consensus"* would have pushed every
density, rate, mean and variance onto the consensus tier. Because most intensive quantities are
**secretly a pair of extensive ones**, the criterion moves them back to wait-free — which is
strictly the right direction for an architecture whose stated goal is to degrade *as rarely as
possible*. A criterion that over-escalates is worse than no criterion, because it spends the
gradient's budget on work that never needed it.

**The procedure, in the form a designer can apply:**

1. Is the statistic a **count**? → wait-free CRDT. Done.
2. Is it a **ratio of counts**? → carry numerator and denominator as separate counts and divide at
   read. **Still wait-free.** Do not reach for consensus here.
3. Is the update **order-dependent**? → this is the **only** tier that needs CASPaxos/CASRaft, and
   the trust gradient decides whether the round is affordable.
4. Can the channel **duplicate**? → per-source keying (G-Counter). Orthogonal to 1–3, free.

Applied to the naming registry: per-agent change **counts** and their **dispersion** are tier 1–2
and need no coordination at all; only *deciding* something about a cluster — its canonical name,
its hub-or-satellite classification — reaches tier 3. **Registry measurement is wait-free;
registry adjudication is not**, and the line between them is now a test rather than a judgement
call.

*Register: the procedure is **derived** from §10's descent condition; the ladder it selects on is
**recorded design**; the mathematical tier boundaries are §11.8's `iff`.*

### 11.8 Routing

**Not a new work-item.** The precise half is folded into the existing descent item
`081M0R34AZY087G0R001H9N6YS` as **D4**, because it is the same theorem family and a sixth
investigation is not what the evidence asks for. The statement is precise enough to be worth Lean:

> An aggregation `⊕ : Multiset(X) → X` descends along **every** coarsening **iff** it factors
> through multiset equality — i.e. iff `(X, ⊕)` is a **commutative monoid**. It descends along
> every coarsening whose fibres arrive with **unknown multiplicity** **iff** it is additionally
> **idempotent** — i.e. iff `(X, ⊔)` is a **join-semilattice**.

Two tiers, an `iff` each, and they are **exactly** the `CmRDT` and `CvRDT` conditions of Shapiro et
al. — which is what upgrades the mapping from analogy to theorem in the one place where it is one,
and simultaneously names the place where it is not (§11.2). Short in Lean 4 (`Multiset`,
`Multiset.sum`, `Finset.sup`).

**Anchors added to `docs/PRIOR-ART-LIST.md`:** Shapiro–Preguiça–Baquero–Zawirski 2011 (the
CvRDT/CmRDT split and the semilattice condition — the anchor that **corrected** §11.2 rather than
confirming it); Rystsov 2018 (CASPaxos); Tolman 1917 (extensive/intensive); FLP 1985 and
Gilbert–Lynch 2002 (the cost). Beckman was already resident as REQUIRED READING.

---

## 12. CALM settles the open half — in its LATTICE form, and the set form says the opposite

> Aaron: *"I'm almost certain **CALM theorem** is going to apply here."* And, on the underlying
> question: *"I don't know this answer or even have a thesis. This is very interesting and novel to
> me — that does not happen often."*

**He is right, and the citation does most of the work. Saying that plainly is the result.** What is
left after CALM is one question, and it is genuinely ours (§12.5).

### 12.1 The answer to the open question, in four lines

| | |
|---|---|
| Is *"freely pushforward-able"* **equivalent** to *"CRDT-mergeable"*? | **No.** `B ⊊ A`, strictly, and the separator is idempotence (T1) |
| Are they co-extensive on what is **constructible**? | **Yes** — every commutative monoid admits a CvRDT representation via uniquely-tagged ops merged by **union** (T2). The representation is the aggregate's *free form*, not the aggregate |
| So what is *"a count is CRDT"* actually asserting? | **Compressibility.** The free G-Set is `O(#ops)`; the G-Counter is `O(#sources)`. 500 ops → 500 entries vs **3** (T3). The compression, not the construction, is the content |
| What has the theorem attached? | **CALM** — and it supplies the direction none of the above does: **necessity** |

**T1, stated as a proof rather than an observation.** Every join-semilattice `(M, ⊔, ⊥)` is a
commutative monoid, so `⊔` pushes forward freely — `B ⊆ A`. And `(ℕ, +, 0)` pushes forward freely
while `x + x = x` holds **only at `x = 0`**, so no order on `ℕ` makes `+` a join — `(ℕ,+) ∈ A \ B`.
The containment is strict, and the asymmetry is total: **there is no statistic that is
CvRDT-mergeable whose pushforward needs a condition**, because idempotence is an *extra* axiom, not
a weakening. That was the direction nobody had an intuition for; it is empty, provably.

### 12.2 CALM applies — but only in its lattice generalisation, and this had to be checked

> **CALM (Consistency As Logical Monotonicity).** Conjectured by **Hellerstein**, *The Declarative
> Imperative* (SIGMOD Record 2010); **proved by Ameloot, Neven & Van den Bussche** (JACM 2013) over
> relational transducer networks; restated accessibly in **Hellerstein & Alvaro**, *Keeping CALM*
> (CACM 2020). *A program has a consistent, coordination-free distributed implementation **iff** it
> is monotonic.*

**Cited naively, CALM gives the wrong answer for counting.** In the original **set** formulation
monotonicity is set-containment of the *output relation*, and under that reading `COUNT` and `SUM`
are **non-monotone** — adding an input fact *retracts* the previous answer (`{(5)}` → `{(8)}`, and
`{(5)} ⊄ {(8)}`). That is why aggregation is a non-monotone operator in Bloom/Dedalus and needs a
seal. Taken at face value, set-CALM says **a counter needs coordination**, which is the opposite of
what a G-Counter demonstrates.

**The version that applies is the lattice generalisation** — **Conway, Marczak, Alvaro, Hellerstein
& Maier, *Logic and Lattices for Distributed Programming* (SoCC 2012)**, i.e. `Bloom^L` — where
monotonicity means *the value only ascends in a bounded join-semilattice*. There a G-Counter **is**
monotone and **is** coordination-free.

> This is `anchor-to-human-prior-art`'s *checked, not cited* discipline paying for itself: the two
> formulations of the same named theorem give **opposite verdicts** on the exact case at hand, and
> only reading which one has the right hypotheses tells you that.

### 12.3 Idempotence vs monotonicity — not two depths, one condition in two vocabularies

The framing on offer was that idempotence is the shallower answer and monotonicity the deeper one.
**Neither is deeper. They are related by a standard correspondence and are interderivable:**

> **Semilattice ↔ poset.** A commutative, associative, **idempotent** `⊔` on `M` is *equivalent* to a
> partial order with least upper bounds, via `x ≤ y ⟺ x ⊔ y = y`. Idempotence is exactly what makes
> `⊔` a **join** rather than an accumulation; monotonicity is that order's ascent condition.

So you cannot have "monotone ascent in a lattice" without idempotence — **idempotence is the
algebraic form and monotonicity the order-theoretic form of the same requirement.** The correction
is worth recording rather than silently overwriting: my §11 named it algebraically, Aaron named it
order-theoretically, and both are naming the object CALM quantifies over.

**What CALM genuinely adds, and neither §11 nor T1–T3 contains, is the `only if`.** Everything above
is *sufficiency* — a semilattice merges freely, and a commutative monoid can be constructed into
one. CALM says **monotonicity is necessary**: a non-monotone query has *no* coordination-free
implementation at all. That is a lower bound on the problem rather than on the failure model, so it
is strictly sharper than §11.5's FLP and CAP rows, which bound the *environment*.

### 12.4 The correction CALM forces on my own §11.3 — converge is not act

§11.3 concluded *"intensive ⇒ consensus is false"* because a mean is a ratio of extensives and the
pair `(sum, count)` merges wait-free. **That stands, and it was answering the smaller question.**
CALM makes the missing distinction visible:

| question | answer |
|---|---|
| Can I compute the mean of what I have seen, wait-free, converging to the right value as data arrives? | **Yes.** The pair is monotone; §11.3 is correct |
| Can I know the mean I am holding is **final**? | **No**, without a seal — and the seal is the coordination |

Measured (T6): on the stream `[90, 95, 92, 10, 12, 8, 5, 5]` with threshold `50`, the running mean
reads **above** threshold for six steps and then **falls below**. `count ≥ 4` crosses once and
**never un-crosses**.

> **A monotone statistic is safe to *act* on the moment it crosses a threshold, because it cannot
> un-cross. A non-monotone one converges wait-free and is never safe to act on irreversibly without
> a seal.**

So the trust gradient's real question is not *"can I compute this without coordination"* — usually
yes — but **"can I act on it without coordination"**, and only monotonicity licenses that. That
lands exactly on `rules.bak/useful-output-is-evidence-not-authority.md`, whose L0–L4 ladder gates
**irreversible action** specifically. §11.7's procedure is amended accordingly:

2′. **Ratio of counts** → the *value* is wait-free to compute and converge. **Acting irreversibly on
    it is tier 3**, because the derived ratio is non-monotone. Measurement is free; the *decision*
    is not.

### 12.5 The DBSP question — not a third regime, an orthogonal axis

The proposal was a third row: *non-monotone but invertible*, escaping coordination by exactness.
**It does not escape, and the reason is more useful than the escape would have been.**

Z-sets are explicitly non-monotone — `ZSet.fs:91` calls `(~-)` *"the abelian-group **inverse**"* and
retraction removes — so **CALM's necessity direction applies and DBSP is not coordination-free.**
But DBSP never claimed to be. Budiu et al. 2023 is a theorem about **incremental view maintenance**:
given an input *stream*, `Q^Δ` computes the output deltas exactly. **The agreed stream is a
hypothesis, not a conclusion.** So:

> **The two rows are orthogonal axes, not rungs of one ladder.**
> **CALM axis:** do I need coordination to *agree on the answer*? (monotone ⇒ no.)
> **DBSP axis:** given the input, do I need to *recompute from scratch*? (incremental ⇒ no.)
> **DBSP buys exactness without recomputation, not consistency without coordination.**

And the coordination it needs is already named in this repo, as a rule:
[`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
requires the shared fold to see **only agreed phase / logical order**. *That agreement is the
coordination.* It was never removed — it was factored out into an ordering assumption and written
down as a discipline. Honest engineering; simply not filed under "coordination".

**Corollary that splits the row.** δ-CRDT deltas (**Almeida, Shoker & Baquero**, arXiv:1603.01529 —
already cited in `src/Core/Crdt.fs`'s header) are **join-irreducible lattice elements**, so they are
monotone and re-delivery-safe, and belong in **row 1**. Z-set deltas are **group** elements and are
not. Measured (T4): re-applying a δ-CRDT delta leaves `{r1: 5}` unchanged; re-applying a Z-set delta
takes `8 → 13`. **Two things called "delta" with opposite re-delivery properties**, and `Crdt.fs`
cites the first while being layered on the second.

### 12.6 The corrected taxonomy

| regime | condition | coordination-free? | what it buys |
|---|---|---|---|
| **lattice — CvRDT / δ-CRDT** | monotone in a join-semilattice (≡ idempotent merge) | **yes**, by CALM's `iff` | consistency without coordination |
| **exact-delta — DBSP / Z-set** | non-monotone but **invertible** | **no** — presupposes an agreed logical order | exactness without **recomputation** (orthogonal axis) |
| **consensus — CASPaxos / Raft** | non-monotone, not invertible | no | agreement on a single value |

Rows 1 and 2 compose rather than compete — our CRDTs are *built on* Z-sets, which is exactly what
having two axes predicts.

### 12.7 Register and routing

| claim | register |
|---|---|
| `B ⊊ A`, strictly; the converse direction is empty (T1) | **theorem** (short, and now proved above) |
| every commutative monoid has a free CvRDT representation (T2); its cost is unbounded state (T3) | **theorem** + measured |
| CALM: monotone ⟺ coordination-free | **borrowed theorem** — Ameloot–Neven–Van den Bussche 2013. **Citation-check obligation, not a Soraya target.** Do not re-prove it |
| the applicable form is lattice-CALM (`Bloom^L`), and set-CALM gives the opposite verdict on counting | **checked-anchor finding** |
| idempotence ≡ monotonicity via `x ≤ y ⟺ x ⊔ y = y` | **theorem** (classical order theory) |
| converge ≠ act; only monotone statistics license irreversible action | **theorem** (CALM necessity) + measured (T6) |
| DBSP is an orthogonal axis, not a third coordination-free regime | **ours** — argued from Budiu et al.'s hypotheses and this repo's own ordering rule. The one statement here worth a precise treatment |
| `OrSet.Merge = ZSet.add` is not idempotent on the carrier (T5) | **flagged for audit, not a confirmed defect** — T5 models the F#, it does not run it |

**Soraya:** nothing new is routed. `081M0R34AZY087G0R001H9N6YS` **D5** carries T1–T3, which are
short and precise. CALM is a **citation check**, filed the same way as the Amari–Nagaoka results in
§3.5. The DBSP-axis claim is argued rather than proved and is registered as such.

**One in-tree contradiction, now documented on both sides.** `src/Core/Crdt.fs:9` calls Z-sets a
*"signed-multiset **join-semilattice** — commutative, associative, with an identity"*, while
`src/Core/ZSet.fs:73` says of the very same operator: *"**SUM, NOT idempotent** — `a + a` doubles
every weight (the Bag/Z-set step away from G-Set's idempotent union)."* **`ZSet.fs` is right.** The
files disagree, and §12 is the reason the disagreement matters: it is exactly the row-1/row-2
boundary.

---

## 13. VERIFICATION — Aaron's four-part claim, checked per lane

> Aaron: *"for us we **preserve uncertainty with Bayesian inference** for now, **we never collapse**,
> and we also have **ECC to correct missed messages with adinkras** and other ECC codes to **handle
> out-of-order −1s** too. Please **verify me correct — if not, we need to work towards this.** I've
> never said it this clearly."*

He invited falsification, so the negatives below are stated as plainly as the positives. **Two parts
are shipped and metered, one is true of one object and false of another, and one conflates two
layers.** Nothing here is a re-derivation: it is a read of the code at `cdc2227156`.

| claim | lane | verdict | register |
|---|---|---|---|
| preserve uncertainty, never collapse | belief fold | **true in the sense meant** — no argmax, distribution retained. But the retained object is a **summary**, not the evidence set; and the **candidate set is fixed** | **shipped**, with a scope correction |
| the belief lane is therefore monotone / coordination-free | belief fold | **refuted — and the tree already says so, in its own docstring** | **refuted** |
| −1 is more evidence, not removal | Z-set state | **false** — inverse, and zero entries are **pruned** | — |
| " | delta log + transport | **true** — append-only; `retractLoss` withdraws a loss report | **shipped** |
| adinkra ECC corrects missed messages | UDP transport | **true, implemented and measured** | **shipped / metered** |
| " | belief fold | **not wired.** The fold's loss/duplication guard is a caller-supplied dedup key | **aspirational** |
| out-of-order −1s handled | transport | **true** — `cause: "reorder"`, a re-attribution carrying the withdrawn belief | **shipped** |

### 13.1 "Never collapse" — true, and there is a second collapse worth naming

`src/Core/BeliefConvergence.fs` carries belief as an **unnormalized** `int64[]` over a candidate set
and updates by pointwise multiplication. There is no `argmax`, no thresholding, no hard decision:
normalization is described as a final step that *"does not change the relative distribution"*. **So
"we never collapse" is true in the sense Aaron means — uncertainty is carried as a distribution and
never resolved to a point.** Confirmed.

**Two honest riders.**

1. **The retained object is a summary, not the evidence set.** `observe` keeps the *product of
   likelihoods*. That is an exact sufficient statistic and a monoid homomorphism from the evidence
   multiset — which is the good case — but it is **not** the evidence set, and §13.2 is why that
   distinction decides the CALM question.
2. **The candidate set is fixed.** `Array.map2 (*) likelihood belief` requires equal lengths, so the
   support is frozen at construction: a hypothesis not present at the start can never be acquired,
   and one driven to weight `0` can never return (`0 × l = 0` absorbs). That is not collapse *of
   uncertainty*; it is **closure of the hypothesis space**, and for an open-world naming registry it
   is the binding limitation rather than a detail. Register: **shipped, closed-world.**

### 13.2 The monotonicity hypothesis is refuted — and `BeliefConvergence.fs` refutes it itself

The proposed reading was: *evidence accumulation is monotone in the evidence set even though the
posterior summary is not monotone in value, so "never collapse" puts the belief lane on CALM's
coordination-free side.* **That does not hold, and the file says why in its own docstring:**

> *"**NOT IDEMPOTENT — stated here because the omission reads as a guarantee.** Pointwise
> multiplication is commutative and associative, so this is a commutative MONOID, not a
> join-semilattice … Folding the same evidence twice moves the belief."*

and

> *"the evidence must be **DEDUPLICATED before it gets here** … redelivery double-counts … The dedup
> key must be supplied by the caller; the operator's algebra does not provide one, and no fold over
> a non-idempotent operator can."*

So the belief lane is a **commutative monoid, not a lattice** — structurally the *same* class as the
Z-set lane, not its opposite. **The prior that this claim is "true of the belief lane and false of
the Z-set lane" is wrong: both lanes sit in row 2 of §12.6**, and neither is coordination-free by
CALM. The monotone object (the evidence set) exists conceptually and **is not the thing retained**.

**And the tree already contains a sharper form of §12's T1, which I should have found before proving
it:**

> *"An idempotent group is trivial — `a + a = a ⇒ a = e` — so a single operator cannot be both
> redelivery-safe and retraction-capable. Auditable divergence lives in the Z-set delta log;
> redelivery-safety lives in the merge. **Two structures, forced by a one-line theorem, not by
> taste.**"* — `BeliefConvergence.fs`, found 2026-08-10 by two independently-dispatched reviewers.

§12's T1 separated a *monoid* `(ℕ,+)` from the semilattices. This separates the *group* case in one
line and is strictly stronger. **Recognition, not discovery** — recorded here per
`honor-those-that-came-before`, and §12.1 should be read as the weaker restatement it is.

### 13.3 The −1 — removal in the state, evidence in the log, evidence on the wire

Answered per lane rather than averaged, because the lanes genuinely differ.

| lane | what a −1 does | monotone? |
|---|---|---|
| **Z-set materialized state** | `(~-)` is *"the abelian-group **inverse**"*; `a + (−a) = Zero` and zero-weight entries are **pruned** (`ZSet.fs:75-89`). The fact is **removed and leaves no trace** | **no** |
| **Z-set delta log** | append-only; the +1 and the −1 both persist with their order | **yes** |
| **UDP transport** | `retractLoss` **withdraws** a loss report when the sequence number turns up late, carrying `cause: "reorder"` and *"the belief being withdrawn"* — the header calls it a **re-attribution** | **yes** |

> **So Aaron's reading — a −1 is more evidence, both kept, path recorded — is TRUE of the log and the
> wire, and FALSE of the materialized fold.** That is not a defect: it is precisely Data Vault's
> *single version of the facts, never a single version of the truth*, and
> `anti-babel-preserve-reconcilability`'s *"both branches held, each with its path recorded"*. The
> architecture already runs the both-held pattern — **in the log, not in the state** — and the two
> objects should not be described as one.

### 13.4 The ECC — shipped and metered at the transport, absent from the fold

**Shipped.** `src/Core.TypeScript/discovery/udp-lossy-transport.ts` implements the Adinkra `[8,4,4]`
extended Hamming code as a genuine erasure code: 4 data + 4 parity per block
(`computeAdinkraParity`), recovery via `recoverAdinkraBlock` / `recoverAdinkraErasure`, **any 3
erasures per block of 8 recoverable**, and **56 of the 70 four-erasure patterns** recover — *"the 14
that do not are exactly the weight-4 codeword supports"*. Chaos-tested (`UCH-13 / UCH-13b / UCH-23`).
On the F# side `AdinkraCode` carries `syndrome`, `isCodeword` and `correct` (≤ 1 bit, `None` if
uncorrectable). **This is real, and it is metered.**

**Order-independence holds where it is claimed.** Erasure decoding for a linear code depends on the
**set** of surviving positions, not their arrival order — and the file characterises recoverability
by exactly that set (which erasure *patterns* recover). Decode commutativity: confirmed, **within a
block of 8**. There is no cross-block ECC.

**Honest measured caveat, from the file's own table.** At low loss the ECC **loses** to plain
retransmit — *"the reason is rate, not capability: at low loss goodput → rate, and 7/8 > 4/8 by
construction, so no decoder can close that gap"* — with a measured crossover. "ECC corrects missed
messages" is true and is not free.

**The gap, and it is the part of the claim that does not hold.** The ECC is **not wired into the
belief fold**. `BeliefConvergence.fs` references `AdinkraCode` only for the **Hadamard/MacWilliams
duality** — a mathematical bridge between `SoftValue.combine` and the code's weight enumerator, not
error correction. The fold's protection against loss and duplication is the **caller-supplied dedup
key**, which the file explicitly says the algebra cannot provide.

> **The claim couples two layers that are not coupled.** Transport ECC protects *packets*; nothing
> protects the *fold*. A packet recovered by the code is then folded by a non-idempotent operator,
> so a duplicate that the ECC did not cause is still double-counted. **Register: transport ECC
> shipped/metered; belief-fold ECC aspirational.**

### 13.5 The smallest step toward the aspirational part — and it falls out of §12

Aaron asked for the roadmap if the answer was no. The tree's own one-line theorem (§13.2) says the
fix **cannot** be a better operator: `observe` cannot be made idempotent while remaining
retraction-capable. So the step is not to change the operator but to **change what is folded**:

> **Put a G-Set of uniquely-tagged evidence in front of the fold.** Merge evidence by **set union**
> — idempotent, commutative, associative, therefore monotone, therefore **coordination-free by
> CALM** — and fold the resulting *set* into the belief. This is exactly §12's T2 free construction,
> and exactly the `OrSet` pattern already in `src/Core/Crdt.fs`.

What it buys, all four at once:

- **redelivery safety** — union is idempotent, so the dedup key stops being a caller obligation and
  becomes a structural property;
- **order independence** — already proved for `observe`, and now for intake too;
- **out-of-order −1s as evidence** — a retraction becomes a *new tagged element*, not a removal, so
  the monotone reading of §13.3 becomes true of the belief lane as well;
- **the monotone object is finally the retained object**, which is what would put the belief lane on
  CALM's coordination-free side — the thing §13.2 found is currently not the case.

**The cost is exactly the one §12 T3 measured**: state grows with evidence count (`O(#evidence)`
rather than `O(#candidates)`). That is presumably why it has not been done, and it makes §12's
**compression** question — when does a tagged-op G-Set compress to a bounded summary, as the
G-Counter does — the load-bearing open problem rather than a curiosity. **The chain closes: the
answer to Aaron's ECC gap is the same question as the answer to his CRDT question.**

Filed as `081M0R5E1ZG087G0R001RVAQVR`. **Register corrected in §14.1 from `aspirational` to
`partial`:** `SoftValue.foldRetained` already implements exactly this construction; the gap is that
`BeliefConvergence` does not adopt it. Adoption, not invention.

*Smallest shippable slice:* an `EvidenceSet` wrapper carrying `(tag, likelihood)` with union-merge
and a `fold` into `BeliefConvergence.observeAll`, plus a falsifier that the same tagged evidence
delivered twice leaves the belief unchanged — which is a test that **fails today** and is the
honest measure of the gap.

### 13.6 The rule interaction, checked

`.claude/rules/local-time-never-enters-the-shared-fold.md` requires the shared fold to see *"the
evidence set, phase-ordered"*. **`observeAll` cites that rule by name in its own docstring and
carries the invariant** — so the rule and the claim are the same commitment stated twice, and to
that extent they corroborate. But the rule's *"evidence set"* is, in the shipped code, a `list` the
caller must have deduplicated; the file says so and pins the negative in tests. **So the rule is
shipped as to ordering and time, and depends on an unenforced caller obligation as to multiplicity.**
That is worth surfacing on its own: the invariant that IS enforced is about *which order*, and the
one that is NOT is about *how many times*.

---

## 14. ADVERSARIAL — Aaron's widening/collapse framing, attacked rather than confirmed

> Aaron: *"widening is a **specialization over the retraction −1**… **widening reduces precision
> while the key stays in the set** — this is the non-collapse. **A full key retraction would be the
> uncertainty collapse.**"* And then: *"this is **my interpretation** — make sure it's **verified
> adversarially** too by the math team."*

Attacked, not confirmed. **One link holds, one survived a serious attempt to break it, and two are
refuted — including the load-bearing one.** Numbers from
`docs/research/scripts/2026-08-23-geometry-as-root-widening-as-retraction-verify.py` (`ALL PASS`,
exit 0; the "pass" is that each check reached its stated conclusion, several of which are negative).

| link | verdict | register |
|---|---|---|
| widening **is** a restricted retraction | **holds — and is already shipped as the load-bearing operator** | `theorem`-shaped, **implemented** |
| `SoftValue.widen` is support-preserving | **attacked and survived**, structurally | `theorem` |
| **collapse = a key leaving the support** | **refuted as a formalisation** — it is a *fourth* meaning that **inverts the shipped labels** | **`coinage-not-discovery`** |
| never-collapse "as written in the rules and manifesto" | **there is no such text** | **`ill-posed`** |
| support-monotonicity ⇒ CALM coordination-free | **refuted** — support constant while a confidence query flips | **`refuted`** |

### 14.1 What holds: widening really is a restricted retraction, and it is already the load-bearing operator

`src/Core/SoftValue.fs` contains a section literally headed **"(B) Widening as RETRACTION — the
commutative route"**, written 2026-08-23 from Aaron's own earlier framing (*"our zsets −1 should be
able to retract stale priors"*). The mechanism is a retention **multiplicity**: evidence enters the
fold as `Lᵐ`, and — the file's words — *"dropping `m` from `k` to `0` is literally the `-1`
retraction."* Widening is lowering `m`. **The specialization is not a proposal; it is in the tree.**

And it commutes. Measured: over all **24** permutations of a 4-element evidence set the belief is
identical to `5.6e-17`, with a stale item fully retracted (`m = 0`) and its removal a no-op. The
file's own reason is the right one: *"it changes the evidence SET rather than reading the belief."*

**Correction to my §13.5.** I called an evidence-set intake "the smallest step" and registered it
**aspirational**. That was wrong: it is **built**, in `SoftValue.foldRetained`. The gap is narrower
and cheaper than I said — `BeliefConvergence.observeAll` folds a *list* with caller-supplied dedup
while `SoftValue` folds a retained *set* with recorded retractions. **Adoption, not invention.**
Work-item `081M0R5E1ZG087G0R001RVAQVR` amended.

### 14.2 What survived attack: `widen` cannot remove a key

The predicted failure was underflow into `WeightedSet`'s zero-pruning. It is *nearly* reachable —
`5e-324 × 0.001` **is** exactly `0.0` — and it is nonetheless **unreachable**, for a structural
reason rather than a lucky one:

- a **minimal** key has `v = t·u` exactly, so its post-widen mass is exactly `λ·u = λ/n`;
- driving `λ/n` to zero needs `λ ≲ 2.5e-321` (at `n = 1000`);
- but the guard `if t >= lambda then sv` returns early unless `t < λ`, i.e. `n·min(p) < λ`, which
  forces `min(p)` below the smallest denormal — so the key was already gone.

**The two conditions are mutually exclusive.** Checked at `λ ∈ {5e-324, 1e-320, 1e-310, 1e-8}` on a
1000-candidate belief spanning 300 decades: **zero keys lost every time.** `widen` is
support-preserving, and the floor formulation (idempotent, not an increment) is what buys it.

**But the composite claim is still false**, because `foldRetained` calls `observe` internally, and
`observe` *does* lose keys (§14.4). "Widening preserves support" is true of `widen` in isolation and
**false of any fold that contains an observation** — which is every real fold.

### 14.3 REFUTED: "collapse = a key leaving the support" inverts the shipped meaning

This is the sharpest negative, and it is not a quibble about words. **`SoftValue.fs` already uses
"collapse", consistently, and it means something else:**

| line | text | meaning |
|---|---|---|
| 7 | *"`resolve` **collapses to a definite value** ONLY when confidence ≥ a threshold"* | the soft→hard **read** |
| 115 | *"superposition carried through, **never collapsed early**"* | don't snap early |
| 138 | *"Terminal decision (**the ONE legitimate collapse**)"* | `resolve` |
| 170–171 | *"A **snap policy**: the soft → hard decision. **Collapse** a soft value to a definite `DynamicValue`… the *only* sanctioned exit"* | `snap` |
| 183 | *"always **collapse** to the most-likely candidate (argmax)"* | argmax |

**Collapse, in the shipped code, is the distribution → point map. It is a READ, and it does not
change the support at all** — `resolve` and `snap` return `DynamicValue option` and leave the
`SoftValue` untouched.

Now apply the two definitions to the same two operations:

| operation | `SoftValue.fs`'s meaning | Aaron's proposed meaning |
|---|---|---|
| `resolve` / `snap` (argmax, threshold) | **IS** collapse — "the ONE legitimate collapse" | **NOT** a collapse (support unchanged) |
| `observe` refuting a candidate to zero | **not** called collapse — "that candidate refuted" | **IS** a collapse |

> **They classify the same two operations oppositely.** So the support definition is not a
> formalisation of the existing principle — it is a **fourth meaning of the word** (after value-axis
> snap, ensemble collapse in `YinYangEnsemble.reseedIfCollapsed`, and society-axis `ρ → 1`), and one
> that **inverts** the labels the shipped file uses.

That is `numerology-vs-number-theory` applied to vocabulary: a resonance between two uses of one
word, promoted to an identity without checking the invariants. **The definition may still be
useful** — support-monotonicity is a real property worth checking — but it must be introduced as a
**new named term**, never as "what never-collapse always meant". A reinterpretation presented as a
formalisation is how a principle changes meaning with nobody deciding to change it.

### 14.4 ILL-POSED: there is no never-collapse text in the manifesto or the rules

I was asked to check the principle "as written in the rules and manifesto". **It is not written
there.** `git grep -in "never collapse\|never-collapse\|non-collapse"` over `docs/governance/`,
`docs/VISION.md` and `.claude/rules/` returns **zero hits** at `cdc2227156`.

The principle exists only in `SoftValue.fs`'s docstrings — *"Composes `DynamicValue` + the
never-collapse discipline"* — where it means the **snap discipline**: never assert certainty you do
not have. So both the framing I was handed and my own §13 treated a governance-level commitment as
existing text. It does not. **Register: `ill-posed` as stated; the honest question is "what does
`SoftValue.fs` mean by it", and the answer is the snap discipline, not support.**

### 14.5 REFUTED, and this is the load-bearing one: support-monotonicity does not give CALM

The chain's final claim was *"the belief lane is coordination-free exactly as long as no operation
prunes a key."* **False.** Measured, with the support held constant throughout:

| step | `P(a)` | query `P(a) ≥ 0.5` | support |
|---|---|---|---|
| 1 | 0.7500 | **true** | `a b c d` |
| 2 | 0.4500 | **false** | `a b c d` |
| 3 | 0.0978 | false | `a b c d` |

**The support never changes and the query flips `true → false`.** CALM's monotonicity is a property
of the *query*, not of the carrier's support, so a query reading **confidence** is non-monotone
however well the support is preserved. Support-monotonicity is **necessary at best and nowhere near
sufficient** — it is the same finding as §12.4's converge-vs-act, reached from the other side.

**So the chain breaks at exactly the link that was carrying it.** Widening being support-preserving
does *not* put the belief lane on CALM's coordination-free side, and no amount of guarding the
pruning will make it so.

### 14.6 The two real defects the attack turned up anyway

Attacking the framing was still worth it, because it found things the confirmation would have missed:

1. **`observe` collapses the support intentionally.** `w * max 0.0 (likelihood d)` clamps a
   non-positive likelihood to zero, and `build → WeightedSet.ofSeq` prunes it. The docstring says
   *"that candidate refuted"*. Deliberate, documented — and under any support-based reading it is a
   collapse.
2. **`observe` collapses the support SILENTLY, by float underflow.** With a likelihood of `0.1` for
   one candidate — merely unlikely, **never zero, never refuted** — the candidate leaves the support
   after **324** observations. Nobody asked for that collapse.
   > **The defect is not that a hopeless candidate dies. It is that *when* it dies is a function of
   > float rounding**, so two oracles with different float paths prune at different steps, hold
   > different supports, and **diverge** — which breaks the four-oracle byte-lock. Filed as
   > `081M0R5R1JN087G0R0031FT1C2`. The fix is not to remove pruning (canonical form needs it) but to
   > distinguish *refuted* from *underflowed*.

### 14.7 Net

**Never-collapse remains a principle without a mechanical check at the value axis.** That is the
honest outcome, and it is a real finding rather than a failure to produce one: the check that was
proposed measures something true and different, contradicts the shipped vocabulary, and would not
have delivered the CALM property it was wanted for.

What *is* now available, and worth having on its own terms:

- a **support-monotonicity falsifier** — `support(fold(E ∪ {e})) ⊇ support(fold(E))` — which **fails
  today** on both paths in §14.6, and would pin the underflow defect;
- the confirmed identity **widening ≡ multiplicity reduction ≡ the `−1`**, already shipped;
- and the standing correction that the coordination-free property comes from **folding a retained
  evidence set**, not from any property of widening.

**Anchor, checked.** The widening lineage is abstract interpretation — **Cousot & Cousot, POPL 1977**
— where a widening operator `∇` is required to be **inflationary** (`x ⊑ x ∇ y`) and is famously
**not required to be monotone**; that is precisely why *narrowing* exists as a separate operator, and
precisely the distinction §14.5 turns on. In-tree ferry:
`docs/research/ip-questionable/2026-06-07-sparta-abstract-interpretation-patricia-trees-fixpoint-widening-meta-redex-verbatim-transcript-aaron-forwarded.md`.
**Honest limit on provenance:** I cannot confirm that ferry is the specific video Aaron means; it is
the widening ferry in the tree, and the mathematical anchor carries the claim either way. No
expression from any source is reproduced here (`cleanroom-two-team-separation`).

**One vacuity instance of my own, recorded rather than quietly fixed.** The first draft of the
`widen`-does-not-commute witness used `λ = 0.5`, at which `widen` is a **no-op in both orders** — so
the check passed while testing nothing, and reported "diverges = False" as if it were a result. It
is the vacuity class, produced by the same hand that has been auditing for it all day. Caught by
running the falsifier rather than by reading it.

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
- `docs/research/scripts/2026-08-23-geometry-as-root-bregman-coarsening-verify.py` — every number in §10.
- `docs/research/scripts/2026-08-23-geometry-as-root-extensive-crdt-verify.py` — every number in §11.
- `docs/research/scripts/2026-08-23-geometry-as-root-pushforward-vs-crdt-verify.py` — every number in §12.
- `docs/research/scripts/2026-08-23-geometry-as-root-widening-as-retraction-verify.py` — every number in §14.
- `src/Core/SoftValue.fs` — §14's subject: `widen` (route A), `foldRetained` (route B), and the shipped meaning of "collapse".
- `src/Core/Crdt.fs` — §11.2's witness (merge is `max`, read is `Σ`) and its doc-comment defect.
- `src/Core/BeliefConvergence.fs` — §13's subject, and the source of the one-line theorem §12.1 restates more weakly.
- `src/Core.TypeScript/discovery/udp-lossy-transport.ts` — the shipped, metered Adinkra [8,4,4] erasure code (§13.4).
- `.claude/rules/numerology-vs-number-theory.md` — why §4.3's table is invariants, not counts.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §3.5 and §7.1 exist.
