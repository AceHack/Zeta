# Clifford GPU: a theory brief — the geometric root, the metered clock, and five questions for the math team

> **This is a THEORY BRIEF, not a design.** Aaron 2026-08-23: *"the geometric root has zero
> implementation in Zeta. we should **route this to math team first**, then we code after they have
> us some **solid theoretical formal analysis**."*
>
> **Nothing here proposes code and no work-item here builds anything.** §7 states five questions
> precisely enough for a mathematician to answer without reading the conversation that produced
> them. §1–§5 are the reconnaissance those questions sit on: an engineering survey, an inventory of
> what already exists in this tree, one design commitment Aaron has already settled, and an honest
> costing. Everything else is `proposed` or `open`.

**Base:** `origin/main` @ `58d69c485191e871fa7f6e5715ec1ded7a849d89` (2026-08-23).

---

## 0. Register discipline — read this before anything else

`.claude/rules/toy-is-free-metered-must-be-earned.md`. There is a specific trap in this document and
it is named here so it cannot operate silently:

> ### Architectural primacy is not epistemic primacy

§6 records Aaron's decision to make **geometry the root** and the Bayesian/Gaussian layer **a fast
approximation over it**. That is a legitimate architectural commitment and it is taken. But the
evidence gradient runs the *other* way:

| layer | evidence |
|---|---|
| **Bayesian / NG4** — the layer being demoted to "optimization" | **`metered`.** Round-trip max KL **4.0e-8** over 4096 weights, 0 invalid; a measured refutation of Student-t-as-storage; exact bit-for-bit associativity over N parents; ten falsifiers in `toy-bnn-rgba-codec.test.ts` |
| **Geometric root** — the layer being promoted to foundation | **`proposed`.** Zero implementation in Zeta. Zero measurements. |

So the foundation is the **less-checked** layer. Placing it underneath does not transfer the
measured layer's confidence downward, and a brief that reads like a design would let it. **Sitting
lower in an architecture is not the same as being better established**, and the whole point of
routing this to the math team first is that the foundation has to be *earned* rather than assumed by
position.

Nothing in this document is `metered`. The only `metered` claims cited are ones already earned
elsewhere in the tree, and they are marked where they appear.

---

## 1. Aaron's framing (verbatim, four asks)

> *"we can code against the Apple Metal API but I would really like to create our own GPU primitives
> that can be coded once in a spec form and then lowered into specific versions like Metal from Apple
> or DirectX or others, open source ones. There is a lot of existing work here in the industry and
> cross compilation. But our graphics library is trying to be **clockless**, or at least only
> internal-phase-clock based, and have **no hidden consensus / warp control flow**. Also our graphics
> library will be based on **Clifford algebra and geometries within that space**, not traditional
> geospatial or anything like that — we will **embed geospatial inside Clifford**, right beside
> **memetic understanding**."*

> *"the clock requirement is mostly about **metering it as accurately as possible where it can't be
> avoided**. This maps to like a **soft version of the Sequoia memory model from Stanford** but **less
> rigid hierarchies and more measured distances and divergence**, and metering as accurately as
> possible and **assuming it will drift over time** as hardware and firmware and software is updated."*

> *"on Clifford I have a novel theory that **English is geospatial**, at least a closed subset of it
> that we can define as our **minimal linguistic seed**. I see English geometrically in my head."* /
> *"this should map directly to our **wset** — I hope this is our **universal-ish tensor**."*

> *"we should lean toward the **30 years of history on the geometric version**. The Bayesian/Gaussian
> and the Student-t outlier stuff is an **optimization** that can connect it to modern math — but we
> could make the 30 years of geospatial/Clifford **the root** and **retrofit the Bayesian stuff into
> it for optimization / fast approximation**."*

| # | claim | status here |
|---|---|---|
| 1 | one spec, many backends | **reconnaissance complete** — §2. Solved industry-wide; adopt, do not rebuild |
| 2 | clock metered, not avoided | **decided by Aaron** — §4. A design commitment, not a theorem |
| 3 | embed geospatial inside Clifford | **partially shipped already** — §3, costed §5 |
| 4 | geometry is the root, Bayesian is a chart | **`proposed`** — §6, and it generates §7's questions |

---

## 2. Engineering reconnaissance — what the existing IRs commit you to

Checked, not merely cited (`.claude/rules/anchor-to-human-prior-art.md`). This section stands
independent of the theory: it is true whatever the math team concludes.

### 2.1 SPIR-V + SPIRV-Cross

A binary IR plus a transpiler to MSL / HLSL / GLSL — the literal shape of Aaron's ask, shipping since
2016. **The finding that matters here:** the MSL backend **drops synchronization constructs**. Per
the SPIRV-Cross MSL documentation, `OpMemoryBarrier` **has no MSL counterpart**; descriptor sets do
not exist in Metal so combined image samplers must be split; shared variables cannot have matrix
type. So the portable IR is not portable in exactly the register §4 cares about: **a memory barrier
expressed in the IR is not guaranteed to survive lowering to Metal.** Not a criticism of SPIRV-Cross
— Metal's model genuinely differs — but it means the place where hidden consensus is lost in
translation is a **real, named, documented location** in the existing toolchain.

### 2.2 SPIR-V's reconvergence extensions — the industry already named the hidden consensus

- **`SPV_KHR_subgroup_uniform_control_flow`** (2020): an execution mode requiring invocations uniform
  on entry to a structured construct to **reconverge** at its merge block.
- **`SPV_KHR_maximal_reconvergence`**: supersedes it with `MaximallyReconvergesKHR` — diverged
  invocations must reconverge *as soon as possible*.

The CUDA lineage tells the same story from the other end. Pre-Volta, warps executed in lockstep, so
intra-warp synchronization was implicit and free; **Volta's independent thread scheduling broke
that**, legacy warp-level primitives were deprecated in CUDA 9.0 precisely because they enabled
*implicit warp-synchronous programming*, and code had to insert `__syncwarp()` where the guarantee
had been ambient.

**`__syncwarp` exists because an implicit consensus turned out to need a name.** Aaron's instinct
that hidden consensus is a defect is the direction the industry already moved, twice. What it did
*not* do is remove the consensus — it made it **declarable**. That is the shape §4 adopts.

**Honest limit:** both SPIR-V extensions are **optional**, and Metal exposes no equivalent execution
mode. A guarantee you must query for is a guarantee you must have a fallback for.

### 2.3 MLIR (Lattner et al., CGO 2021)

Progressive lowering through *dialects* — architecturally the closest to "one spec, many targets".
**What it commits you to: everything is an operation in some dialect, and you own every dialect you
invent** — its verifier, canonicalization, and lowering to each target. MLIR supplies the framework
and none of the content. It is also a C++ build dependency in a repo whose
`clone-at-tag-stays-sufficient` rule requires the tree to build from a pinned tag with no package
manager present.

**What transfers at zero dependency cost:** the *discipline* — never lower more than one level of
abstraction at a time, keep every intermediate legal and printable.

### 2.4 Halide (Ragan-Kelley et al., PLDI 2013) and TVM (Chen et al., OSDI 2018)

**Separate the algorithm from the schedule.** The algorithm says what is computed; the schedule says
in what order, with what tiling, on what device. Same math, different execution strategy, no rewrite.

What it commits you to: **the schedule becomes a first-class artifact you must author, tune and
version.** Halide did not remove the tuning problem, it *relocated* it into an object you can name —
which is why it is the right shape here, since §4's machine model is a schedule input whose whole
difficulty is that it decays.

### 2.5 Slang (He, Foley & Fatahalian, SIGGRAPH 2018; Khronos-hosted since 2025)

**The decisive survey finding.** Slang compiles to **SPIR-V (Vulkan), HLSL (D3D), GLSL, WGSL
(WebGPU), Metal Shading Language, and CUDA** — every target Aaron named plus the two already present
in this tree. **Automatic differentiation is a first-class language feature.** It ingests existing
HLSL/GLSL. It ships in production (Valve, Source 2, CS2, Dota 2). Since 2025 it is a **Khronos-hosted
project with multi-company governance** rather than a single vendor's.

That last property is the `itron-hub-patent-boundary` test applied to a dependency: multi-company
governance over an open IR means **exit is real**. If Slang goes somewhere we will not follow, SPIR-V
remains and SPIRV-Cross still lowers it. A dependency you can route around is an **oracle you
chose**, not a **hub that holds you**. Slang passes.

### 2.6 What each portable language gave up

The honest content of the survey:

| system | what it gave up for portability |
|---|---|
| **Futhark** (Henriksen et al., PLDI 2017) | general recursion and mutable aliasing — purely functional, parallel structure statically visible |
| **Taichi** (Hu et al., SIGGRAPH Asia 2019) | control over data layout — decoupled and compiler-chosen |
| **Accelerate** (Chakravarty et al.) | nested parallelism — flat data-parallel arrays only |
| **Halide** | data-dependent control flow in the algorithm language |

**Every one bought portability by restricting expressible control flow. Not one bought it by
describing the target hardware more accurately.** That is a real result and it is a standing warning
against §4, which proposes to do the second thing. §4.5 answers it directly.

### 2.7 Reconnaissance verdict

**The lowering problem is solved and Zeta should not re-solve it.** Building a parallel
IR-and-backend stack would be inventing an appointed hub where a multi-vendor oracle already exists.

Stated plainly so it is not diluted: **SPIR-V + SPIRV-Cross — or better, Slang — already does the
lowering. What would be ours is the primitive set and the execution discipline.** Both sit *above* an
existing IR; neither requires owning one. And **the primitive set is precisely what §7 is asking the
math team to establish**, because a Clifford primitive set whose signature and composition laws are
unsettled is not a primitive set.

**There is already an open row for this half:** `docs/backlog/P3/081KQTPYE0008QG0R002Y7X5KH` (tinygrad
UOp IR, "one symbolic IR → all hardware", P3). This brief does not duplicate it. That row asks
whether to adopt a universal IR; §2 answers *adopt*, and names Slang as the candidate.

---

## 3. What is already in this tree (found, not assumed)

`git grep` over `origin/main`. The shared checkout was ~600 commits stale and is not a reliable view
(`.claude/rules/shared-checkout-is-view-only.md`).

| artifact | what it is | state |
|---|---|---|
| `src/Core/Cl3.fs` | Cl(3,0) geometric algebra, 8 blades, geometric product, `distSq` | shipped |
| `src/Core/ConformalGA.fs` | **CGA Cl(4,1)**: null-vector embedding, `d² = −2(P·Q)`, PSD RBF kernel | shipped, **72 lines** |
| `src/Core/CliffordPeriodicity.fs` | mod-8 Atiyah–Bott–Shapiro classification; register **`metered`** | shipped |
| `src/Core/CliffordE8Roots.fs`, `CliffordE8BladeMask.fs`, `CliffordE8Bridge.fs` | the E8 lineage | shipped |
| `src/Core/LinguisticSeed.fs` | Mercer-kernel computation expression, **PSD by construction** | shipped |
| `src/Core/WeightedSet.fs` | semiring-generic sparse tensor; `ITensor` | shipped |
| `src/Core/Semiring.fs` | the split `ISemiring` / `IRing` tower (081KWG9JQ9H) | shipped |
| `src/Core/Viewport.fs`, `src/Core/ShapeRender.fs` | 2D-over-3D viewport; cartridge → strict-dialect SVG | shipped |
| `demo/identity-dla-site/src/components/OracleWebGPU.tsx` | **a real WGSL compute shader** | shipped |
| `src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.ts` | BNN posterior → RGBA (NG4); **`toy`**, `metered` round-trip | in flight |

**Three corrections recorded, because look-don't-infer is the rule:**

1. **The WebGPU path is in `demo/identity-dla-site/`, not `src/apps/twitch-ai/`.** `twitch-ai` renders
   CHIP-8 through a 64×32 **Canvas2D** context (`Chip8TvPlayer.ts`) and has no GPU path.
2. **CGA is not a proposal — it is shipped.** `ConformalGA.fs` has existed since ~2026-06-10;
   `Cl3.fs`'s own header flagged it as the next slice before it was built. Aaron's *"we will embed
   geospatial inside Clifford"* describes something partly already done. §5.2 states what is missing.
3. **An older doc's peel is now stale.**
   `docs/research/2026-06-08-the-memetic-quantum-observer-*` states *"`SoftValue` fits a rig … it does
   not satisfy the repo's `ISemiring` (which requires `Negate`)"*. `Semiring.fs` records that the
   tower was **split** (081KWG9JQ9H) into `ISemiring` (Zero/One/Add/Mul — *"the free tier"*) and
   `IRing : ISemiring` (+ Negate). A rig **does** satisfy today's `ISemiring`. The peel's substance —
   no negative weights, hence no interference, hence quantum-*like* — is untouched.

---

## 4. The clock — settled by Aaron: meter the crossing, assume drift

Not an open question. Aaron decided it: *"metering it as accurately as possible where it can't be
avoided."* Recorded here as the design commitment it is, with the reasoning that makes it defensible.

### 4.1 Why the restricted-subset alternative would have been a vacuous guarantee

Forbidding divergent control flow forbids the *visible* hidden consensus and leaves every invisible
one. **The proof is in our own tree.** `OracleWebGPU.tsx`'s `WGSL_DLA`:

```wgsl
@group(0) @binding(0) var<storage, read_write> cluster: array<u32>;   // NOT atomic

fn hasNeighbor(x: i32, y: i32) -> bool {          // every lane READS cluster
  return isCluster(x+1, y) || isCluster(x-1, y) || ...;
}

@compute @workgroup_size(64)
fn main(...) {
  for (var step = 0u; step < 256u; step++) {
    ...
    if (hasNeighbor(x, y)) {
      cluster[idx(x, y)] = 1u;                    // and every lane WRITES it
      ...
    }
  }
}
```

Every lane runs the same loop — control flow is as uniform as this kernel gets — and it **still** has
an unsynchronized read-modify-write race on `cluster`, across lanes and workgroups, no atomics, no
barrier. Whether walker *A* sticks before walker *B* observes the cell is a function of **physical
lane scheduling**. A rule phrased "no divergent control flow" classifies this kernel as compliant.

A check that cannot fail on the one racing kernel we actually ship is not a check
(`vacuous claims are THE obstacle to human-AI trust`). Divergence is one of at least four hidden
consensuses, and not the most dangerous:

1. divergence/reconvergence — the named one;
2. **the memory model** — aliasing writes need no divergence at all *(the live instance above)*;
3. barrier and workgroup scheduling — `workgroupBarrier()` **is** a consensus, not an escape from one;
4. host-side dispatch ordering — a clock outside the shader entirely.

**So: lower onto the machine as it is; declare and meter every crossing.** This is §13 noninterference
(`dv2-data-split-discipline-activated`) stated for lanes.

### 4.2 Lane-coupling classes — the declared channel

| class | meaning | clockless? | portable today? |
|---|---|---|---|
| **L0 · lane-pure** | no cross-lane read, no aliasing write; output is a pure function of (input, lane index) | **yes, strictly** | yes, everywhere |
| **L1 · phase-coupled** | cross-lane communication **only** at explicitly declared internal phase boundaries | **no — self-clocked** | yes, at a cost |
| **L2 · ambient** | anything else | no | **refused** |

**L1 is exactly BSP** — Valiant, *A Bridging Model for Parallel Computation* (1990): local compute,
barrier, exchange. Valiant's argument is that making the barrier an explicit costed superstep
boundary is what lets you reason about portable parallel programs at all. Aaron's *"only
internal-phase-clock based"* **is** the BSP superstep, named independently.

**Peel, so the literal claim is not softened into an analogy.** Aaron said *"clockless"* first and
*"or at least only internal-phase-clock based"* second. Those are different properties and both are
real: **L0 is clockless; L1 is not clockless, it is self-clocked.** Neither word is dropped.

**The litmus transfers verbatim** from `.claude/rules/local-time-never-enters-the-shared-fold.md`:

> A lane may use physical timing for anything **local**. The value crossing a phase boundary must be
> a pure function of **(input set, phase index)**. If two lanes with different physical timing could
> produce different values at the boundary, the clock has leaked.

`WGSL_DLA` fails this litmus and would classify **L2**. *(That does not make it a bug — see §4.6.)*

### 4.3 The machine model is a measurement that decays — soft Sequoia

**Sequoia** (Fatahalian, Horn, Knight et al., *Sequoia: Programming the Memory Hierarchy*, SC'06)
exposes the memory hierarchy **in the programming model**: the machine is a **tree of memory levels**,
computation is localized to a level by nested *tasks*, vertical data movement is **declared rather
than implicit**, and portability comes from writing the task hierarchy once and *mapping* it onto a
particular machine's tree in a separate step — the same algorithm/schedule separation as Halide,
reached earlier and for memory rather than loops.

**What Sequoia commits you to: a machine model that is declared, discrete, tree-shaped, and trusted
at compile time.** Aaron's departure:

| Sequoia | soft Sequoia |
|---|---|
| hierarchy **declared**, fixed at compile time | **structure declared, magnitudes measured** |
| levels discrete and strictly nested | measured **distances and divergence**, continuous |
| machine model assumed **stable** | **drift assumed** — hardware, firmware, driver, OS |

**A compilation problem becomes a metering problem** — and metering is machinery this repo has.

**The cost of the departure, stated rather than papered over.** Sequoia's *tree* is what makes its
no-hidden-communication property provable: a strict hierarchy means every transfer crosses a named
level, structurally. Replace it with continuous measured distances and the structural guarantee is
gone and only numbers remain. **The reconciliation: keep the structure declared (the classes and the
level graph, checked statically) and let only the *costs* be measured and continuous.** Structure
declared, magnitudes measured — which preserves Sequoia's guarantee and buys drift-tolerance.

### 4.4 How a stale measurement is detected — the part that makes this non-vacuous

An unrefreshed machine model that still looks authoritative is the vacuity class in a new place: **a
number measured once, now a guess wearing a measurement's clothes.**

**The repo already solved this exact problem** — `src/Core.TypeScript/hygiene/apt-job-timings.measured.json`
plus `refresh-apt-job-timings.ts`. The audit **reads only the committed snapshot** (*"a check whose data
source can fail open is the vacuity class"*); the JSON carries provenance (`measuredAt`, sampled
`runIds`, the sample `window`); it states its own honest limit (*"This is a committed SNAPSHOT"*); and
**the staleness guard is coverage, not freshness — the audit FAILS on any governed job the file does
not mention at all.**

That last mechanism is what transfers, and it answers Aaron's *"assuming it will drift over time":*

> **Key the machine model by the identity of the machine, and refuse when the identity is not in the
> file.** A row keyed by `(adapter vendor+device, driver version, OS build, backend version)`. A
> driver update **changes the key**, the row is absent, and lowering **fails loudly** instead of
> silently reusing a number measured against different firmware.

This inverts a hard problem into an easy one. Detecting *"this number drifted"* requires knowing the
true value — the thing you lack. Detecting *"I have never measured this machine"* is a dictionary
lookup. **Drift is not measured; it is made structurally undeniable**, and firmware/driver updates are
exactly the events that change the key. Cost: a driver bump blocks until the refresher is re-run —
the correct failure direction, since a check that did not run must never look like one that passed.

### 4.5 Answering §2.6's warning

Every portable system surveyed bought portability by **restricting control flow**, none by
**describing hardware more accurately**. This commitment does both: the classes are the restriction
(structure declared), the machine model is the description (magnitudes measured). **If the measured
half proves unmaintainable, the restriction half stands alone** and degrades to a conventional,
known-good design. That is the intended failure mode.

### 4.6 What this does not say

- **`WGSL_DLA` is not thereby a bug.** DLA growth is stochastic by nature, and the *statistical*
  observable (box-counted `D_f`) may well be robust to lane scheduling even though the *trajectory* is
  not. Those are different claims, and the file currently asserts substrate independence for the first
  while depending on the second being unobserved. Recorded as an open observation, not a defect
  report. (`D_f ≈ 1.322` carries repo history as a hardcoded-proxy incident; `computeDf`'s box-counting
  is real and no claim about the value is made here.)
- **It does not claim GPUs can be made deterministic.** It claims the nondeterminism can be
  *classified, declared, priced and refused* — strictly weaker, and achievable.

---

## 5. Honest costing — CGA versus 4×4 matrices

### 5.1 What CGA is, and that it is not a metaphor

**Conformal Geometric Algebra** (Hestenes) embeds Euclidean ℝ³ in Cl(4,1) with two null basis
vectors. A point becomes a **null vector** `P = x + ½|x|²e∞ + e₀`, and

```text
P · Q = −½ |x − y|²
```

**distance is one inner product.** Points, point-pairs, lines, circles, planes and spheres are all
*blades* of one algebra; rigid motions and uniform scaling are all *versors* acting by the same
sandwich product. *"Embed geospatial inside Clifford"* is CGA's defining construction — verified, and
verified as partly **already implemented**: `ConformalGA.fs` has `embed`, `inner`, `distSq`, `isNull`
(`P·P = 0`), and a Mercer-PSD Gaussian RBF over conformal distance.

### 5.2 What is missing — four fifths of CGA

`ConformalGA.fs` is **72 lines** and implements exactly one grade. Absent: **versors/motors** (rotors,
translators, dilators; the sandwich `V x Ṽ`) — without which CGA's headline property is unavailable
and the module is a distance function, not a geometry; **the round and flat objects as blades**;
**meet and join**; and **the general multivector** — `CPoint` is a **5-float record**, not an element
of the 32-dimensional Cl(4,1).

### 5.3 The costs

| cost | magnitude | eliminable? |
|---|---|---|
| dimension | Cl(3,0)=8, **PGA Cl(3,0,1)=16**, **CGA Cl(4,1)=32** components | **yes** — §5.4 |
| naive product | 32×32 = 1024 term-products vs 64 MACs for a 4×4 matrix ⇒ ~16× worse | **yes** — §5.4 |
| **precision** | the embedding stores **½\|x\|²** — coordinates are **squared** | **no** |
| ecosystem | no debugger, profiler or artist tool speaks blades | no |

**The precision cost is the one that does not go away, and it is the one that bites on a GPU.**
Squaring the coordinate doubles the exponent range and consumes mantissa; at `f32` — let alone the
`f16` GPU workloads reach for — a CGA point far from the origin loses significant bits *before any
arithmetic happens*. `ConformalGA.fs` conveniently exposes **both** paths (`distSq` via the conformal
`inner`, and `euclidSq` direct), so this is measurable against shipped code the moment measurement is
authorized. There is in-tree precedent for exactly that experiment shape: the belief-manifold study
swept five decades of units and found a **verdict inversion**.

**The win, as the tradeoff it is:** uniformity. One product for every transform; translations are
versors (they are *not* linear maps on ℝ³, which is why conventional pipelines patch around them with
homogeneous 4×4 coordinates); intersection is algebraic rather than case-analysed. Fewer special
cases means fewer branches, and fewer branches is **L0 pressure** — algebra and execution discipline
pull the same way. Real argument; not a free win.

### 5.4 Gaalop — GA's dimensional cost is a compile-time problem with published prior art

**Gaalop** (Hildenbrand et al., *Gaalop — High Performance Parallel Computing Based on Conformal
Geometric Algebra*) symbolically optimizes CGA expressions at compile time down to scalar arithmetic,
targeting CUDA and FPGA, explicitly aiming to beat conventional implementations. The mechanism:
**blade sparsity is statically known** — a conformal point occupies 5 of 32 coordinates and 27 are the
literal constant zero, so the general product's 1024 term-products collapse under constant folding.

**This is Halide's algorithm/schedule separation applied to an algebra:** the geometric product is the
algorithm, specialization to known-sparse blades is the schedule. **And we have an existence proof
in-tree** — `ConformalGA.fs` stores 5 floats and computes `inner` in 5 multiplies and 4 adds, a
hand-performed Gaalop specialization. It also demonstrates the cost of doing it by hand: you get one
grade and no versors (§5.2).

### 5.5 Signature choice is an invariant question, never a dimension count

`.claude/rules/numerology-vs-number-theory.md`, applied hard, because Clifford algebra is a
coincidence generator: 8 blades in Cl(3,0), 4 RGBA channels, 16 in PGA, 32 in CGA. **Every one of
those matches is worthless as evidence.** The repo's precedent is exact — *"sharing the length 8
identifies nothing"* — and the in-flight RGBA work applied the same bar to itself: *"the width match
is worthless as evidence… 4 is the dimension of the sufficient statistic."*

> **Choose the signature by the transformation group you need to be versors, not by dimension count.**

| you need | signature | components | discriminating invariant |
|---|---|---|---|
| rotations only | Cl(3,0) | 8 | rotors = unit quaternions; **compact** |
| rigid motions (rotation **+ translation**) as versors | **PGA Cl(3,0,1)** | 16 | a **degenerate** metric is what makes translation a versor |
| + rounds as blades, + uniform scaling | **CGA Cl(4,1)** | 32 | the conformal group; null-cone embedding |
| **boosts** / hyperbolic structure | Cl(2,1) | 8 | **non-compactness** — `Spin⁺(2,1) ≅ SL(2,ℝ)` |

**This rule has already been applied once here and it overturned shipped code.** The belief-manifold
study found `CliffordAntiSybil.fs`'s flat Cl(3,0) embedding wrong because Fisher–Rao on the Gaussian
family is **hyperbolic**, so the right algebra is **Cl(2,1) — not Cl(4,1), not Cl(3,0)** — stating in
its own words that *"the invariant that decides it is non-compactness, not a dimension count."* The
measured consequence: a detector whose verdict depended on the **units** of the believed quantity,
sweeping 0.9998 → 0.000006 across five decades. Same agents, same beliefs, opposite verdict.

That finding is also the reason §7 exists. **The last time this repo picked a Clifford signature
without a formal argument, it picked the wrong one and shipped it.**

---

## 6. The inversion: geometry as root, the Bayesian layer as a chart on it

**Aaron's decision** (§1, fourth quote): the 30-year geometric lineage is the **root**; the
Bayesian/Gaussian and Student-t work is an **optimization / fast approximation** retrofitted into it.
Registered **`proposed`**, under §0's warning.

### 6.1 Information geometry is the hinge — and it is the missing citation in this whole thread

**Amari** (*Differential-Geometrical Methods in Statistics*, 1985; Amari & Nagaoka, *Methods of
Information Geometry*, 2000) already unifies the two views:

- the space of probability distributions **is a Riemannian manifold** under the **Fisher information
  metric**;
- **exponential families are dually flat**, with a pair of dual affine coordinate systems — the
  **natural (canonical) parameters θ** and the **expectation parameters η** — related by Legendre
  transform;
- in θ-coordinates the e-connection is trivial, which is the register in which conjugate updating
  looks like translation.

**So NG4 is already a geometric statement written in statistics vocabulary.** That makes Aaron's
inversion a **renaming into the anchored register** rather than a re-architecture — much cheaper than
it sounds, and it means the Bayesian work already done is not discarded but **re-sited**. Whether the
third bullet is an *entailment* or a *coincidence of parameterisation* is **Q2** below; this brief
does not assert it.

### 6.2 It retroactively explains a measured finding nobody connected

**`metered`, and earned elsewhere.** PR #14268 measured, comparing 4-bit storage grids for a BNN
posterior:

```
per-channel QUANTILE grid (NF4, Dettmers 2023)          mean KL 10.88  ← 2.8x WORSE than uniform
quantile + 1% f32 outliers (LLM.int8(), Dettmers 2022)  mean KL  4.19
```

with the diagnosis stated in the review itself: *"quantile quantisation allocates by probability MASS
of values; KL between exponential-family members is governed by the FISHER metric. Every method
surveyed minimises an L2 on point weights, none targets a divergence."*

**That is an information-geometry observation, arrived at from measurement rather than from theory:
an L2 on parameters is the wrong metric because the manifold is not Euclidean in those coordinates.**
It is evidence the geometric root is already doing real work in this tree, and there is already a
minted work-item for the consequence (`081M0QMDM99087G0R0034D6EQP`, Fisher-metric quantiser). Cited as
evidence, not decoration.

### 6.3 What the inversion demands, and where the honesty risk is

If geometry is the root and the Bayesian layer is an *optimization*, then there must be a **geometric
object the Gaussian approximates**, and an **error**. If nobody can write that object down, then
"retrofit as optimization" is smuggling a **modelling change** under an **efficiency** label — and an
unstated modelling change is exactly what the register rules exist to catch. Amari supplies the
machinery to write it down, which is why this is answerable and why it is **Q3**, the question this
brief would put first.

### 6.4 Consequent reordering

Under the inversion, the DisCoCat / compact-closure question (**Q1**) sits **inside** the geometric
root rather than beside it: if `WeightedSet` is compact closed, it is the **linear-algebraic shadow**
of the geometric object — precisely the "fast approximation" role Aaron is assigning it. And
`LinguisticSeed.fs` is not a separate strand either: a **PSD kernel is a geometry** (Mercer /
Moore–Aronszajn — the kernel *is* an inner product in a reproducing-kernel Hilbert space, inducing
distances, angles and betweenness), so the metric half of "English is geospatial" is already
implemented in this tree under another name, and what is *missing* is exactly the Clifford half:
grade, orientation, the geometric product, and versors. That gap is **Q5**'s setting.

---

## 7. The theory brief — five questions for the math team

**These are questions, not results.** Each is stated so a mathematician can act on it without reading
the conversation that produced it. A question that cannot be answered *"no"* is not a question, so
each carries an explicit refutation condition and a stated cost of a negative answer.

**A parallel math-side agent is being launched against these. This document does not answer them** —
its job is to make them good, and to record the in-tree facts each one starts from.

---

### Q1 · Is `WeightedSet<'K,'W>` compact closed

**Precise statement.** Let `WeightedSet<'K,'W>` be the shipped type in `src/Core/WeightedSet.fs`:
finitely-supported maps `'K → 'W` with Zero pruned, over `'W : ISemiring`. Does the category of these
objects and `'W`-linear maps carry a **compact closed** structure — a monoidal tensor, a dual object
for each `'K`, and unit/counit (cup/cap) satisfying the **snake (triangle) identities**?

**Why Zeta cares.** DisCoCat (Coecke, Sadrzadeh & Clark 2010) composes meaning by **contraction**:
a pregroup parse (Lambek) reduces via cups and caps, and that is what lets a grammatical structure
*apply* one meaning vector to another. Without compact closure you have vectors, and a grammar, and
no way to combine them. Aaron's *"this should map directly to our wset — our universal-ish tensor"*
is the claim that we already own the right object.

**Facts in the tree the question starts from** (checked by reading the source, offered as input, not
as an answer):

- The exported operations are `empty · isEmpty · count · weight · ofSeq · singleton · add · negate ·
  subtract · scale · inner · mapKeys · sum · support · toSeq`.
- **There is no operation** `WeightedSet<'K1,'W> → WeightedSet<'K2,'W> → WeightedSet<'K1*'K2,'W>`.
  The module docstring says *"GraphBLAS-shaped: ⊕ = `add`, ⊗ = `scale`"* — but `scale` is
  multiplication by a **scalar** `'W`, the module action, **not** the monoidal tensor. *(The shared
  glyph ⊗ identifies nothing — `numerology-vs-number-theory` applied to a symbol.)*
- `inner` (`Σ_k a[k]·b[k]`) is cap-shaped and present.
- The cup `η : I → 'K ⊗ 'K` would require **enumerating the basis**. The type constraint is
  `'K : comparison` — **not finite, not enumerable**; `'K` may be `string`. No finiteness witness
  appears in the signature.
- `src/Core/Semiring.fs` states its axioms as *"(S, Add, Zero) … commutative monoid; (S, Mul, One) …
  monoid"* — **`Mul` is not required commutative** — and
  `tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs` defines `addCommutes` and has **no
  `mulCommutes`**. Every shipped instance (`IntegerRing`, `IntervalRing`) happens to be commutative.
- PR #14302 established by measurement that the object exhibited is **the free `'W`-module on a
  finite basis** — the finiteness is assumed there informally and is **not** in the type.

**What would count as an answer.** Either (a) a construction of ⊗, duals and cup/cap with the snake
identities proved — stating exactly which extra hypotheses are needed (finite enumerable basis?
commutative `Mul`? a field rather than a semiring?) — or (b) a proof that no such structure exists
under stated hypotheses, identifying which law fails.

**What would refute it.** Exhibiting a `'K` and `'W` admitted by the current type for which the snake
identities cannot hold. *(A candidate line: compact closure appears to need a fixed finite basis,
while `WeightedSet`'s open sparse key domain is the entire point of the type — Z-sets over arbitrary
records, DBSP-style. If those two are genuinely in tension, saying so precisely is the answer.)*

**Cost of a negative answer.** DisCoCat composition would need a different carrier, and *"wset is our
universal tensor"* would be false as stated — recoverable by restricting to a declared finite basis,
but that is a different type and the difference should be named rather than absorbed.

**Two limits the answer must not overstate.** PR #14302 measured that the map into `WeightedSet` is a
**monoid** homomorphism and **not a semiring** one — *"`WeightedSet`'s ⊗ has no Bayesian meaning under
`h`"* — so even a correct categorical ⊗ would give "one substrate" at the **linear-algebra** level and
**not automatically at the inference level**. And PR #14302 also found the parsers are **not
semiring-generic** (`src/Core/Sppf.fs` is hardcoded `float`, literal `1.0` as ⊗-identity, no
`ISemiring<'W>` parameter, single-oracle F# with no golden vectors), so a pregroup-contraction
implementation would hit that wall immediately.

**Bears on:** `src/Core/WeightedSet.fs`, `src/Core/Semiring.fs`,
`tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs`, `src/Core/Sppf.fs`.
**Anchors:** Kelly & Laplaza, *Coherence for compact closed categories* (1980); Selinger, *A survey of
graphical languages for monoidal categories*; Lambek, pregroups; Coecke, Sadrzadeh & Clark (2010);
Abramsky & Coecke (LICS 2004).

---

### Q2 · Does dual flatness *entail* the vector-addition update, or merely accompany it

**Precise statement.** For an exponential family with natural parameters θ, conjugate Bayesian
updating is addition in θ: `θ_post = θ_prior + Σᵢ T(xᵢ)`. Amari's theory says exponential families are
**dually flat**, with θ an affine coordinate system for the exponential connection. **Is the additive
update a theorem *derived from* dual flatness — so that it would be predicted for any dually flat
manifold in its e-affine coordinates — or is it a consequence of the conjugate-prior construction
that dual flatness merely *coincides with*, so that the geometry is descriptive rather than
generative here?**

**Why Zeta cares.** NG4's headline properties — exact associativity, branchless `float4` addition,
commutative fusion, bit-for-bit determinism over N parents — all rest on "update is addition". If
that is a **theorem of the geometry**, then §6's inversion is real content: the geometric root
*explains* the Bayesian layer, and the same reasoning should transfer to other families and other
charts. If it is an artifact of how conjugate priors are *defined*, the geometry is an elegant
re-description that predicts nothing new, and calling it "the root" would be **decorative
re-labelling** — a Beacon-register overclaim.

**What would count as an answer.** A statement of the exact hypotheses under which additivity
follows, and a worked example of a dually flat manifold whose affine coordinates do **not** give an
additive Bayesian update (or a proof that none exists).

**What would refute the strong reading.** Exhibiting the additivity as immediate from the definition
of conjugacy without invoking flatness.

**Cost of a negative answer.** §6's inversion survives as **organisation** but loses its claim to
**explanatory** force, and the doc must say so plainly rather than let "geometric root" imply a
derivation that was never performed.

**Bears on:** `src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.ts` (its `metered` associativity result
is what would be explained or left unexplained).
**Anchors:** Amari (1985); Amari & Nagaoka (2000); Diaconis & Ylvisaker (1979) on conjugate priors for
exponential families.

---

### Q3 · Can a Normal-Gamma posterior be exhibited as a region in a conceptual space under a named metric, with a stated approximation error

**This brief would put this question first.** Everything in §6 is downstream of it.

**Precise statement.** Exhibit the geometric object the NG4 encoding approximates. Concretely: name
the manifold, name the metric (Fisher–Rao? the dually flat structure's divergence? a Clifford
quadratic form?), name the point or region a given Normal-Gamma posterior **is** under that metric,
and **state the approximation error** — what is lost in passing from the geometric object to the
four-channel natural-parameter encoding.

**Why Zeta cares.** This is the load-bearing test of Aaron's *"the Bayesian stuff is an optimization /
fast approximation."* **If the object can be written down with an error term, "optimization" is true
and checkable.** If it cannot, then "retrofit as optimization" is an **unstated modelling change
wearing an efficiency label** — precisely the failure `toy-is-free-metered-must-be-earned` and the
vacuity discipline exist to catch. Note the trap runs in the honest direction too: the Bayesian layer
is the `metered` one, so an unwritable geometric object would mean the *unmeasured* layer had been
placed underneath the *measured* one with nothing connecting them.

**What would count as an answer.** A named manifold + metric + the embedding of NG4's four natural
parameters into it + an error bound (or an exactness proof, if the encoding is a chart rather than an
approximation — which is a possible and interesting answer: **an exact chart is not an
approximation**, and would mean "optimization" is the wrong word rather than a wrong claim).

**What would refute it.** A demonstration that no metric makes the Gaussian family a region in the
same space as the geometric/linguistic objects — i.e. that the two live in different spaces and the
"root/approximation" relation is a category error.

**Cost of a negative answer.** The inversion in §6 must be withdrawn or restated as *two parallel
substrates with a translation between them*, which is a materially weaker and much more expensive
architecture. Better to know before anything is built — which is the point of routing first.

**Bears on:** `toy-bnn-rgba-codec.ts`; the Fisher-metric quantiser row `081M0QMDM99087G0R0034D6EQP`;
`docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-*`.
**Anchors:** Amari & Nagaoka (2000); Čencov (1982) on the uniqueness of the Fisher metric;
Gärdenfors (2000) for the conceptual-space side of the join.

---

### Q4 · Does CGA compose with the Clifford substrate already in-tree, or do they merely share a name

**Precise statement.** `src/Core/ConformalGA.fs` works in **Cl(4,1)**. `src/Core/Cl3.fs` works in
**Cl(3,0)**. `src/Core/CliffordE8Roots.fs` / `CliffordE8BladeMask.fs` / `CliffordE8Bridge.fs` work in
the **E8 lineage** (E8 root system, blade masks, Construction A from the [8,4,4] doubly-even self-dual
code). `src/Core/CliffordPeriodicity.fs` (register **`metered`**) classifies `Cl(p,q)` by
**`p − q (mod 8)`** after Atiyah–Bott–Shapiro. **Is there a structure-preserving relation — a functor,
an embedding, a shared quotient — connecting these, or are they distinct algebras that share the name
"Clifford" and a repository?**

**Why Zeta cares.** `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` says the
structured special cases should be **earned quotients of one free generator**, not independent
hardcodings. If these four are genuinely related, the primitive set §2.7 identified as "ours" has a
single generator and the drift-correction property that rule claims. If they are unrelated, we have
four algebras with a shared prefix, and a "Clifford GPU library" would be an **umbrella term rather
than a substrate** — which is worth knowing before it is designed around.

**A specific numerology trap to disarm, offered as a worked instance rather than as a result.**
`Cl(3,0)` has `p − q = 3`; `Cl(4,1)` has `p − q = 3`. Both are `≡ 3 (mod 8)`, so ABS assigns them the
**same periodicity class**. **That is a matching count and it identifies nothing on its own** — the
same discipline `CliffordPeriodicity.fs` states in its own header (*"These are not three sightings of
the integer 8"*). The question is what, if anything, the shared class **entails** for transferring
constructions between them, given that their *geometries* are entirely different (one is Euclidean
3-space, one is a conformal model with a null cone). **Naming the invariant that does or does not
transfer is the answer; noting the shared residue is not.**

**What would count as an answer.** Either an explicit relation with its transfer property stated
(what carries across, what does not), or a clear statement that the algebras are independent and the
shared name is an accident of etymology.

**What would refute a unifying claim.** An invariant held by one and not the other that any
purported functor would have to preserve.

**Cost of a negative answer.** The E8/adinkra lineage and the graphics lineage would need to be
described as **separate programs**, and the repo's Clifford vocabulary would need splitting to stop
the two reading as one substrate. Cheap to do now, expensive later.

**Bears on:** `src/Core/Cl3.fs`, `ConformalGA.fs`, `CliffordPeriodicity.fs`, `CliffordE8Roots.fs`,
`CliffordE8Bridge.fs`, `CliffordE8BladeMask.fs`.
**Anchors:** Atiyah, Bott & Shapiro, *Clifford Modules* (1964); Hestenes & Sobczyk; Dorst, Fontijne &
Mann (2007); Gunn on PGA; Conway & Sloane (Construction A); Gates on adinkras and doubly-even
self-dual codes.

---

### Q5 · Is Gärdenfors convexity testable on any embedding we can actually build

**Precise statement.** Gärdenfors (*Conceptual Spaces: The Geometry of Thought*, 2000) holds that
meanings are **regions** in geometric spaces built from quality dimensions, and that **natural
concepts correspond to CONVEX regions** — betweenness carries semantic content. Aaron's *"English is
geospatial, at least a closed subset we can define as our minimal linguistic seed"* is this thesis,
reached independently. **Is the convexity criterion testable on an embedding Zeta can construct — and
in particular on the RKHS induced by a `LinguisticSeed` kernel — or does the test require a
coordinate structure (named quality dimensions, a specific metric) that a kernel-induced embedding
does not supply?**

**Why Zeta cares.** This decides whether *"English is geospatial"* **has a falsifier at all**. Without
one it stays an intuition — a good one, and Aaron's phenomenological report of *seeing English
geometrically* is authoritative about his own experience — but not a claim the repo can carry in the
Beacon register. Convexity is the sharpest testable core the theory has.

**A register split that must be preserved** (`.claude/rules/engagement-profiles-*`): *"I see English
geometrically in my head"* is a **first-person report**, authoritative about experience and **not
evidence for the formal claim**; *"English is geospatial"* is a **formal claim** needing a falsifier.
Keeping them apart is what lets the theory be tested without the report being doubted.

**Facts in the tree the question starts from.** `src/Core/LinguisticSeed.fs` composes kernels
`k : 'x → 'x → float` that are **PSD by construction** — only Mercer-closure operations are exposed
(sum, Schur product, nonnegative scale, feature map, pullback), so *"compositions outside the closure
can't be expressed, so they can't break PSD."* By Mercer / Moore–Aronszajn a PSD kernel **is** an
inner product in an RKHS, inducing `d²(a,b) = k(a,a) − 2k(a,b) + k(b,b)`, angles, and betweenness. So
a metric geometry over linguistic objects **already exists in this tree**. What it does **not**
supply is Clifford structure: grade, orientation, the geometric product, versors. Separately,
`ConformalGA.rbfKernel` is **already a `LinguisticSeed.Kernel`** and `memoryPack` is a
`LinguisticSeed.Pack` — the join between conformal geometry and the seed language is a shipped line
of code, currently used for memory distance rather than word distance.

**What would count as an answer.** A statement of the minimal structure convexity-testing requires,
whether an RKHS supplies it, and — if it does — the precise form the test takes (geodesics in an RKHS
are straight lines in the feature space; whether that is the right notion of "between" for
Gärdenfors' claim is exactly the question). Any proposed test **must include a negative control**:
categories agreed to be non-natural (disjunctive ones — *"things that are either red or prime"*)
should come out **non-convex**. A test where everything passes has measured nothing.

**What would refute it.** A demonstration that convexity is not well-defined, or is trivially
satisfied, in kernel-induced embeddings — which would make the criterion untestable *by us* even if
true in principle.

**Cost of a negative answer.** *"English is geospatial"* stays in the `proposed` register
indefinitely, and the Clifford framing of the linguistic half would carry no evidential weight beyond
the RKHS that already works. That is survivable; asserting otherwise is not.

**Bears on:** `src/Core/LinguisticSeed.fs`, `src/Core/ConformalGA.fs`.
**Anchors:** Gärdenfors (2000); Lakoff & Johnson, *Metaphors We Live By* (1980); Johnson on image
schemas; Talmy, *Toward a Cognitive Semantics*; Mercer / Moore–Aronszajn.

---

### 7.6 A sixth question, held back deliberately

*"Memetic understanding"* has **two** definitions in this tree and they may or may not be one thing.
The 2026-06-08 program
(`docs/research/2026-06-08-the-memetic-mapping-research-program-*`) defines it **symbolically** —
memes as control structures, `meme = quine = eval fixed point`, mapped through `Bonsai.Expr`
homoiconicity, with F1–F5 falsification criteria already written. Aaron's new clause defines it
**geometrically**, via English-as-geospatial. **This is a question for Aaron, not for the math team**,
and it is recorded in §9 rather than §7 because guessing at it would be the worst thing this brief
could do. Nothing blocks on the answer: **Q1 and Q5 are the crux under either reading.**

---

## 8. Register table

| claim | register | basis |
|---|---|---|
| SPIRV-Cross MSL drops `OpMemoryBarrier` | **checked** | Khronos SPIRV-Cross docs |
| SPIR-V has named reconvergence execution modes | **checked** | `SPV_KHR_maximal_reconvergence`; `SPV_KHR_subgroup_uniform_control_flow` |
| `__syncwarp` named a previously-implicit consensus | **checked** | CUDA 9.0 deprecation of legacy warp primitives; Volta ITS |
| Slang targets all six backends; Khronos-governed | **checked** | Khronos announcement; shader-slang.org |
| WGSL subgroups unstandardized as of 2026 | **checked** | gpuweb proposals; WGSL WG minutes 2026-03 |
| CGA embeds Euclidean geometry as blades | **checked** | Hestenes; implemented in `ConformalGA.fs` |
| `ConformalGA.fs` implements one grade only | **checked** | read the 72 lines |
| `WGSL_DLA` races on `cluster` | **checked** | read the shader: non-atomic `array<u32>`, no barrier |
| `SemiringRing.Laws` has no `mulCommutes` | **checked** | read the test file |
| `WeightedSet` has no categorical tensor; no finiteness witness | **checked** | read the signatures |
| Gaalop collapses CGA to scalar code | **checked** (published) | Hildenbrand et al. |
| NF4 quantile grid 2.8× worse by KL; Fisher-metric diagnosis | **`metered`** (earned in PR #14268) | cited, not re-derived |
| NG4 round-trips at max KL 4.0e-8 | **`metered`** (earned in PR #14268) | cited, not re-derived |
| Clock: meter the crossing, key the model by machine identity | **design commitment** | Aaron 2026-08-23 |
| Geometry is the root; Bayesian is a chart | **`proposed`** | Aaron 2026-08-23; §7 Q2/Q3 test it |
| `WeightedSet` is / is not compact closed | **open** | Q1 |
| dual flatness entails additive update | **open** | Q2 |
| an NG4 posterior is a region under a named metric | **open** | Q3 |
| the in-tree Clifford modules are one substrate | **open** | Q4 |
| Gärdenfors convexity is testable here | **open** | Q5 |
| PGA is the right default for rendering | **`proposed`** | invariant argument, unmeasured |

**Nothing in this document is `metered`.** The two `metered` rows were earned elsewhere and are cited.

---

## 9. Work-items and open questions for Aaron

### 9.1 The one work-item

**Await the formal analysis.** A single row: hold all Clifford-GPU implementation until the math team
returns on Q1–Q5, with the questions as its acceptance criteria. **No code, no lowering, no
classifier, no measurement.** Id in the PR body.

It **composes with** (does not duplicate):

- `docs/backlog/P3/081KQTPYE0008QG0R002Y7X5KH` — tinygrad UOp IR / universal IR (§2.7 answers *adopt*,
  and names Slang);
- `081M0QMDM99087G0R0034D6EQP` — Fisher-metric quantiser (§6.2's already-minted consequence).

### 9.2 Questions for Aaron

1. **`memetic understanding` — the 2026-06-08 symbolic program, or a new geometric one?** (§7.6.)
   These may be one claim (the homoiconic structure *is* the geometry) or two. The answer decides
   whether that program's stage 3 gets a new tool or a competitor. Nothing blocks on it.
2. **Which closed subset of English is the minimal linguistic seed?** Q5's test needs a concrete word
   list. The smallest useful answer is ~50 words containing a few natural categories and at least one
   deliberately disjunctive category for the negative control.
3. **PGA or CGA as the rendering default?** §5.5 argues PGA on the invariant — rigid motions are the
   group a renderer needs, and PGA is the smallest algebra making them versors. CGA buys rounds and
   conformal maps at 2× the components plus the unavoidable precision cost. This is a question about
   what the library is *for*, and Q4 informs it without settling it.

---

## 10. Pointers

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — §0, §8
- `.claude/rules/numerology-vs-number-theory.md` — §5.5, Q1's ⊗ glyph, Q4's mod-8 trap
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — §4.2's litmus at the GPU layer
- `.claude/rules/anchor-to-human-prior-art.md` — anchors checked, not cited
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — Q4's motivation
- `.claude/rules/interfaces-free-classes-earned-under-rules.md` — Q1's finiteness witness as earned structure
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — §2.5's oracle-vs-hub test on Slang
- `.claude/rules/clone-at-tag-stays-sufficient.md` — §2.3's bootstrap constraint
- `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md` — Q5's register split
- `src/Core/Cl3.fs` · `ConformalGA.fs` · `CliffordPeriodicity.fs` · `LinguisticSeed.fs` · `WeightedSet.fs` · `Semiring.fs`
- `demo/identity-dla-site/src/components/OracleWebGPU.tsx` — §4.1's worked instance
- `src/Core.TypeScript/hygiene/apt-job-timings.measured.json` + `refresh-apt-job-timings.ts` — §4.4's precedent
- `docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-*` — §5.5's worked instance
- `docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-*` — §6.2, Q2, Q3
- `docs/history/pr-reviews/PR-14268-*` · `PR-14302-*` — the `metered` findings cited
- `docs/research/2026-06-08-the-memetic-mapping-research-program-*` · `2026-06-08-the-memetic-quantum-observer-*` — §7.6, §3 correction 3

### Beacon anchors

**Parallel/compilation:** Valiant, *A Bridging Model for Parallel Computation* (CACM 1990) ·
Fatahalian, Horn, Knight et al., *Sequoia: Programming the Memory Hierarchy* (SC'06) · Ragan-Kelley
et al., *Halide* (PLDI 2013) · Chen et al., *TVM* (OSDI 2018) · Lattner et al., *MLIR* (CGO 2021) ·
He, Foley & Fatahalian, *Slang* (SIGGRAPH 2018) · Henriksen et al., *Futhark* (PLDI 2017) · Hu et al.,
*Taichi* (SIGGRAPH Asia 2019).
**Geometric algebra:** Hestenes & Sobczyk, *Clifford Algebra to Geometric Calculus* · Dorst, Fontijne
& Mann, *Geometric Algebra for Computer Science* (2007) · Gunn on PGA · De Keninck (`ganja.js`) ·
Hildenbrand et al., *Gaalop* · Atiyah, Bott & Shapiro, *Clifford Modules* (1964).
**Information geometry:** Amari, *Differential-Geometrical Methods in Statistics* (1985) · Amari &
Nagaoka, *Methods of Information Geometry* (2000) · Čencov (1982) · Diaconis & Ylvisaker (1979).
**Categorical / linguistic:** Lambek, pregroups · Coecke, Sadrzadeh & Clark (2010) · Kelly & Laplaza
(1980) · Selinger, *A survey of graphical languages for monoidal categories* · Abramsky & Coecke
(LICS 2004) · Gärdenfors, *Conceptual Spaces* (2000) · Lakoff & Johnson (1980) · Talmy · Mercer /
Moore–Aronszajn (RKHS).
