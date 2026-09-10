# Rung 7 — the .NET oracle agrees byte for byte, and the GEOMETRY, not the CPU, is what bounds the frame rate

**Date:** 2026-09-09 · **Work item:** `081M23FPSHV087G0R001V4M5QV` ·
**Register:** the agreement is **metered**; the throughput is **metered on one named
machine**; "a fully-.NET engine is worth building" is a **judgement**, argued below, not a
measurement.

Aaron set the architecture:

> *"for our graphics engine maybe we should start in f# first since it looks like the math
> for the simd stuff, your css/canvas/webgpu is also a good split, ts is fine too as far as
> the web stuff but we don't have to vectorize there yet with like simd. ... it's also fine
> for us to have multi oracle with rust too but i'd love to have a graphics engine built
> entirely built in dotnet if it's useful."*

So: **F# owns the math and the SIMD/CPU rendering; TypeScript keeps the web surface; Rust
stays acceptable as a further oracle but a fully-.NET engine is the target if it earns its
place.** This rung is the first .NET member of the ladder whose rungs 1–6 live in
`src/Core.TypeScript/research/clifford-e8-*.ts`.

## 1. What was built

| artifact | what it is |
|---|---|
| `src/Core.FSharp.E8Render/E8Exact.fs` | the 240 roots, the 6,720 edges, the 60,480 2-faces, the f-vector and the facets — **exact integer arithmetic**, no float, no tolerance |
| `.../E8Clifford.fs` | Cl(8,0) **generated** from a transposition-count sign rule; no multiplication table |
| `.../E8Shading.fs` | the derived shading model; the single irrational is confined to `cosineToNumber` |
| `.../E8Embedding.fs` | Jacobi eigen-decomposition → the Coxeter plane. **The declared float boundary** |
| `.../E8Raytracer.fs` | binned-SAH BVH, ordered traversal, two-sided Möller–Trumbore, scalar and `Vector<float32>` kernels, a DoP knob |
| `.../E8GoldenVector.fs` | the byte-lock, emitted as one canonical JSON document |
| `tests/cross-verification/clifford-e8-rendering/` | the TypeScript emitter and the F# oracle script of the SAME document, the `cross-verify.ts` that runs both, and the committed treaty between them |
| `tests/Tests.FSharp/E8Render.Tests.fs` | 31 falsifiers |
| `bench/Benchmarks/E8RaytraceBench.fs` | the committed measurement harness |

**This is a second oracle, not a port.** The repo already records that the language oracles
do not agree by default and that agreement is *achieved*, by a treaty, then locked
(`.claude/rules/culture-invariant-by-default.md`, "the seed is the treaty"). The F#
construction differs from the TypeScript one in three places on purpose:

- **triangles are enumerated edge-first** (intersect the two endpoints' adjacency rows)
  rather than by clique recursion, and the test asserts the two routes agree element for
  element;
- **`affineRank` is fraction-free integer elimination**, where TypeScript runs floating-point
  Gaussian elimination against a `1e-9` pivot threshold. A rank is a theorem here, not a
  measurement;
- **`reorderSign` counts inversions per set bit**, where TypeScript accumulates shifted
  population counts. Same count, different formulation.

## 2. Result: every quantity byte-locks, first run, no disagreement

The two oracles emit the same canonical document, and its SHA-256 is
`53330f85d54a7e5a65c8c96bb543b4edaf915a63124265caa74c33bee26c13e8`.

| quantity | F# | TypeScript |
|---|---|---|
| roots (112 + 128), `\|r\|² = 8` | 240 | 240 |
| edges at inner product 4 | 6,720 | 6,720 |
| 2-faces | 60,480 | 60,480 |
| f-vector | `240 · 6720 · 60480 · 241920 · 483840 · 483840 · 207360 · 19440` | identical |
| alternating sum | **0** | 0 |
| edge → face incidence (min, max) | 27, 27 | 27, 27 |
| `\|n\|² = a+b+c` squared norm | 48, on all 60,480 | 48 |
| Lambert numerator census | `−16:756 … 0:11592 … 16:756` | identical |
| two-sided census (**five** levels) | `0:11592, 4:24192, 8:15120, 12:8064, 16:1512` | identical |
| plane-illumination census | `0:1512, 256:40824, 384:18144` | identical |
| Coxeter rings × points | 8 × 30 | 8 × 30 |
| SHA-256 of all 240 roots | `300c2a4c…` | identical |
| SHA-256 of all 60,480 faces | `2f02909e…` | identical |
| SHA-256 of all 60,480 normals | `a6eefc57…` | identical |

**Nothing disagreed.** That is worth stating plainly rather than celebrating: two oracles
agreeing is evidence only in proportion to how independently they were built, and the three
divergences listed above are the whole of this pair's independence. A third oracle in Rust
would buy more.

**What is deliberately NOT locked** is the 3D embedding's coordinates. An eigenvector is
defined up to sign, so locking one would lock an arbitrary gauge; the ring *count* and
points-per-ring are rotation- and precision-invariant, and those are locked instead.

**A second, genuinely independent cross-check** is in the tests and not in the golden
vector: `Zeta.Core.E8Lattice` realises E8 in a completely different integer frame
(Construction A over the [8,4] adinkra code, `|r|² = 4`). The test asserts the inner-product
*multiset* agrees after doubling and that the two coordinate sets are **disjoint** — same
structure, different realisation.

## 3. The ray tracer, and why it is the principled repair of a measured limit

Rung 6 declined occlusion and said exactly why: every edge of 4_21 carries **27** incident
2-faces, so the projected shell *has no inside*, and a painter's-algorithm depth sort is
**wrong** on interpenetrating geometry. Ray tracing's nearest-hit is the correct occlusion
method for that case.

Rung 6 also hands the tracer the expensive half for free: **intensity is computed in exact
8D integers before the projection and takes exactly five values**, so a ray hit does not
evaluate lighting — it reads one byte out of an array.

**The SIMD contract is the falsifier.** The scalar and vector kernels must produce
byte-identical images; a lane mask that silently drops a hit is the classic defect and is
invisible without that assertion. `E8Render.Tests` asserts it, and mutation confirms the
assertion has teeth (§5).

## 4. Measurements — Apple M2 Ultra, arm64, .NET 10.0.11, macOS 26.6

`Vector<float32>.Count = 4` on this machine (ARM NEON, 128-bit),
`Vector.IsHardwareAccelerated = true`. Scene: 60,480 triangles, 11,975 BVH nodes, 142 ms to
build (root enumeration, shading and the Jacobi decomposition included). Single frame,
one primary ray per pixel, nearest hit, two-sided. Warm, mean of 3–5 frames.

| kernel | DoP | resolution | ms/frame | Mrays/s |
|---|---|---|---|---|
| scalar | 1 | 256×256 | 2274 | 0.029 |
| **SIMD** | 1 | 256×256 | **664** | 0.099 |
| SIMD | 24 | 256×256 | 68 | 0.967 |
| **SIMD** | **24** | **512×512** | **229** | **1.15** |
| scalar | 24 | 512×512 | 728 | 0.360 |

- **SIMD speedup: ×3.4 at DoP 1, ×3.2 at DoP 24, on four lanes.** Near-linear in lane count.
  On AVX-512 hardware the same code path compiles to 16 lanes; that is **untested here** and
  is not claimed.
- **DoP speedup: ×9.8** on a machine with 16 performance + 8 efficiency cores.
- **DoP = 1 and DoP = 24 produce byte-identical images**, asserted in the test suite. The
  knob is a knob, not a spawn.
- The headline: **≈4.4 frames/second at 512×512 for 60,480 fully interpenetrating triangles,
  CPU only, single process.**
- The committed harness is `bench/Benchmarks/E8RaytraceBench.fs`
  (`dotnet run -c Release --project bench/Benchmarks -- --filter '*E8Raytrace*'`), so these
  rows are re-derivable rather than quoted.

### 4.1 The honest finding: this geometry defeats spatial subdivision

The absolute throughput is poor by ray-tracing standards, and the cause is measured rather
than guessed:

> **Total leaf surface area ÷ root surface area ≈ 1,140.**

For a well-behaved mesh that ratio is a small number. Here it is three orders of magnitude
out, and the reason is structural: **60,480 triangles are drawn over only 240 vertices**, so
a projected 2-face has a mean edge length of 1.63 against a scene diagonal of 7.87 — every
triangle spans roughly a fifth of the model. Their bounding boxes all overlap, so no BVH can
prune much, and a ray ends up testing a large fraction of the whole set.

Both improvements attempted are in the committed code and both are honest about their size:

- **object median → binned SAH build** (16 bins, 3 axes): the leaf/root area ratio did not
  materially improve (1,004 → 1,142; the SAH buys tighter *inner* nodes, not smaller
  triangles);
- **unordered → front-to-back ordered traversal**: scalar 2,243 → 1,787 ms at 256×256; the
  SIMD path was unchanged, because it is already triangle-test-bound rather than
  traversal-bound.

So the bottleneck is **not** the CPU, **not** the kernel, and **not** .NET. It is that
4_21's 2-skeleton projected to 3D is not a surface, which is the same fact rung 6 measured
as 27 faces per edge. A GPU would hit the identical wall for the identical reason and would
simply have more lanes to hide it with.

## 5. Mutation testing — every falsifier, with its killer, and a control that must survive

Sixteen mutants, each built and run against the falsifier suite (27 at the time of the run;
31 now, the four added by §7). Twelve had to die, four had
to survive, and **one that was supposed to die did not** — which is where the value was.

| # | mutant | verdict | killed by |
|---|---|---|---|
| M1 | `GossetEdgeInnerProduct 4 → 2` | KILLED | f-vector; scalar/vector image; specular norm guard |
| M2 | face normal drops `c` | KILLED | five brightness levels; orthogonality; byte-lock |
| M3 | `lambertCosine` numerator → `0` | KILLED | five levels; cosine ordering; byte-lock |
| M4 | SIMD mask drops `u + v ≤ 1` | KILLED | scalar/vector byte-identical images |
| M6b | facet filter `Rank = 7 → Rank ≥ 0` | KILLED | rank spectrum; f-vector; byte-lock |
| M7 | `compareCosines` drops the negative-branch flip | KILLED | exact ordering vs float |
| M8 | canonical separator `;` → `,` | KILLED | byte-lock; separator sensitivity |
| M9 | padding slots carry a real triangle | KILLED | padded-lane test; total-order test |
| M10 | render drops the `+1` level offset | KILLED | scalar/vector images |
| M11 | ordered traversal never pushes the far child | **SURVIVED → then KILLED** | see below |
| M12 | tie-break removed (visit order decides) | KILLED | scalar/vector images |
| M14 | Jacobi sweep runs zero times | KILLED | byte-lock; four ray-tracer tests |
| **M5** | `above`'s `bit + 1 → bit` | **SURVIVED (control)** | — |
| **M6** | facet filter `Rank = 7 → Rank ≥ 6` | **SURVIVED (equivalent)** | — |
| **M13** | whitespace no-op | **SURVIVED (control)** | — |
| **M15** | Jacobi sweep cap `100 → 200` | **SURVIVED (control)** | — |

**M5** is the survivor the TypeScript oracle already documented as legitimate: the mask is
only ever applied to a set already intersected with `v`'s own adjacency row, and no vertex
is adjacent to itself, so bit `v` is clear before the mask sees it.

**M6 is an EQUIVALENT mutant, with evidence rather than an assertion.** The measured rank
spectrum of the 19,680 candidate faces is exactly `{0: 240, 7: 19440}` — nothing in between —
so `Rank = 7` and `Rank ≥ 6` select the same set. That is now pinned by the test as the whole
spectrum rather than as two counts, so if a future candidate family ever produces a rank-6
face the equivalence claim fails loudly instead of quietly becoming false. **M6b** is the
mutant that proves the filter is not vacuous: admitting rank 0 is killed.

### M11 — the one that got through, and what it cost

Mutating the ordered traversal to push only the NEAR child — so the far subtree is never
opened at all — **survived the entire suite.** The reason is exact and worth stating, because
it is a whole class:

> **Every ray-tracer falsifier was RELATIVE.** Scalar against vector, DoP 1 against DoP N.
> Both sides share `trace`, so a traversal defect changes both identically and no relative
> comparison can see it.

The repair is `renderBruteForce`: the exhaustive scan over every triangle with no BVH at all.
A BVH is an *accelerator*, so its only obligation is to reproduce the un-accelerated answer,
and that is now asserted at 48×48. M11 re-run against it: **KILLED**.

### The tie-break the brute-force falsifier immediately exposed

The first run of BVH-against-exhaustive **disagreed on 6 of 1,024 pixels**. Diagnosed rather
than tuned away: the two nearest hits sat at a **bit-identical `float32` t** on faces of
different brightness — 4_21's shell puts many faces on one plane, so this is common rather
than exotic. The winner was therefore whichever triangle the traversal reached first.

That is an order dependence, and rung 6's stated convention is that the shaded value is a
pure function of `(face, light)` and of nothing else. Occlusion had quietly reintroduced
what shading had eliminated. The fix restores it: **nearest hit breaks exact ties on the
lowest original face index**, which makes the answer a pure function of `(scene, ray)`. The
two renderers then agree exactly, and M12 (removing the tie-break) is killed.

### Two further defects found by the discipline, recorded where they happened

1. **A BVH child index computed as `left + 1`.** A depth-first build does not put siblings
   next to each other. It was written with an assertion guarding it, the assertion fired on
   the first real scene, and the fix was to store both child indices rather than to keep a
   check whose only possible report is that same defect.
2. **Two test assertions that passed for the wrong reason.** `compareCosines` was checked
   against `samples.[0]`, which happened to be a maximal element, so the "separates in both
   directions" claim was carried by an accident of sampling; and a frame was asserted to
   contain all five brightness levels at 96×96, which is a fact about ray sampling rather
   than about the kernel under test. Both were narrowed to what they can actually establish.

## 6. Verdict on a fully-.NET engine

**Worth pursuing, with one caveat that is about the object and not the platform.**

For:

- **The math is a natural fit.** Everything above the projection is exact integer arithmetic
  and F# expressed it without ceremony. The whole exact layer — roots, cliques, facets,
  Clifford products, shading — is 900 lines with zero dependencies.
- **.NET's portable SIMD is the right abstraction for this repo's rules.**
  `System.Numerics.Vector<T>` gives one code path that is 4-wide on NEON, 8 on AVX2 and 16
  on AVX-512, which is `async-all-the-way`'s scale-free requirement applied to lanes rather
  than threads. The measured ×3.4 on four lanes says the abstraction is not costing much.
- **The DoP knob came free and is honest.** DoP = 1 is a deterministic single loop that
  replays under DST; DoP = N is the same code. Byte-identical output is asserted, not
  assumed.
- **The byte-lock worked on the first run**, which means the .NET side can be held to the
  same treaty as the TypeScript side with no special pleading.

Against, and it is not an argument against .NET:

- **This particular object is the wrong benchmark for a renderer.** Any conclusion of the
  form "CPU ray tracing is/isn't fast enough" drawn from 4_21's 2-skeleton is a conclusion
  about 4_21. A renderer intended for general use needs a scene with a bounded leaf/root area
  ratio before its throughput number means anything.
- **Nothing here touches the parts of a graphics engine that are actually hard**: materials,
  texturing, shadow rays, denoising, an asset pipeline. This rung is a nearest-hit visibility
  solver over a fixed triangle soup with a five-entry palette.

The recommendation is therefore: **keep the exact/math/SIMD layer in .NET and grow it**, keep
the web surface in TypeScript as Aaron split it, and treat a Rust oracle as *additional
independence for the byte-lock* rather than as a competing engine. The next honest
measurement is the same kernel on a scene that a BVH can actually accelerate — that is what
would tell us whether .NET is fast enough, and this scene cannot.

## 7. Aaron's two design questions, answered by measurement

Both are answered with numbers produced by the module this PR ships. Nothing below is
argued from the shape of the mathematics alone.

### 7.1 "Will that work for a mirror?"

The question splits, and the two halves have opposite answers.

**(a) A mirror in the scene, reflecting our object — yes, unchanged.** Secondary rays are
ordinary rays hitting our geometry; the BVH, the kernels and the five-level lookup all serve
them exactly as primary rays. This is the cheap half and nothing about 4_21 obstructs it.

**(b) Our object BEING a mirror — three separate obstacles, two of them fatal as posed.**

**Obstacle 1 — there is no front side, on 768 faces, measured.** A mirror presupposes an
orientable surface with a side to reflect off. Measured here: **768 of 60,480 projected faces
(1.27%) have their plane pass through the origin**, so no outward direction is determinable
for them. That is not a tolerance artefact — the smallest *non-zero* origin-to-plane distance
over the other 59,712 faces is **0.002329**, three orders of magnitude above the `1e-9`
threshold, so the 768 are a genuine gap and not a near-miss. Rung 6 already closed the
obvious repair: `embed3d` is linear, so the projection of the 8D normal `a + b + c` is
*exactly three times* the projected centroid, which makes "import the 8D orientation" the
same test that already failed. And underneath that sits the structural fact: every edge
carries **27** incident faces, so the shell has no interior and "which side" is undefined
globally, not merely undetermined on 768 faces.

**Obstacle 2 — a view-dependent term breaks the precompute, but NOT as badly as expected.**
This is the measurement that surprised me and it is worth stating carefully. The reason this
tracer is cheap is that intensity is view-independent and precomputed to five levels. A
specular term is view-dependent by definition. But specular reflection off a root-quantised
view stays a lookup:

| view (a root) | distinct specular numerators over all 60,480 faces |
|---|---|
| 0 | 3 — `{−384, −128, 384}` |
| 13 | 5 — `{−320, −192, −64, 64, 192}` |
| 61 / 100 / 200 | 5 — `{−256, −128, 0, 128, 256}` |
| 137 / 239 | 5 — `{−192, −64, 64, 192, 320}` |

So a mirror is not "per-hit shading work" *provided the camera direction is one of the 240
roots*: it is **one five-entry table per view**, i.e. 240 tables, `240 × 60,480 =
14,515,200` bytes ≈ 14 MB, fully precomputable and still exact. What it is not is *free*: the
five-level table stops being a property of the object and becomes a property of
(object, view). A **free** camera direction leaves that regime entirely — see obstacle 3.

**Obstacle 3 — exactness ends at the camera, and the boundary is nameable.** Rung 6's
specular term is exactly rational for the precise reason that it pairs **two roots**:
`|L| |V| = √8 · √8 = 8`. `specularCosine` therefore *refuses* a view whose norm differs from
the light's, and the refusal is tested. Generalised: with `|V|² = m` the denominator is
`48 · √(8m)`, which is rational **iff `8m` is a perfect square**. A free camera direction is
not a root, so a view-dependent term leaves the exact lattice — the same kind of boundary
rung 6 drew at `√6`, one layer further out:

> **The Lambert boundary is `√6` and lives in the object. The specular boundary is the
> camera, and it is rational only on the 240 root directions.**

**Honest disposition.** A reflective 4_21 is buildable in exactly one register: **root-
quantised views, two-sided reflection, and a stated admission that 768 faces have no front**.
Anything else — a free camera, a genuine mirror surface with an inside — is not a rendering
feature we have not got around to; it is a claim the geometry does not support. Filed rather
than faked.

**Held, on Aaron's instruction (2026-09-09): reflections wait for the projection
measurement.** A sibling agent is measuring whether the interpenetration and the overdraw
pathology are intrinsic to 4_21 or artifacts of `embed3d` specifically. Everything above is
analysis and is offered to inform that decision; nothing here is being built toward.

**And this rung already answers half of that question, in the negative, because of where
each quantity is computed:**

| property | computed in | projection-dependent? |
|---|---|---|
| **27 incident 2-faces per edge** | `E8Exact`, pure integer 8D — `3 · f₂ / f₁ = 3 · 60480 / 6720` | **NO — intrinsic to 4_21** |
| f-vector, face normals, `\|n\|² = 48`, the five levels | `E8Exact` / `E8Shading`, pure integer 8D | **NO** |
| **768 faces with no determinable front side** | `E8Embedding`, after projection | **YES** |
| **leaf/root surface-area ratio ≈ 1,140** | `E8Raytracer`, over projected triangles | **YES** |

The incidence is a **theorem about the polytope in eight dimensions**, with no float anywhere
in its call graph — a different embedding cannot give the shell an inside, only change how
the sidelessness manifests in 3D. The 768 and the overdraw ratio genuinely belong to
`embed3d`, and those are the ones worth re-measuring under a different projection.

### 7.2 "Is five levels enough compared to real game engines, or is this a toy?"

**As a renderer: it is a toy, in this repo's exact vocabulary, and I am not going to dress
that up.** Game engines shade continuously in HDR float and tone-map to 256+ levels per
channel, with many lights, shadows, ambient occlusion, textures and a microfacet BRDF. This
has one light, Lambert only, no shadows, no textures, and occlusion added only in this rung.

**The structural answer, which is the useful one: five is not a ceiling of the method.** It
is the consequence of exactly two choices — *one* light that *is an E8 root*, meeting normals
that are *root sums*. Change either and the count changes. Measured, each with the field the
shading algebra then closes over:

| change | distinct levels | denominator | field | exact? |
|---|---|---|---|---|
| **baseline** — one root light | **5** | `√384 = 8√6` | `Q(√6)` | yes |
| light off the root lattice, still integral — `(1,…,8)`, `\|L\|² = 204` | **49** | `√9792 = 24√17` | `Q(√17)` | **yes** |
| light on a coordinate axis, `\|L\|² = 1` | 7 | `√48 = 4√3` | `Q(√3)` | yes |
| **two** root lights, summed | 9 | `√384` (shared!) | `Q(√6)` | **yes** |
| per-**vertex** normals, at the vertices | 3 | `12096` | **`Q`** | yes |
| per-vertex normals, interpolated across a face | continuous | — | — | **no** |
| distance falloff `1/r²` | continuous | — | — | **no** |
| specular, **root** view | 3–5 per view | `384` | `Q` | yes |
| specular, **free** camera | continuous | `48√(8m)` | irrational unless `8m` is square | **no** |

Three of those rows are worth reading twice.

- **A light off the root lattice buys 49 levels and costs no exactness at all** — it only
  moves the field from `Q(√6)` to `Q(√17)`. Quantisation is not the price of exactness here;
  it is the price of *choosing a root as the light*. Any integer vector keeps the numerator
  an integer.
- **Two root lights stay in `Q(√6)`**, because both terms share the denominator `√384` and
  the sum is `(k₁ + k₂)/√384`. Multi-light does not compound the field. Measured: 9 distinct
  sums, `0 … 32`.
- **Per-vertex ("Gouraud") normals go the wrong way**, and the reason is an exact identity
  worth recording: every vertex has exactly **756** incident faces, and the sum of their
  normals is **exactly `1512 × the vertex itself`** — verified on all 240. So the interpolated
  normal degenerates to the sphere normal, `|n_v|² = 1512² · 8 = 18,289,152`, the Lambert
  denominator becomes the *rational* `8 · 1512 = 12096`, and the level count **drops to
  three** at the vertices. Smoothness would then come only from barycentric interpolation
  across the face, which is float and leaves exactness. Gouraud on this object trades an
  exact five-level shading for a rational three-level one plus a float interpolant.

**The claim being made, stated so it cannot be over-read:** the exact-integer core is a
differentiator for **correctness and cross-oracle byte-lock**, not for visual quality. Five
levels is what one root light produces on this polytope, and it is a *measurement of 4_21*,
not a rendering budget. A renderer that wanted more would take a non-root light (free) and
per-pixel interpolation (leaves exact), and would be making an ordinary graphics trade rather
than discovering a limit.

### 7.3 On paying for eight dimensions and then projecting to three

Aaron has questioned the representation layer itself: we carry 8D and then project to 3D,
which is expensive, and the extra dimensions ought either to be doing calculations we
actually need or to be simulating in 8D without projecting at all. That critique is aimed at
the geometry pipeline rather than at this F# core, and the core's value — an exact-integer
byte-lock across oracles — holds whichever algebra the engine ends up using. But the rung
does supply one measured data point on it, and it points the same way he does:

> **Almost nothing here needs the projection.** Every quantity in §2 — 240, 6,720, 60,480,
> the f-vector, `|n|² = 48`, the nine Lambert numerators, the five levels, the plane-
> illumination census, the specular numerators — is computed in 8-dimensional integer
> arithmetic and never passes through `embed3d`. The projection is used for exactly one
> thing: **placing pixels**. It places them; it never touches a brightness.

So on this rung the extra dimensions are not overhead attached to a 3D pipeline — they are
where the work happens, and the 3D step is the *thin* part. What the measurements then say
is that the thin part is where all the cost and all the pathology live: the exact 8D layer
builds the entire polytope in 872 ms, and the projected 3D layer is what defeats the BVH
(§4.1) and what loses the front side on 768 faces (§7.1). That is at least consistent with
his instinct that the projection is the expensive mistake rather than the dimensionality.

What this rung does **not** establish is the stronger form of his claim — that we could
simulate in 8D and never project. A viewer needs pixels, so *something* must reduce to two
dimensions eventually; the open question is whether that reduction has to happen where it
happens now, over the whole triangle set, or could happen per-ray at the very end. Nothing
here measures that, and it is not claimed.

## 8. Anchors (Beacon), cited because they are used

- **Thorold Gosset** (1900) — 4_21. **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed.,
  Dover 1973) — the f-vector and the Coxeter element.
- **Bertram Kostant**, *The principal three-dimensional subgroup and the Betti numbers of a
  complex simple Lie group* (Amer. J. Math. 81, 1959) — the exponent structure the ring
  census measures.
- **Pierre-Philippe Dechant**, *The E8 Geometry from a Clifford Perspective* (Adv. Appl.
  Clifford Algebras 27, 2017) — the versor route.
- **Leo Dorst, Daniel Fontijne & Stephen Mann**, *Geometric Algebra for Computer Science*
  (Morgan Kaufmann, 2007); **David Hestenes & Garret Sobczyk** (Reidel, 1984) — the sandwich,
  the grade decomposition, reversion.
- **Coen Bron & Joep Kerbosch**, CACM 16(9), 1973 — clique enumeration.
  **Erwin Bareiss**, Math. Comp. 22, 1968 — fraction-free elimination.
- **Tomas Möller & Ben Trumbore**, *Fast, Minimum Storage Ray/Triangle Intersection* (JGT
  2(1), 1997). **Timothy Kay & James Kajiya** (SIGGRAPH 1986) — the slab test.
  **Amy Williams, Steve Barrus, R. Keith Morley & Peter Shirley** (JGT 10(1), 2005) — the
  robust reciprocal-direction form.
- **Jeffrey Goldsmith & John Salmon** (IEEE CG&A 7(5), 1987) and **J. David MacDonald &
  Kellogg Booth** (The Visual Computer 6, 1990) — the surface-area heuristic and its cost
  model. **Ingo Wald, Solomon Boulos & Peter Shirley** (ACM TOG 26(1), 2007) — binned SAH
  builds and ordered BVH traversal.
- **Johann Heinrich Lambert**, *Photometria* (1760) — used as the DEFINITION of a shading
  value, not as a radiometric measurement (register: `toy`). **Bui Tuong Phong** (CACM 18(6),
  1975) — named for the boundary this rung declines to cross.
- **Carl Gustav Jacob Jacobi** (1846) — the cyclic rotation sweep.

Prior art searched before claiming anything: geometric-algebra shading, BVH construction and
SIMD packet tracing are all decades old and none of it is claimed as novel here. What is
claimed, and only this, is that **for this polytope the shading numerator is an integer, the
model closes over `Q(√6)`, and two independently constructed oracles in different languages
agree on every one of those integers.**
