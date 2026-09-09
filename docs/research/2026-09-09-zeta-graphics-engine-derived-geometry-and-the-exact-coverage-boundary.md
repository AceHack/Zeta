# A Zeta graphics engine: what it is, what it is not, and where the irrational is allowed in

Date: 2026-09-09
Operational status: research-grade; the shipped slice is **metered**
Author: shadow-subagent (Claude Opus 5), Claude Code
Work item: 081M22J18FZ087G0R0034AWA5H
Scope: the design of a graphics engine whose geometry is admissible only when generated
from the Clifford substrate, plus rung 4 of the rendering ladder — exact integer coverage
of derived planar regions — built, measured and mutation-checked.

## Register discipline

Claims are marked **VERIFIED** (I ran it in this session and read the output),
**INFERRED** (my reasoning over verified inputs), or **UNVERIFIED** (not established
here). Constructions are marked **toy** / **unmetered** / **metered** per
`.claude/rules/toy-is-free-metered-must-be-earned.md`. Numbers appear only where I
measured them; predicted numbers are labelled as predictions and, where a prediction was
wrong, the correction is left in the record rather than tidied away.

---

## 1. The one property that makes it a Zeta engine

Aaron, 2026-09-08:

> _"our rendering surface should only come from our clifford if we cant generate it from
> clifford that's not our research"_

Everything else in this document is downstream of that sentence. The distinguishing
property is not the algebra, not the exactness, not the determinism — those are all
available elsewhere. It is:

> **Every rendered coordinate carries a derivation, and the derivation is checked by a
> test rather than described in a comment.**

In rung 4 that is mechanical: each vertex of each filled region carries the index of the
E8 root it is the snapped projection of; the eight vertex-index sets are asserted to be
exactly the eight orbits of the bipartite Coxeter element; and together they are asserted
to account for all 240 roots. A hand-placed vertex has no root index and fails the test.
That is Aaron's constraint as a falsifier, and it is the thing that would be missing if
this were any other renderer. **VERIFIED** (mutant M2 injects one hand-authored vertex;
the provenance test dies).

## 2. What it is NOT — stated first, because it is the more useful half

- **Not a general-purpose renderer.** It cannot open an OBJ, an FBX, a glTF or a texture.
  There is no import path and there is not meant to be one; an imported mesh has no
  derivation and is therefore inadmissible by construction, not by policy.
- **Not a modelling tool.** Nothing here lets anyone place a vertex. The API has no
  function that accepts an authored coordinate as scene content — coordinates enter only
  through `ringPolygons()`, which reads the root system.
- **Not a competitor to Unreal, Blender or a path tracer**, and not an attempt to become
  one. Those are excellent at a problem this engine does not have.
- **Not the character-reconstruction work.** The TripoSR / TripoSG studies preserved in
  `docs/research/2026-09-08-character-evolution/README.md` are a learned SDF sampled to a
  mesh. That is a real generator at another scale and it is worth keeping, but its
  geometry comes from fixed neural weights, not from the algebra, so under Aaron's
  sentence it is _not this research_. Saying so plainly is the point of this section.
- **Not anti-aliased, and not shaded.** A lattice point is in or out. That binary is
  exactly what makes the coverage count an integer and the conservation law exact; a
  coverage _fraction_ is a different and harder object (see §7).
- **Not a physics engine.** No solver of any kind is implemented. See §6 for what the
  Variational Stokes anchor is actually doing in this design, which is not "a thing we
  reimplemented".
- **Not new because it uses geometric algebra.** Geometric algebra in graphics is decades
  old and is cited, not claimed. See §8.

## 3. The rendering ladder, and where rung 4 sits

Aaron's progression, 2026-09-08: _"we can go fome lines to drawings over time then 3d
renderoring based on multi lary tellesaling over time."_

| rung                             | what it derives                                                    | falsifier that landed with it                                                         |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1 lines                          | Coxeter-plane projection of the 240 roots                          | 8 rings of exactly 30                                                                 |
| 2 drawings                       | Gosset 4_21 edges by exact integer inner product                   | 6720 edges, uniform degree 56                                                         |
| 3 3D by multi-layer tessellation | four invariant eigenplanes; a 3D vertex set and an orbit wireframe | Coxeter order exactly 30; exponents 1, 7, 11, 13; Pythagorean completeness            |
| **4 filled regions**             | **the eight rings as lattice polygons, and their exact coverage**  | **Pick's residual exactly 0; a 240-way partition with zero overlaps and zero cracks** |

A drawing has strokes. A render has **area**. Rung 4 is where area appears, which is where
a renderer starts being a renderer, and it is the first rung whose output is a _measure_
rather than a set of marks.

The regions are derived with no choices left over. Rung 3 measured that each ring is one
Coxeter orbit and that the Coxeter element rotates the plane by exactly 2*pi/30; I
re-measured the angular gaps here and they agree to nine decimals, so each ring's thirty
points are the vertices of a regular 30-gon and _sorting by angle_ is the entire hull
step. No hull algorithm, no tolerance, no tie to break. **VERIFIED.**

## 4. Tension 1 — floats versus the proof lineage. Where the boundary sits.

`.claude/rules/no-binary-in-proof-lineage.md` wants verification artifacts exact and
diffable. Rendering wants floats. `src/Core/Tsirelson.fs` is the in-tree precedent: it
locks `S² = 8` in integer arithmetic so _the irrational appears only at readout_.

A renderer reverses the direction of travel, so the boundary has to be stated the other
way round, and this is the design decision the rung is built around:

> **The irrational appears only at INTAKE.**

One operation — `Math.round(coordinate * scale)` — converts the eigen-derived floating
point projection into lattice integers. Everything downstream of that snap is integer with
no tolerance anywhere: the coverage test is an integer sign, the area is an integer
shoelace sum, the scanline bounds are integer floor and ceiling divisions.

Three things make this a boundary rather than a slogan:

1. **It is one call, in one function, and it is named `snap`.** A reviewer can find every
   place a float becomes geometry by grepping one identifier.
2. **Its cost is stated and guarded.** Rounding moves a vertex by at most half a unit,
   which can destroy convexity when the polygon's sagitta is smaller than that.
   `MIN_LATTICE_SCALE = 512` refuses rather than degrades. The floor is not decorative:
   **measured**, the smallest ring loses convexity at scale 64 and survives 128, 256 and
   384, so the floor sits above the observed edge with margin. **VERIFIED** — and asserted
   in the test, so a future scale change that quietly breaks the geometry fails loudly.
3. **The exactness claim is bounded and the bound is enforced.** IEEE-754 doubles
   represent integers exactly to 2^53. Every product formed is a coordinate difference
   times a coordinate difference, so `EXACT_COORD_BOUND = 2^20` bounds intermediates near
   2^42 with eleven bits of headroom. `assertExactLattice` throws outside it. An
   unenforced precision claim is the vacuity class, so the bound is tested by its
   refusals. **VERIFIED** (mutants M7 and M8 disable the two guards; the two refusal tests
   die and nothing else does).

Why not arbitrary-precision integers everywhere? Because a declared, checked bound is
_more_ honest than an unbounded claim nobody profiles: it states the regime, it fails at
the edge instead of silently slowing down, and it is a property a reader can verify by
arithmetic. This is the same shape as the treaty in
`.claude/rules/culture-invariant-by-default.md` — pick one canonical regime, write it
down, make everything conform, and make the conformance checkable.

## 5. Tensions 2 and 3 — determinism, scale-freedom, noninterference

**DST (§7).** Every function is a pure function of its arguments over integers. There is
no seed because there is no randomness to seed: the geometry is derived, the snap is
deterministic rounding, and the fill rule is a predicate on edge directions. Replay is
byte-identical by construction. The _cost_ is real and is named rather than waved at:
exactness forbids the ordinary graphics shortcuts — no floating-point edge stepping, no
accumulated increments, no tolerance-based early-out. The scanline solver pays an integer
division per edge per row where a float rasterizer pays one add. Rung 4 pays that bill
because a renderer whose output is evidence has to be reproducible before it is fast.

Determinism is asserted with teeth rather than by re-running and comparing (which is the
`f(x) = f(x)` failure this repo has already been bitten by): the load-bearing assertion is
**exact translation invariance** — shifting a region by 1,038,576 lattice units must not
move a single covered point. **VERIFIED**, and mutant M11, which truncates one
intermediate to float32, kills it along with five other tests.

**Noninterference (§13).** The module's only imports are the two rungs below it and its
only inputs are its arguments: no clock, no RNG, no environment, no filesystem. That is
checked by scanning the module's own source with comments stripped and the _call form_
matched. Both halves of that guard were mutation-checked: M9 adds a real `Math.random()`
call and the test dies; **M10 mentions `Math.random(` and `Date.now(` in a comment only and
the test correctly survives.** That second mutant is the one worth having — explanatory
prose satisfying a source-scanning guard is a live failure mode in this codebase.

**Scale-free (§1).** The scanline solver is one code path for a 30-gon and for a triangle;
`latticePointCount` has no special case for either, and the partition falsifier is
precisely a check that the two agree.

## 6. The Variational Stokes anchor — what it is doing here

The paper, cited properly:

> Egor Larionov, Christopher Batty and Robert Bridson (2017). _Variational Stokes: A
> Unified Pressure-Viscosity Solver for Accurate Viscous Liquids._ ACM Transactions on
> Graphics 36(4), article 101. DOI [10.1145/3072959.3073628](https://doi.org/10.1145/3072959.3073628).

From the abstract, read this session at the author institution's open repository
(**VERIFIED**, [UWSpace record](https://uwspace.uwaterloo.ca/items/ecb9fe94-1ef5-4ed0-a67e-b3d3c5a7534e)):

> "Modern fluid simulators treat viscosity and pressure in separate solver stages, which
> reduces accuracy and yields incorrect free surface behavior. Our proposed implicit
> variational formulation of the Stokes problem leads to a symmetric positive definite
> linear system that gives properly coupled forces, provides unconditional stability, and
> **treats difficult boundary conditions naturally through simple volume weights**."
> (emphasis added) … "we demonstrate that our method is convergent through grid refinement
> studies on analytical problems in two dimensions."

**It is an anchor and a comparison point, not a template.** Two reasons, and the second is
the load-bearing one:

1. Reimplementing the method would produce a second implementation of someone else's
   result. That is legitimate work and it is not the contribution being attempted here.
2. **Its discretization is authored.** The method lives on a staggered grid — pressures at
   cell centres, velocity components on cell faces. A grid is a hand-chosen
   discretization, and a solver built on one violates Aaron's sentence at its foundation
   no matter how correct the numerics are. So "port Variational Stokes" is not a smaller
   version of this project; it is a different project.

What the paper does supply, and this is the genuine connection rather than a forced one:
its boundary treatment is **volume weights** — the fraction of each cell occupied by
fluid or solid. That is a _coverage measure_, computed per cell, and it is the quantity
whose inaccuracy the paper identifies as the source of incorrect free-surface behaviour.
Rung 4 builds a coverage measure that is exact by construction. So the honest statement of
the relationship is:

> A variational solver's correctness rests on cell measures. Rung 4 establishes an exact,
> derivation-carrying measure. The gap between them is the derived discretization that
> does not exist yet, plus the step from an integer _count_ to a rational _fraction_.

Register: that paragraph is **unmetered**. No solver is implemented, no volume weight is
computed, and no comparison against the paper's refinement studies has been run. The
paper's own results are cited, not reproduced, and the video that pointed at it
(`docs/ip-questionable/2026-09-08-two-minute-papers-astra-code-generated-graphics-transcript.md`)
remains an unauthenticated source claim, exactly as that record says.

I did not read `github.com/elrnv/stokes-houdini`. That is someone else's implementation
that we hold no rights to; the ordinary boundary is not to copy it. The paper itself is
published and citable and needs no ceremony beyond citation.

## 7. What landed, and the measured numbers

`src/Core.TypeScript/research/clifford-e8-exact-coverage.ts` (+ its `.test.ts`).
Register: **metered** — eight falsifiers, thirteen mutants, every mutant killed by the
right test. All numbers below are **VERIFIED**: measured in this session at
`PROOF_LATTICE_SCALE = 4096`.

| ring |      2·area | boundary pts B | interior pts I | covered pts | Pick residual |
| ---: | ----------: | -------------: | -------------: | ----------: | ------------: |
|    0 |  23,757,568 |            972 |     11,878,299 |  11,878,784 |             0 |
|    1 |  62,199,212 |          1,716 |     31,098,749 |  31,099,606 |             0 |
|    2 |  93,991,952 |          1,668 |     46,995,143 |  46,995,976 |             0 |
|    3 | 137,406,320 |          2,044 |     68,702,139 |  68,703,160 |             0 |
|    4 | 207,639,628 |          2,604 |    103,818,513 | 103,819,814 |             0 |
|    5 | 246,076,388 |          2,676 |    123,036,857 | 123,038,194 |             0 |
|    6 | 359,703,540 |          3,260 |    179,850,141 | 179,851,770 |             0 |
|    7 | 543,567,036 |          3,944 |    271,781,547 | 271,783,518 |             0 |

The falsifiers, and why each is structural rather than a snapshot:

1. **Provenance.** Eight vertex-index sets, each equal to a Coxeter orbit; 240 roots
   accounted for; every vertex equal to `snap` of that root's projection.
2. **Pick's theorem (1899).** `2A = 2I + B − 2`, exactly, zero tolerance, on all eight
   regions **and** on all 224 fan triangles. The three quantities come from three
   unrelated computations — a shoelace blade sum, the rasterizer's own interior
   classification, and a gcd count over edges — so this checks the rasterizer against an
   external theorem instead of against itself.
3. **The partition.** Each region is split into a fan and the pieces must partition it:
   same total, no overlapping span, no gap, endpoints flush. This is the oldest
   rasterization bug in both directions at once — double coverage on shared edges if the
   fill rule is too generous, cracks if it is too strict — and overlaps and cracks are
   counted separately so neither hides behind the other. The apex is a gauge, as rung 3's
   z-axis was, so "it does not matter" is asserted rather than assumed: **all 30 apexes of
   all 8 regions, 240 distinct triangulations, produce the identical count of the
   identical point set, with 0 overlaps and 0 cracks.**
4. **The fill rule is exclusive by construction.** Exactly one of every direction pair
   claims its boundary, over all 6,560 nonzero direction pairs in ±40. This is the
   property the partition is a consequence _of_.
   5–6. **The two refusals** (exact bound, scale floor), plus the measurement that the floor
   is real.
5. **Translation invariance and byte-identical replay.**
6. **The coincidence, with its scope.** Covered points equal the area exactly on all eight
   regions — `coverage = 2A/2`, on the nose. That is striking and it is recorded as a
   **measurement, not promoted to a law**, because the same test exhibits a
   counterexample: the unit triangle has `2A = 1` and covered count 0. So the identity is
   a property of these figures (Pick, plus an even boundary count), not of lattice
   polygons in general. Numerology versus number theory, kept honest inside the file that
   was tempted.

### The mutation run

| mutant                                    | killed                                           |
| ----------------------------------------- | ------------------------------------------------ |
| M1 root indices shifted by one            | provenance                                       |
| M2 hand-authored vertex injected          | provenance + 6 others                            |
| M3 boundary gcd replaced by 1/edge        | both Pick tests, nothing else                    |
| M4 strict-interior off-by-one             | both Pick tests + partition + coverage           |
| M5 fill rule too generous (`dy >= 0`)     | exclusivity + partition + spans                  |
| M6 fill rule too strict (`dy > 0`)        | exclusivity + partition + spans                  |
| M7 exactness guard disabled               | the bound refusal only                           |
| M8 scale floor disabled                   | the scale refusal only                           |
| M9 real `Math.random()` call added        | noninterference only                             |
| **M10 `Math.random(` in a COMMENT only**  | **nothing — correct; the guard strips comments** |
| M11 float32 truncation in the span solver | 6 tests including translation invariance         |
| M12 vertices ordered clockwise            | 8 tests                                          |
| M13 shoelace perturbed by 2               | both Pick tests + coverage                       |

**A prediction I got wrong, left in the record.** The first draft of the span-artifact
test asserted one output row per scanline in the vertex range. Measured, it is one fewer
(3,882 rows against a 3,883-row range) because the bottom extreme scanline is never lit —
its edges run rightward or downward and the exclusive rule hands them to the neighbour
below. The top extreme _is_ lit, but only on rings 0, 1, 4 and 7, which have a horizontal
top edge that the `dy === 0 && dx < 0` clause claims; rings 2, 3, 5 and 6 have a single
top vertex and are dark there. The test now asserts that structure instead of a guessed
count, which is a better test than the one I meant to write.

## 8. Anchors, and an honest split between cited and claimed

**Cited, established, not claimed as ours:**

- Pierre-Philippe Dechant, _The E8 geometry from a Clifford perspective_, Adv. Appl.
  Clifford Algebras 27 (2017), and _Clifford algebra is the natural framework for root
  systems and Coxeter groups_, ibid. 26 (2016) — the lineage rungs 1–3 stand on, already
  cited by `src/Core/CliffordE8Roots.fs`. Rung 4 extends that module's ladder rather than
  starting beside it.
- Leo Dorst, Daniel Fontijne & Stephen Mann, _Geometric Algebra for Computer Science_
  (Morgan Kaufmann, 2007; revised 2009) — the conformal model, rotors in place of
  quaternions and matrices, GA as the object-oriented framework for 3D geometry.
  **Geometric algebra for graphics is decades old. Using it is not the contribution.**
- Juan Pineda, _A Parallel Algorithm for Polygon Rasterization_, SIGGRAPH 1988 — the edge
  function. Rung 4's coverage test is that function, recognised as the grade-2 blade it
  already is.
- Georg Alexander Pick (1899) — the lattice-polygon area identity used as the falsifier.
- H. S. M. Coxeter — the Coxeter plane and the Gosset polytope 4_21 the ladder renders.
- Larionov, Batty & Bridson (2017) — §6.
- W. K. Clifford — the geometric product and the versor reflection that generates the
  roots in the first place.

**The negative search result, stated as such.** I searched for prior art on the specific
combination — an exact-integer coverage measure over geometry admissible _only_ because
the algebra generated it — and did not find it. What the searches did return was
conservative rasterization (a different property: cover every touched pixel, rather than
partition exactly), GA-for-graphics as above, Pick's theorem as a mathematical result with
no rasterization-validation usage surfaced, and E8 Coxeter-plane pictures produced by
scripts with no derivation constraint attached. **INFERRED, weakly:** the combination may
be new. **UNVERIFIED:** I ran four web searches, not a literature review; absence of
evidence at this depth is a reason to keep looking, not a novelty claim. The honest
register for "this is new" is that it has not been established.

What is _not_ in doubt, because it is a decision rather than a discovery: the
admissibility constraint is a **policy** Zeta adopted, and the contribution is making that
policy **mechanically enforced** rather than aspirational.

## 9. Honest limits — what I could not verify

- **No shaded 3D surface.** Rung 3 derives a 3D vertex set and a wireframe but no face
  set. Coverage here is planar. A closed mesh needs a principled 2-cell choice over the
  edge graph, which is a real open question, not an oversight.
- **No fluid solver, no volume weights, no comparison to the paper's refinement studies.**
- **The coverage measure is integer, not fractional.** A physical solver wants area
  _fractions_ per cell. Whether an exact rational coverage fraction is reachable with the
  same guarantees is open. **UNVERIFIED.**
- **`renderFilledSvg` is filled by the viewer, not by us.** The SVG is the viewable
  artifact; `renderCoverageSpans` is the measured one. Both read the same derived
  vertices, and the document says which is which so nobody mistakes a picture for a
  measurement.
- **Convexity is a precondition of the scanline solver.** It is asserted for the eight
  derived regions and guaranteed by the scale floor, but the solver is not correct for
  non-convex input and does not claim to be.
- **The prior-art search depth is four queries.** See §8.

## 10. The single highest-value next step

**Derive a face set, and let the falsifier be the f-vector.** The 2-faces of the Gosset
polytope 4_21 are the triangles of the root-adjacency graph rung 2 already computes by
exact integer test — no new construction, exactly as rung 3 introduced no new
construction. Coxeter's published f-vector gives an exact target (the standard values are
240 vertices and 6,720 edges, which rung 2 measured, and 60,480 triangles, which is
**UNVERIFIED here — I have not counted them**), and the alternating sum over the whole
f-vector of an 8-polytope is exactly zero, which is a conservation law of the same
character as Pick's residual. That would give rung 5 a face set with a derived normal per
face — a bivector, from the same outer product — and with faces and normals in hand, a
shaded surface is reachable without anyone placing a vertex.

The step after that, and only after it: an exact _fractional_ coverage, which is what a
variational solver's volume weights would actually consume.

## Pointers

- `src/Core.TypeScript/research/clifford-e8-exact-coverage.ts` — rung 4.
- `src/Core.TypeScript/research/clifford-e8-coxeter-projection.ts` — rungs 1 and 2.
- `src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts` — rung 3.
- `src/Core/CliffordE8Roots.fs` — the Clifford generation of the root set, and the Dechant
  anchor.
- `docs/research/2026-09-08-character-evolution/README.md` — Vera's handoff; the generator
  DAG proposal, and the reconstruction work this engine deliberately is not.
- `docs/ip-questionable/2026-09-08-two-minute-papers-astra-code-generated-graphics-transcript.md`
  — the forwarded source and its 16 links, quarantined.
- `.claude/rules/no-binary-in-proof-lineage.md`, `.claude/rules/toy-is-free-metered-must-be-earned.md`,
  `.claude/rules/numerology-vs-number-theory.md` — the three rules §4, §7 and §7.8 are
  applications of.
