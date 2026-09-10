# Phase 0 — the shading survives at rank 3 on TRIANGLES, and the object has a side

Work item: 081M243HXZS087G0R003746F3H · 2026-09-09 · register: every count, incidence, norm,
level and intersection below is `metered` (exact `bigint` / `BigInteger`, byte-locked across
two oracles). The wall-clock timings are `metered on the named hardware only`. That an H3
solid is a *good-looking* or *useful* scene is `unmetered` and is not claimed.

Aaron decided the direction:

> *"for the graphics i think the least computational one is the better one … the extra
> brightness dimensions make a lot of sense … in case it's not clear we don't need to be in 8d
> if it does not buy us some advantage. i didn't know if there was some advanced physics we
> could do to unify the graphics and physics into one engine but its fine if these are
> separate."*

The roadmap (#17170) put one thing ahead of everything else in Phase 0:

> *"the H3 result is measured for the **ring**, not the **light** … **Exact shading over an H3
> orbit polytope is `toy` and unrun.** If Phase 0 proceeds, that is the first thing to falsify
> — before the byte-lock, not after, because a golden document that locks an inexact shading
> model locks the wrong thing."*

It was run first. This is what it says.

---

## 1. The gating answer, stated precisely enough to be wrong

**Shading stays exact — and the honest statement has two halves, because one of them is a
negative result.**

| claim | status |
|---|---|
| `cos^2` is an **exact ratio in `Q(phi)`** for every facet of every H3 orbit polytope, under any light in `Z[phi]^3` | **holds** — checked on all 126 facets of the four solids under two lights |
| the brightness **ordering** is exact `Z[phi]` integer arithmetic with no float anywhere | **holds** — `<L, n>` is a ring element by construction |
| `cos` **itself** closes over `Q(phi, sqrt 3)` — ONE named irrational, the analogue of rung 6's `sqrt 6` | **holds on TRIANGULAR and HEXAGONAL facets only** |
| `cos` closes over a single named radical on **pentagonal and decagonal** facets | **REFUTED** — `\|n\|^2 = 60 + 80 phi = 5 sqrt 5 phi^3`, and no `c^2 d` factorisation with `d` a square-free rational integer exists |

The mechanism is the same identity rung 6 relies on, and it **transfers**: for a facet of an
orbit polytope, **the sum of the facet's vertices is exactly normal to it**. Rung 6 proved that
for 4_21's triangles by an integer identity on root inner products; here it is checked on every
facet of every solid, in two ways — orthogonality to every facet edge, and parallelism to the
cross-product plane normal, which rank 8 does not even have.

It is also a theorem rather than a coincidence, which is why it survived the descent: a facet's
vertex set is one orbit of that facet's stabiliser, the stabiliser fixes the facet axis and has
no nonzero fixed vector in the facet plane, so the vertex sum — which the stabiliser fixes —
must lie on the axis.

**Where the irrational lives.** `|n|^2` for the icosahedron is exactly `12 + 12 phi = 12 phi^2`,
so `|n| = 2 phi sqrt 3`, and with a light of rational norm the Lambert cosine is `m / (k sqrt 3)`
with `m` in `Z[phi]`. **`sqrt 3` is the rank-3 analogue of rung 6's `sqrt 6`**, and it appears
exactly on the facets whose vertex count is 3 or 6.

**So Phase 0 does not change shape — but the choice of object is now forced by a measurement
rather than by taste.** The all-triangle solid is the one where the whole model has a single
named boundary.

---

## 2. What was built, and whether it self-intersects

**All four H3 orbit polytopes, derived — 12 / 20 / 30 / 120 vertices.** Nothing is authored:
the simple system is found by its **Gram matrix** (the Coxeter diagram `o --5-- o ----- o` fixes
`<a1,a2> = -2 phi`, `<a2,a3> = -2`, `<a1,a3> = 0` exactly, so the diagram is the input and the
coordinates are the output), the Wythoff seeds are the **fundamental weights** obtained as cross
products of the simple roots, and every vertex is an orbit image under the 30 reflections.
**Zero reflections leave `Z[phi]` on any solid.**

### The object is a convex 3-polytope, and the question does not arise

| | 4_21, rung 7/8 | H3 orbit polytopes |
|---|---|---|
| what it is | the **2-skeleton** of an 8-dimensional polytope, mapped to `R^3` | a **convex solid** already in `R^3` |
| the map applied | a rank-3 projection with a 5-dimensional kernel | **the identity** |
| Whitney (1936) | a 2-complex is in general position only in `R^5`, so **every** projection self-intersects | **does not apply** — there is no map |
| facets per edge | **27** (`3 f2/f1`) — no inside, no side, two-sided shading forced | **2**, min and max, on every edge of all four |
| Euler characteristic | — | **2** on all four |
| orientation | 768 faces undetermined in 3D | **determined on every facet** — `<n, v> > 0` everywhere |

**Established, not assumed: zero improper self-intersections, by exhaustive pairwise triangle
scan** — every one of the `n(n-1)/2` pairs, no BVH, no sampling: 190 / 630 / 1,540 / 27,730
pairs. Steinitz says a convex 3-polytope's boundary is an embedded 2-sphere, so this had to come
out zero; it was run because a theorem nobody checked against the shipped triangles is a check
that did not run. The detector's control — two deliberately crossed triangles — reports 1.

**This is the crux the task asked about: Phase 1 as written is not needed for this content.**
Phase 1 exists because *"4_21 cannot be an occlusion-correct 3D scene"*. An H3 orbit polytope
already is one. What Phase 1 becomes is a different question — how to build a *scene* out of
objects like these — not the question of whether a renderable object exists.

---

## 3. Is it actually cheaper? The numbers, on the same meters

Every geometric number below comes from **rung 7 and rung 8's own code**, imported and not
restated — `projectionCost` for overdraw and primitive size, `buildSbvh` + `intersectOrdered`
for the tracer, `intersectBruteForce` as the absolute reference. Comparing two objects requires
one meter, not two measurement programs.

**Apple M2 Ultra, Bun 1.3.14, single-threaded scalar TypeScript, 128² framed view, median of 9
after a warm-up.**

| solid | V,E,F | tris | overdraw | mean tri bbox | tri/ray | node/ray | render | SBVH build | brute force | disagreements |
|---|---|---|---|---|---|---|---|---|---|---|
| **icosahedron** | 12,30,20 | 20 | **0.762** | 48.3% | **3.23** | 6.03 | **1.5 ms** | 0.4 ms | 20 | **0** |
| dodecahedron | 20,30,12 | 36 | 0.837 | 38.7% | 3.43 | 6.36 | 1.4 ms | 0.8 ms | 36 | **0** |
| icosidodecahedron | 30,60,32 | 56 | 0.891 | 28.7% | 3.74 | 11.22 | 1.8 ms | 1.1 ms | 56 | **0** |
| trunc. icosidodecahedron | 120,180,62 | 236 | 0.959 | 17.1% | 3.97 | 15.18 | 2.4 ms | 5.8 ms | 236 | **0** |
| **4_21 (rung 8, SBVH + ordered)** | 240,6720,60480 | 60,480 | **738** | 29.3% | **440** | 594 | **268 ms** | 6,138 ms | 60,480 | — |

**Against rung 8, on the same meters:**

| | 4_21 | H3 (icosahedron) | factor |
|---|---|---|---|
| overdraw ratio | 738 | 0.762 | **969×** |
| triangle tests per ray | 440 | 3.23 | **136×** |
| 128² frame time | 268 ms | 1.5 ms | **179×** |
| exhaustive scan per ray | 60,480 | 20 | **3,024×** |
| SBVH build | 6,138 ms | 0.4 ms | **15,345×** |
| whole family derived | — | **26.4 ms** for all four | — |

**The overdraw below 1 is not an error and is worth reading correctly.** The metric is total
triangle area over the surface area of the containing unit ball; a polyhedron inscribed in that
ball has strictly less area than the ball, and the value rises toward 1 as the solid gets
rounder (0.762 → 0.959 across the family). 738 means the 4_21 skeleton covers the ball 738 times
over. That is the difference between a surface and a shell of interpenetrating sheets.

### The honest half: primitive size does NOT uniformly improve

Rung 8's diagnosis of its BVH was that *"the mean triangle bounding box is 29.3% of the scene
diagonal, so no assignment of whole triangles to boxes can produce boxes that do not overlap
almost everything."* **The icosahedron is worse on that metric — 48.3%** — because it has twenty
triangles and each one is a large fraction of the object. The 120-vertex solid is better at
17.1%.

It does not matter here, and the reason it does not matter is itself the point: with 20 to 236
triangles the acceleration structure is nearly irrelevant. Exhaustive scan over the whole
icosahedron is 20 triangle tests, which is **less than one twentieth** of what rung 8's *best*
accelerated traversal spends per ray. The BVH is being kept because the code is shared, not
because it is earning anything.

**Both directions are asserted in the test suite** so a future change that quietly flips them is
caught.

---

## 4. The level count — the deliverable Aaron asked for

Rung 7 measured that a light **off the root lattice but still integral** buys 4_21 **49**
brightness levels at **no loss of exactness**, moving the field `Q(sqrt 6) -> Q(sqrt 17)`. The
H3 analogue was run with `L = (2, 3, 6)`, whose `|L|^2 = 49` is a perfect square, so `|L| = 7`
is **rational** and the light contributes no new irrational at all.

| solid | facets | root light: signed / two-sided / lit | **integral light: signed** | field |
|---|---|---|---|---|
| icosahedron | 20 | 7 / 4 / 3 | **20 — every facet** | `Q(phi, sqrt 3)` |
| dodecahedron | 12 | 5 / 3 / 2 | **12 — every facet** | no single radical |
| icosidodecahedron | 32 | 11 / 6 / 5 | **32 — every facet** | `sqrt 3` on triangles, none on pentagons |
| trunc. icosidodecahedron | 62 | 19 / 10 / 9 | **62 — every facet** | `sqrt 3` on hexagons, rational on squares, none on decagons |

**The answer is not a number like 49 — it is SATURATION.** On every H3 solid the non-root
integral light gives **one distinct exact level per facet, with zero facets on the terminator**.
That is the ceiling: a flat-shaded render cannot have more levels than it has facets, so the
posterisation rung 6 measured on 4_21 **disappears entirely** at rank 3.

Two things this does *not* say, stated because the temptation runs both ways:

- **It is a smaller ceiling in absolute terms.** 4_21 gets 49 levels over 60,480 faces (0.08%
  distinct); the icosahedron gets 20 over 20 (100% distinct). Which is "more brightness" depends
  entirely on whether you want *levels* or *facets*, and the honest statement is that **at rank
  3 the level count stops being a property of the algebra and becomes a property of how much
  geometry you built.** The exactness constraint is no longer what limits the shading.
- **`|L|^2 = 49` matching rung 7's 49 levels is a coincidence and is recorded as one.** They are
  different quantities that share a digit string, which is the definition of numerology
  (`.claude/rules/numerology-vs-number-theory.md`). Any Pythagorean quadruple works; this one is
  a gauge choice and is named as one in the source.

**The light gauge is discharged, not asserted.** Rung 6's transitivity argument transfers: the
H3 group is transitive on the 30 roots, so the intensity multiset over a full orbit polytope is
**identical for every one of the 30 root lights** — measured, in both oracles.

---

## 5. The payload: 0 bytes of geometry, and a reversal worth naming

**0 bytes of geometry survives.** Nothing in the derivation is a coordinate table: the 30 roots
are generated by a sign-and-permutation rule, the simple system is *searched for* by its Gram
matrix, the weights are cross products, every vertex is an orbit image. A test refuses any
literal array of four or more nested arrays in the module, with a control string that the
pattern does match.

| | rung 7 (4_21) | Phase 0 (all four H3 solids) |
|---|---|---|
| minified derivation bundle | **27,621 B** | **8,238 B** — 3.35× smaller |
| its output as `float32` triangles | 2,177,280 B | 12,528 B (720 + 1,296 + 2,016 + 8,496) |
| derivation / output | **0.0127** | **0.66** |

**The byte argument inverts at this scale, and pretending otherwise would be dishonest.** For
the icosahedron alone the explicit triangle soup is **720 bytes** — eleven times *smaller* than
the code that derives it. Rung 7 ships the derivation because 27 KB beats 2.1 MB; at rank 3
that inequality is gone.

The reason to keep deriving is therefore **provenance, not size**: a committed geometry blob is
a golden vector nobody reads, it drifts silently when a rung changes, and it is exactly the
class `no-binary-in-proof-lineage` refuses. The derivation stays because it is *checkable*, and
that argument has to be made on its own now rather than resting on a byte count that no longer
supports it.

---

## 6. The byte-lock

`tests/cross-verification/h3-rank3-geometry/h3-rank3-geometry.golden.json` — 126 lines, 7,064
bytes, and **it held first try**, exactly as the E8 one did.

**The document contains no floating point at all.** Every locked quantity is an integer or a
`Z[phi]` pair of integers, so there is no numeric formatting treaty to negotiate between
`Number` and `System.Double` and the whole class of divergence
`.claude/rules/culture-invariant-by-default.md` exists for cannot arise. The one irrational the
model admits appears as the integer `3` under `cosineRadicand` and is never evaluated.

**The independence, enumerated rather than asserted** — because agreement is worth exactly what
the independence behind it is worth:

| quantity | TypeScript | F# |
|---|---|---|
| facets | argmax over the 62 derived weight-orbit directions, `O(62 n)` | **exhaustive supporting-plane search over every vertex triple**, `O(n^4)` |
| `zSqrt` | search `q`, solve `p^2 = a - q^2` | search `p`, solve `q^2 + 2pq - b = 0` |
| facet cyclic order | gift-wrap by an exact orientation sign | an exact half-plane + cross-product angular comparator |
| orbit closure | breadth-first by rounds, with a frontier | a worklist stack |

Everything else is shared mathematics, so agreement there is evidence in proportion to those
four rows and no more.

The two facet algorithms are also each other's falsifier *inside* TypeScript: the exhaustive
search is the **absolute reference** the fast path is obliged to reproduce, facet for facet, on
all four solids. That discipline comes from rung 7's surviving .NET mutant, where every tracer
test compared one accelerated path against another and both shared `trace`.

---

## 7. Mutation testing: two survivors, and what they were

Twenty targeted mutants across both modules. Eighteen were killed and the killer is named; the
two survivors are reported, because a surviving mutant reported is worth more than a clean sheet
asserted.

**M1 — `zSign`: `>` becomes `>=` in the mixed-sign branch. SURVIVED, and it found a real
defect.** The two differ only when `p^2 = 5 q^2`, which forces `p = q = 0` — the irrationality
of `sqrt 5` — and that case was already returned by the first test. **The `left === right ? 0`
branch was unreachable code wearing the shape of a case**, and it is now deleted in both
oracles, with a test that checks no such `(p, q)` exists in a `401 x 401` window. The mutant is
equivalent *after* the fix, and stays reported as such.

**M6 — `h3SimpleRoots`: delete the `<a1, a3> = 0` condition. SURVIVED, equivalent under this
input.** For the order `h3Roots()` returns, the first triple satisfying the other two Gram
conditions is already orthogonal, so no test can distinguish. The condition stays because it is
what the Coxeter diagram says, and a new test was added that shares nothing with the search: the
three simple roots **generate all 30 roots** under their own reflections, which is the property
that makes them simple.

Kills worth naming because they show the falsifiers bite:

| mutant | killed by |
|---|---|
| facet normal sums only the first three vertices | the dodecahedron's vertex sum stops being orthogonal to its pentagon's edges |
| the orbit swallows non-integral reflections silently | the off-lattice seed test — the exact defect measured while writing the module |
| `h3EdgeFacetIncidence` returns 2 unconditionally | the hole test: delete one facet and the minimum must fall to 1 |
| the self-intersection scan never reports improper | the deliberately crossed pair |
| the unit-ball scaling is removed | the SBVH disagrees with brute force |
| only the first weight orbit supplies candidate normals | the dodecahedron's f-vector |
| `h3NormalRadical` returns radicand 3 unconditionally | the **negative** pentagon result |
| `h3Embed` drops the `phi` term | the exact-`cos^2`-versus-float control |

---

## 8. What this does NOT settle

- **Whether an H3 solid is a scene.** Twenty triangles is an object, not a world. Phase 1's real
  question survives in a changed form: how to compose many such solids, and what a `Z[phi]`
  scene graph costs.
- **Which solid to build on.** The measurement says the **icosahedron** if a single named
  irrational matters (all-triangle, `sqrt 3`, fewest primitives, 3.23 tests/ray) and the
  **truncated icosidodecahedron** if primitive size matters (17.1% bbox, 62 facets, 62 exact
  levels). Both are cheap. That is a choice, and it is Aaron's, not a measurement's.
- **Reflections.** Held pending, as instructed. The 27-facets-per-edge blocker is gone — the
  surface has two sides now — but nothing about reflection is implemented or measured here.
- **Physics.** Out of scope by instruction, and nothing here builds toward unification. Graphics
  and physics remain separate engines, which is what Aaron said is fine.
- **The pentagon/decagon field.** Reported as `null`, meaning *"not of the form `c^2 d` for `d`
  in the named candidate set `{1,2,3,5,6,7,10,11,13,14,15}`"* — **not** "no algebraic form
  exists". `|n|` there is a degree-4 algebraic number and `cos^2` is still exactly in `Q(phi)`;
  only the single-named-radical property fails.

---

## 9. Anchors (Beacon), cited because they are used

- **Pierre-Philippe Dechant**, *Rank-3 root systems induce root systems of rank 4 via a new
  Clifford spinor construction*, J. Phys. Conf. Ser. 597 (2015) 012027, and *The birth of E8 out
  of the (Clifford) algebra of the icosahedron*, Proc. R. Soc. A 472 (2016) 20150504 — the
  `H3 -> H4 -> E8` chain this reads at its bottom rung.
- **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., Dover 1973) — H3, the Wythoff construction,
  and the four f-vectors the derivation is **compared against** rather than defined by.
- **W. A. Wythoff** (1918) — the kaleidoscopic construction: seed point plus group orbit.
- **Hassler Whitney**, *Differentiable manifolds*, Ann. of Math. 37 (1936) — general position,
  and therefore the theorem that governs rung 8 and does **not** apply here.
- **Ernst Steinitz** (1922) — the boundary complex of a convex 3-polytope is a 2-sphere.
- **Johann Heinrich Lambert**, *Photometria* (1760) — the cosine law, used as a **definition** of
  a shading value; the radiometric correspondence stays `toy`.
- **Leo Dorst, Daniel Fontijne & Stephen Mann**, *Geometric Algebra for Computer Science* (2007)
  — the versor sandwich `-a v a / |a|^2` that the reflection is the vector form of.
- **Stich, Friedrich & Dietrich**, *Spatial Splits in Bounding Volume Hierarchies*, HPG 2009 —
  the SBVH reused unchanged from rung 8.
- **Möller & Trumbore** (1997) — the ray/triangle test.

## 10. Where the code is

- `src/Core.TypeScript/research/h3-rank3-geometry.ts` — the derivation and the exact shading.
  One `Math.sqrt` call site, asserted on a **comment-stripped** copy of the source, because the
  raw count is three and two of those are docstrings.
- `src/Core.TypeScript/research/h3-rank3-cost.ts` — the cost measurement, on rungs 7 and 8's
  imported meters.
- `src/Core.TypeScript/research/h3-rank3-{geometry,cost}.test.ts` — 101 falsifiers.
- `src/Core.FSharp.E8Render/H3Exact.fs`, `H3GoldenVector.fs` — the second oracle.
- `tests/Tests.FSharp/H3Render.Tests.fs` — 19 falsifiers including the byte-lock.
- `tests/cross-verification/h3-rank3-geometry/` — the treaty, both emitters, and `cross-verify.ts`.
