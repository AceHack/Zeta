# WSet carries the BNN and the factor graph — and the texel is a residual program nobody generated

**Measured at `origin/main` `36c2ff5594a466c105799297e6b1fd65be1be8e4`.** Every number below came from a probe run this pass,
each with a **sabotage control** that had to go red before the result was allowed to count. Every
"absent" came from a search whose scope is named.

**Register (`toy-is-free-metered-must-be-earned.md`):**

- §1 the two carrier fits — **metered** (probes C, D; controls pass).
- §2 `ngFuse` is the residual program of `WeightedSet.add` — **metered** (probe A, bit-identical, control passes).
- §3 the Futamura staging — **unmetered**; the specialiser exists and the GPU arm does not. Stated as a gap, not a result.
- §4 the doubling-transfer table — **metered as algebra** (probe B), **unmetered as a claim about Bayesian meaning** (§4.3 is the limit).
- Everything under "what this unblocks" is **proposed**.

> Aaron, 2026-08-24: *"on our soft regime we are trying to make our BNNs and factor graphs
> representable in WSet tensors even if they are specialized — like for GPU textures the spec is in
> WSets. This is another Futamura, then, with a lot of recent work on a spec language that can
> auto-specialize to hardware instructions."*

## 0. The answer in seven lines

| question | answer | where |
|---|---|---|
| Does `WSet` carry a BNN? | **Yes, exactly.** `IMessage<'M>` = {Uniform, Product, Divide} is *precisely* the additive commutative group of `WeightedSet<'K,'W>`. The keys are the sufficient-statistic index, never the sample space | §1.1 |
| Does it carry a factor graph? | **Yes — and there are two different fits, not one.** The EP/natural-parameter graph consumes only ⊕; the discrete sum-product graph consumes ⊕ *and* ⊗ | §1.1, §1.2 |
| Did the shipped graph actually run over it? | **Yes. Bit-identical marginals** over 5 000 random graphs × 4 BP rounds, against the Gaussian instance | §1.1 |
| Is the GPU texel *derived from* the spec? | **No — but it is bit-identical to what derivation would emit.** `ngFuse` == `WeightedSet.add` at `\|'K\|=4`, exactly, over 20 000 pairs. It is a **residual program that no specialiser produced** | §2 |
| Is 4 = RGBA = NG4 numerology? | **No**, and the arena doc already settled it on sufficiency + closure + operation-match. This pass adds a fourth invariant it did not have: **derivability** | §2.2 |
| Where is the Futamura staging? | Stage 1 and stage 3 exist and are machine-checked (`Residual.Target`, `MixCogen.cogen`). **The texture is a missing third residual target. Today the specialiser for it is a human** | §3 |
| Which operations survive a doubling? | **⊕ survives every rung** (ℝ→ℂ→ℍ→𝕆→𝕊). ⊗-order dies at ℍ, ⊗-associativity at 𝕆, normalisation at 𝕊, ordering at ℂ | §4 |

---

## 1. Does `WSet` carry these? Yes — and the first correction is that there are two carriers

Before anything else, a naming fact that the question's phrasing hides. **"WSet" is two types in this
tree**, and they are not interchangeable:

| type | file | shape | weight constraint | the ops it exposes |
|---|---|---|---|---|
| `WSet<'K,'W>` | `src/Core/WSet.fs` | unconsolidated `('K * 'W) list` | `IStarRing<'W>` | `apply`, `tensor`, `consolidate`, `copy`, `discard`, `negate`, `bornProb` |
| `WeightedSet<'K,'W>` | `src/Core/WeightedSet.fs` | canonical `Map<'K,'W>`, Zero-pruned | `ISemiring<'W>` / `IRing<'W>` | `add`, `subtract`, `negate`, `scale`, `inner`, `ITensor` |

`WeightedSet` is the one that implements `ITensor<'K,'W>` — so "universal tensor" **has a referent in
the tree**, and it is not the `WSet.fs` one. The two fits below land on different carriers, which is
the first honest answer to "does it fit": *it fits, but not on one type.*

### 1.1 The BNN / EP message algebra IS the additive group of `WeightedSet` — measured, not resembled

`src/Bayesian/Message.fs:55` defines the entire interface a message must satisfy:

```fsharp
type IMessage<'M> =
    abstract Uniform : 'M
    abstract Product : 'M * 'M -> 'M
    abstract Divide  : 'M * 'M -> 'M
```

Three members. Written additively they are `empty`, `add`, `subtract` — **an abelian group, and
nothing more.** `src/Core/WeightedSet.fs` supplies exactly those three (`empty`, `add`, `subtract`),
with `Zero`-pruning in `setW` making `empty` a genuine identity rather than a conventional one.

So the required key and weight types are:

> **`'K` = the sufficient-statistic index of the exponential family. `'W` = the natural-parameter
> field.** Gaussian: `'K = {ν, τ}`, `|'K| = 2`. Normal-Gamma: `'K = {h1..h4}`, `|'K| = 4`.

That the *fusion law* matches was already measured by the 2026-08-23 discretisation doc (an injective
monoid homomorphism over 20 000 pairs). **What was not measured is whether the shipped graph
algorithm runs on it**, and a law-level match does not imply that — `FactorGraph.passOnce` could
depend on its message type in ways `IMessage` does not name.

Probe C replicates `src/Bayesian/FactorGraph.fs` operation-for-operation (`prior`, `equality`,
`factorsOf`, `productFrom`, `varToFactor`, `passOnce`, `marginal`) and instantiates it twice:

```
C  FactorGraph marginals: Gaussian vs WeightedSet<NatCoord,float>
C  max abs diff = 0.000e+0 over 5000 random 3-variable graphs x 4 BP rounds
C  verdict: BIT-IDENTICAL — the graph runs over WeightedSet unchanged
C' sabotage control (non-identity uniform): max abs diff = 4.000e-3 — PROBE CAN FAIL (control passes)
```

Bit-identical, not merely close — because both instances perform the *same float additions in the
same order*; only the container differs. The control perturbs `uniform` away from the identity and
the probe goes red, so the zero is a result and not a tautology.

**The fit is honest.** It is honest specifically because it is *narrow*: the factor graph never
touches ⊗. It folds `Product` over neighbours and that is all. A carrier supplying only an abelian
group is therefore not an impoverished factor graph — it is an exact one.

### 1.2 The discrete sum-product graph needs ⊗ — and that is `WSet`'s existing ops, unchanged

The other factor graph — discrete tables, the Aji–McEliece GDL form that `WSet.fs`'s header cites —
needs two operations the natural-parameter form does not: a factor **product** (⊗) and a
**marginalisation** (⊕ over one axis). Probe D checks whether those are already present rather than
needing new code, using the shipped `tensorWSet` and `consolidateWSet` from
`src/Core.TypeScript/algebra/wset.ts`:

```
D  sum-product marginalisation == tensor -> mapKeys -> consolidate
D  max abs diff = 8.882e-16 over 3000 random 3x3 factor pairs
D  verdict: HOLDS — marginalisation is already WSet's consolidate
D' sabotage control (marginalise wrong axis): max abs diff = 1.584e+0 — PROBE CAN FAIL (control passes)
```

So the sum-product rule decomposes into three ops that already exist:

> **factor product = `tensor`** · **project the axis = `mapKeys`** · **sum the fibres = `consolidate`**

`consolidate` is doing double duty here, and the coincidence is not one: summing weights that
collide on a key is *the same act* whether you call it Z-set consolidation or Bayesian
marginalisation. The 8.88e-16 is float reassociation (a different summation order), not a model gap.

**One defect surfaced while writing the probe, and it is already filed.** `consolidateWSet` in the
TypeScript oracle does **not** sort by key, while the F# `WSet.consolidate` ends in `List.sortBy fst`
— so the probe had to sort itself. That is open workitem `081M05ZZG6A087G0R001PBBKDX`, and its
sibling `081M060AYN9087G0R0006E6FWZ` records that the F# sort is UTF-16 code-unit order rather than
the canonical UTF-8 byte order. Both bear directly on this lane: a marginalisation whose output order
differs across oracles cannot be byte-locked.

### 1.3 Where the fit is forced — five limits, stated before anyone builds

1. **Two carriers, not one.** §1's opening table. A design that says "put it in WSet" has not yet
   said which type, and they have different weight constraints (`IStarRing` vs `ISemiring`).
2. **The properness half-space is not in the carrier.** `WeightedSet<NatCoord,ℝ>` is all of ℝ²;
   proper Gaussians are `τ > 0`. This is *deliberate* — EP cavities are improper by design (Minka
   2001) — but it means `Gaussian.isProper` must ride alongside, never inside.
3. **The type does not carry the interpretation.** A `WeightedSet<string,float>` over grid points and
   one over natural coordinates have the same type; adding them typechecks and means nothing. Stated
   in the 2026-08-23 doc and it needs restating every time the word "universal" appears.
4. **Float weights cannot legally reach shared state.** `src/Core/WireWeight.fs` has no
   `WireWeight<float>` and the constructor is `internal`. A BNN posterior in this encoding is
   **local-only by construction**. That is correct (float addition is not associative, so two nodes
   folding in different orders diverge) and it puts the exact-weight question on this lane's
   critical path.
5. **`Sppf.fs` is hardcoded `float`.** The parse layer — the other thing that wants to be a
   `WeightedSet` — has no `ISemiring` parameter at all. The citation is in the substrate; the parser
   has never read it.

---

## 2. Is the GPU texel *derived* from the spec, or merely consistent with it?

This is the clause Aaron's question turns on, and it deserves a sharper answer than yes or no.

### 2.1 The measurement: `ngFuse` is bit-identical to `WeightedSet.add` at `|'K| = 4`

`src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.ts` defines the conjugate update as four
hand-written additions over four named fields:

```ts
export const ngFuse = (a: NormalGammaNp, b: NormalGammaNp): NormalGammaNp => ({
  h1: a.h1 + b.h1, h2: a.h2 + b.h2, h3: a.h3 + b.h3, h4: a.h4 + b.h4,
});
```

Probe A imports **that shipped function** and compares it against a generic `WeightedSet.add`
(mirroring `WeightedSet.fs`, Zero-pruning included) specialised to the four-element key set:

```
A  ngFuse == WeightedSet.add over |K|=4 : max abs diff = 0.000e+0 over 20000 pairs
A  verdict: BIT-IDENTICAL — ngFuse IS the residual program
A' sabotage control (weight x1.0000001): max abs diff = 4.564e-5 — PROBE CAN FAIL (control passes)
B  h(uniform) size = 0 (expect 0 = WeightedSet.empty)
```

**So the answer is a third thing, and it is the useful one.** The texel form is not "merely
consistent" — it is *exactly what a first Futamura projection of `WeightedSet.add` against the static
key set `{h1,h2,h3,h4}` would emit*: the loop over keys unrolled, the map lookups resolved to field
offsets, the Zero-prune branch eliminated as statically dead. That is textbook residualisation.

And it is not derived. **No specialiser ran. A person wrote the output by hand.**

> **The finding: this repo has a residual program with no projection behind it.** That is a strictly
> better position than "a second implementation wearing a spec's name" — the specialised form is
> *provably* the right one, today, by measurement. It is a strictly worse position than a Futamura
> staging, because **the guarantee is a fact about the current bytes, not a property of the pipeline.**
> Change `WeightedSet.add` — add a compensated-summation path, change the pruning predicate, widen
> the weight — and `ngFuse` does not move. Nothing would report it. The drift Aaron is worried about
> is not present; it is *unguarded*.

The cheapest thing that converts this from a fact to a property is not a specialiser at all. It is
**probe A promoted to a test**: assert that the hand-written `ngFuse` equals the generic op at
`|'K|=4`. That is a one-file change and it makes divergence loud.

### 2.2 The numerology question — already settled, and this adds a fourth invariant

`docs/research/2026-08-23-otto-arena-bnn-exact-gpu-mapping-*.md` §6 already ran
`numerology-vs-number-theory` on `dim T(NormalGamma) = 4 = RGBA channels` and cleared it on three
invariants: **sufficiency** (the four numbers are the *full* sufficient statistic, so a 4-dim
projection of a 6-dim statistic would "fit" and be wrong), **closure** (texel + texel is a valid
texel), and **operation match** (the hardware op *is* the update, KL 4.0e-8 being float error).
Crucially it **excludes**: a full 2-D Gaussian with covariance has `dim T = 5` and does not fit.
That is an identification, not a fit, and I am not re-litigating it.

What this pass adds is a fourth invariant the count could not have supplied:

> **4. Derivability.** The four-channel form is not merely *the same size* as the spec — it is the
> spec's `add` with the key set specialised away, bit-identically (§2.1). A coincidence of counts
> cannot produce a bit-identical residual program; only a shared operation can.

The honest counterweight, which keeps this out of the "too many correlations" trap: **RGBA's 4 is
doing no work in the derivation.** `|'K| = 4` comes from Normal-Gamma's sufficient statistic; the
texel's 4 comes from a 1970s framebuffer. They meet, and the meeting is genuinely convenient, but the
*derivation* would be identical if the family had `|'K| = 3` and we used RGB. The structural claim is
`ngFuse ≡ WeightedSet.add ∘ specialise`; the RGBA fit is a **packing** result that rides on it. Those
are two claims and only the first is load-bearing.

---

## 3. Where is the Futamura staging? Two of three stages exist and are machine-checked

The most surprising thing this survey found is that Aaron's "this is another Futamura" is **not
aspirational** — the machinery is built, proven, and pointed at a different target.

**What exists, in code, with laws:**

- `src/Core/Isa.fs` / `IsaSpec.fs` — the ISA **as data**. 893 lines; `evalSpec` interprets *any*
  instruction set given its spec, proven equal to the hand-written interpreter differentially.
  This is the "spec language that can auto-specialize to hardware instructions" Aaron remembers.
- `src/Core/Residual.fs` — **the residual-target knob**, and this is the load-bearing one:

  ```fsharp
  type Target =
      | Code      // instructions run by Isa.eval
      | Circuit   // a synthesized gate CPU (CpuSynth), run as clocked gates
  ```

  with the stated law `run (emit p regs Code) = run (emit p regs Circuit) = Isa.eval p regs` —
  *"the residual target is a free choice of medium; the specialized program's semantics are
  invariant under it."*
- `src/Core/MixCogen.fs` / `Cogen.fs` — the 2nd and 3rd projections, with the `cogen` fixpoint
  proven to exact `DynamicValue` equality.

**So the three stages, named concretely as asked:**

| stage | what it should be | what it is today |
|---|---|---|
| **1. Spec** | `WeightedSet<'K,'W>` + the semiring/ring instance + the key set | **exists** — `src/Core/WeightedSet.fs`, `ITensor<'K,'W>` |
| **2. Specialiser** | `mix(WeightedSet.add, staticKeySet)` → a residual program | **the machinery exists** (`Residual.emit`, `MixCogen.cogen`) but has **never been pointed at `WeightedSet`**; it specialises `Isa` programs |
| **3. Hardware instructions** | a `Texture` residual target emitting the blend-state + layout | **absent** — `Target` has two cases, and there are **zero** `.wgsl`/`.glsl`/`.frag`/`.comp` files in the tree (measured) |

**Said plainly, as asked:** the specialiser for the texture path is currently **a human writing a
codec by hand**. `toy-bnn-rgba-codec.ts` contains no reference to `WSet`, `WeightedSet`, `ISemiring`
or any ring — I grepped it; the count is zero. And the GPU side is not even that: every GPU row in
the arena doc's mapping table is labelled `[proposed]`, and there is no shader in the repo to be
inconsistent with. **A Futamura projection with a human in the middle is a design intent, not a
projection**, and this one has a human in the middle.

The gap is smaller than it sounds, though, and worth stating because it is actionable: `Target` is a
two-case DU behind one `emit` function with a meaning-invariance law already written down. **The
texture target is a third case of an existing knob**, not a new subsystem. The honest sequencing is
(a) promote probe A to a test so the hand-written form cannot drift; (b) point `Residual` at
`WeightedSet` for the `Code` target first, where the law is already proven, before anything touches
a GPU.

---

## 4. The transfer question — which operations survive a Cayley–Dickson doubling

Aaron's claim: if BNN and factor-graph operations are expressed over `WSet`, then which survive a
doubling is **derivable from the properties each operation consumes**. That claim is correct, and the
derivation is short enough to be exhaustive.

### 4.1 The measurement

Probe B implements Cayley–Dickson doubling directly (`(a,b)(c,d) = (ac − d*b, da + bc*)`) and tests
each law at each rung, 4 000 random pairs per cell, tolerance 1e-9:

```
operation                                   law consumed              R(1)   C(2)   H(4)   O(8)   S(16)
------------------------------------------------------------------------------------------------------
WeightedSet.add (BP/EP Product = fusion)    Add comm + assoc          hold   hold   hold   hold   hold
WeightedSet.subtract (EP cavity a+(-a)=0)   Add group inverse         hold   hold   hold   hold   hold
scale-CHAIN / inner (factor product)        Mul ASSOCIATIVE           hold   hold   hold  1.1e0  3.8e0
order-free factor product (fold)            Mul COMMUTATIVE           hold   hold  9.1e-1 1.8e0  3.0e0
Born / renormalise |w|                      norm MULTIPLICATIVE       hold   hold   hold   hold  6.4e-1
alternativity (aa)b = a(ab)                 Mul ALTERNATIVE           hold   hold   hold   hold  1.3e0

zero divisors:  S(16)  YES — (e1+e10)(e5+e14) = 0  (norm 0.0e+0)
total order:    R yes; C and above no (no order compatible with the field ops)
```

This reproduces the classical ladder exactly (ℂ loses order, ℍ commutativity, 𝕆 associativity while
keeping alternativity and a multiplicative norm as the last composition algebra, 𝕊 loses alternativity
and gains zero divisors) — which is the point: **the probe is calibrated against a known answer**, so
its verdicts on *our* operations are trustworthy.

It also independently reproduces what `tests/Tests.FSharp/CayleyWeightedSet.Tests.fs` already
asserts in-repo — that `WeightedSet`'s add-side is sound at every rung while scale-chains are
order-sensitive above ℍ. That file's comment states the boundary; this measures it from the algebra
side, and the two agree.

### 4.2 The transfer argument, stated as a derivation

> **Which operations consume commutativity or associativity of ⊗?**
>
> - **None of the BNN's.** `IMessage` is `{Uniform, Product, Divide}` = `{empty, add, subtract}`.
>   Every one of them consumes only the **additive commutative group**, which every Cayley–Dickson
>   algebra has at every rung, forever. **The entire EP/BP message algebra transfers to sedenions
>   and beyond, unchanged.** Conjugate fusion, the EP cavity, the flat-message identity, retraction —
>   all of it.
> - **The discrete sum-product graph consumes both.** Its factor product is a fold of ⊗ over
>   neighbours, so it needs **Mul commutative** (the fold's order is the graph's adjacency order,
>   which carries no canonical orientation) — **dies at ℍ** — and **Mul associative** for
>   contraction chains — **dies at 𝕆**.
> - **Viterbi / max-product / tropical consumes a total order** — **dies at ℂ**, the very first rung.
>   So does any threshold test, including `HeavyTailFold`'s `ψ(z) = z(ν+1)/(ν+z²)` redescending
>   influence, which is a statement about `|z|` growing.
> - **Normalisation (`bornProb`, any belief renormalise) consumes a multiplicative norm** —
>   survives to 𝕆 (Hurwitz: ℝ, ℂ, ℍ, 𝕆 are the only composition algebras) and **dies at 𝕊**.
> - **`consolidate`'s Zero-pruning consumes the absence of zero divisors** on the ⊗ side —
>   **dies at 𝕊**, where a product of two nonzero weights can vanish and be pruned as if it had
>   cancelled.

**This is decidable in a way ML transfer is not**, and that is the whole value of the framing. "Will
this network transfer to that domain" is an empirical question answered by running it. "Will this
operation survive this doubling" is answered by reading which law it consumes off the type signature.
The operations that survive are exactly the ones written with `Add` and no `Mul`.

**The design consequence, and it inverts the obvious intuition:** the *most* transferable part of the
soft regime is the part that looks least like tensor algebra. Natural-parameter fusion — two float
adds — carries to every rung. The rich-looking ⊗ machinery is the fragile part.

### 4.3 The honest limit — algebraic survival is not Bayesian meaning

This is the sentence that keeps §4 out of the overclaim class, and it must be said before anyone
builds on the table.

**Surviving is necessary, not sufficient.** That `add` remains a commutative group over sedenions
tells you the *fold* is well-defined. It does not tell you the result is a **posterior**. An
exponential family needs `p(x|η) = h(x)·exp(η·T(x) − A(η))` to be a **real, normalisable density**:
`η·T(x)` must land in ℝ, and `A(η)` must be a real convex log-partition function. Over a
Cayley–Dickson algebra above ℝ, `η·T(x)` is algebra-valued and neither is automatic.

Where the ceiling actually sits, and this is the interesting part: the row that decides it is
**normalisation**, not associativity. A multiplicative norm gives you a real-valued map back to ℝ to
build a density from — and Hurwitz's theorem says that ends at **𝕆**. So the window is:

> **ℝ ⊂ ℂ ⊂ ℍ ⊂ 𝕆 admit a normalisation; 𝕊 does not.** Inside that window the fusion algebra and the
> normalisation both survive, but from ℍ onward the *order* of a ⊗-fold matters and from 𝕆 onward its
> *bracketing* matters. **There is no rung where the ⊗ side is free and the ⊕ side is not.**

So the falsifiable form of the transfer claim, and what I would hand Soraya:

> **Conjecture.** For any operation `f` in the soft regime expressed over `WeightedSet<'K,'W>`, the
> highest Cayley–Dickson rung at which `f` is well-defined is determined by the weakest law `f`'s
> implementation invokes, and is computable from the call graph without running `f`.
>
> **Falsifier.** Exhibit an operation whose implementation invokes only `Add`/`Negate`/`Zero` and
> which nonetheless fails at some rung; or one invoking `Mul` associatively that survives 𝕆. Either
> refutes the derivability claim.
>
> **Scheme-independence it must survive.** The verdict must not depend on the *representation* of the
> tower (nested pairs vs flat coordinate arrays vs a basis-multiplication table) — only on the laws.

---

## 5. What is NOT claimed

- **Not claimed:** that a BNN over quaternion or octonion weights means anything statistically. §4.3.
  The algebra transfers; the probability theory is not carried along by it.
- **Not claimed:** that the texture path works. There is no shader in this repo. Every GPU row in the
  arena doc is `[proposed]`, and this document does not upgrade any of them.
- **Not claimed:** that `ngFuse` was *produced by* a specialiser. It was measured to be equal to one's
  output. Those are different facts and §2.1 keeps them apart.
- **Not claimed:** that "one substrate" implies composability. Two `WeightedSet<string,float>` values
  with different interpretations add without complaint and the sum is meaningless.
- **Not claimed:** any of this is on the four-oracle byte-lock. `Sppf` is F#-only; the NG4 codec is
  TypeScript-only; `consolidateWSet` and `WSet.consolidate` **disagree on output order today**
  (§1.2, two open workitems).

## 6. Anchors (Beacon)

- **Diaconis & Ylvisaker (1979)**, *Conjugate priors for exponential families* — conjugate updating
  is addition in natural coordinates. The theorem that lets a fixed-function add be an inference step.
- **Amari & Nagaoka (2000)**, *Methods of Information Geometry* — natural/expectation coordinates as
  the two dually flat systems; the update is a straight line, hence no curvature term.
- **Aji & McEliece (2000)**, *The generalized distributive law* — sum-product, max-product and the FFT
  as one algorithm over different commutative semirings. Already quoted verbatim in `WSet.fs`.
- **Kschischang, Frey & Loeliger (2001)**, *Factor graphs and the sum-product algorithm*;
  **Minka (2001)**, *Expectation Propagation* — the cavity that requires `Divide`, and the reason
  improper messages must not be forbidden.
- **Futamura (1971)**, *Partial evaluation of computation process*; **Kleene** (S-m-n);
  **Ershov** (mixed computation) — the projections. Already the stated anchors of `Residual.fs`.
- **Hurwitz (1898)** — ℝ, ℂ, ℍ, 𝕆 are the only normed division composition algebras. This is what
  puts the normalisation ceiling at 𝕆 in §4.3, and it is a theorem, not an observation.
- **Baez (2002)**, *The Octonions* — the standard modern account of the doubling ladder and what each
  rung costs.
- **Cayley–Dickson**; **Fritz (2020)** / **Cho–Jacobs (2019)** / **Fox (1976)** — the comonoid /
  Markov-category structure `WSet.copy`/`discard` already implements.

**Provenance discipline.** These are **math-shape correspondences** — borrowed, published mathematics
whose shapes match ours, checked by probe. None of it is evidence that "the physics proves our
system." Math grounds validity; physics grounds the metering, by analogy.

## 7. Reproduce

Every number in this document comes from a committed script; each carries its own sabotage control
and each exits 0:

```bash
bun src/Core.TypeScript/research/wset-ngfuse-is-residual-program.ts        # probe A (§2.1)
bun src/Core.TypeScript/research/wset-doubling-transfer-table.ts           # probe B (§4.1)
bun src/Core.TypeScript/research/wset-factorgraph-message-algebra.ts       # probe C (§1.1)
bun src/Core.TypeScript/research/wset-sumproduct-marginalisation.ts        # probe D (§1.2)
```

Probes A and D import the **shipped** functions (`ngFuse` from `toy-bnn-rgba-codec.ts`;
`tensorWSet`/`consolidateWSet` from `algebra/wset.ts`), so they measure the real code rather than a
replica. Probes B and C replicate `Cayley-Dickson` doubling and `FactorGraph.fs` respectively, and
say so.

## 8. Pointers

- `src/Core/WeightedSet.fs` · `src/Core/WSet.fs` — the two carriers (§1).
- `src/Bayesian/Message.fs` (`IMessage`, `Gaussian`) · `src/Bayesian/FactorGraph.fs` — what §1.1 measured.
- `src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.ts` — `ngFuse`, the residual program (§2).
- `src/Core/Residual.fs` (`Target`) · `src/Core/MixCogen.fs` · `src/Core/IsaSpec.fs` — the staging that exists (§3).
- `tests/Tests.FSharp/CayleyWeightedSet.Tests.fs` — the in-repo half of §4, from the code side.
- `docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-*.md` — why `'K` is the sufficient
  statistic and not the sample space. Read before designing here.
- `docs/research/2026-08-23-otto-arena-bnn-exact-gpu-mapping-*.md` §6 — the numerology check this
  document extends rather than repeats.
- `docs/design/2026-08-13-factor-graph-soft-value-heterogeneous-bnn-linguistic-seed-bridge.md` — the
  bridge design; its five interfaces are still unbuilt.
- Open workitems this lane depends on: `081M0QRPY6W087G0R001K4TE3M` (the `toWeightedSet`
  homomorphism + its negative control), `081M05ZZG6A087G0R001PBBKDX` and
  `081M060AYN9087G0R0006E6FWZ` (the two `consolidate` order defects), `081M0QHPRPV087G0R0019ZF47A`
  (`SoftValue` is an assoc list).
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-doubling — where §4's conjecture is filed.
