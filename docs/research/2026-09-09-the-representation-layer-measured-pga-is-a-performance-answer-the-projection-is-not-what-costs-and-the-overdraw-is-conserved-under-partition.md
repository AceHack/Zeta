# The representation layer, measured: PGA is a performance answer, the projection is not what costs, and the overdraw is conserved under partition

Scope: Aaron's challenge to the representation layer for the combined graphics/physics engine — whether `Cl(3,0,1)` (PGA), quaternions, or something else beats the current 8D-derive-then-project pipeline. Measurement, not survey: a working PGA implementation benchmarked against the three rivals a real engine would pick between, on named hardware.
Attribution: shadow-subagent (Claude Opus 5). Aaron set the challenge and both alternatives. The projection-invariance finding was measured independently by a sibling task and is cross-checked here by a second implementation.
Operational status: research + falsifiers. **Nothing here implements an engine.** Three modules and one test file landed; no rendering path changed.

**Date:** 2026-09-09
**Work item:** `081M23PJBHP087G0R001GT2E3E`
**Related:** `docs/research/2026-09-09-rung-{5,6,7}-*.md` · `2026-09-09-geospatial-reasoning-over-clifford-*.md` · `2026-08-26-cga-is-m2-of-the-in-tree-clifford-*.md` · `2026-08-01-icosahedron-to-e8-the-visual-geometry-layer-soraya-verdict.md`

---

## 0. Registers, and what was actually run

| register | what |
|---|---|
| `metered`, **on one named machine** | every ns/vertex figure in §2. Apple M2 Ultra (24 cores), 192 GB, macOS 26.6.2, **Bun 1.3.14**, single-threaded scalar TypeScript. Median of 41 trials after 20 discarded warm-up trials, three independent process runs |
| `metered` | the algebraic results: motor sandwich against an independently written Euclidean control; the unrolled fast path against the general 16-component product; the exact-integer path; the overdraw and partition sweeps. Pure functions, seeded, no wall clock, byte-identical on replay |
| `unmetered` | anything about other hardware, SIMD, or a GPU. No `v128` inner loop exists and none is claimed |
| `metered` | §6's rank-3 exactness result: H3 closes at 30 roots in `Z[φ]` under its own reflections, one norm class, zero reflections leaving the ring. Exact `bigint`, no floating point, with a control that fails |
| `toy` | §6's remaining claim — that H3-derived geometry reproduces rung 6's exact *shading*. The ring is measured; the light is not. Falsifier named, **not run** |

**Aaron's words, kept intact because the critique is the requirement:**

> *"i'm happy to look at other options as well for a combined graphics/physics engine, maybe quaternions or something else would be better. the uncertainty preserving is good, but if we are paying for extra dimension and then projecting down that's going to be slow, i was assuming we are either using the 8d to do calculations we needed or simulate 3d in 8d without projecting down but using different dimensions to render different parts of the scene or something. for our graphics/physics maybe we should take another route at the representation layer again."*

---

## 1. The indictment is right. Its stated mechanism is not — and the correction makes it worse, not better

The pipeline derives an 8D object and projects it to 3D, and the resulting surface is pathological: overdraw **738**, mean triangle bounding box **29.3%** of the scene diagonal, **27 faces on every edge**, ~1% of rays meeting two triangles at bit-identical depth with different shading. All measured, all real.

**But "projecting down is going to be slow" locates the cost in the wrong place, and the real location is a harder problem.**

The projection is a one-time preprocessing step. 240 roots through a 3×8 linear map, once, at load. Per frame it costs **nothing** — the browser animates the already-projected 3D result with an ordinary camera, exactly like any other engine. Removing the projection step therefore saves zero per-frame time in the regime that ships today.

What costs is **the surface the projection produces**. And that is worse than a slow step, because a slow step can be optimised and this cannot:

> A rank-3 linear map from `R^8` has a **5-dimensional kernel**. The 2-skeleton of 4_21 is a 2-complex, and a 2-complex is in general position — embedded, no self-intersection — only in dimension **2k+1 = 5**. Three is below five. **Self-intersection is not a defect of the map; it is the generic outcome, and every rank-3 map has it.**

Anchor: Hassler Whitney, *Differentiable manifolds*, Annals of Mathematics 37 (1936) — the general-position count. The strong embedding theorem (`R^{2k}`) concerns smooth manifolds and does not lower this to 3 either.

**Measured, as an independent second implementation of the sibling task's sweep** (`representation-layer-projection-cost.ts`, 24 seeded Haar-random rank-3 frames plus the shipped eigen frame):

| frame | overdraw | mean bbox fraction | distinct vertices |
|---|---|---|---|
| shipped `embed3d` | **737.64** | **0.2926** | 240 / 240 |
| best of 24 random | 635.68 | 0.272 | 240 / 240 |
| median of 24 random | 664.59 | — | — |
| worst of 24 random | 724.43 | 0.292 | — |

Two things to read here. First, this reproduces rung 7's published 738 and 29.3% from an independently written area/diagonal computation — a genuine cross-check, not a re-run. Second, **the best frame anyone found buys 1.16×**, against the two-orders-of-magnitude a BVH would need. The sibling task measured the same question over 116 embeddings (all 56 eigenlayer 3-frames plus 60 random) and found the span **598–834**, with the three "best" frames winning only by collapsing 6,912 faces to zero area. Two implementations, two frame families, one conclusion.

**So the honest statement of the indictment is sharper than the one Aaron gave, and less fixable:** the extra dimensions do not cost us time at the projection step; they cost us *the ability to have an embedded surface at all*, and no choice made at the projection step can return it.

---

## 2. The numbers

`src/Core.TypeScript/research/representation-layer-benchmark.ts`, run three times. Same task, same data, same process, warm-up excluded, checksums accumulated and printed so dead-code elimination cannot delete the work being timed.

| path | ns/vertex | ops/vertex | state (floats) | × mat4 |
|---|---|---|---|---|
| `8d-then-project` — 8×8 transform then rank-3 projection | **45.5 – 46.0** | 165 | 88 | **25.2×** |
| `mat4` — 4×4 affine | **1.81 – 1.86** | 18 | 16 | 1.00× |
| `quat+t` — unit quaternion + translation | **3.03 – 3.12** | 30 | 7 | 1.67× |
| `pga-motor` — `Cl(3,0,1)` motor, decomposed once, applied per vertex | **3.03 – 3.13** | 30 | 8 | 1.69× |
| `pga-naive` — the same motor through the general 16-component product, twice | **364 – 374** | 192 | 8 | **201×** |

Spread across the three runs is under 4% on every row.

**Row 1 is the number Aaron asked for, and it must be read with its condition attached.** Animating *in 8D* — an 8D rotor applied to the roots and re-projected every frame, which is exactly what *"using the 8d to do calculations we needed"* would require — costs **25× a 4×4 matrix**, per vertex, per frame. That is a real and large penalty and it fully vindicates the instinct behind the objection. It is also **not what the shipped pipeline does today**, and quoting it as today's cost would be a benchmark flattering its own recommendation.

**Row 5 is the number that gets quoted when people say geometric algebra is slow, and it is true of the naive call and only of it.** An off-the-shelf 16-component sandwich is 201× a matrix. The specialised path is 1.69×. The gap between rows 4 and 5 is the entire practical content of "is GA usable".

---

## 3. The finding: per vertex, a PGA motor and a quaternion are the same computation

Rows 3 and 4 are indistinguishable — the spread *within* each row exceeds the gap *between* them. That is not a tuning coincidence. It was derived before it was measured.

Symbolic expansion of the sandwich `M X ~M` over the eight motor components and the four point components (run through the product table, not transcribed) returns:

```
e123 = s² + e23² + e31² + e12²
```

plus three components each of degree 1 in the point. Two consequences, and they settle the question:

1. **The weight is the rotor norm alone.** All four degenerate components — `e01, e02, e03, e0123` — contribute nothing to it.
2. **The map is linear-plus-constant, i.e. affine.** Its linear part is therefore the rotor, and its constant part is the image of the origin.

So a motor's action on points is exactly *rotate by a quaternion, then translate*, and after a once-per-motor decomposition there is no per-vertex arithmetic left for the degenerate half to do.

**This is the precise answer to Aaron naming quaternions.** They are not an alternative to what we have:

- Rotors in 3D GA **are** quaternions — `Cl(3,0)⁺`, the even subalgebra.
- **Motors are dual quaternions** — the even subalgebra of `Cl(3,0,1)`. Clifford, *Preliminary Sketch of Biquaternions* (1873); Study, *Geometrie der Dynamen* (1903).

So "should we use quaternions" resolves to *we already can, at zero conceptual cost, and we are already paying for them whether we call them rotors or not*. The efficient concrete choice for the inner loop is the quaternion form, and choosing it costs nothing algebraically because it **is** the motor, decomposed.

**Where PGA still earns its place, then, is everywhere except the inner loop:** one object for rotation and translation (no special case for translation anywhere downstream), 8 floats of state against 16 for a matrix, uniform join/meet on points, lines and planes, and — for the physics half — the bivector velocity/momentum pairing that makes screw motion a single object. Anchors: Charles Gunn, *Geometric Algebras for Euclidean Geometry* (arXiv:1411.6502) and the 2011 TU Berlin thesis; Robert S. Ball, *A Treatise on the Theory of Screws* (1900).

**Maturity, honestly.** PGA for rigid-body *dynamics* is research-stage-to-early-production: Gunn's thesis is the standing treatment, `ganja.js` (De Keninck) and `klein` (Ong) are the reference implementations, and GATr (Brehmer, de Haan, Behrends & Cohen, NeurIPS 2023) uses 16-dimensional PGA at scale for learned geometry. No mainstream physics engine ships it. This is a real adoption cost and it is not offset by the 1.69× row above.

**Not re-measured, because a sibling task settled it and the settlement is a priori:** a PGA representation of the *same* object still interpenetrates. `edgeFaceIncidence` runs on the **combinatorial** face list — no coordinates, no embedding — and reports min 27 / max 27 across all 6,720 edges. Twenty-seven faces per edge is a property of 4_21's 2-skeleton. **No change of algebra can alter it.** PGA cannot fix it, CGA cannot fix it, quaternions cannot fix it. PGA is a **performance and uniformity** answer; it is not a **correctness** answer, and the surface stays two-sided under every representation.

---

## 4. Exactness: PGA keeps it, and the cost is bit growth rather than a square root

Today's exactness is integer-valued with all irrationality confined to a single named `√6` at the shading readout (rung 6: one `Math.sqrt` call site, in `cosineToNumber`). A PGA engine that needed a square root per rotor would be a regression, and that belongs on the page.

**It does not, and the reason is structural rather than lucky: a projective algebra never has to normalise.** Points are homogeneous, so an unnormalised motor built from unnormalised integer planes transforms them correctly up to a positive scale, and the scale divides out at readout.

Measured (`measureExactness`, 8 composed rigid motions from integer planes, `bigint` throughout):

- **`stayedExact = true`** — every intermediate an exact integer, no rounding anywhere.
- **Square roots on the exact path: 0.** Verified by scanning the module's own source with comments stripped, with a control asserting the pattern *does* fire on the float region — a guard satisfied by its own explanatory comment is a failure this repository has hit before.
- **Bit growth: `12 → 18 → 24 → 30 → 37 → 43 → 49 → 55`** — about **6.1 bits per composition, linear, not exponential.**

So the exactness boundary under PGA is arguably *better* than today's: the whole rigid-motion pipeline is `Z`, and the only division is the final homogeneous readout — the same pattern `Tsirelson.fs` already uses locking `S² = 8` in integers with the irrational appearing only at readout.

**The named cost:** coefficients grow without bound because nothing reduces the scale, so a long-running simulation needs periodic renormalisation (a gcd reduction, or a drop to float at a declared boundary). That is a real engineering task, it is measured above rather than waved at, and 6 bits per composition is slow enough to be manageable.

**What this does *not* address:** an arbitrary-angle rotation leaves the integers immediately, because a rational rotor requires a rational point on the 3-sphere. Those are dense but not universal. So the exact regime covers *composed reflections in rational planes* — which includes every lattice symmetry and every camera pose you construct rather than interpolate — and excludes *arbitrary interpolated angles*. That is the boundary, and it should be named in any adoption.

---

## 5. Aaron's alternative #2, measured: the overdraw is CONSERVED under partition

> *"simulate 3d in 8d without projecting down ... using different dimensions to render different parts of the scene or something."*

This is a real idea and it gets a real test. Partition the 60,480 faces into `N` groups, give **each group its own 3-dimensional subspace** (best of 4 seeded random frames per group), and measure each group's overdraw under its own projection.

| parts | faces/part | per-part overdraw, own frame (mean) | min | max | per-part, shared frame | **SUM over parts** |
|---|---|---|---|---|---|---|
| 1 | 60,480 | 609.11 | — | — | 737.64 | **609.1** |
| 8 | 7,560 | 76.79 | 72.68 | 79.54 | 92.20 | **614.3** |
| 64 | 945 | 9.49 | 7.15 | 10.61 | 11.53 | **607.2** |
| 512 | 119 | **1.11** | 0.00 | 1.43 | 1.44 | **567.3** |

**Read the last column, not the third.** Per-part overdraw falls to 1.11 at 512 parts — which looks like the idea working — but the **total is invariant**: 609 → 614 → 607 → 567 across a 512× change in partition count. Each part got cheap because it holds 1/512 of the triangles. **The ink is conserved.** The 7% drop at 512 parts is mostly the same artifact the sibling found in the "best" frames: `min = 0.00` means some parts collapsed to zero area entirely.

**And there is a second obstruction that no measurement can relieve.** If two parts live in *different* 3D subspaces, there is no common frame in which to resolve occlusion *between* them. You can render each part correctly and you cannot composite them — a depth value in one part's subspace is not comparable to a depth value in another's. So the technique yields **N pictures, not one scene**.

**Verdict: it works, and it is not rendering.** Assigning different subspaces to different scene elements is a legitimate and well-established *visualisation* technique — that is exactly what a Coxeter-plane projection is, what the eigenlayer tessellation already does with four invariant eigenplanes, and what small-multiples/multi-view methods are for. It is the right tool for *inspecting* a high-dimensional object. It is not a route to a single occlusion-correct scene, because the cost it appears to remove is redistributed rather than eliminated, and because the parts have no shared depth.

---

## 6. Aaron's alternative #1: what the 8D actually buys

> *"using the 8d to do calculations we needed"*

**It buys something real, and this is measured in-tree, not speculation.** Rung 6 computes shading in 8-dimensional integer arithmetic *before* any projection: the face normal is the sum of the face's three roots, `|n|² = 48` on all 60,480 faces with zero exceptions, the Lambert numerator is an integer, and brightness levels are compared by cross-multiplication without ever evaluating a square root. Rung 6's own sentence: *"The projection places pixels. It never touches a brightness."* That is a genuine computation the 8D performs and the 3D image cannot reproduce — the ~1% of rays meeting two triangles at bit-identical depth **with different shading levels** is the direct evidence that the 3D geometry does not determine the 8D answer.

**But the exactness comes from the roots being algebraic integers in a ring closed under multiplication, not from the dimension being 8 — and this was RUN.**

`representation-layer-rank3-exactness.ts` builds H3 — the icosahedral Coxeter group, and the rank-3 generator of the very chain that produces E8 — in `Z[φ]`, the ring of integers of `Q(√5)`, then closes it under its own reflections in exact `bigint` arithmetic with no floating point anywhere:

| measured | H3 (rank 3, `Z[φ]`) | E8 (rank 8, doubled `Z`) |
|---|---|---|
| roots | **30**; closure adds none | 240 |
| distinct squared norms | **one class — the rational integer 4**, `φ` component exactly zero | one class: 8 |
| reflections that left the ring | **zero** | zero |
| rank of span | **3 — no projection anywhere** | 8, then projected |

The norm cancellation is the load-bearing part: `1 + φ² + (φ−1)² = 1 + (φ+1) + (φ²−2φ+1) = 4`, using `φ² = φ + 1`. Every root has the same rational-integer length, so `x − ((x·α)/2)·α` lands back in the ring on every reflection. **That is structurally the same property E8 has, one ring over, in three dimensions, with no projection step to destroy an embedding.** The test carries a control that fails on a root of the wrong norm, so the pass is not vacuous.

**Still `toy`, and now narrowed to exactly what remains unrun:** whether H3-derived geometry reproduces rung 6's exact *shading*. This module measured the ring, not the light, and the falsifier is unchanged — compute Lambert over an H3 orbit polytope in `Z[φ]` and check the level census is exact with irrationality confined to one named quadratic surd. What *is* now established is the prerequisite everyone would have assumed and nobody had checked: **the exact regime survives at rank 3.**

**What the 8D buys that rank 3 genuinely cannot** is *cardinality of distinguished structure*: 240 distinguished directions against H3's 30, and a Weyl group of order 696,729,600 against 120. If a computation needs that many distinguished directions or that large an equivariance group, only the 8D supplies it. **A 3D scene renderer needs neither.** A cross-domain reasoning space with several independent semantic axes plausibly does — which is the split §7 turns on.

**And for the one visibility question, the sibling measured that the 8D buys nothing at all:** the kernel is 5-dimensional, a 3D ray pulls back to a 6-flat, and `6 + 2 − 8 = 0` — one point per 3D crossing, nothing saved. The overlap *is* the kernel. That is one narrow question and not a verdict on 8D generally, but it is the question a renderer asks most often.

---

## 7. The verdict on the representation layer

**The two jobs are different and should be carried by different members of one algebra family.** This was offered to me as a framing to test rather than adopt, so: the evidence for it is that every measurement above separates cleanly along that line, and the evidence against it is that nothing here measures the *reasoning* job at all.

| job | carrier | why | register |
|---|---|---|---|
| **rigid motion, camera, physics** | **PGA `Cl(3,0,1)`**, inner loop as quaternion+translation | natively 3D, no projection, one object for rotation and translation, 8 floats, exact over `Z`, screw motion for the physics half | `metered` here for the transform cost and exactness; `unmetered` for anything dynamics-related, which is unbuilt |
| **cross-domain reasoning** (geometry ∥ English ∥ code ∥ affect) | **E8 / `Cl(8)`** remains the candidate | 240 distinguished directions, a `696,729,600`-order equivariance group, exact integer coordinates, and the derived-not-authored seed | `toy` — the geospatial doc's verdict stands: *"There is no current algebra with a demonstrated, measured fidelity for carrying affect and geometry simultaneously"* |

**They compose, and cheaply, which is why the separation is not a fork.** The in-tree finding of 2026-08-26 is that all three GA towers reduce to `Cl(3,0)`: PGA(3D) is `Cl(3,0) ⊗ Λ(R¹)` (dim 16, radical 8), and CGA `Cl(4,1) ≅ M₂(Cl(3,0))`. The shared kernel already exists in the tree. Adding PGA is one degenerate generator on an algebra we have, not a second stack.

**What the separation costs, stated plainly:**

1. **A second algebra to maintain** — golden vectors, four-oracle parity, the usual. Mitigated by the shared `Cl(3,0)` kernel, not eliminated.
2. **The rotor group does not inherit cleanly** if CGA is ever wanted alongside — `Cl⁰(4,1) ≅ Cl(4,0)` is quaternionic (`M₂(H)`), so conformal rotors are new arithmetic. Already on record in the 2026-08-26 doc; noted here so it is in the estimate.
3. **The demo's content problem becomes explicit.** This is the real cost. `demo/clifford-e8/` derives a 4_21 surface that is not, and cannot be made, an occlusion-correct 3D scene. Moving the engine to PGA does not give the engine any content. A 3D-native derived source is needed, and the strongest candidate is already anchored in-tree: **H3 in `Cl(3,0)`**, whose orbit polytopes are honestly embedded 3D solids with no projection anywhere.

**Note the direction this reverses, and it is not decoration.** The Soraya verdict of 2026-08-01 records Dechant's chain: **H3 (rank 3, 30 roots, native 3D) → spinors = `Cl⁺(3,0) ≅ H` → H4 (120 roots, the 600-cell)**, and then a *separate* theorem — the icosian golden doubling over `Q(√5)`, **not** a third spinor induction — reaching E8's 240. So for a 3D rendering surface the irreducible generator sits at **rank 3**, and E8 is what rank 3 generates. The current ladder reads that chain from the wrong end for this job. Under `only-the-irreducible-is-primitive-generate-the-rest.md`, rendering should read the generator at rank 3 and let E8 be the earned extension for the reasoning job.

Anchors, all in the Soraya verdict and cited there with the correction that the 3→4 and 4→8 steps are different theorems: Dechant, Proc. R. Soc. A 472 (2016) 20150504; AACA 27 (2017) 17–31; J. Phys. Conf. Ser. 597 (2015) 012027; Conway–Sloane SPLAG §8.2; Elser–Sloane, J. Phys. A 20 (1987).

**Honest limit on this recommendation: I did not build it.** No H3 generation was run in this session, no 3D-native content pipeline exists, and no physics solver of any kind is implemented. The chain above is cited from an in-tree verdict that metered it, not re-derived here.

---

## 8. What survives, and what a recommendation would have to justify

- **0 bytes of geometry — survives, and gets stronger.** The property is that the page ships *the derivation* (27,621 bytes) rather than *its output* (2,177,280 bytes as float32), with `clifford-e8-page.test.ts` asserting the committed bundle reproduces the modules. Nothing about that depends on the content being 8-dimensional. An H3 generator is a *smaller* seed than an E8 one — 30 roots from three simple roots in `Cl(3,0)`. If the content moves to rank 3, the falsifier moves with it unchanged.
- **Derived, not authored — survives.** PGA *is* a Clifford algebra; H3 roots are generated by versor reflection. No coordinate would be authored by hand at any rung. Aaron's standing rule is met by both halves.
- **Exactness — survives, with a better boundary and a new named cost.** `Z` throughout rigid motion, one division at readout, zero square roots; bit growth ~6.1 bits per composition needs a renormalisation strategy.
- **DST (§7) — survives for geometry; the hard part is unchanged and is not solved here.** Geometry stayed exact because it never integrated. A physics layer brings division and roots everywhere, and faces a fixed-point / rational / float decision that geometry never had to make. Nothing in this session addresses it. It is the first thing an engine proposal will hit.

---

## 9. Anchors (Beacon)

- **Hassler Whitney**, *Differentiable manifolds*, Ann. Math. 37 (1936) — general position; a 2-complex embeds generically in `R^5`. The reason §1's pathology is a theorem.
- **Charles Gunn**, *Geometric Algebras for Euclidean Geometry* (arXiv:1411.6502); *Geometry, Kinematics, and Rigid Body Mechanics in Cayley-Klein Geometries*, TU Berlin thesis (2011) — the case for `P(R*_{3,0,1})`, and the solution-space argument against CGA for rigid-body dynamics (PGA 14-dimensional against CGA's 26, whose co-dimension exceeds its own solution space).
- **W. K. Clifford**, *Preliminary Sketch of Biquaternions* (1873); **Eduard Study**, *Geometrie der Dynamen* (1903) — dual quaternions; the even subalgebra of `Cl(3,0,1)`. §3 rests on this.
- **Robert S. Ball**, *A Treatise on the Theory of Screws* (1900) — screw motion; the bivector pairing for the physics half.
- **Leo Dorst, Daniel Fontijne & Stephen Mann**, *Geometric Algebra for Computer Science* (2007) — the sandwich/versor formulation.
- **Steven De Keninck** (`ganja.js`); **Jeremy Ong** (`klein`) — reference PGA implementations. Neither is vendored; the products here are generated from the metric in-file.
- **Brehmer, de Haan, Behrends & Cohen**, GATr (NeurIPS 2023); **de Haan, Cohen & Brehmer**, AISTATS 2024 (arXiv:2311.04744) — carried over from the geospatial doc, which read the abstract only and says so. The AISTATS verdict that *plain projective is "not sufficiently expressive"* is about **learned equivariant representations**, not about rigid motion, and does not bear on §3.
- **Pierre-Philippe Dechant**; **Conway–Sloane**; **Elser–Sloane** — the H3→H4→E8 chain, as cited and corrected in the 2026-08-01 Soraya verdict.
- **Coxeter**, *Regular Polytopes* (3rd ed., 1973) — 4_21 and its f-vector.

**Citations I did not verify this session:** the AISTATS/GATr results and the Dechant/Conway–Sloane chain are taken from in-tree documents that recorded their own verification state (abstract-only for the former, cited-not-reproven for the latter). I did not open the papers. Gunn's PGA-vs-CGA dimensional argument is likewise carried from the geospatial doc. Everything in §§1–5 was run here.

---

## 10. Open, and what would settle each

| question | what would settle it |
|---|---|
| Does a rank-3 exact root system reproduce the 8D's exact **shading**? (`toy`) | §6 settled the ring: H3 closes at 30 roots in `Z[φ]`, one norm class, nothing leaving the ring. What remains is the light — shade an H3 orbit polytope in `Z[φ]` and check the level census is exact with one quadratic surd at readout |
| Does PGA hold up for **dynamics**, not just transforms? | Implement a rigid-body step as a bivector ODE and measure against a quaternion+inertia-tensor baseline. Nothing here touches dynamics |
| The fixed-point / rational / float decision for time integration | Unaddressed. The first wall an engine proposal hits |
| Renormalisation strategy for exact composition | 6.1 bits/composition measured; the policy is not designed |
| Is the E8-for-reasoning half true at all? | The geospatial doc's fidelity meter (`081M23H36QF087G0R0012F5GHT`), still `toy`, still unrun |

---

## Files

- `src/Core.TypeScript/research/representation-layer-pga-motor.ts` — `Cl(3,0,1)`: product table generated from the metric, general product as oracle, motor decomposition, exact `bigint` path.
- `src/Core.TypeScript/research/representation-layer-projection-cost.ts` — the overdraw/partition sweeps.
- `src/Core.TypeScript/research/representation-layer-benchmark.ts` — the five-path benchmark and the exactness probe.
- `src/Core.TypeScript/research/representation-layer-rank3-exactness.ts` — H3 in `Z[φ]` and its reflection closure.
- `src/Core.TypeScript/research/representation-layer-pga-motor.test.ts` — 25 falsifiers, 1,605 assertions.

**One defect worth recording, because it is the ordinary one.** The first version of the unrolled fast path was hand-transcribed from a twelve-term symbolic expansion and had a sign error in the vector part of the rotor-to-quaternion map. It was caught by the test that compares the fast path against the general-product oracle, and the correct convention was then determined by *measuring* the motor's own rotation matrix against all four candidate assignments — the right one agreed to `3.8e-15`, the nearest rival was wrong by `3.2`. The benchmark had already produced plausible timings with the wrong code. A timing of an incorrect kernel is a measurement of nothing, and only the oracle-agreement test stood between that and this document.
