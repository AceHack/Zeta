# Rung 8 — the 7.6× was a measurement of our BVH, and the projection is not the problem

**Work item:** `081M23ND4C5087G0R00036MYZ5`
**Date:** 2026-09-09
**Builds on:** rung 7 (`081M23EWJNV087G0R001MYF1H7`, PR #17155) — the CPU tracer and the
738-layer measurement under it.
**Hardware for every number below:** Apple M2 Ultra, macOS 25.6.0, Bun 1.3.14, **one thread, no
SIMD**. A number without named hardware is `unmetered`, and both exclusions are deliberate: the
question this rung answers is *how much of rung 7's answer was algorithmic*.

---

## 0. What rung 7 concluded, and what was wrong with it

Rung 7 shipped a CPU ray tracer over the derived Gosset 4_21 2-skeleton and concluded:

> *"Is it fast on a CPU? **No** — measured, at 0.5 fps for 128² on one core."*

with **2,780 triangle tests per ray** and a **7.6×** speedup over exhaustive scan. It then
defended those numbers:

> *"A 7.6× speedup from a BVH is a bad speedup, and it is not the BVH's fault. With 738×
> overdraw a ray genuinely meets on the order of a thousand triangles; 2,780 tests to find them
> is a small constant over the true answer."*

**The premise is right and the inference does not follow.** Measured here on the same scene and
the same framing:

| quantity | measured |
|---|---|
| triangles a ray genuinely crosses (all rays) | **582** |
| triangles a ray genuinely crosses (hitting rays only) | **1,586** |
| **triangles at-or-before the NEAREST hit** | **0.49** |

A nearest-hit query does not have to find the thousand crossings. It has to find the **first**
one. The answer set is one triangle, not a thousand — so 2,780 tests is not "a small constant
over the true answer", it is roughly **5,700× the true answer**. Rung 7 compared its cost
against the wrong query's answer size, and the comparison made a defeated accelerator look
like a saturated one.

**The corrected diagnosis has two separable parts, and both are measured.**

### Part 1 — the traversal was never front-to-back

`intersectBvh` pushes both children in a fixed order and never sorts by entry distance, so
`best` stays at infinity through most of the descent and the `t > best` prune barely fires. On a
surface 738 layers deep that cutoff is the entire game: the nearest hit is on the outer shell,
and everything behind it is provably irrelevant the moment it is found.

Replaying **the identical median-split tree rung 7 built**, with the traversal replaced:

| traversal, same tree | tri/ray | µs/ray |
|---|---|---|
| rung 7's | 2,777 | 131.4 |
| + distance-stack cutoff (subtrees stacked with their entry distance) | 1,600 | 74.0 |
| + near/far child ordering | **1,319** | **57.0** |

**2.1× for free, and the decomposition is the interesting half**: the cutoff is worth 1.74× and
the near/far ordering 1.21× on top. Naming which lever moved the number was the point of
holding SIMD and threads out of this rung, and it applies inside the rung too — a single
"ordered traversal is 2.1×" claim would have hidden a mechanism. (It did: see M2 in §5.)

### Part 2 — the tree cannot separate the primitives

| structure quality | median (rung 7) | binned SAH | SBVH |
|---|---|---|---|
| Σ leaf box surface area ÷ root's (**1.0 is a perfect partition**) | **2,577** | 1,638 | **1,360** |
| SAH cost (Ct = Ci = 1) | 13,550 | 9,137 | 8,406 |
| mean leaf box ÷ root diagonal | 40.5% | — | — |

2,577 against a perfect 1.0. That is the object-partitioning failure mode exactly, and rung 7
already measured its cause without naming it as one: **the mean triangle bounding box is 29.3%
of the scene diagonal.** No assignment of *whole* triangles to boxes can produce boxes that do
not overlap almost everything, because the triangles themselves are a third of the scene wide.

Even a *perfectly ordered* traversal over rung 7's tree costs **1,205 tests/ray** — measured by
enumerating every leaf, sorting by entry distance and stopping at the first hit. The tree, not
the traversal, is the floor there.

---

## 1. The fix: spatial splits (Stich, Friedrich & Dietrich, HPG 2009)

That failure mode is exactly the one **Stich, Friedrich & Dietrich**, *Spatial Splits in
Bounding Volume Hierarchies* (High Performance Graphics 2009) exists for: object partitioning
fails when primitives are large relative to the leaves they must fit in, so stop insisting a
primitive live in exactly one leaf. A reference straddling the split plane is **chopped**, each
half clipped to its side, and the boxes get tight even though the triangles stay big.

`src/Core.TypeScript/research/clifford-e8-sbvh.ts` implements it: binned SAH object splits
(**Wald**, IRT 2007), chopped binning with the `alpha` overlap criterion (Stich et al.), and
**Sutherland–Hodgman** polygon clipping (CACM 1974) so a chopped bound is tight rather than
merely legal. `spatialSplits: false` gives exactly the binned-SAH build, which makes the two
settings a controlled comparison rather than two programs.

### 128² on the framed view, one thread, no SIMD

| # | configuration | build | render | µs/ray | **tri/ray** | node/ray |
|---|---|---|---|---|---|---|
| 1 | **median + rung 7 traversal (the baseline)** | 180 ms | **2,153 ms** | 131.4 | **2,781** | 3,136 |
| 2 | median + ordered traversal | 180 ms | 934 ms | 57.0 | 1,319 | 1,654 |
| 3 | SAH + rung 7 traversal | 163 ms | 976 ms | 59.6 | 1,212 | 1,690 |
| 4 | SAH + ordered traversal | 163 ms | 373 ms | 22.7 | 574 | 825 |
| 5 | **SBVH + ordered traversal** | 6,138 ms | **268 ms** | **16.3** | **440** | 594 |
| 6.1 | subdiv 4¹ + SAH + ordered | 468 ms | 138 ms | 8.4 | 187 | 315 |
| 7 | subdiv 4¹ + SBVH + ordered | 18,024 ms | 130 ms | 7.9 | 176 | 300 |
| 6.2 | subdiv 4² + SAH + ordered | 1,975 ms | 66 ms | 4.0 | 76 | 147 |
| 6.3 | **subdiv 4³ + SAH + ordered** | 8,326 ms | **36 ms** | **2.2** | **34** | 87 |

Brute force on the same view: **1,023 µs/ray**.

**The two headline numbers, before and after:**

| | rung 7 | rung 8 (SBVH) | factor |
|---|---|---|---|
| triangle tests per ray | **2,780** | **440** | **6.3×** |
| speedup over exhaustive scan | **7.6×** | **62.8×** | **8.3×** |
| 128² frame time | 2,153 ms | 268 ms | 8.0× |

The SBVH duplicates references by **1.435×** (86,799 for 60,480 triangles), takes 2,209 spatial
splits against 20,785 object splits, and reaches depth 25.

---

## 2. The cheaper rival wins on speed — and loses on exactness

The rival hypothesis: if the pathology is that primitives are large, make them small and keep
the plain SAH build. `subdivideTriangles` splits each triangle into four at its edge midpoints.

**On speed it is not close.** Subdivision at 4³ is **7.4× faster than the SBVH** (2.2 vs 16.3
µs/ray) and **60× faster than rung 7's baseline**, and it builds in 8.3 s against the SBVH's
6.1 s — comparable, where an SBVH over subdivided geometry takes 18 s and buys 7%.

**It is paid for twice, and the second cost is the one that decides it.**

**Cost one — memory, and it is steep:**

| | positions | BVH | total |
|---|---|---|---|
| baseline / SBVH | 2.2 MB | 1.8 MB | **4.0 MB** |
| subdiv 4¹ | 8.7 MB | 5.6 MB | 14.3 MB |
| subdiv 4² | 34.8 MB | 23.1 MB | 57.9 MB |
| subdiv 4³ | 139.3 MB | 94.5 MB | **233.8 MB** |

58× the memory for 7.4× the speed.

**Cost two — it is not exact.** Rendering the 128² level image and comparing pixel-for-pixel
against rung 7's baseline:

| structure | pixels differing from the baseline |
|---|---|
| SAH + ordered | **0** |
| SBVH + ordered | **0** |
| subdiv 4¹ | 426 / 16,384 (2.6%) |
| subdiv 4² | 484 / 16,384 (3.0%) |
| subdiv 4³ | 470 / 16,384 (2.9%) |

Midpoint subdivision is exact in exact arithmetic — `embed3d` is linear, so the four children
tile the parent — but a midpoint rounds on its way into a `Float32Array`. Measured: the child
vertices leave the parent's plane by at most **3.4e-8**, float32 ulp scale at these
coordinates, and the resulting hit depths move by a mean relative **4.5e-9**. No pixel changes
from hit to miss; **every one of the 426 is a depth tie decided differently.**

**So: SBVH wins.** It is 7.4× slower than the fastest subdivision and it is the one that can be
shipped without a footnote — bit-identical to the exhaustive scan on every seeded ray and
pixel-identical to rung 7's image. Rung 7 declared its tie-break precisely so the answer would
not depend on traversal order; a rival that reintroduces the ambiguity through rounding has
given back what that declaration bought. Subdivision stays in the module, measured, with its
price stated, for a caller who wants 27 fps more than exactness.

---

## 3. The scene is ill-conditioned — which is not the same as non-deterministic

The subdivision result raised a sharper question than it answered, and the answer belongs to
the object rather than to subdivision.

**Perturb every coordinate of the shipped scene by exactly one float32 ulp** and re-render:

> **393 of 16,384 pixels change level — 2.40%.**
> Control: re-rendering a byte-identical copy changes **0** pixels.

Essentially the same fraction subdivision moved. **So the sensitivity is a property of the
scene, not of subdivision.** On a surface 738 layers deep, ~2.4% of pixels sit within one ulp
of a depth tie, and which face wins is decided by rounding rather than by geometry.

This refines rung 7's finding rather than contradicting it. Rung 7 measured that ~1% of rays
meet two triangles at **bit-identical** depth and declared a tie-break for them. There is a
second, larger population **within one ulp** of a tie, and a tie-break cannot help there —
there is no tie to break, only a comparison whose inputs are not accurate enough to mean
anything.

> **The tracer is deterministic. The scene is ill-conditioned. These are different properties,
> and rung 7 established the first while the second went unstated.**

Both are `metered` and both are pinned by falsifiers, including the control that must find
zero differences.

---

## 4. Task 2 — is the pathology an artifact of the 8D→3D projection? **No.**

`embed3d` is one map among many: it takes `(x, y)` from eigenlayer 0 and `z` from eigenlayer
1's first axis, and rung 3 says outright that which axis becomes `z` is a gauge. The four
eigenlayers supply **eight orthonormal axes of R⁸** (checked: the full 8×8 Gram matrix is the
identity to 1e-9), so there are **C(8,3) = 56** eigenlayer-derived 3-frames, plus the whole
Stiefel manifold beyond them.

`src/Core.TypeScript/research/clifford-e8-projection-sweep.ts` measures all of them.

| family | overdraw min | median | max | spread |
|---|---|---|---|---|
| 56 eigenlayer-axis triples | **598.2** | — | **834.3** | **1.39×** |
| 60 seeded random orthonormal frames | **598.0** | 651.3 | 732.0 | 1.22× |
| **shipped `embed3d`** | **737.6** — rank **33 of 56** | | | |

| family | mean triangle bbox ÷ scene diagonal |
|---|---|
| 56 eigenlayer triples | **29.1% – 29.3%** |
| 60 random frames | **26.0% – 29.1%** |
| shipped `embed3d` | 29.3% |

**The negative result, stated plainly:**

> **No 3D embedding escapes the pathology.** The best frame available buys a factor of 1.23 on
> overdraw and essentially nothing on primitive size — against the two orders of magnitude a
> BVH would need. The shipped map is not badly chosen; there is nothing to choose. There is no
> projection to go find.

Two details that keep the result honest:

- **The frames that score lowest "win" by losing the object.** The three tied at 598.2 each
  collapse **6,912 faces to zero area**. They score better by projecting away a ninth of the
  surface, not by spreading it. The shipped frame collapses nothing.
- **Overdraw is therefore not a quality score on its own.** A deliberately squashed frame
  scores **334** — better than everything in the table — while showing strictly less of the
  object. It ranks projections that keep the surface; it rewards throwing it away.

### Why the spread is so small — the structural reason

`unmetered`, and offered as the explanation rather than as a result. Overdraw is an average
over **60,480 faces** of a smooth bounded function on the Stiefel manifold V₃(R⁸). **Lévy's
lemma / Milman's concentration of measure** says such an average concentrates sharply about its
mean as dimension grows, and **Cauchy's surface-area formula** (1841) is the classical
statement of the same averaging for convex bodies: the mean projected area is a fixed fraction
of the surface area, independent of direction. In 8 dimensions, with 60,480 samples, all
orthonormal 3-frames look nearly alike to this quantity. The measured 1.39× spread is what that
predicts.

### One premise in the brief is false, and it is worth correcting

The framing offered was that *both* the interpenetration (27 faces per edge) and the huge
overlapping triangles arise from flattening. Measured:

- **The oversized, mutually overlapping triangles: yes, projection-induced** — but intrinsically
  so, per the sweep above. Every linear map to 3D does this.
- **The 27 faces on every edge: NO — that is an 8-dimensional combinatorial fact.**
  `edgeFaceIncidence` takes the face list and nothing else: no coordinates, no embedding, no
  eigenlayers. It reports **min 27, max 27 over all 6,720 edges**. Every edge of 4_21 lies in 27
  of its 2-faces *in R⁸*. A manifold edge carries 2; the 2-skeleton of an 8-polytope is not a
  2-manifold and was never going to be. **No embedding can change a number no embedding
  produces.**

And one thing the projection does *not* do, contrary to what "it folds" suggests: **all 60,480
face centroids stay distinct in 3D** (measured). The crowding is overlap of extended triangles,
not coincidence of position.

### Can the visibility question be answered in 8D, before projecting?

**Not usefully, and the reason is dimensional rather than clever.** A linear map R⁸ → R³ has a
**5-dimensional kernel**. The preimage of a 3D point is a 5-flat and the preimage of a 3D ray is
a 6-flat, so "the nearest surface along this ray" pulls back to intersecting a 6-flat with 2-faces
in R⁸ — dimension 6 + 2 − 8 = 0, a set of points, one per 3D crossing. Every crossing the 3D
tracer finds is still there; nothing is saved. The overlap *is* the kernel, and it cannot be
removed while the map stays a linear projection of the polytope.

What 8D **could** do is disambiguate: two faces meeting a ray at bit-identical 3D depth are
distinct points in R⁸, so an 8D quantity could order them by something other than index. That
would replace an authored tie-break with a derived one — genuinely attractive, and it addresses
the ~1% exact-tie population while doing nothing for the ~2.4% within-one-ulp population of §3.
Filed as follow-on, not built.

### What linearity buys and costs

Rung 5 measured that `embed3d` is linear (re-checked here to 1e-12).

- **It buys the subdivision rival its legitimacy.** Midpoint subdivision commutes with a linear
  map, so subdividing the projected triangles and projecting subdivided 8D faces give the same
  surface. `subdivideTriangles` is a re-indexing of the same geometry, not an approximation —
  which is exactly why its 2.9% pixel difference had to be explained by float32 rounding rather
  than by geometry, and was.
- **It costs the overlap, unavoidably** — the 5-dimensional kernel above.

---

## 5. Falsifiers and mutation testing

53 falsifiers across two new test files, ~451k assertions. **Seventeen mutants applied, the
suite re-run for each, every verdict as predicted.**

| mutant | verdict | killed by |
|---|---|---|
| M1 ordered-traversal cutoff becomes `>=` | **KILLED** | *the ordered traversal's cutoff is `>` and never `>=`* |
| M2 traversal stops ordering children by distance | **KILLED** | *the NEAR child is descended first — a hand-built scene where that is the whole cost* |
| M3 chop returns the reference BOX instead of clipping the polygon | **KILLED** | *clips the FAR side to a genuinely smaller y extent than a box clip would* |
| M4 the reference-shift bookkeeping is dropped | **KILLED** | *leaf ranges tile the reference array exactly — no gap, no overlap* |
| **M5a the no-progress guard bails to a leaf** | **SURVIVED** ✅ | — see below |
| M5b the guard's condition is over-strict | **KILLED** | *duplicates references and stays inside its budget* |
| M5c over-strict condition AND leaf fallback | **KILLED** | *no leaf is oversized — a rejected split must fall back to a split* |
| M6 subdivision emits three children, not four | **KILLED** | *preserves total area — the four children tile the parent* |
| M7 subdivision paints every child level 0 | **KILLED** | *multiplies the triangle count by four and preserves the level per child* |
| M8 `bvhQuality` reports a perfect partition | **KILLED** | *the median tree rung 7 shipped is the worst of the three by leaf-area ratio* |
| M9 `projectFaces` skips the unit-ball normalisation | **KILLED** | *SHIPPED_FRAME really is what `embed3d` uses* |
| M10 `randomOrthonormalFrame` ignores its seed | **KILLED** | *the random frames really are different from each other* |
| M11 `eigenlayerFrames` returns a truncated enumeration | **KILLED** | *enumerates all C(8,3) = 56 frames* |
| M12 `measureProjection` hardcodes 737.6 | **KILLED** | *CONTROL: returns the ANALYTIC answer on a scene computed by hand* |
| **C1 control: a comment is reworded** | **SURVIVED** ✅ | — |
| **C2 control: the SAH bin count 16 → 12** | **SURVIVED** ✅ | — |
| **C3 control: equal-distance children visited in the opposite order** | **SURVIVED** ✅ | — |

**M2 is the mutant that changed this document.** On its first run it **survived**, and the
reason is the finding: the assertion aimed at it — *"halves the triangle tests over the
identical median tree"* — measures the **distance cutoff**, not the near/far ordering. Always
descending left first still lands at 1,600 tests/ray, comfortably under the bound. One number
was covering two mechanisms and only one of them was falsified. The repair was to measure the
decomposition (1.74× cutoff, 1.21× ordering — §0) and add a hand-built scene where the ordering
is the entire cost: two groups of eight triangles at z ≈ 1 and z ≈ 10, a ray from z = 20, and
**8 triangle tests instead of 16** because the far leaf is never opened.

**M5a is reported as a limitation of my mutant, not as a gap in the suite** — the same honest
register as rung 7's C1. It survived because on this scene the no-progress guard fires at only
**133 of ~23,000 nodes**, so making it bail to a leaf moves leaf-area 1359.7 → 1359.2 and
nothing else. The defect I was aiming at was in the guard's *condition*, and M5b/M5c reproduce
it: an over-strict `||` rejects **every** spatial split (SBVH silently becomes SAH), and with a
leaf fallback it produced, live during development, **4,190 fat leaves and 2,897 tests/ray —
worse than the baseline it was built to beat.** Both are killed.

**C3 is the control that carries information**, re-run from rung 7 on new code: swapping which
of two equal-distance children is visited first survives, and it survives *because* the
tie-break is declared. A control mutant that only passes after a real property holds is a
measurement of that property.

**Two defects the mutation run itself produced, recorded because they are the ordinary kind.**
The runner's killer-extraction filtered on lines starting with the failure glyph *before*
stripping ANSI, so every killed mutant reported `killed by: -` — a reporting bug in the tool
that reports on bugs. And the sweep's first "control" asserted that a squashed frame scores
*worse*; it scores **better**, because collapsing an axis destroys area faster than it shrinks
the ball. The corrected control checks `measureProjection` against a two-triangle scene whose
area, diagonal and bbox fraction are known by hand.

**Negative source assertions read a comment-stripped copy**, with a control asserting the
stripper kept the code and removed the prose. This is the fourth time in this repository's
record that a guard has been satisfied by its own explanation, and the third was in the rung 7
PR this rung extends.

---

## 6. The revised answer to "can CPU ray tracing be interactive here?"

Rung 7: **no**, 0.5 fps at 128² on one core.

Measured now, **one thread, no SIMD, no threading, plain TypeScript**:

| resolution | SBVH (exact) | subdiv 4³ (2.9% of pixels perturbed) |
|---|---|---|
| 128² | 319 ms — **3.1 fps** | 38 ms — **26.7 fps** |
| 256² | 936 ms — 1.07 fps | 127 ms — **7.9 fps** |
| 512² | 3,341 ms — 0.30 fps | 437 ms — 2.3 fps |

**This table says 319 ms at 128² where §1 says 268 ms, and the difference is the harness, not
the tracer.** §1 traces a pre-built ray array and discards the hits; this one renders a full
frame — it builds each ray inline, looks the level up per hit and writes the pixel buffer, which
is what a viewer actually pays for. Both are real measurements of the same structure, 19% apart,
and the slower one is quoted here because it is the one that answers the question in the
heading. Quoting a single number for two harnesses would have been the cheaper choice and the
less honest one.

> **The answer changes, and it changes on algorithm alone.**
> **128² is interactive today** — 27 fps subdivided, 3.1 fps exact, on one core in TypeScript,
> against rung 7's 0.5.
> **256² is reachable**: 7.9 fps subdivided now, and rung 7's own labelled estimates for
> threading (~20× on 24 cores) and a native SIMD inner loop (4–5×) sit on top of *these*
> numbers rather than on the baseline they were written against.
> **512² exact is still out of reach on one thread** — 0.30 fps — and that remains the honest
> boundary.

**What rung 7 got right and what it got wrong.** Right: the 738× overdraw is real, intrinsic
(§4 now proves it), and the dominant fact about this object. Right: nearest-hit is the
principled occlusion method here, and keeping the exhaustive scan beside the accelerator is
what made this rung possible at all — every claim above is checked against that second meter.
Wrong: the conclusion *"CPU ray tracing: not at interactive rates"* was a measurement of a
median-split tree with an unordered traversal, and 8× of it was ours to take back.

The general form, worth carrying: **an accelerator's cost must be compared against the answer
size of the query you are actually asking.** Comparing 2,780 tests against the number of
triangles a ray crosses reads as saturation. Comparing it against the number of triangles at or
before the nearest hit — 0.49 — reads as a defeated index. Same measurement, same scene,
opposite conclusion.

---

## What this rung does not claim

- **No SIMD and no threading result.** Both were held out on purpose so the remaining factor is
  algorithmic. Rung 7 §4's design stands unchanged, and its estimates are still estimates.
- **No claim that the SBVH here is a state-of-the-art SBVH.** Reference *unsplitting* (Stich et
  al. §4.3) is not implemented, and its absence is the most likely reason the reference
  duplication sits at 1.435× rather than the paper's typical ~1.2×. Named, not built.
- **No claim about other hardware, other languages, or the browser.** Every number is M2 Ultra,
  Bun 1.3.14, one thread.
- **No 8D visibility algorithm.** §4 argues from the kernel dimension that there is no cheap one
  and identifies the one thing 8D could buy (a derived tie-break). Neither is built.
- **The concentration-of-measure explanation in §4 is `unmetered`.** It predicts the observed
  flatness and is the standard reason for it; it is not itself measured here.

## Prior art (Beacon)

- **Stich, Friedrich & Dietrich**, *Spatial Splits in Bounding Volume Hierarchies*, High
  Performance Graphics 2009 — the SBVH: chopped binning, the `alpha` overlap criterion,
  reference unsplitting (named, not implemented).
- **Wald**, *On fast Construction of SAH-based Bounding Volume Hierarchies*, IEEE Symposium on
  Interactive Ray Tracing 2007 — binned SAH construction.
- **Goldsmith & Salmon**, IEEE CG&A 1987; **MacDonald & Booth**, *The Visual Computer* 1990 —
  the surface-area heuristic itself. Rung 7 named these as the next step; this rung takes it and
  reports what it was worth (2.3× on tests/ray, table row 2 → 4).
- **Sutherland & Hodgman**, *Reentrant Polygon Clipping*, CACM 17(1), 1974 — the polygon clip
  that makes a spatial split tight rather than merely legal.
- **Pharr, Jakob & Humphreys**, *Physically Based Rendering* 4th ed., §4.3 — ordered
  front-to-back traversal with the `t > best` cutoff.
- **Möller & Trumbore** 1997 · **Kay & Kajiya** 1986 · **Williams, Barrus, Morley & Shirley**
  2005 — inherited from rung 7 unchanged; this rung adds no new intersection arithmetic.
- **Lévy**, *Problèmes concrets d'analyse fonctionnelle*; **Milman** — concentration of measure
  on high-dimensional spheres and Stiefel manifolds. Why 56 frames and 60 random frames agree
  to 1.39×.
- **Cauchy**, surface-area formula (1841) — the mean projected area of a convex body is a fixed
  fraction of its surface area, direction-independent.
- **Coxeter**, *Regular Polytopes* — 4_21 and its face lattice; the source of the 2-skeleton
  whose 27-faces-per-edge is measured with no embedding involved.
- **Knight & Leveson** 1986 — why the exhaustive scan is kept: an accelerator with no
  independent oracle is an optimisation nobody can falsify. This rung is what that decision
  bought.

## Files

- `src/Core.TypeScript/research/clifford-e8-sbvh.ts` (+ test) — binned-SAH and SBVH builds,
  ordered traversal, `subdivideTriangles`, `bvhQuality`.
- `src/Core.TypeScript/research/clifford-e8-projection-sweep.ts` (+ test) — the 56 eigenlayer
  frames, seeded random frames, `measureProjection`, and the intrinsic-vs-projected checks.
- Rung 7: `docs/research/2026-09-09-rung-7-the-picture-exists-and-the-surface-is-738-layers-deep.md`
  — the tracer, the 738 measurement, and the conclusion this rung revises.
