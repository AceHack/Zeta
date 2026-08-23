# TOY — encoding a BNN posterior into RGBA: Normal-Gamma natural parameters round-trip; Student-t `(μ,σ,ν)` does not

**Register: `toy` throughout** (`.claude/rules/toy-is-free-metered-must-be-earned.md`). Aaron called
`OracleRGBA.tsx` a toy himself and he is right. Nothing in this document is promoted. What it adds is
**numbers**, so the direction can be earned or killed cheaply instead of admired.

> *"`OracleRGBA.tsx` — this is the start, a toy, of what I'm hoping to turn the evolutionary algo on
> top of our BNNs into. I'm hoping somehow we can encode their information into RGB-like values.
> This is the start; it is only a toy."* — Aaron, 2026-08-23

## 0. The answer in six lines

| question | answer | evidence |
|---|---|---|
| Which parameterisation? | **Normal-Gamma in natural coordinates**, 4 channels, 1 weight/texel | §2 |
| Does it round-trip? | **Yes, exactly**, at `rgba32float`: max KL **4.0e-8** nats over 4096 weights | §4, outcome **1** |
| Student-t `(μ,σ,ν)`? | **Rejected** — the family is not closed under fusion, and `ν` is a scalar the repo already refuses to assert | §3 |
| Is the 4-channel fit structural? | **Structural, but not because RGBA is 4-wide.** 4 is the dimension of the sufficient statistic | §6 |
| Branchless crossover? | **Yes** — `float4` add / `mix()`; no per-texel `if` | §7 |
| Associative? | **Exactly**, bit-for-bit, over 3 parents and any N | §5 |

And one refutation the brief asked for, delivered: **RGB→CMYK is not a model of `snap`** (§8).

Every number below comes from `src/Core.TypeScript/bayesian/toy-bnn-rgba-roundtrip.ts`
(`bun` it) and is pinned by `toy-bnn-rgba-codec.test.ts` (9 falsifiers).

---

## 1. What `OracleRGBA.tsx` actually encodes today — measured, not assumed

`demo/identity-dla-site/src/components/OracleRGBA.tsx`, 736 lines. The header comment says
*"R=occupancy, G=walk-length, B=distance, A=harmonic"*, and that is true of the CPU path. Four things
are true that the header does not say, and each one bears on the design:

1. **There is no texture.** Not `rgba32float`, not `rgba16float`, not a texture at all. The display
   path is `ctx.createImageData(GRID, GRID)` — a `Uint8ClampedArray`, **8 bits per channel**. The
   WebGPU path uses `var<storage, read_write> array<u32>` buffers. So the question *"what does
   `OracleRGBA` bind?"* has the answer **nothing float**, and the precision problem is not a future
   risk, it is the current state.
2. **The GPU path does not render the RGBA encoding at all.** `runGPU` writes a flat
   `img.data[b]=220; [b+1]=100; [b+2]=50; [b+3]=255` for every cluster cell. `walkLenBuf` and
   `harmonicBuf` are allocated and bound and **never read back**. The four-channel encoding exists
   only on the CPU path.
3. **R is not a measurement.** `img.data[b]=220` — a constant. "R = occupancy" is a **boolean** wearing
   8 bits. Only G, B and A carry a value, and A is confined to `100..255` (155 levels) by
   `Math.min(255,100+Math.round(155*harmonic[i]/mh))`.
4. **The shader is branchy in exactly the way Aaron wants to avoid.** `if (dir == 0u) { x += 1; } else
   if (dir == 1u) { x -= 1; } else if (dir == 2u) { y += 1; } else { y -= 1; }`, plus two early
   `return`s. This is the *"warp hidden control structures slowing things down"* shape, present in the
   toy today.

**One likely defect, reported as a finding rather than fixed here** (out of scope, filed):
`harmonic` is declared `array<u32>` and then written with `atomicAdd(&harmonic[i], 1u)`. WGSL
`atomicAdd` requires `ptr<storage, atomic<u32>, read_write>`; a plain `array<u32>` element is not an
`atomic<u32>`. As written this reads as a shader-validation error, which would make the whole GPU path
fall over at `createShaderModule` — consistent with the observation that nothing ever reads
`harmonicBuf` back. Not confirmed on a device; filed to be confirmed on one.

**The gap, stated plainly.** `OracleRGBA` encodes *statistics of a trajectory* — how long a walker
walked, how many passed through. A BNN encoding must carry *parameters of a model*, and those
parameters are **distributions, not numbers**. Nothing about the current file transfers except the
idea of putting four numbers in a texel. That is the honest starting position.

---

## 2. The parameterisation chosen: Normal-Gamma in natural coordinates

### 2.1 The repo is already in natural parameters, and this is the load-bearing fact

`src/Bayesian/Message.fs:64` —

```fsharp
type Gaussian =
    { /// precision-mean ν = μ·τ
      PrecisionMean: float
      /// precision τ = 1/σ²
      Precision: float }
    static member One : Gaussian = { PrecisionMean = 0.0; Precision = 0.0 }
    static member ( * ) (a, b) = { PrecisionMean = a.PrecisionMean + b.PrecisionMean
                                   Precision     = a.Precision + b.Precision }
```

`MinimalBnn.State` holds `Prior`, `LikelihoodProduct` and `Posterior` as exactly this type, and
`MultilayerBnn` is `Layers: MinimalBnn.State array` with `Gaussian array` messages. **A BNN posterior
in this repo is already a pair of natural parameters, and its combination is already componentwise
addition with a monoid identity.** The soft-regime map (PR #14243) states the same fact as a
constraint: *"Gaussian fusion **is** a monoid in natural parameters `(η, τ)` (they add), and it is
**not** one in `(μ, σ²)`."*

So the encoding question is *not* "how do I turn a posterior into colour". It is **"how many
already-additive coordinates fit in a texel, and what do I get for the fourth."**

### 2.2 Two weights, or one weight with tails

- **NP2** — `(η₁, τ₁, η₂, τ₂)`: **two Gaussian weights per RGBA texel**, 8 bytes/weight. Directly the
  in-tree type. Cheapest. **No tails** — a Gaussian posterior has none.
- **NG4** — the **Normal-Gamma**, `NG(m, λ, α, β) = N(μ | m, (λτ)⁻¹)·Gamma(τ | α, β)`: a joint
  posterior over *both* the weight and its precision. One weight per texel, 16 bytes/weight.

Sufficient statistic `T = (τ, τμ, τμ², log τ)`; natural parameters

```
η = ( −(β + λm²/2),  λm,  −λ/2,  α − ½ )
```

with the inverse `λ = −2η₃`, `m = η₂/λ`, `α = η₄ + ½`, `β = −η₁ − λm²/2`. Conjugate update is
**η_post = η_prior + Σ η(data)** — vector addition, again.

**And the marginal on the weight is exactly a Student-t:** `μ ~ t_{2α}(m, β/(αλ))`. So NG4 gives the
heavy tail Aaron wants **without** paying the price §3 shows Student-t charges.

### 2.3 Why the fourth channel is not spare

The 4-tree/3-tree doc
(`docs/research/2026-06-07-zs-zetashell-interpreter-zc-zetacell-cli-daemon-and-idl-in-4tree-3tree-soft-representation-aaron.md`)
already says RGB carries *"3 carried trees + the 4th recovered by Bayesian inference"*, and #6922 calls
the 4th *"the captured shared environment you don't transmit"*. NG4 says the same thing concretely:
three channels locate and scale the weight; the fourth (`α − ½`, the observation count) is **the
evidence weight** — how much this weight has been *earned*. It is not a spare slot and it is not a
colour. It is the thing you would otherwise have to keep in a side buffer.

---

## 3. Why Student-t `(μ, σ, ν)` is rejected — two independent reasons

This was the candidate I was told to look at hardest, and it fails twice.

### 3.1 The family is not closed under fusion, so the blend is not a fold

A Student-t is a **scale mixture of Gaussians**, not an exponential family in `(μ,σ,ν)`. The product
of two Student-t densities **is not a Student-t**. Any implementation must therefore *project* back
into the family after each combination, and projection is where associativity dies. Measured with a
moment-matched projection over three parents:

```
t(μ,σ,ν)  (X*Y)*Z  ν = 7
          X*(Y*Z)  ν = 6
```

The order of combination changes the recovered degrees of freedom. Note honestly what this does and
does not show: the closure rule used (`ν ← min(νₓ,ν_y)+1`) is ad hoc, and so is every other one — that
is the point. The non-closure is a *fact about the family*; the specific breakage is an illustration
of it. Under **any** projection rule, "blend three parents" stops meaning one thing.

### 3.2 A scalar `ν` channel asserts something this repo already refuses to assert

`src/Bayesian/HeavyTailFold.fs` is a shipped, measured refusal to do exactly this:

> *"there is no function here that takes a bare `nu` … `tryInfer` estimates `nu` by profile likelihood
> and returns an interval **only** … at society scale `nu` is not identifiable and the estimate is
> noise wearing a number."*

with a measurement table (400 replicates/cell) showing the estimator's spread, and the note that
**`1/ν` is the coordinate, not `ν`**. Putting `ν` in the alpha channel as one 32-bit float would
re-commit the defect that file was written to fix — it would look like a measurement and carry an
unidentifiable one.

**NG4 avoids this structurally rather than by discipline.** In NG4 you never fit a shape parameter:
`α` starts at the prior and increments by ½ per absorbed observation, so `ν = 2α` is *derived from the
evidence count*, which is identifiable by construction. The tail heaviness is **earned**, not
estimated. That is the same shape as the rest of the repo's economy, and it is why NG4 is the right
answer rather than merely the convenient one.

### 3.3 What was also considered and rejected

- **`(μ, σ²)` moments** — rejected: not a monoid, and the harness shows the naive form failing
  associativity by `1.75e-1` on the first three-parent example tried (§5).
- **Mixture-of-K-Gaussians per texel** — rejected: mixtures are not closed under product either
  (K² components after one fusion), so it fails the same falsifier as Student-t, and worse.
- **Samples / particles in the channels** — rejected: fusion of particle sets is resampling, which is
  stochastic and therefore neither associative nor replayable without carrying the RNG stream.
- **`tri-boolean-float`** — rejected, checked: `src/Core.TypeScript/tri-boolean-float/` v0 is
  **unsigned and finite-only** (`"v0 is unsigned + finite"` is the literal refusal in `fromValue`),
  and `η₁`, `η₃` are always negative while `η₂` is signed. Beyond that it answers a *different*
  question — its held trit `N` records *"this bit is not known"*, i.e. uncertainty about the
  **encoding**, where we need resolution of a **distribution**. It is not the tool for this, and there
  is no GPU representation of it. This is a "no" with a reason, not a "not yet".

---

## 4. The falsifier: round-trip, with the number

4096 synthetic weights, precisions spanning ~5 decades (1–400 observations each), deterministic seed.
Error measured as **KL divergence between the original and recovered posterior** — the
exponential-family KL `A(η₁) − A(η₀) − (η₁−η₀)·∇A(η₀)`, computed in closed form — **not** an L2 on
channel values.

### Outcome **1 — exact, single texture.** `rgba32float` round-trips.

| encoding | format | max KL (nats) | mean KL | invalid |
|---|---|---|---|---|
| NP2 Gaussian | `rgba32float` | **1.4e-10** | 8.6e-13 | 0 |
| **NG4 Normal-Gamma** | **`rgba32float`** | **4.0e-8** | **5.4e-11** | **0** |
| NG4 | `rgba16float` | 1.9e0 | 3.4e-3 | 0 |
| NP2 | `rgba16float` | **∞** | ∞ | **19 / 4096** |
| NG4 (per-channel) | `rgba8unorm` | 2.7e2 | 3.6e0 | **108 / 4096** |
| NP2 (per-channel) | `rgba8unorm` | 3.2e4 | 1.2e2 | 0 |

**Read it in this order:**

- **`rgba32float` is sufficient.** No multi-texture scheme is needed for exactness. The single
  best-case outcome is available at 1 fetch and 16 bytes per weight.
- **`rgba16float` breaks NP2 outright — to infinity, not to imprecision.** The measured `τ` range was
  `[5.3, 129836]`, and binary16's maximum finite value is **65504**. A confident weight has a large
  precision, so *the more evidence a weight has absorbed, the more certainly f16 destroys it.* Pinned
  as test `RT-3`. NG4 survives f16 only because `−λ/2` and `α−½` stay small; its 1.9-nat max KL is
  still a real posterior corruption.
- **8-bit is not a lossy encoding, it is a broken one.** 108 of 4096 texels decode to a
  **structurally invalid posterior** — `β ≤ 0` or `λ ≤ 0`, i.e. not a probability distribution at all.
  That is the sharpest statement of the precision problem: at the precision `OracleRGBA` uses today,
  2.6% of weights are not merely coarse, they *do not exist*.

### The one precision hazard worth naming: `β` decodes by cancellation

`β = −η₁ − λm²/2` is a difference of like-signed quantities, so it cancels for large `|m|`:

| `m` | recovered `β` (true = 2) | rel. err |
|---|---|---|
| 0 … 1000 | 2.00000000 | **0** |
| 10000 | 0.00000000 | **1.0 (total loss)** |

Bound: safe to `|m| ≲ 10³` at `λ = 50` in binary32, which is far outside any normalised BNN weight.
Stated so the guard is a *known* boundary rather than a surprise. It is also why `ngFromNp` is written
as `−h1 − λm²/2` rather than the algebraically identical `−h1 + h2²/(4h3)`: same cancellation, and the
first form makes it visible.

### What survives and what does not, inside a texel

The intuition "protect the tails" turns out to have it backwards:

- **The shape parameter `ν = 2α` round-trips EXACTLY** — at f32 *and* at f16 (`rel-err = 0`), because
  `α − ½` is a half-integer count and half-integers are exact in any binary float. Test `RT-4`.
- **The scale does not** (`1.1e-5` relative at f32), because it goes through `β`, which is a
  difference.

So the tail *heaviness* is the cheapest thing in the texel and the *location* is the dearest — see §9.

---

## 5. Associativity — combination is a genuine fold

| combination | `(A∘B)∘C` vs `A∘(B∘C)` |
|---|---|
| Gaussian `(η,τ)` | **identical, bit for bit** (`|Δ| = 0`) |
| Normal-Gamma natural | **identical, bit for bit** (`|Δ| = 0`) |
| naive `(μ, σ²)` averaging | `|Δμ| = 1.75e-1` — **fails** |
| Student-t `(μ,σ,ν)`, moment-matched | `ν`: 7 vs 6 — **fails** |

Floating-point addition is not associative in general, so "bit for bit" deserves its caveat: it holds
here because the summands are of comparable magnitude, and it is *exactly* what the falsifier asserts
(`AS-1`, `AS-3`). At extreme magnitude spread, f32 reassociation error returns — a Kahan or
sorted-order reduce is the mitigation if it ever bites, and it is a bounded engineering problem rather
than a structural one.

**This is what makes "multi-parent" mean something.** N-parent fusion is `parents.reduce(fuse)` — one
associative, commutative reduce, any N, no special case at 3 (`AS-4`). That is the mathematical
content of the already-minted `081M0QJ2Z91087G0R00061PBQF` (N-parent recombination), and it is why
`agent-genome.ts`'s hard 2-tuple is a *representation* limit rather than an algebraic one.

**Beacon anchor for weighted multi-parent mixing.** A convex combination in natural coordinates
`η_child = Σ wᵢ ηᵢ`, `Σwᵢ = 1`, is **logarithmic (log-linear) pooling** of the parent densities —
characterised by Genest (1984) as the unique pooling rule satisfying *external Bayesianity* (pooling
then updating equals updating then pooling), and surveyed in Genest & Zidek (1986). The natural-
parameter simplex mix is not an invented operator; it is the pooling rule with the strongest
axiomatic standing, and it is `mix()` on a GPU.

---

## 6. Is the four-channel fit structural or coincidental?

**The repo's own precedent is the bar.** `docs/research/2026-08-15-bounded-infinity-…` and the
`numerology-vs-number-theory` rule refuse identification-by-count, and the genome→Adinkra tie was
refused on exactly these grounds — *sharing the length 8 identifies nothing*. Aaron's own *"I thought
we had tied this into Clifford algebra too but maybe not"* is on record, and the *"maybe not"* was
correct.

**So: the width match is worthless as evidence, and it is not what the claim rests on.**

- RGBA is 4-wide. Quaternions are 4-wide. Student-t `(μ,σ,ν)` + 1 spare is 4-wide. CMYK is 4-wide.
  **None of that discriminates.** By itself, "4 = 4" is the weakest possible argument and it should
  carry no weight in the decision.
- What *does* discriminate is an invariant that excludes the competitors: **is the coordinate system
  closed under an associative, commutative, branchless combination that is also the Bayesian update?**
  Quaternions: no (their product is non-commutative and is not an inference operator). Student-t
  `(μ,σ,ν)`: **no**, demonstrated in §3.1. Normal-Gamma natural coordinates: **yes**, demonstrated in
  §5.

**The honest statement.** *4 is the dimension of the sufficient statistic of the smallest exponential
family whose marginal on the weight is heavy-tailed.* `T = (τ, τμ, τμ², log τ)` has four components
because you need two for the location-scale part and two for the shape part. That number came from the
statistics and would be 4 whether or not textures had four channels. **The fit is structural in that
direction only** — the family determines the width; the width does not endorse the family.

Two remaining honesties:

- **"Smallest" is a claim I have not proved.** I know of no 3-parameter exponential family with a
  Student-t marginal, and Normal-Inverse-Gamma is a reparameterisation of the same family, not a
  competitor. That is *"I could not construct one"*, which is weaker than *"none exists"*. Register:
  **consistent with minimal**, not *is minimal*.
- **Convenience is not evidence.** That the required width happens to equal the available width is a
  fortunate coincidence and should be enjoyed as one. If the family had needed five parameters, the
  answer would have been "use two textures", and §10 costs exactly that.

---

## 7. Branchless GPU operations — the second falsifier

The requirement is *"everything in math and discriminated unions rather than control flow if
statements"*, because Aaron's reason for wanting colour is **warp coherence**. Each operation:

| operation | expression | branches |
|---|---|---|
| **fusion / N-parent** | `h = h_a + h_b` (`float4` add) | none — this is *literally* GPU additive blend (`ONE, ONE`) on a float target |
| **crossover, uniform** | `h = mix(h_a, h_b, mask)` with `mask` from a hash texture | none — `mix` is one instruction |
| **crossover, simplex over N** | `h = Σ wᵢ hᵢ` | none — a fused-multiply-add loop with fixed trip count |
| **mutation** | `h += s * gaussFromHash(texelId, seed)` | none — PCG hash, no rejection loop |
| **cone guard** | `h3 = min(h3, -EPS); h4 = max(h4, EPS)` | **none** — `min`/`max` are single instructions, not branches |
| **decode to (m,λ,α,β)** | 4 divides and a multiply-add | none |

The last row is the one that needs care, so it is stated rather than assumed. The natural-parameter
space is not all of ℝ⁴: validity requires `η₃ < 0` and `η₄ > −½`, and §4 measured what happens when a
value lands outside (108 invalid posteriors). Clamping is branchless — but **clamping is not
associative**, so a clamp inside the fold would break §5.

**It does not have to be inside the fold, and this resolves cleanly:**

- The valid region is a **convex cone**. Fusion of two valid posteriors stays inside it (sums of
  positive `λ`, `α`, `β` are positive), so **the fold never needs a clamp** — associativity is safe.
- Crossover is a **convex combination**, and a convex cone is closed under convex combinations, so
  **crossover never needs a clamp either.**
- Only **mutation** can leave the cone, and mutation is a *unary* operator applied once per
  individual. Associativity is not at stake there, so the clamp is free.

That is the whole design constraint in one line: **mutate in the cone, fold anywhere.**

**The existing shader is the counter-example to fix, and it is small.** `OracleRGBA`'s
`if (dir==0u){x+=1;} else if…` chain is replaceable by arithmetic
(`let d = rng % 4u; x += i32(d==0u) - i32(d==1u); y += i32(d==2u) - i32(d==3u);`), which is branchless
and warp-coherent. Filed, not done here.

---

## 8. Does RGB→CMYK model `snap`? **No — and the refutation is clean**

The proposed correspondence: RGB(A) = unsnapped `SoftValue`, CMYK = snapped `DynamicValue`, and
**RGB→CMYK conversion = the `snap` operator**, on the strength of three shared properties —
directional, lossy, non-invertible.

**Tested, and it fails on all three.** Naive RGB↔CMYK over 100,000 random colours and a 21³ grid:

```
RGB -> CMYK -> RGB   max round-trip error: 1.11e-16
```

- **Not lossy.** It round-trips to floating-point epsilon. Pinned as test `CM-1`.
- **Not non-invertible.** It is a **bijection** everywhere off the single point `K = 1`.
- **Not directional.** Both directions are closed-form and total.

And the structural reason, which is more decisive than the measurement:

> **`dim(RGB) = 3`, `dim(CMYK) = 4`. The map goes UP in dimension. `snap` goes DOWN** — a distribution
> to a point, ∞-dimensional to 0-dimensional. **The arrow points the wrong way.**

(Real ICC gamut mapping *is* lossy — but that lossiness comes from clipping to a *device's* reachable
set, which is a property of a printer, not of the colour spaces. And it is still not idempotent, and
still not a distribution→point collapse. Nothing is rescued by reaching for it.)

### What survives, and it is better than what was proposed

The **soft/solid** reading in `docs/VISION.md:1394` — *"base alphabet CMYK-solid + RGB-soft, not
ACTG"* — is correct and does not need the conversion to carry it. The 4-tree/3-tree doc already states
the precise version:

- **CMYK = 4 explicit trees, exact/lossless** — everything is carried.
- **RGB = 3 explicit + the 4th recovered by inference** — the *"host-invariant K supplied by the host"*.

So the difference between the two spaces is *exactly one channel's worth of "carried vs inferred"* —
which is the soft/solid distinction, stated dimensionally, and it agrees with the measured
`dim` gap. **`snap` then corresponds to supplying the missing channel from evidence, not to a colour
transform.** That is a sharper claim than the one it replaces, and it costs nothing to hold.

### The dense-resonance check, applied to this section

Three framings were offered as agreeing: soft/snapped, additive/subtractive, emit/retract. Per
`numerology-vs-number-theory` — *"too many correlations is a warning, not a confirmation signal"* —
they are not three observations.

**Emit/retract and additive/subtractive are the same observation twice.** "RGB adds light, CMYK
removes it" and "RGB emits, CMYK retracts" differ only in vocabulary; the second is the first in Z-set
words. That leaves **two** independent framings, and one of them (the conversion-as-`snap` reading)
was just refuted. So the resonance is thinner than it felt, which is precisely what the rule predicts
about the moment everything clicks.

---

## 9. If lossy: what transfers from the quantisation literature, and what does not

Aaron: *"if we do that we should likely try to do some of the latest quantization work the big model
teams do … not just do it naively."* Right, and the result is more interesting than expected.

All schemes at 8 bits/channel on NG4, 4096 weights, scored by KL between the original and recovered
**posterior**:

| # | scheme | anchor | max KL | mean KL | invalid |
|---|---|---|---|---|---|
| a | per-tensor uniform | the naive baseline | 6.1e2 | 7.45 | 166 |
| b | **per-channel uniform** | Krishnamoorthi 2018; Nagel et al. 2021 | 5.1e2 | **3.84** | 92 |
| c | per-channel **quantile** grid | NF4 / quantile quantization, Dettmers et al. 2023 | 1.1e4 | **10.88** | 32 |
| d | quantile + top-1% kept in f32 | LLM.int8() decomposition, Dettmers et al. 2022 | 2.5e3 | 4.19 | 22 |
| e | 8-bit on the **location** channel only | — | 9.7e3 | 11.21 | — |
| e | 8-bit on the **shape/scale** channels only | — | 1.3e3 | **2.19** | — |

### Three findings, and the second one is the one worth carrying

**(i) Per-channel scaling transfers.** (b) beats (a) roughly 2× in mean KL. The standard result holds:
`η₁ ∈ [−479, −0.5]`, `η₂ ∈ [−601, 527]`, `η₃ ∈ [−200, −1]`, `η₄ ∈ [1, 200]` are four genuinely
different ranges and a shared scale wastes bits. Adopt it.

**(ii) NF4's *method* does NOT transfer, and this is the named gap.** A quantile grid is
*information-theoretically optimal* in the sense NF4 means it — *"each quantization bin has an equal
number of values assigned"* — and here it is **2.8× WORSE than plain uniform** by KL. That is not a
bug in the implementation; it is the difference between two error metrics:

> Quantile quantisation allocates resolution by **probability mass of the values**. KL between
> posteriors is governed by the **Fisher information metric**, which weights regions where the
> distribution is *sensitive*, not where the parameters are *common*. Those are different measures,
> and the sparse-but-sensitive region is exactly where a density-matched grid starves.

**This is precisely the gap the brief asked about, confirmed with a number rather than asserted.**
Every method in the list — GPTQ (Frantar et al. 2023), AWQ (Lin et al. 2023), NF4, LLM.int8() —
minimises a reconstruction error on **point weights or layer activations**, an L2 through the network.
None of them quantises a **distribution**, and the right objective for one is a divergence. The
transferable *idea* is "fit the grid to the data rather than assuming uniformity"; the transferable
*criterion* is **not** equal mass but equal **Fisher-metric arc length** — the quantiser should be
uniform in the natural distance on the statistical manifold (Amari's information geometry), not in
value-space or in mass. That is a concrete, checkable next experiment and it is filed.

*Honest caveat on (d):* LLM.int8() isolates ~0.1% of **feature dimensions** — systematic, whole
columns — whereas (d) keeps the top 1% of **individual values** per channel. (d) tests the *idea*
(mixed-precision decomposition), not the *method*. It helps (4.19 vs 10.88) but does not beat plain
per-channel uniform, so on this data the outlier story is not the lever.

**(iii) `σ` and `ν` need LESS protection than `μ`, which inverts the intuition.** Row (e): quantising
only the shape/scale channels costs **2.19** nats; quantising only the location channel costs
**11.21** — 5× worse. Combined with §4's finding that `ν = 2α` is exact even in f16, the guidance is:

> **Spend the bits on location.** The heavy tail — the property the memetic-resistance work depends
> on — is the *cheapest* thing in the texel to preserve. It is a count, and counts are exact.

Part of this is that `η₂` has the widest range, so a fixed 256-level budget is coarsest there; that is
not a confound to explain away, it is the design consequence — **budget levels per channel by Fisher
sensitivity, not equally.**

**(iv) And the verdict on 8 bits overall: don't.** Mean KL of 3.84 nats is not a small perturbation of
a posterior; it is a different posterior. Worse, 92 of 4096 texels decode to something that is not a
distribution at all. **Outcome 3 (deliberate lossy) is available and now has its number — and the
number says no.** `rgba32float` round-trips exactly at 1 fetch and 16 bytes per weight; there is no
reason to accept 3.84 nats to save 12 bytes.

---

## 10. Layout cost, in fetches per weight — since exactness is already free

Aaron accepted a cost penalty for exactness. **It is not needed, and the honest report is that it is
not needed**, so the table is for the case where it becomes needed (a wider posterior, a 5th
parameter, a multivariate weight block):

| layout | fetch/weight | bytes/weight | note |
|---|---|---|---|
| NP2 packed `rgba32float` | **0.5** | 8 | 2 Gaussian weights per texel; no tails |
| **NG4 packed `rgba32float`** | **1** | **16** | **round-trips exactly — the recommendation** |
| NG4 SoA, 4 × `r32float` | 4 | 16 | independent range per parameter; matters only if quantising |
| NG4 SoA, 4 × `rgba32float` | 4 per 4 weights | 16 | same fetches, 4× the weights — the SoA form that is not a penalty |
| hi/lo planes, 2 × `rgba32float` | 2 | 32 | **unnecessary** — f32 already round-trips |
| 8-bit bulk + 1% f32 outliers | 1.01 | 4.12 | lossy at 4.19 nats — see §9 |

**On structure-of-arrays specifically**, which the brief asked to treat as first-class: SoA's real
argument is not exactness (packed f32 already has that) — it is **independent dynamic range per
parameter**, which is worth exactly as much as your quantisation is aggressive, i.e. **nothing at
f32**. Its second argument is better: a mutation kernel that touches only `η₂` reads one plane instead
of four, so SoA wins on *partial* access. Recommendation: **packed `rgba32float` for the fold,
SoA only if a later kernel proves it reads a strict subset of channels.** Do not pay 4× fetches for a
property f32 gives free.

---

## 11. The bounded first milestone — done, and what it says

The suggested milestone was *"encode a single `MinimalBnn` layer's posterior into an `rgba32float`
buffer, round-trip it, and report the recovered precision."* Taken, with one change: **synthetic
posteriors matching `MinimalBnn`'s shape rather than a live F# layer**, because the codec question is
answered by the parameter ranges and the F# interop would be scaffolding, not evidence. The ranges
used are stated in §4 and are the honest weak point — a *real* trained layer may have wider ones, and
that is the next measurement, not this one.

**It answered the question with a number, and it did two things I did not expect:**

- it **killed `rgba16float`** (∞, not imprecision — the τ overflow), which was on the table as the
  cheap option; and
- it **killed the quantile-grid transfer** (2.8× worse than uniform), which was the most-recommended
  idea in the brief.

Both were cheap to learn and would have been expensive to assume.

## 11b. One owned error, because the mechanism that caught it is the point

The binary16 converter used for the `rgba16float` rows was hand-rolled (`Math.f16round` needs an
`es2025` lib). My first version routed `double -> float32 -> binary16`, which is **double rounding**
and is not the same as `double -> binary16`. It was wrong by one ulp on **4 of 20012** probes.

It was caught only because the harness cross-checks the hand-rolled converter against the platform
intrinsic before quoting any f16 number (`f16RoundSelfCheck`, and test `RT-5`). Without that check, a
subtly wrong converter would have faked every f16 result in §4 and nothing would have complained. The
corrected converter agrees on **0 of 300,016** probes, and the §4 f16 numbers were unchanged to the
precision quoted — but that is luck, not vindication.

Recorded here because "the falsifier caught my own instrument" is worth more than a clean-looking
document, and because it is the concrete instance of `no-binary-in-proof-lineage`'s underlying worry:
a measuring device nobody measured.

## 12. What is NOT claimed

- **Nothing is metered.** No GPU kernel was written or run. Every timing intuition here is unmeasured.
- **No BNN was trained.** The posteriors are synthetic with realistic ranges. If a real layer's `|m|`
  reaches 10⁴ the §4 cancellation bound is live; it is not live at the ranges tested.
- **The `rgba16float` rows depend on a hand-rolled converter** — cross-checked against the platform
  intrinsic (§11b), which is as strong as this gets without a GPU in the loop.
- **The `atomicAdd` defect is not device-confirmed** — it is read off the WGSL spec, and filed to be
  confirmed on hardware.
- **"Minimal exponential family" is unproved** (§6) — register: *consistent with*, not *is*.
- **CMYK is out of scope.** Per Aaron: CMYK is the snapped `DynamicValue` side, and a snapped value
  has no tails to lose, so it is a strictly easier and different problem. It is not solved here and
  should not be presented as if it were.

## 13. Anchors (Beacon)

**Statistics.** Wainwright & Jordan, *Graphical Models, Exponential Families, and Variational
Inference* (2008) — natural parameters, log-partition, `∇A = E[T]`, the KL used throughout ·
DeGroot, *Optimal Statistical Decisions* (1970) — the Normal-Gamma conjugate prior and its Student-t
marginal · Minka, *Expectation Propagation* (2001) — the cavity/division already in
`Message.fs` `( / )` · Amari, *Information Geometry and Its Applications* (2016) — the Fisher metric
that §9(ii)'s finding turns on.

**Pooling.** Genest (1984); Genest & Zidek, *Combining Probability Distributions: A Critique and an
Annotated Bibliography*, Statist. Sci. (1986) — logarithmic pooling and external Bayesianity: the
axiomatic standing of the N-parent simplex mix in §5.

**Bayesian neural networks.** Blundell, Cornebise, Kavukcuoglu & Wierstra, *Weight Uncertainty in
Neural Networks* (2015) — the weights-as-distributions premise · Herbrich, Minka & Graepel, *TrueSkill*
(2006) — already in-tree in `TravelerRankLedger.fs`, and the same natural-parameter message passing.

**Quantisation** (checked in §9, not merely cited). Krishnamoorthi, *Quantizing deep convolutional
networks for efficient inference* (arXiv:1806.08342) — per-channel scales · Nagel et al., *A White
Paper on Neural Network Quantization* (arXiv:2106.08295) · Dettmers, Lewis, Belkada & Zettlemoyer,
*LLM.int8()* (arXiv:2208.07339) — mixed-precision decomposition, ~0.1% outlier **dimensions** ·
Dettmers, Pagnoni, Holtzman & Zettlemoyer, *QLoRA* (arXiv:2305.14314) — NF4, quantile quantisation,
equal-mass bins · Frantar, Ashkboos, Hoefler & Alistarh, *GPTQ* (arXiv:2210.17323) · Lin et al., *AWQ*
(arXiv:2306.00978). **All six optimise an L2 on values or activations; none targets a divergence
between distributions. That is the gap §9(ii) names and measures.**

**MacVector / directed mutation.** Aaron's own sequence-analysis lineage is the framing anchor and is
**still unfiled** — `docs/PRIOR-ART-LIST.md:299`/`:313` record MacVector against Boost and NIST, and
CRISPR/polymerase appear nowhere. The soft-regime map already flags this; work-item
`081M0QJ2ZA3087G0R0034KWF15` owns it.

## 14. Pointers

- `src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.ts` — the codec (`toy`)
- `src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.test.ts` — 9 falsifiers
- `src/Core.TypeScript/bayesian/toy-bnn-rgba-roundtrip.ts` — the runner; every number above
- `src/Bayesian/Message.fs` `Gaussian` · `MinimalBnn.fs` · `MultilayerBnn.fs` — already natural parameters
- `src/Bayesian/HeavyTailFold.fs` — why a scalar `ν` channel is refused (§3.2)
- `demo/identity-dla-site/src/components/OracleRGBA.tsx` — the toy this starts from (§1)
- `src/Core.TypeScript/planning/agent-genome.ts` · `society-evolution.ts` — the 2-parent engine
- `docs/research/2026-08-23-the-soft-regime-one-substrate-many-semirings-*` — the `(η,τ)` monoid fact
- `docs/VISION.md:1394` — *"CMYK-solid + RGB-soft"* (§8)
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `numerology-vs-number-theory.md` (§6)
