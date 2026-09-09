# Rung 7 — the picture exists, and the surface is 738 layers deep

**Work item:** `081M23EWJNV087G0R001MYF1H7`
**Date:** 2026-09-09
**Rungs:** 1 lines · 2 drawings · 3 3D tessellation · 4 exact filled regions · 5 faces and normals ·
6 shading · **7 a thing you can look at, and the four questions under it**

Aaron, opening this rung:

> *"keep routing the drawing forward too. i'm curious when i will be able to see some 3d
> renderings based on our framework, eventually we want to get this into css if possible and
> shaders like our other stuff, we can have a new page for this. and gpu accelerated like
> with webgpu or whatever it's called and/or canvas, we have some work here too. are we going
> to have full ray tracing and it be fast on a cpu too? we likely would want vectorization
> too for this and simd kind of stuff for CPUs."*

The deliverable is the page. Open `demo/clifford-e8/index.html`. Everything below is what the
page turned out to be evidence *for*, and one measurement in it changes what the rest of the
ladder should be aiming at.

---

## 0. The one number that reframes the rest

> **The derived surface has an overdraw ratio of 738.**
> Total triangle area of the 2-skeleton, in the 3D embedding: **9,269**.
> Surface area of the ball that contains it: **12.57**.
> A chord through the object therefore crosses **hundreds of triangles**.

Every other measurement on this page is downstream of that. It is why:

- **nearest-hit occlusion shows you almost nothing** — the solid view is the outer shell, and
  it hides ~99.9% of the surface it is drawing;
- **CPU ray tracing is slow here** — 2,780 triangle tests per ray is not a weak accelerator,
  it is close to the number of triangles a ray genuinely meets;
- **an unscaled additive pass is pure white** — 700 layers of light with no exposure;
- **CSS 3D cannot render this at all**, at any element count (§1).

Rung 6 declined occlusion and said why. This rung supplies the number behind that refusal.

Secondary measurement, same cause: the **mean triangle bounding box is 29.3% of the whole
scene's diagonal** (0.902 against 3.084). Spatial subdivision assumes primitives are small
relative to the scene. Here they are not, by two orders of magnitude.

---

## The deliverable: `demo/clifford-e8/index.html`

| | |
|---|---|
| **page** | `demo/clifford-e8/index.html` — 33,971 bytes |
| **bundle** | `demo/clifford-e8/clifford-e8-substrate.js` — 27,621 bytes, generated |
| **geometry shipped** | **0 bytes** |
| **built in the browser** | 240 roots · 6,720 edges · 60,480 triangles · 181,440 vertices · 5 levels |
| **backends** | WebGPU → WebGL2 → Canvas 2D, auto-selected, each verified rendering |
| **modes** | solid (z-buffer) · additive (order-independent) · wireframe |

**Payload choice, and why.** The page ships **the derivation, not its output**. The position
buffer alone is 2,177,280 bytes as `float32`, or 184,320 bytes as 8-bit vertex indices over
240 points. The bundle that *computes* it is 27,621 bytes — smaller than any encoding of its
own output, and the only form that stays true when a rung changes. It is also the only form
that keeps the proof lineage textual with nothing to argue about: a committed geometry blob
would be a golden vector nothing reads, while committed source is read by a bundler and by a
reviewer alike.

**The bundle is our modules, not a port of them.**
`build-clifford-e8-page.ts` runs `Bun.build` over `clifford-e8-browser-entry.ts`, which
imports rungs 1–7 directly. There is no hand-written JavaScript geometry anywhere in
`demo/clifford-e8/`. `clifford-e8-page.test.ts` executes the *committed* bundle and asserts
its `positions`, `levels`, `histogram` and a ray-traced frame are equal to the TypeScript
modules'.

**Cost, measured (Apple M2 Ultra, Bun 1.3.14, single thread):** topology 10 ms · embedding
1.5 ms · shading 179 ms · BVH 147 ms. In Chrome the same work is within about 1.5× of that.

**GPU frame rate is UNMEASURED.** The page reports its own fps in the overlay; the automated
browser session used to verify it throttles `requestAnimationFrame` in a non-foreground tab,
so every reading taken here was 0–2 fps and means nothing. What *is* established is that all
three backends draw the surface correctly. Register: `unmetered`.

**Two defects the page found on the way.**

The WebGPU additive pass rendered silently black because the bind-group layout declared
`visibility: GPUShaderStage.VERTEX` while the fragment shader read the exposure out of the
same uniform. Nothing errored; the picture was just absent. Fixed, and pinned by a falsifier
that greps for `GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT`.

**CodeQL caught a `js/xss-through-dom` (high) on the first push**: the `<select>` value for
the surface mode flowed into `overlay.innerHTML`. It was not exploitable — the three options
are authored twenty lines away in the same file — and that is precisely the argument that
stops being true the moment someone adds a fourth option, or interpolates an `err.message`
into the same sink, which this page also did. So the **sink class was removed rather than the
taint argued away**: the page now assigns `innerHTML` nowhere, every dynamic value reaches
the document as a text node through two small `el`/`fill` helpers, and a falsifier asserts
`/\.innerHTML\s*=/` does not appear (with a control string proving the pattern fires).

That is the same discipline as the rest of this ladder pointed at a security finding: *"I
control the inputs"* is an unfalsifiable claim about the future, and a grep for the sink is
a check that can fail.

**The fix's first version was itself flagged**, which is worth recording. `fill` accepted
either a string or a node and branched at the sink —
`appendChild(typeof part === "string" ? createTextNode(part) : part)` — and CodeQL raised
`js/xss-through-exception` (medium): taint tracking cannot see through the ternary, so an
`err.message` reaching that call reads as a string handed to `appendChild`. Narrowing the
parameter to **nodes only**, with callers saying `txt("...")` where they mean text, removed
the union rather than the warning.

**And the falsifier for it had the classic defect on its first run.** The assertion
`expect(HTML).not.toMatch(/appendChild\(typeof/)` failed — on the *comment* explaining why
that shape had been removed. A source-scanning guard must match the **call**, not the prose
about the call, so the negative assertions now read a comment-stripped copy of the page,
with a control asserting the stripper kept the code. This is the third time in this
repository's record that a guard has been satisfied by its own explanation.

---

## 1. CSS — what is viable, with a number

**The blocker is not element count. It is the compositing model.**

CSS 3D under `transform-style: preserve-3d` composites elements by **sorting them**, and a
per-primitive depth sort is exactly what is undefined on this surface: 27 faces meet on every
edge, faces interpenetrate constantly under an 8→3 projection, and depth cycles are the norm
rather than the exception. There is no per-fragment depth test in CSS. So **CSS 3D cannot
render the 2-skeleton correctly at any element count** — not slowly, not at all. That is a
statement about the model, not about performance.

The element count is a second, independent wall, and it is measured. Building transformed
`<div>`s in Chrome on this machine:

| elements | build + forced layout |
|---|---|
| 240 (the vertices) | **1.1 ms** |
| 6,720 (the edges) | **24.9 ms** |
| 20,000 | **105.6 ms** |
| 60,480 (the faces) | **351.5 ms** |

*(Measures construction and forced layout only. Per-frame paint and compositing cost is
**unmeasured** — the same rAF throttling as above. Register: the build column is `metered`,
the frame cost is not.)*

**So what IS viable in CSS, honestly:**

- **The 2D Coxeter projection — comfortably.** 240 points and 6,720 edges, and *the occlusion
  question does not arise*, because a 2D projection has nothing to occlude. Rung 1 already
  emits this as SVG (`renderSvg`, `renderDrawingSvg`); a CSS version is a styling exercise
  over the same derived data. This is the right CSS target.
- **Small 3D subsets — yes.** A single ring, one eigenlayer, a few hundred elements. The
  sorting problem is real but tolerable when primitives do not interpenetrate.
- **The full 2-skeleton in 3D — no**, and the reason to say no is correctness, not speed.

In-repo prior art for the register: `src/Renderers/css-only/dla-css-oracle.html` is the
existing CSS-only oracle; the CSS path here would sit beside it, over the Coxeter projection.

---

## 2. Shaders — the model is unusually shader-friendly, and here is why

**The shader evaluates no lighting.** Both shaders on the page contain exactly one lighting
operation, an array index:

```wgsl
// WGSL — the entire shading model
o.shade = u.palette[u32(lvl)].x;
```
```glsl
// GLSL ES 300 — the same model
vShade = uPalette[int(aLevel)];
```

No normal is uploaded. No dot product is computed. No exponent, no `normalize`, no `reflect`.
A falsifier greps the shader text for each of those and requires their absence.

This is not a simplification, it is the structure of rung 6 arriving intact at the GPU. The
intensity is `<L, n> / √384` with `n = a + b + c` — computed in **8-dimensional integer
arithmetic**, over a face set that has no 3D existence, before any projection happened. The
integer numerator takes five values over the whole surface, so what reaches the GPU is a
**per-face index into a 5-entry palette**. The only irrational in the pipeline is
`cosineToNumber`, crossed exactly **5 times** for 60,480 faces.

Three practical consequences:

- **Flat shading forces unindexed geometry.** The level is per-face; a vertex is shared by
  many faces at different levels; `flat` interpolation resolves that by *provoking vertex*,
  which is a rasteriser-order-dependent answer. So 60,480 faces become 181,440 vertices over
  240 distinct points. Deliberate, and stated in `clifford-e8-browser-scene.ts`.
- **Culling must be off everywhere.** `cullMode: "none"` in WGSL, `gl.disable(gl.CULL_FACE)`
  in WebGL2. There is no inside to cull; a culled pass silently deletes half a surface and
  still looks like a picture.
- **The palette is a uniform, so the light gauge is free.** Changing the light root changes
  the per-face level buffer, not the shader.

---

## 3. Ray tracing on the CPU — measured, and the answer is *not at interactive rates*

**The insight first, because it is the reason the tracer exists.** Rung 6 excluded occlusion
because a painter's sort is wrong on interpenetrating geometry. Ray tracing's nearest-hit is
the *correct* method for exactly that case: the decision is made **per sample**, at a point,
so interpenetration and depth cycles cannot arise. So this is not a nicety — it is the
principled repair of a limitation the ladder had already named. (A z-buffer is the same
repair with the sampling pinned to the pixel grid, which is why the GPU paths are honest too.
What is *never* honest here is a sort.)

### The numbers (Apple M2 Ultra, macOS 25.6.0, Bun 1.3.14, ONE thread, TypeScript)

BVH over 60,480 triangles: 32,767 nodes, 16,384 leaves, depth 14, leaf size 4, median split
on the widest centroid axis. **Build: 147 ms.**

| resolution | time | fps | µs/ray | hits |
|---|---|---|---|---|
| 64² | 545 ms | 1.83 | 133.1 | 34% |
| 128² | 1,992 ms | 0.50 | 121.6 | 34% |
| 220² | 6,454 ms | 0.15 | 133.3 | 34% |
| 256² | 8,654 ms | 0.12 | 132.1 | 34% |
| 512² | 31,028 ms | 0.03 | 118.4 | 34% |

**Per ray: 2,780 triangle tests and 3,134 node tests.** BVH against exhaustive scan over the
same framed view: **7.6×** (1,109 µs → 146 µs per ray).

In Chrome, the same tracer through the page's button: 220² in **7,476 ms**, BVH build 905 ms —
roughly 1.2–1.5× Bun.

### Reading those numbers honestly

**A 7.6× speedup from a BVH is a bad speedup, and it is not the BVH's fault.** With 738×
overdraw a ray *genuinely meets* on the order of a thousand triangles; 2,780 tests to find
them is a small constant over the true answer. A surface-area heuristic (Goldsmith & Salmon
1987; MacDonald & Booth 1990) would improve the constant. It cannot change the conclusion,
because the conclusion is set by how many triangles are actually there.

**Is it fast on a CPU? No — measured, at 0.5 fps for 128² on one core.** The headroom, and
each item is a **labelled estimate**, not a measurement:

| lever | estimated factor | 128² | 512² |
|---|---|---|---|
| measured, 1 core, TypeScript | 1× | 1,992 ms | 31,028 ms |
| 24 cores, perfect scaling *(estimate)* | ~20× | ~100 ms | ~1,550 ms |
| native + 4-wide SIMD *(estimate)* | 4–5× | ~22 ms | ~340 ms |

So **interactive CPU ray tracing at 128² is plausibly reachable** with threads and a native
inner loop; **512² is not**, on this hardware, for this geometry. And the honest closing
observation: the GPU rasteriser already computes the same correct per-sample occlusion at
full resolution. **Ray tracing's value here is not speed — it is that it can be checked**
against an exhaustive scan, which is what makes it the falsifiable occlusion method.

### Two findings the tracer produced that were not in the plan

**(a) The projection FOLDS, so "the nearest triangle" is not unique.** `embed3d` is linear
from 8 dimensions to 3, and edge-adjacent faces can land on *overlapping* regions of the same
3D plane. About **1% of seeded rays** meet two distinct triangles at **bit-identical** depth —
and **some of those tied faces carry different shading levels**, so the pixel's colour is
genuinely ambiguous, not merely its provenance. The tracer therefore declares its tie-break
(lowest triangle index) rather than letting traversal order decide it. Before that rule was
declared, the BVH and the exhaustive scan disagreed on 2 of 220 rays — *neither was wrong*.

This sharpens rung 6's refusal: a 3D image of an 8D object cannot always say which face you
are looking at.

**(b) Opaque nearest-hit is correct and nearly uninformative.** The solid mode renders the
outer shell and hides everything behind it — which, at 738 layers, is essentially the whole
object. The **additive, order-independent** mode is the more faithful view of this surface,
and it needs an exposure near 1/700 or every interior pixel saturates to white. That exposure
is the **only authored number in the picture**, and the page says so on its face.

---

## 4. SIMD and vectorisation — what would actually vectorise, and where it has to live

**What vectorises well, in the order it pays:**

1. **Ray/box (the slab test).** 3,134 node tests per ray dominate the test count. The standard
   win is a **4- or 8-wide BVH**: test one ray against 4 child boxes at once (`MBVH`/`QBVH` —
   Wald, Benthin & Boulos 2008; Ernst & Greiner 2008). Fully data-parallel, no branching in
   the inner loop, and it also shortens the tree.
2. **Ray/triangle (Möller–Trumbore).** 2,780 tests per ray, all identical arithmetic — the
   textbook SoA case. Store leaf triangles as **structure-of-arrays** (`x0[4], y0[4], …`) and
   test 4 triangles per instruction; the `u < 0 || u > 1` rejections become masks.
3. **Ray packets.** Trace 4–16 coherent primary rays together (Wald et al. 2001). Least
   attractive *here*: with 738× overdraw the rays diverge early and packet coherence decays.

**Layout comes before instructions, and half of it is already done.** The BVH in
`clifford-e8-raytrace.ts` is already flat typed arrays (`Float32Array` bounds, `Int32Array`
nodes) rather than objects, because a pointer-chasing tree cannot be vectorised whatever the
ISA. The remaining layout work is the SoA leaf packing above.

**Can Bun/TypeScript reach it? Partially, and the honest answer is that the real gains need
another language.**

- **Not in plain TypeScript.** JavaScript has no portable SIMD. `Float32Array` gives good
  memory layout — measured at ≈**48 ns per triangle test** here (133 µs ÷ 2,780) — but the
  JIT will not fuse four of them.
- **WebAssembly SIMD (`v128`) is the reachable path,** and this repo already speaks it:
  `src/wasm-dla/` builds WebAssembly from six substrates with a committed byte-lock. A
  `v128` Möller–Trumbore compiled to Wasm would run in Bun *and* in the browser page, which
  is the property that matters — one implementation, both consumers.
- **The Rust oracle is where the ceiling is.** `std::simd` / explicit NEON on this machine,
  with real control over alignment and prefetch. This repo's four-oracle discipline makes
  that a natural home, and it is the honest answer to "how fast can this get".

**The register.** Every number in this section except the 48 ns is an estimate. Nothing here
has been SIMD-implemented or benchmarked, and a vectorised tracer is filed as follow-on work
rather than claimed. `toy` until a `v128` inner loop exists and is timed on named hardware.

---

## Falsifiers and mutation testing

23 falsifiers across three new test files, 693k assertions, plus 7 on the committed page.
Twelve mutants were applied and the suite re-run for each.

| mutant | verdict | killed by |
|---|---|---|
| M1 `deriveLevelNumerators` returns the hardcoded five levels | **KILLED** | *derives the level list from a shaded set rather than from a constant* (a 3-face slice cannot contain 5 levels) |
| M2 every triangle vertex reads point 0 | **KILLED** | *places all 181,440 vertices exactly where `embed3d` puts their root* |
| M3 histogram always credits level 0 | **KILLED** | *agrees with rung 6's census* |
| M4 normalisation divides by 1, not the measured radius | **KILLED** | *places all 181,440 vertices exactly…* |
| M5 the scene ignores the requested light root | **KILLED** | *changes the picture and not the census when the light root changes* |
| **M6 cross-module: `lambertCosine` numerator forced to 0** | **KILLED** | *agrees with rung 6's census* |
| M7 the ray/triangle test culls back faces | **KILLED** | *measures the projection's exact-depth ties* |
| M8 the declared tie-break is dropped | **KILLED** | *returns the same nearest hit as brute force* |
| M9 the camera's conditioning fallback is removed | **KILLED** | *builds a well-conditioned frame from every root* |
| M10 leaf bounds inflated by 1 unit | **KILLED** | *bounds every node over its own triangles and over its children* |
| **C1 control: the slab test accepts every node** | **KILLED — by TIMEOUT** | see below |
| **C3 control: BVH children visited in the opposite order** | **SURVIVED** ✅ | — |
| **C2 control: a comment is reworded** | **SURVIVED** ✅ | — |

**M6 is the one that matters.** Rung 6 documented that forcing `lambertCosine`'s numerator to
a constant zero *survived its entire suite*, because `shadeFaces` carried an inlined copy.
Rung 6 fixed the duplication; this rung's scene builder is the second consumer, and the mutant
is now killed **across a module boundary**. That is the specific check that a renderer with
its own private copy of the shading model would have defeated.

**C1 is reported as a failure of my control, not of the suite.** Making the slab test accept
every node is *semantically neutral* — the nearest hit is unchanged, the traversal is just
exhaustive — so I predicted it would survive. It was killed by a **5-second test timeout**,
not by a wrong answer. The suite's time budget is a real constraint the mutant violates, and
saying "killed" without saying "by timeout" would have overstated what the assertions cover.

**C3 is the control that carries information.** Swapping the order in which the BVH visits its
two children survives — and it survives *because* the tie-break is declared. Before that rule
existed, this mutant would have been killed by the very disagreement that produced it. A
control mutant that only passes after a real fix is a measurement of the fix.

---

## Prior art (Beacon)

- **Möller & Trumbore**, *Fast, Minimum Storage Ray/Triangle Intersection*, JGT 2(1), 1997 —
  the triangle test, used in its two-sided form, which this geometry forces.
- **Kay & Kajiya**, *Ray Tracing Complex Scenes*, SIGGRAPH 1986 — the slab test.
- **Williams, Barrus, Morley & Shirley**, *An Efficient and Robust Ray-Box Intersection
  Algorithm*, JGT 10(1), 2005 — the reciprocal-direction form, IEEE-infinity handling included.
- **Wald, Boulos & Shirley**, *Ray Tracing Deformable Scenes using Dynamic BVHs*, ACM TOG
  26(1), 2007 — the BVH design. **Goldsmith & Salmon** 1987 and **MacDonald & Booth** 1990 for
  the SAH that is named here and not implemented.
- **Wald, Benthin & Boulos**, *Getting Rid of Packets*, IEEE Interactive Ray Tracing 2008;
  **Ernst & Greiner**, *Multi Bounding Volume Hierarchies*, 2008 — the wide-BVH SIMD design.
- **Wald, Slusallek, Benthin & Wagner**, *Interactive Rendering with Coherent Ray Tracing*,
  Eurographics 2001 — ray packets.
- **Pharr, Jakob & Humphreys**, *Physically Based Rendering*, 4th ed. — reference for both.
- **Dorst, Fontijne & Mann**, *Geometric Algebra for Computer Science*, 2007 — the algebra
  rungs 1–6 stand on; this rung adds none of its own.
- **Segal & Akeley**, the OpenGL specification's provoking-vertex rule — why a per-face
  attribute forces unindexed geometry.
- **Knight & Leveson** 1986 — why the exhaustive scan is kept beside the BVH: an accelerator
  with no independent oracle is an optimisation nobody can falsify.

## What this rung does not claim

- No GPU frame rate. Measured as 0–2 fps in a throttled automated tab, which is not a
  measurement of anything. The page reports its own fps to whoever opens it.
- No SIMD result. Section 4 is a design with estimates and one measured scalar cost.
- No claim that the picture is *good*. That it renders, on three backends, with the derived
  five levels and no culling, is checked. Whether it is beautiful is `unmetered`.
- No CSS implementation. §1 says what is viable and why the full surface is not; the Coxeter
  projection remains the right CSS target and is not built here.

## Files

- `demo/clifford-e8/index.html` — the page.
- `demo/clifford-e8/clifford-e8-substrate.js` — generated bundle of rungs 1–7.
- `src/Core.TypeScript/research/clifford-e8-browser-scene.ts` (+ test) — substrate → buffers.
- `src/Core.TypeScript/research/clifford-e8-raytrace.ts` (+ test) — BVH, Möller–Trumbore,
  nearest hit, the declared tie-break.
- `src/Core.TypeScript/research/clifford-e8-browser-entry.ts` — the bundle entry.
- `src/Core.TypeScript/research/build-clifford-e8-page.ts` — the generator.
- `src/Core.TypeScript/research/clifford-e8-page.test.ts` — falsifiers over the committed page.
