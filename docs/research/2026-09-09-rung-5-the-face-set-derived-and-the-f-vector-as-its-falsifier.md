# Rung 5: the face set, derived — and the f-vector alternating sum as its falsifier

Date: 2026-09-09
Operational status: research-grade; the shipped slice is **metered**
Author: shadow-subagent (Claude Opus 5), Claude Code
Work item: 081M22RZ3VD087G0R0009780NX
Scope: the 2-faces of the Gosset polytope 4_21, derived from rung 2's integer edge test;
the full f-vector measured by two independent mechanisms; the Euler–Poincaré alternating
sum as the load-bearing check; a grade-2 blade per face as the derived normal; and the
first in-tree verification of the 60,480 triangle count that rung 4 quoted and flagged.

## Register discipline

Claims are marked **VERIFIED** (I ran it in this session and read the output),
**INFERRED** (reasoning over verified inputs), or **UNVERIFIED** (not established here).
Constructions are marked **toy** / **unmetered** / **metered** per
`.claude/rules/toy-is-free-metered-must-be-earned.md`. Every number below was measured
unless it is explicitly labelled as an external published value.

---

## 1. The first thing this rung had to do was fix rung 4's own flag

`docs/research/2026-09-09-zeta-graphics-engine-derived-geometry-and-the-exact-coverage-boundary.md`
§10 named this rung and, to its credit, named its own weakest sentence at the same time:

> _"the standard values are 240 vertices and 6,720 edges, which rung 2 measured, and
> 60,480 triangles, which is **UNVERIFIED here — I have not counted them**"_

A number quoted from Coxeter and sitting unchecked in a repository built out of
falsifiers is the vacuity class with a fuse on it: it looks like a fact, it is treated
like a fact downstream, and nothing in the tree can tell you if it is wrong.

**VERIFIED. It is now counted: 60,480.** Enumerated as the triangles of the root
adjacency graph — the graph rung 2 already builds by the exact integer test
`<r,s> = 4` in doubled coordinates. Coxeter held.

That is the shape of the whole rung. The remaining seven entries of the f-vector got the
same treatment, and so did the facet census.

## 2. What is derived, and from what

Nothing new is constructed. Rung 3's design note was that it introduced no new
construction — it ran rung 1's recipe on the other eigenvectors — and rung 5 keeps that
property:

| object | derived from | new machinery |
|---|---|---|
| vertices (240) | rung 1, `e8Roots()` by construction | none |
| edges (6,720) | rung 2, `<r,s> = 4`, exact integers | none |
| **2-faces (60,480)** | **triangles of that same graph** | **none** |
| higher simplex faces | k-cliques of that same graph | none |
| facets (19,440) | supporting hyperplanes from root-supplied directions | `maxFace` + affine rank |
| **normals** | **grade-2 blade `(b−a) ∧ (c−a)`, 28 integer components** | **none — rung 4's outer product, one dimension up** |

The admissibility constraint is Aaron's, 2026-09-08:

> _"our rendering surface should only come from our clifford if we cant generate it from
> clifford that's not our research"_

and it stays mechanical rather than aspirational: every face is a triple of root indices,
and the test asserts that every face lies inside derived facets. A hand-placed triangle
has no root index and lies in nothing.

## 3. The measured f-vector

**VERIFIED**, `bun test src/Core.TypeScript/research/clifford-e8-face-lattice.test.ts`:

| k | face dimension | measured `f_k` | how |
|---|---|---|---|
| 0 | vertices | **240** | 1-cliques |
| 1 | edges | **6,720** | 2-cliques |
| 2 | triangles | **60,480** | 3-cliques |
| 3 | tetrahedra | **241,920** | 4-cliques |
| 4 | 4-faces | **483,840** | 5-cliques |
| 5 | 5-faces | **483,840** | 6-cliques |
| 6 | 6-faces (ridges) | **207,360** | 7-cliques |
| 7 | facets | **19,440** | supporting hyperplanes |

**The alternating sum is exactly 0.**

```
240 − 6,720 + 60,480 − 241,920 + 483,840 − 483,840 + 207,360 − 19,440 = 0
```

For a convex d-polytope the Euler–Poincaré relation gives `Σ (−1)^k f_k = 1 − (−1)^d`,
which is 0 for d = 8 because the boundary is a 7-sphere and χ(S⁷) = 0.

**Why this is the load-bearing check and not decoration.** `f_0..f_6` come out of clique
enumeration; `f_7` comes out of an unrelated supporting-hyperplane derivation. Eight
counts, two mechanisms, forced to cancel to the digit. The test also perturbs each entry
by ±1 and requires the sum to break, so "it came out zero" is a tight statement about
these eight numbers rather than a coincidence of large ones.

### Why clique counting is legitimate for `f_0..f_6`

Every proper face of 4_21 of dimension ≤ 6 is a **simplex**: the facets are 7-simplices
and 7-orthoplexes, and every proper face of an orthoplex is a simplex. So a (k−1)-face is
exactly a k-clique. **VERIFIED** that the ladder stops where it must: there are **17,280**
8-cliques and **zero** 9-cliques, so the enumeration is complete rather than truncated.

### The facet census

**VERIFIED**: 19,440 facets, in exactly two kinds —

- **17,280** with 8 vertices — the 7-simplex facets;
- **2,160** with 14 vertices — the 7-orthoplex facets;
- every one has affine rank 7, and every one is a genuine supporting hyperplane (no root
  lies strictly beyond it).

The candidate directions come from the root system itself, three families:

1. **orthogonal root pairs** `r + s` with `<r,s> = 0` — 15,120 pairs collapsing to
   **2,160** distinct directions (measured), one per orthoplex facet;
2. **8-clique centroids** — **17,280** distinct directions, one per simplex facet;
3. **the roots themselves** — 240 directions that support a *single vertex*, and are
   therefore what the rank filter must reject. See §6; they are in the candidate set
   because a dimension filter with nothing to reject is a check that cannot fail.

### The ridge audit — an independent check on `f_7`

Every 6-face of an 8-polytope is a ridge and lies in **exactly two** facets. A 7-simplex
has 8 six-faces; a 7-orthoplex has 2⁷ = 128. **VERIFIED**:

```
2 × 207,360 = 414,720   =   17,280 × 8 + 2,160 × 128 = 414,720
```

This audits `f_6` against `f_7` without going through the Euler sum at all.

### Comparison with the published values

**VERIFIED (external):** the published f-vector of 4_21 — Coxeter's, as reproduced on
Wikipedia's *4_21 polytope* and *Uniform k_21 polytope* pages — is
240 / 6,720 / 60,480 / 241,920 / 483,840 / 483,840 / 207,360 / 19,440, with the facets
splitting 17,280 seven-simplices and 2,160 seven-orthoplexes. **All eight entries and the
facet split agree with what this module measured.** The published values are the external
comparison, not the source: the test contains the measurement and compares against
nothing but itself and the Euler relation.

## 4. The normal is a bivector, and its components are integers

`faceBivector(a, b, c)` is the grade-2 part of `(b − a) ∧ (c − a)` in Cl(8,0): 28
components, one per basis blade `e_i ∧ e_j`. This is rung 4's outer product with one
dimension removed from the assumption. In 2D that blade has a single component and reads
as a signed area; in 8D it does not collapse, and what it carries is the **oriented plane
of the face** — which is what a normal is, before a dimension-3 accident lets you write it
as a vector.

Two exact-integer properties, **VERIFIED on all 60,480 faces**:

- **`|B|² = 48`, every face, no exceptions.** By the Lagrange identity
  `|u ∧ v|² = |u|²|v|² − <u,v>²`. Every 4_21 edge has squared length 8 in the doubled
  coordinates (two roots of norm 8 at inner product 4 give `8 + 8 − 2·4 = 8`), so every
  face is equilateral of side √8, `<u,v> = 4`, and `|B|² = 64 − 16 = 48`.
- **`B ∧ B = 0`** on all 70 grade-4 components — the Plücker condition for a bivector to
  be a *simple blade*. In 8 dimensions the generic bivector is **not** simple, so this is
  a constraint with teeth, and the test proves it discriminates by feeding it
  `e₀∧e₁ + e₂∧e₃` and requiring a refusal.

**A note the numerology rule requires.** 48 also happens to be the root count of D₄⊕D₄,
which appears elsewhere in this repository. There is no connection. Here 48 is the Gram
determinant `64 − 16` of an equilateral triangle of side √8 and nothing else; the
derivation is what fixes the number, and reading content into the shared digits is exactly
the failure `.claude/rules/numerology-vs-number-theory.md` names.

### The 3D normal, and the gauge that admits where it stops

Pushing each face through rung 3's eigenlayer embedding and taking the dual of the
projected blade gives a normal vector per face. **VERIFIED: all 60,480 faces have a
non-degenerate 3D normal** — none of them projects edge-on. Smallest measured magnitude
0.159 against a mean well above it.

Two gauges, both stated, both measured:

1. **Vertex order fixes the sign.** Ascending root index is the convention; the plane and
   the magnitude are invariant under it.
2. **`orientOutward` repairs the sign against the face centroid — and fails on 768 of the
   60,480 faces** (1.27%), whose 3D plane passes through the origin so there is no side to
   agree with. Those are flagged, not guessed. A gauge that silently fails on part of its
   domain is worse than one that says where it stops.

## 5. What this makes reachable, and what it does not

`renderShadedObj()` emits 240 derived vertices, 60,480 derived normals and 60,480 face
elements — a mesh a renderer can shade, with no coordinate authored by hand at any rung.

**Honest limits, and they are not small:**

- The 3D face set is the **projected 2-skeleton of an 8-polytope, not a closed
  2-manifold.** It interpenetrates. No amount of normal orientation makes it a solid, and
  the OBJ header says so.
- `f_7`'s candidate families are established as *sufficient* by the Euler sum and the
  ridge audit, not by a completeness proof. A fourth family producing more facets would
  break both checks — which is the point of having them — but this is weaker than a proof
  and is labelled **UNVERIFIED** as a completeness claim.
- Clique enumeration is exponential in general. It is fast here because the graph is small
  and its cliques stop at 8, which is measured rather than assumed.
- **No shading model, no lighting, no material.** A normal is an input to those. This rung
  supplies the input and nothing downstream of it.
- The whole test file runs in ~6 s. That is the exactness bill, paid deliberately.

## 6. The mutation run, including the defect it found

Sixteen mutants, one at a time, whole test file re-run for each. **Thirteen killed, three
survived — two deliberate controls and one documented equivalent.**

| mutant | verdict | killed by |
|---|---|---|
| M1 adjacency inner product 4 → −4 | KILLED | triangle count / f-vector / link chain |
| M2 `FACE_BIVECTOR_NORM_SQUARED` 48 → 47 | KILLED | the blade falsifier |
| M3 `faceBivector` wedge `−` → `+` | KILLED | the blade falsifier |
| M4 Plücker relation sign flip | KILLED | the blade falsifier |
| M5 clique ordering drops the lower-word cut | KILLED | clique counts / f-vector |
| M6 `maxFace` takes the minimum | KILLED | facet census |
| M7 orthogonal-pair filter `0` → `4` | KILLED | facet census |
| M8 **facet rank filter accepts everything** | KILLED | the candidate rank histogram |
| M9 outward orientation never flips | KILLED | the normals falsifier |
| M10 `eulerAlternatingSum` drops the alternation | KILLED | the Euler falsifier |
| M11 vertex count off by one | KILLED | f-vector / Euler |
| M12 centroid tolerance widened to 1 | KILLED | the normals falsifier |
| M13 root directions dropped from the candidate set | KILLED | the candidate rank histogram |
| M14 **CONTROL** — comment text only | SURVIVED (must) | — |
| M15 **CONTROL** — `Number.NEGATIVE_INFINITY` → `-Infinity` | SURVIVED (must) | — |
| M16 **EQUIVALENT** — ordering mask off-by-one | SURVIVED (documented) | — |

Two controls survive, which is what proves the harness discriminates rather than failing
everything it touches.

### The real defect the run found, and the fix

**M8 originally SURVIVED.** The facet derivation filtered candidates by `rank === 7`, and
loosening it to `rank >= 6` changed nothing — because *every* candidate the two original
families produced already had rank 7. The filter had never rejected anything. It was a
dimension test that could not fail: the vacuity class, in the middle of the mechanism that
produces `f_7`.

The fix is not a better assertion, it is a better candidate set. The **roots themselves**
are now a third family; each supports exactly one vertex, so the filter has 240 real
rejections to make. The test now asserts the candidate rank histogram directly —
`{0: 240, 7: 19440}` — and M8 (now "accepts everything") is killed.

**This is the finding worth carrying forward**: a filter is only a filter if something in
its input is supposed to fail it, and reading the code will not tell you whether anything
does. Mutation will.

**M16 is an equivalent mutant and the module says so.** Changing `bit + 1` to `bit` in the
clique-ordering mask survives every falsifier, and that is correct rather than a hole: the
mask is always applied to a set already intersected with the vertex's own adjacency row,
and no vertex is adjacent to itself, so the bit in question is already clear. A survivor
that is not a gap should be recorded as such, or the next reader will read the mutation
table as a coverage failure.

## 7. Anchors (Beacon), cited because they are used

- **Thorold Gosset**, *On the Regular and Semi-Regular Figures in Space of n Dimensions*
  (Messenger of Mathematics, 1900) — the semiregular polytope this is.
- **H. S. M. Coxeter**, *Regular Polytopes* (3rd ed., Dover 1973) and *Regular and
  Semi-Regular Polytopes III* (Math. Z. 200, 1988) — the k_21 series and the published
  f-vector this rung measures itself against rather than copies.
- **Euler–Poincaré relation** for convex polytopes — Schläfli (1852), Poincaré (1893);
  modern statement and proof in Grünbaum, *Convex Polytopes* (1967) §8.1.
- **Julius Plücker** (1865) / **Hermann Grassmann** (1844) — the quadratic relations that
  decide when a bivector is a simple blade.
- **Dorst, Fontijne & Mann**, *Geometric Algebra for Computer Science* (Morgan Kaufmann,
  2007) — the outer product as the oriented-subspace primitive. Geometric algebra for
  graphics is decades old and is cited, not claimed.
- **Bron & Kerbosch**, CACM 16(9), 1973 — the reference clique-enumeration algorithm. What
  is implemented is the simpler ordered-extension enumeration, which needs no pivoting on
  a graph this size; Bron–Kerbosch is named because it is what a reader will compare it to.
- **Pierre-Philippe Dechant**, *The E8 Geometry from a Clifford Perspective* (Adv. Appl.
  Clifford Algebras 27, 2017) — the versor construction generating the roots.
- **Georg Pick** (1899) — rung 4's falsifier, the sibling conservation law to this one.

### The negative search result, stated as such

I ran **four web searches** on: the published 4_21 f-vector; E8 face sets with
geometric-algebra bivector normals for rendering; deriving a polytope face set by clique
enumeration with the Euler characteristic as a check; and 4_21 triangle faces exported as
a shadable mesh. What came back: the f-vector itself (which **confirmed** the measurement,
§3); Dechant and the Clifford/E8 literature (bivectors used for the *Coxeter versor
factorisation*, not for face normals); the standard clique-complex Euler-characteristic
identity as a mathematical fact; and 4_21 visualisations — Petrie-polygon projections,
vZome models — with no derivation constraint attached and no mesh-export discussion.

**UNVERIFIED:** four searches is not a literature review. What I did *not* find is the
combination — a face set admissible only because the algebra generated it, with the
Euler sum wired up as a mechanical falsifier over it. Absence of evidence at this depth is
a reason to keep looking, not a novelty claim. What is *not* in doubt, because it is a
decision rather than a discovery, is that the admissibility constraint is a policy Zeta
adopted and the contribution is making it mechanically enforced.

## 8. The single highest-value next step

**Exact rational area, and then a fractional coverage.** Rung 4's coverage is an integer
lattice-point count; a physical solver wants area *fractions* per cell. This rung supplies
what that needs and rung 4 lacked: an exact integer measure of face area (`|B|² = 48`,
so each face's area is exactly √48/2 = 2√3 in doubled units — an irrational appearing
only at readout, exactly as `src/Core/Tsirelson.fs` treats S² = 8). Whether an exact
*rational* coverage fraction is reachable over these faces with the same guarantees is
the open question rung 4 already named, and it is now approachable with a face set in hand
rather than a boundary.

The step after that, and only after it: shading. A normal per face exists now; a shading
model is a separate object with its own falsifiers, and pretending the mesh is a closed
solid to get there would be exactly the hand-placement this ladder exists to avoid.

## Pointers

- `src/Core.TypeScript/research/clifford-e8-face-lattice.ts` — rung 5.
- `src/Core.TypeScript/research/clifford-e8-face-lattice.test.ts` — the eleven falsifiers.
- `src/Core.TypeScript/research/clifford-e8-exact-coverage.ts` — rung 4, which named this
  step and flagged the number this rung verified.
- `src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts` — rung 3, the 3D
  embedding the normals are read in.
- `src/Core.TypeScript/research/clifford-e8-coxeter-projection.ts` — rungs 1 and 2, the
  root set and the integer edge test the face set is built from.
- `src/Core/CliffordE8Roots.fs` — the Clifford generation of the root set, and the Dechant
  anchor.
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`,
  `.claude/rules/toy-is-free-metered-must-be-earned.md`,
  `.claude/rules/numerology-vs-number-theory.md` — the three rules §2, §4 and §6 are
  written under.
