# Learning geometry from pictures is a second track, and efficiency is its entry fee

Work item: 081M2439BGM087G0R002AQ9ENP · 2026-09-09 · author: the shadow (Claude Opus 5)

Source material, quarantined separately:
[the supplied Two Minute Papers transcript and the four papers it covers](../ip-questionable/2026-09-09-two-minute-papers-deformation-topology-ferrofluid-simulation-transcript.md).
This document restates every fact it needs and survives that file being deleted.

**This is a direction document. It implements nothing, it adds no falsifier, and no claim in
it is metered.** Registers are stated per claim in §7. Where a connection is a resemblance
rather than an identification, it is labelled as one under
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md).

---

## 0. What Aaron said, and the one thing that changed while this was being written

> *"i'm pretty sure this is where our bayesian is going to come in and connect to our
> existing stuff, we want to learn the geometries based on pictures and or existing assets
> and materials ... What we are drawing are going to be geometries approximated in bayesian,
> in a perfect world our shapes would be somewhat fractal / vectorized in 3d ... i also
> imagine this like iterated drawing maybe kind of like tessellation but we are just drawing
> higher accuracy at different distances."*

The standing preference this collides with is *"our rendering surface should only come from
our clifford — if we can't generate it from clifford that's not our research."* Mid-draft,
Aaron relaxed it:

> *"okay i've learned a lot here, this is not load bearing but preferred, a 2nd track would
> be okay if we can see the efficiency gains."*

**So the question this document was originally going to answer — *can a learned geometry
satisfy derived-not-authored?* — is no longer the deciding question.** Derived-from-Clifford
is a **preference**; a learned track is **sanctioned**; and the condition is that the
efficiency gains be **visible**. That relocates the whole burden onto §5, which is about how
you would see them.

Two things do not change, and §5 says both out loud:

1. A second track whose gains are unquantified is the shape this repo refuses everywhere
   else. "We can see the efficiency gains" is a **measurement requirement**, not a mood.
2. **Where both tracks work, the derived one is preferred.** This is permission to explore,
   not a redirection.

---

## 1. The four papers, correctly identified

The transcript covers four 2024 ACM TOG papers. The video's framing and the publishers'
own claims disagree in three of the four cases; the ferry record carries the detail. In one
line each:

| # | paper | what it actually claims |
| --- | --- | --- |
| 1 | Trusty, Fei, Levin & Kaufman, *Trading Spaces: Adaptive Subspace Time Integration for Contacting Elastodynamics*, TOG 43(6), [10.1145/3687946](https://doi.org/10.1145/3687946) | an adaptive **subspace** simulator with an in-time-step oracle and two user tolerances; tighter tolerances **converge to the full-space solution**, looser ones give output-bound cost. 2.5M tets confirmed. **The video's "3 to 300× faster" does not appear in the paper**; it reports 6–40× on timestep solves, up to 70× on one baseline, >10× against IPC-LLT |
| 2 | Zhang, James & Kaufman, *Progressive Dynamics for Cloth and Shell Animation*, TOG 43(4) art. 104, [10.1145/3658214](https://doi.org/10.1145/3658214) | coarse-to-fine LOD simulation with **"tight-matching consistency"** across levels — see §4, where this is the strongest match in the link set and also the one the video overstates |
| 3 | Heiss-Synak, Kalinov, Strugaru, Etemadi, Yang & Wojtan, *Multi-Material Mesh-Based Surface Tracking with Implicit Topology Changes*, TOG 43(4) art. 54, [10.1145/3658223](https://doi.org/10.1145/3658223) | converts **self-intersections into topological changes** on non-manifold multi-material meshes. The video calls this z-fighting; z-fighting is a depth-buffer artifact and this is not that |
| 4 | Ni, Wang, Wang & Chen, *An Induce-on-Boundary Magnetostatic Solver for Grid-Based Ferrofluids*, TOG 43(4) art. 56, [10.1145/3658124](https://doi.org/10.1145/3658124) | a **single-layer-potential** boundary solver using only the surface point cloud, eliminating the linear-system solve. Here the video's "only compute on the shell" is a fair plain rendering |

**Paper 3 is worth one extra sentence for us specifically, because it is about our own
theorem.** The roadmap records that every rank-3 projection of a 2-complex self-intersects
(Whitney 1936), measured as an overdraw ratio of 598–834 across 116 frames, and concludes
that no choice of projection repairs it. Paper 3 is a published method whose entire subject
is *what to do about a self-intersecting surface* — it converts the intersection into a
topology change rather than trying to avoid it. That is a **different response to the same
theorem** than the roadmap's Phase 1 (find content whose 2-skeleton embeds), and it is worth
knowing the option exists. It is not adopted here; it is named.

---

## 2. Connection A — the Bayesian fit, tested rather than asserted

### 2.1 The claim on the table

PR #17162 measured that 3DGUT transfers nothing to today's pipeline because our 8D→3D map
is **linear**: the Unscented Transform and the EWA linearisation it replaces agree to
**6.7e-16 mean / 7.1e-15 covariance** across every UT parameterisation. The proposed reading
is that *learning* a geometry from images is **inverse** and **nonlinear**, which is the
regime the UT and the repo's EP machinery are actually for.

### 2.2 What is genuinely shared

The common parent is already established in-tree and is not a resemblance: **EP is ADF
iterated to a fixpoint (Minka 2001), and the UKF is ADF whose moment integrals are evaluated
by unscented quadrature.** Both do the same thing — project a non-exponential-family belief
back to the family by matching moments. `src/Bayesian/Ep.fs` implements exactly that
cavity → tilt → project → divide cycle. So "the UT and our EP are siblings" is structural.

### 2.3 What is NOT shared, and this is the invariant the count hides

**"Nonlinear inverse problem" is a count, not an identification.** Name the competitors:
Levenberg–Marquardt, bundle adjustment, variational inference, MCMC, and plain gradient
descent under autodiff are *all* methods for nonlinear inverse problems, and 3DGS-style
geometry learning uses the last of these. If the only property invoked is "the map is
nonlinear", the UT is not distinguished from any of them.

The invariant that would distinguish it:

> The UT is a **quadrature rule for the pushforward of a Gaussian through a known map**. It
> earns its place only in a formulation that (a) carries a **Gaussian belief over the
> geometry parameters**, and (b) needs the **moments of a nonlinear function of that belief**
> — which in an inverse problem means the measurement update, where the cross-covariance and
> the gain are computed from sigma points.

So the honest split:

| formulation for learning geometry from images | is the UT the right tool? |
| --- | --- |
| **recursive Bayesian estimation** — a Gaussian (or EP-family) belief over geometry parameters, updated per observed image | **yes, structurally.** This is the UKF measurement update, and the UT is what makes it tractable without Jacobians |
| **EP over a factor graph** — geometry parameters as variables, per-image likelihoods as non-conjugate factors | **yes, and this is the in-tree-shaped one.** `Ep.fs` already handles non-conjugate factors by moment matching; a per-image observation factor is exactly that species |
| **gradient descent against a re-rendering loss** (what 3DGS actually does) | **no.** The UT plays no role; there is no belief, only a point estimate |

**The finding:** the fit is real, but it is real *for a formulation we have not chosen*. It
is not licensed by the word "nonlinear". Choosing the recursive/EP formulation is what makes
the Bayesian machinery relevant; choosing the gradient-descent formulation makes it
irrelevant, and the choice has not been made. Register: `toy`.

### 2.4 The honest limit on "our EP machinery is ready"

It is not. `src/Bayesian/FactorGraph.fs` says so about itself, in the `runToFixpoint`
docstring: the loop *"structurally **is** the DBSP `NestedCircuit.Fixedpoint`"*, and *"wiring
the factor graph as literal DBSP operators — for **incremental re-inference on a data delta**
— is the next integration (slice 4b)."* Read plainly: today the factor graph runs its own
`while` loop, capped, and the DBSP connection is a **stated correspondence and named future
work, not an implementation.** Anyone citing "our EP already runs on DBSP" is citing an
intention. Register of the correspondence: `unmetered`, and it is the module's own word.

---

## 3. Connection B — "higher accuracy at different distances" and whether DBSP is the substrate

### 3.1 The claim on the table

PR #17158 found that the property wanted under a scene graph is `O(Δ)` change propagation;
that it has shipped twice at HPG in the Aardvark platform (Wörister et al. 2013; Haaser et
al. 2015), mostly in F#; that its anchor is Acar, Blelloch & Harper's *Adaptive Functional
Programming* (POPL 2002 / TOPLAS 2006); and that **Zeta already owns the strongest algebraic
form of it in DBSP** (Budiu et al.).

### 3.2 The distinction the claim glosses — two different deltas

Progressive refinement by distance is *a* delta. It is not obviously *the* delta DBSP
incrementalises. Two candidates, and they behave differently:

| | what changes | does DBSP's guarantee apply? |
| --- | --- | --- |
| **(a) scene delta** | an object is added, removed, or moves | **yes, straightforwardly.** This is an insertion/retraction in a Z-set, which is what DBSP is *for*, and it is exactly what Aardvark's Mod system delivers as `O(Δ)` |
| **(b) LOD delta** | the camera moves closer, so a face is *replaced by its refinement* | **only under a condition** — see below |

DBSP's incrementalisation theorem gives `Q^Δ` for operators over abelian-group-valued
streams, with cost proportional to the change. A refinement can be written in that language:
retract the coarse face, insert its children. But `O(Δ)` is only *bought* if the refinement
is **local** — i.e. refining one face must not change the value of any unrefined face. If
refinement is coupled across levels, the delta is not small and the algebra buys nothing.

### 3.3 The falsifier this needs, stated so it can fail

> Express an LOD hierarchy as a Z-set keyed by `(face-id, level)`. Move the camera by one
> LOD step. **Measure how many Z-set entries change against the number of faces whose level
> changed.** If the ratio is `O(1)`, DBSP is the substrate. If the whole scene's entries move,
> DBSP is a vocabulary, and the `O(Δ)` claim is a resemblance.

That is cheap to run and it can return a negative. Nothing in this document runs it.

### 3.4 And there is a known counterexample on the simulation side

Progressive Dynamics (paper 2) is **not** local across levels, deliberately: its coarse-level
proxy energies are built by *sampling and restricting fine-level gradients*, and it uses
horizontal and vertical warm-starting between levels. The coupling is the mechanism, not an
accident — it is **why** the levels agree. So:

> **Rendering LOD is plausibly local; simulation LOD demonstrably is not.** A single "LOD is
> a Δ, so use DBSP" claim covering both would be wrong on the second half.

Register for §3 as a whole: `toy`. The Aardvark/Acar/DBSP anchors are checked and real; the
application to LOD is a proposal with an unrun falsifier.

---

## 4. Connection C — what Progressive Dynamics actually claims, and the idea worth taking

### 4.1 The claim is weaker than the video's, and the paper says so

| | wording |
| --- | --- |
| video narration | "the outcome **remains the same** when running the full workload afterwards" |
| paper abstract | "maintaining the **overall physical behavior**"; "preserves the preview's **physical narrative**" |
| paper §5 | "close **first-order** consistency in the overlaid trajectory's kinetic energies" |

The paper additionally **documents a divergence** rather than claiming none: in the *Bouncy
Jumble* benchmark one cube "begins to diverge by a small but significant amount from the
positions predicted for it by coarser levels", peaking at frame 91, with the trajectories
re-matching by frame 94.

**So it is the strongest match in Aaron's link set to what he described, and it is not the
guarantee the video reports.** It is a demonstrated close consistency with a named,
recovering exception. Anyone building on "the coarse preview is the fine result" would be
building on the narration, not the paper.

Reported speedups, since they are the honest half: 21×, 30×, 52× and 75× for preview steps
against the direct fine-level previews they replace, at roughly 2× overhead versus a direct
simulation at the same coarse resolution.

### 4.2 The transferable idea, and it is the best thing in this document

Strip the overstatement and ask *why* the levels agree at all. The answer is the mechanism:

> **The coarse level is DERIVED from the fine level.** Its energy is not an independently
> authored coarse model; it is built from fine-level gradients, sampled and restricted down,
> through nonlinear prolongation operators between mesh levels.

That is **derived-not-authored applied to level-of-detail**, by an outside group, published,
with measurements. It is the same discipline this repo enforces on its geometry, arrived at
independently and for a purely practical reason: a coarse model that was fitted separately
*does not agree with its own refinement*, and the paper's own introduction says that is the
prior state of the art it is fixing.

**Why this matters for §5:** it is the existence proof that a cheap approximate level can
carry a derivation from an exact one. That is the shape the second track should take if it
wants to keep the preference — and it is a *design*, not a compromise.

Register: the paper's claims are `metered` **by its authors, not by us** — we have read the
PDF and quoted it; we have run nothing. The application to Zeta is `toy`.

---

## 5. "Fractal / vectorized in 3D", and the second track's entry fee

### 5.1 We already have the property Aaron is describing, and it has a number

The derived path ships **the derivation, not the output**:

| | bytes |
| --- | --- |
| `demo/clifford-e8/clifford-e8-substrate.js` — the generator that computes the geometry | **27,621** |
| the geometry it computes, as float32 (60,480 faces × 3 vertices × 3 coordinates × 4 bytes) | **2,177,280** |
| ratio | **78.8×** |

That is "vectorized in 3D" in the only sense that has ever been measured here: the asset is a
*program*, and the program is two orders of magnitude smaller than its output. The roadmap
also records that the property **survives the move to rank 3** — an H3 seed (30 roots in
`Z[φ]`, one norm class, rank 3, no projection) is *smaller* than the E8 one.

### 5.2 The tradition this sits in

The Beacon anchors, old and modern, because the idea is not new and should not be re-coined:

- **Old.** Mandelbrot, *The Fractal Geometry of Nature* (1982). Lindenmayer's L-systems, with
  Prusinkiewicz & Lindenmayer, *The Algorithmic Beauty of Plants* (1990) — grammar as asset.
  Blinn's blobby models (1982) and Perlin noise (1985) — the procedural-texture lineage
  collected in Ebert et al., *Texturing & Modeling: A Procedural Approach*. Hart's sphere
  tracing (1996) — rendering an implicit surface without ever tessellating it.
- **Modern, and these are the learned ones.** DeepSDF (Park et al., CVPR 2019), Occupancy
  Networks (Mescheder et al., CVPR 2019), NeRF (Mildenhall et al., ECCV 2020), Instant-NGP
  (Müller et al., SIGGRAPH 2022), 3D Gaussian Splatting (Kerbl et al., SIGGRAPH 2023).

**A vocabulary note, because the collision is already live in-tree.** "Tessellation" in Zeta
today means rung 3's decomposition of `R⁸` into the four orthogonal invariant 2-planes of the
Coxeter element — a partition in which every root's squared length distributes across layers
and sums back exactly. Aaron's "kind of like tessellation but we are just drawing higher
accuracy at different distances" is the *other* tessellation: adaptive subdivision by
distance. Same word, unrelated constructions. Recorded under
[`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
so the two do not merge by accident.

### 5.3 Where a learned representation sits against `only-the-irreducible-is-primitive`

The rule says: generate from the irreducible free object; every structured special case is an
**earned quotient obtained by declaring its relations**.

- A **procedural / implicit / fractal** representation satisfies the rule cleanly. It *is* a
  generator, and its relations are declared.
- A **learned** representation is a generator whose relations were **fitted**. It satisfies
  "generate the rest"; it does not satisfy "declared". Nothing in it can be regenerated from
  a stated relation, so the generator-as-ECC half of the rule — regenerating *is* the
  correction — has nothing to regenerate from.

That is a real difference and it is not a value judgement: it says precisely which property
is lost, so the second track knows what it must replace.

### 5.4 What a learned representation does to "0 bytes of geometry" — and the answer is measurable

**It does not automatically preserve it, and on current evidence it usually destroys it.** A
learned field's payload *is* its parameters. Published representations in this family run
from megabytes (hash-grid encodings) to hundreds of megabytes (splat scenes) for a single
scene, against 27,621 bytes here. On the payload axis, the derived track is expected to win
by orders of magnitude.

**But that expectation is a prediction, and it is exactly the thing Aaron's condition asks to
see measured.** A small learned generator — one whose *program* is fitted but tiny — would
falsify it, and that is a real possibility worth leaving open rather than assuming away.

### 5.5 The entry fee, stated as four numbers

Aaron sanctioned the second track *"if we can see the efficiency gains."* Making that
checkable is the whole of this section. The repo already has the axes and the harness; the
proposal is to **reuse them, not to invent a parallel evaluation**.

> **A learned-geometry track earns its place when, on one scene, it reports all four of:**
>
> 1. **Payload, in bytes,** against the derived path's **27,621** (and against the 2,177,280
>    bytes of output both are alternatives to).
> 2. **Cost per sample, in nanoseconds,** on the same machine, against the measured
>    **mat4 1.81 / motor 3.03 / 8D-then-project 45.5** ns-per-vertex table.
> 3. **The fraction of pixels it moves against the exact build.** This is not a new rule —
>    it is the roadmap's existing one: *"the exact build is the ORACLE; every fast path ships
>    the measured fraction of pixels it moves against that oracle, and a fast path whose
>    divergence is unmeasured does not ship."* A learned geometry is a fast path under that
>    rule and needs no exemption from it. The scale is already calibrated: SBVH moves **zero**
>    pixels, triangle subdivision moves **2.9%** for 7.4×, and a **one-ulp** perturbation of
>    the scene moves **2.40%** — so 2.4% is roughly the floor that float32 imposes anyway.
> 4. **What it can represent that the derived track cannot.** Stated as a scene, not as a
>    capability adjective.
>
> **Fewer than four is not a comparison.** Three of the four can return a negative, which is
> what makes this an entry fee rather than a formality.

### 5.6 The uncomfortable part, said rather than reframed

Line up the expected answers and the argument for the second track does not sit where the
condition puts it:

| axis | expected direction |
| --- | --- |
| 1 payload | derived wins, probably by 10²–10⁴× |
| 2 ns/sample | genuinely unknown; a rasterised splat can be very fast, a neural field evaluation is not |
| 3 pixels moved vs the oracle | derived wins by construction — it *is* the oracle |
| 4 coverage | **learned wins, and it is not close** — the derived track cannot represent a photographed object at all |

So the honest reading is:

> **The second track's real case is (4), and (4) is a coverage argument, not an efficiency
> argument.** If it is adopted on the strength of "we can see the efficiency gains", the
> stated condition and the actual justification will have come apart, and later readers will
> inherit a claim nobody measured.

Naming that now is cheaper than discovering it later. Two ways it resolves honestly, and both
are fine:

- **Measure (2) and find a real win.** Entirely possible — rasterising fitted primitives is
  fast, and that is a number, not a hope. Then the condition is met as stated.
- **Adopt it for coverage and say so.** Coverage is a legitimate reason for a second track.
  It is simply a different reason, and the write-up should carry the reason it actually had.

The one path this document argues against is adopting it for coverage while citing
efficiency.

### 5.7 The design that keeps the preference anyway — and §4 supplies it

There is a construction under which a cheap track keeps a derivation, and it is not
hypothetical: it is what Progressive Dynamics does.

> **Derive the approximate level FROM the exact one by restriction, rather than fitting it
> independently from images.** Each coarse element then records which exact elements it
> restricts — a **root index by construction**, which is precisely the property PR #17162
> found a fitted Gaussian lacks (*"a fitted Gaussian has no root index; fitting is the
> inverse operation to deriving"*, and mutant M2 — one hand-authored vertex — kills the
> provenance test).

This splits Aaron's direction into two genuinely different projects, and only one of them
gives up the preference:

| project | derivation? | what it is for |
| --- | --- | --- |
| **LOD by restriction** — cheap levels derived downward from exact geometry | **kept** | drawing our own content at different distances. This is "iterated drawing / higher accuracy at different distances" in the derived track, with no second track needed |
| **Reconstruction** — fitting geometry to photographs and existing assets | **given up** | representing things we did not derive. This is the genuine second track, and §5.5 is its entry fee |

**Aaron's sentence contains both** — *"learn the geometries based on pictures **and or**
existing assets and materials"*, plus *"drawing higher accuracy at different distances"* —
and they have been treated as one direction throughout. They are not one direction. Splitting
them is the single most useful thing in this document, because the first half costs nothing
and the second half is the one that needs the four numbers.

---

## 6. What this document does not know

- Whether the LOD-as-Z-set delta is local. §3.3 states the falsifier; nobody has run it.
- Whether a learned representation can be small. §5.4 predicts it cannot and offers the
  measurement that would refute the prediction.
- Whether the recursive/EP formulation of geometry learning is tractable at any useful scale.
  §2.3 says it is the formulation in which the Bayesian machinery is relevant; that is a
  statement about *relevance*, not about *feasibility*.
- Whether the roadmap's Phase 1 (find content whose 2-skeleton embeds) or paper 3's approach
  (convert self-intersection into topology change) is the better response to Whitney. Both
  are on the table; neither is costed.
- Anything about ferrofluids, elastodynamics or cloth as Zeta work. Papers 1, 3 and 4 are
  identified for the record and are not proposed.

---

## 7. Register table

| claim | register | basis |
| --- | --- | --- |
| Identity, authorship and venue of papers 1–4 | **CITED — checked** | each PDF downloaded and its own front matter read; DOIs recorded |
| "3–300× faster" is absent from paper 1 | **CHECKED (negative)** | full-text search of the supplied PDF for `300` / `faster` / `speedup` / `speed-up`; what it does report is quoted |
| Paper 2 claims close first-order consistency, not identity of outcome, and documents a divergence | **CITED — checked** | abstract and §5 quoted from the PDF |
| `Ep.fs` implements cavity→tilt→project→divide; `FactorGraph.runToFixpoint` runs its own capped loop and names DBSP wiring as future work | **VERIFIED in-tree** | read at `src/Bayesian/Ep.fs`, `src/Bayesian/FactorGraph.fs` |
| 27,621-byte generator vs 2,177,280-byte output; 6.7e-16 UT/EWA agreement; 598–834 overdraw; 1.81/3.03/45.5 ns; 2.9% and 2.40% pixel-movement | **metered — by prior work, not re-run here** | PR #17162 and the 2026-09-09 roadmap and representation-layer records |
| UT/EP is the right machinery for *recursive or EP* geometry learning | **toy** | argued structurally in §2.3; nothing built, nothing measured |
| DBSP is the substrate for LOD | **toy** | §3.3 states the unrun falsifier that would decide it |
| A learned representation destroys the payload property | **toy — a prediction** | §5.4; refutable by a small learned generator |
| The four-number entry fee | **proposal** | §5.5; reuses the roadmap's existing oracle rule rather than inventing one |
| LOD-by-restriction keeps the derivation | **toy** | §5.7; the mechanism is published (paper 2), the application to Zeta is unbuilt |

---

## 8. Anchors

**Incremental computation.** Acar, Blelloch & Harper, *Adaptive Functional Programming*
(POPL 2002 / TOPLAS 28(6) 2006). Wörister, Steinlechner, Maierhofer & Tobler, *Lazy
Incremental Computation for Efficient Scene Graph Rendering* (HPG 2013). Haaser,
Steinlechner, Maierhofer & Tobler, *An Incremental Rendering VM* (HPG 2015). Budiu et al.,
DBSP.

**Bayesian machinery.** Minka, *Expectation Propagation for Approximate Bayesian Inference*
(UAI 2001) — EP as iterated ADF. Julier & Uhlmann, the unscented transform (1995/1997).
Wan & van der Merwe, the UKF (2000).

**Geometry as program.** Mandelbrot (1982). Lindenmayer; Prusinkiewicz & Lindenmayer (1990).
Blinn (1982). Perlin (1985). Hart, sphere tracing (1996). Park et al., DeepSDF (CVPR 2019).
Mescheder et al., Occupancy Networks (CVPR 2019). Mildenhall et al., NeRF (ECCV 2020).
Müller et al., Instant-NGP (SIGGRAPH 2022). Kerbl et al., 3D Gaussian Splatting
(SIGGRAPH 2023).

**Simulation LOD.** Zhang, James & Kaufman (TOG 2024) and the progressive-simulation
framework it extends (Zhang et al. 2022, 2023).

**The theorem underneath.** Whitney (1936), general position — every rank-3 projection of a
2-complex self-intersects.

**In-repo rules this document is governed by.**
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) (§2.3,
§3.2 — a count is not an identification),
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
(§7),
[`only-the-irreducible-is-primitive-generate-the-rest`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)
(§5.3),
[`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
(§5.2, the two tessellations),
[`cleanroom-two-team-separation`](../../.claude/rules/cleanroom-two-team-separation.md) (the
two third-party repositories, consulted for licence and capability only — see the ferry
record).

**In-repo prior work.**
[`2026-09-09-graphics-physics-engine-roadmap-read-the-generator-at-rank-3.md`](2026-09-09-graphics-physics-engine-roadmap-read-the-generator-at-rank-3.md) ·
[`2026-09-09-3dgut-unscented-transform-assessed-against-zeta-exact-geometry-the-projection-is-linear-so-the-method-is-a-no-op.md`](2026-09-09-3dgut-unscented-transform-assessed-against-zeta-exact-geometry-the-projection-is-linear-so-the-method-is-a-no-op.md) ·
[`2026-09-09-the-representation-layer-measured-pga-is-a-performance-answer-the-projection-is-not-what-costs-and-the-overdraw-is-conserved-under-partition.md`](2026-09-09-the-representation-layer-measured-pga-is-a-performance-answer-the-projection-is-not-what-costs-and-the-overdraw-is-conserved-under-partition.md) ·
[`2026-09-09-geospatial-reasoning-over-clifford-the-fidelity-meter-is-the-gate-the-shared-structure-is-a-category-not-a-space-and-the-warp-consensus-inventory.md`](2026-09-09-geospatial-reasoning-over-clifford-the-fidelity-meter-is-the-gate-the-shared-structure-is-a-category-not-a-space-and-the-warp-consensus-inventory.md) §4 ·
[`2026-09-09-rung-3-eigenlayer-tessellation-and-the-blendshape-bridge-to-a-real-time-tiktok-avatar.md`](2026-09-09-rung-3-eigenlayer-tessellation-and-the-blendshape-bridge-to-a-real-time-tiktok-avatar.md)
