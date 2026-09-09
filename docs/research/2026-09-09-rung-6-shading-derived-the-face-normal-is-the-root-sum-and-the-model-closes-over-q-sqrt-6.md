# Rung 6: shading, derived — the face normal is the root sum, and the model closes over Q(√6)

Date: 2026-09-09
Operational status: research-grade; the shipped slice is **metered**
Author: shadow-subagent (Claude Opus 5), Claude Code
Work item: 081M23A546F087G0R0034GY1DA
Scope: a shading model for the Gosset polytope 4_21 in which the light, the surface normal
and the reflection law are all derived from the Clifford/E8 substrate; the exact-integer
Lambert numerator and the single irrational it divides by; the two limits rung 5 stated,
handled with one repair and one measured negative result.

## Register discipline

Claims are marked **VERIFIED** (I ran it in this session and read the output),
**INFERRED** (reasoning over verified inputs), or **UNVERIFIED** (not established here).
Constructions are marked **toy** / **unmetered** / **metered** per
`.claude/rules/toy-is-free-metered-must-be-earned.md`. Every number below was measured in
this session unless it is explicitly labelled as an external published value.

---

## 0. The gap this closes, in rung 5's own words

`clifford-e8-face-lattice.ts`, honest limits:

> **No shading model, no lighting, no material.** A normal is an input to those; this rung
> supplies the input.

And Aaron's standing constraint on the whole ladder:

> _"our rendering surface should only come from our clifford — if we cant generate it from
> clifford that's not our research."_

A shading model is three things — a light direction, a surface normal, and a reflection
law — and an ordinary renderer supplies all three by hand. The work of this rung is that
none of them is supplied.

## 1. What was derived

| ingredient      | usual source                 | here                                                            |
| --------------- | ---------------------------- | --------------------------------------------------------------- |
| light direction | authored vector              | **an E8 root**; the choice is a gauge, discharged in §5         |
| surface normal  | cross product + outward flip | **the sum of the face's three roots**, §2                       |
| reflection      | a shading formula            | **the GA versor sandwich** `-a v a / \|a\|²`, `R v R̃`           |
| specular        | a Phong exponent             | the mirror direction is derived; **no exponent is shipped**, §6 |

The Clifford algebra itself is generated rather than tabulated
(`only-the-irreducible-is-primitive-generate-the-rest`): a basis blade is a subset bitmask,
and one sign rule — count the transpositions that interleave two generator lists — produces
all 65,536 basis products of Cl(8,0). **VERIFIED**: generators square to `+1`, distinct
generators anticommute, and the product associates on the actual operands this rung
multiplies.

## 2. The normal is `a + b + c`, and it is exact

For a 2-face `{a, b, c}` of 4_21 the vector `n = a + b + c` is **exactly orthogonal to the
face's plane**. The derivation is two lines of integer arithmetic on facts rung 2 already
established — roots have `|r|² = 8` in the doubled coordinates, and two roots joined by a
4_21 edge have `⟨r,s⟩ = 4`:

```
⟨a + b + c, b − a⟩ = ⟨a,b⟩ + |b|² + ⟨b,c⟩ − |a|² − ⟨a,b⟩ − ⟨a,c⟩
                   = 4 + 8 + 4 − 8 − 4 − 4 = 0
```

and symmetrically for `c − a`. Its squared norm is `3·8 + 6·4 = 48`, so it never vanishes.

It is _outward_ for a structural reason and not by a flip test: 4_21 is centred at the
origin with every vertex on one sphere, so the origin's foot on a face's plane is the face's
circumcentre, which for an equilateral triangle is its centroid. The centroid direction
therefore **is** the normal direction — which is exactly what the orthogonality identity
above says.

**VERIFIED, on all 60,480 faces**: `⟨n, b−a⟩ = ⟨n, c−a⟩ = 0` exactly, and the set of
measured `|n|²` values is `{48}` — one value, no exceptions.

**This is the repair of rung 5's gauge.** Rung 5's 3D normal needed an `orientOutward` pass
that flipped signs against the centroid and failed on 768 faces. The 8D normal needs no
flip, no tolerance, and fails on **zero** faces.

## 3. Where exactness ends: one number, and the field is Q(√6)

Rung 4's discipline is that the irrational is confined to one named boundary. Here it is
confined to **one number**.

| quantity                                       | exact form                         | register              |
| ---------------------------------------------- | ---------------------------------- | --------------------- |
| Lambert cosine `⟨L,n⟩ / (\|L\|\|n\|)`          | integer `/ √384`, and `√384 = 8√6` | algebraic, in `Q(√6)` |
| plane illumination `\|L∧B\|² / (\|L\|²\|B\|²)` | integer `/ 384`                    | **rational**          |
| specular cosine `⟨mirror(L),V⟩ / (\|L\|\|V\|)` | integer `/ 384`                    | **rational**          |

The asymmetry is the mathematical content of the boundary, and it is worth stating plainly
because it is _why_ the boundary sits where it does. The specular term pairs two **roots**,
whose norms multiply to `√8·√8 = 8`, a rational. The Lambert term pairs a root with a
**face normal**, and `√8·√48 = 8√6` is not. So `√6` is the single irrational this rung
admits, it enters through `|n| = 4√6` alone, and one function — `cosineToNumber` — evaluates
it.

**Everything a renderer does before display is exact integer arithmetic.** Comparing two
faces' brightness, sorting them, bucketing them, histogramming them: `compareCosines`
compares `p/√P` against `q/√Q` by sign and then by `p²Q` against `q²P`, which never leaves
the integers. **VERIFIED**: over every pair drawn from the nine measured numerators, and
over a cross-denominator pair, the exact comparison agrees with the float evaluation it
declines to perform.

**VERIFIED by source scan**: the module contains exactly one `Math.sqrt(` call site, and it
lies inside `cosineToNumber`. Comments and string literals are stripped first and the _call_
form is matched, because prose about confining a square root would otherwise satisfy a guard
of this shape.

### The structural claim: the intensity never passes through the projection

Rung 3's embedding into 3D is built from eigenvectors and is irrational at every coordinate;
rungs 4 and 5 both had to name it as their float boundary. This rung computes shading in the
8-dimensional integer coordinates and only then _attaches_ it to the projected triangle.
**The projection places pixels. It never touches a brightness.**

## 4. Consequence, measured: the image is posterised by construction

Because `⟨L,n⟩` is an integer and both norms are fixed, the Lambert numerator over the whole
surface takes exactly nine values. **VERIFIED** census under a root light:

| ⟨L,n⟩ | −16 | −12   | −8    | −4     | 0      | 4      | 8     | 12    | 16  |
| ----- | --- | ----- | ----- | ------ | ------ | ------ | ----- | ----- | --- |
| faces | 756 | 4,032 | 7,560 | 12,096 | 11,592 | 12,096 | 7,560 | 4,032 | 756 |

Two-sided (see §7), that is **five brightness levels**: `{0: 11,592, 4: 24,192, 8: 15,120,
12: 8,064, 16: 1,512}`. Nobody chose a quantisation step. `renderLitObj` therefore emits
five materials over the same 240 vertices rather than 60,480 — not a compression trick, the
exact structure of the shading.

The brightest face attains `⟨L,n⟩ = 16`, i.e. `cos = 16/(8√6) = √(2/3) ≈ 0.8165`, **never
1**: no 2-face of 4_21 faces a root head-on. **No meaning is read into that value.** It is
one dot product over one pair of norms; per `numerology-vs-number-theory` it is claimed to
be nothing else, and in particular carries no relation to any other `√(2/3)` or `√6` in this
repository.

Both branches of the front/back test are exercised by the real data — 24,444 faces on each
side and 11,592 grazing — so the clamp is not a check that cannot fail.

## 5. The light gauge, discharged rather than asserted

Which root is the light is a choice. The claim is that the choice cannot change the
picture's statistics, because the Weyl group is transitive on the roots and its elements
permute the face set.

**VERIFIED two ways.** Globally: the two-sided census is identical for light roots 0, 1,
137, 200 and 239 — drawn from both construction families. Per face: for an explicit rotor
`R = ab` built from two roots, `R` carries every sampled face to another face of the derived
set, and `lambert(R·face, R·L) = lambert(face, L)` exactly. The rotor is measured to move
faces (equivariance under an identity would be vacuous) and the sampled cosines are measured
to include non-zero values (equivariance of `0 = 0` would be vacuous too).

**VERIFIED**: a rotor from two roots satisfies `R R̃ = 64`, is purely even-grade, preserves
`|v|²` exactly on all 240 roots, and permutes the root set (240 distinct images, all roots).

## 6. The reflection law, and the boundary this rung declines to cross

`-a v a / |a|²` is the hyperplane reflection (Dorst/Fontijne/Mann). **VERIFIED** on 240+
root pairs: it is an involution, its image is always a root, and it agrees exactly with the
classical vector formula `v − 2⟨v,a⟩a/⟨a,a⟩` that rung 3 already ships — two mechanisms for
one answer, in two different modules.

For a face, `mirror(L) = -(B L B̃)/|B|²`. The sign is derived rather than picked: the raw
sandwich `B L B̃/|B|²` evaluates to `L⊥ − L∥`, so the mirror a surface performs — tangential
kept, normal flipped — is its negation. **VERIFIED**: the mirror is an involution, preserves
norm exactly, and `mirror(L) + L` lies in the face's plane (its wedge with the bivector
vanishes on all 56 grade-3 components).

**No Phong exponent is shipped, deliberately.** The mirror direction is derived; an exponent
is a material parameter an author supplies, and supplying one would be the hand-written
lighting hack this ladder exists to avoid. **That is the named boundary where the substrate
stops and a material begins** — the model ships the cosine at exponent 1 and stops.

## 7. Rung 5's two limits, handled

### (a) Interpenetration — the prose becomes a number

Rung 5: _"the projected 2-skeleton … is not a closed 2-manifold. It renders as an
interpenetrating shell, and no amount of normal orientation makes it a solid."_

**VERIFIED**: every one of the **6,720** edges of 4_21 carries **exactly 27** incident
2-faces (per-edge minimum and maximum both 27; `3·f₂ = 27·f₁`, i.e. `3·60,480 = 27·6,720`).
A manifold edge carries two.

So a one-sided front-face model is not merely awkward here — **it is undefined**, and
two-sided shading is _forced by measurement_ rather than chosen for convenience.

### (b) The 768 origin-plane faces — a measured negative result

Rung 5 measured 768 faces whose 3D plane contains the origin, leaving their outward sign
undetermined, and flagged them rather than guessing.

The obvious repair is to push the 8D outward normal through the embedding and take its sign.
**It does not work, and the reason is an exact identity rather than bad luck.** `embed3d` is
linear, so

```
proj(a + b + c) = proj(a) + proj(b) + proj(c) = 3 × (the projected face centroid)
```

which makes "import the 8D orientation" **literally the same test** rung 5 already ran. It
fails on the same 768. **VERIFIED**: the residual `|proj(n) − (proj(a)+proj(b)+proj(c))|` is
below `1e-9` on all 60,480 faces, and the 3D undetermined count re-measures at 768.

**The handling is that this rung needs no 3D orientation at all.** The 8D normal is defined
and non-degenerate on all 60,480 faces, so every face — the 768 included — receives an exact
finite intensity. **VERIFIED**: for each of the 768, `|n|² = 48`, the Lambert numerator is an
integer, and the evaluated intensity is finite and not `NaN`.

### The depth convention, stated and checkable

> **Order-independent, two-sided, no occlusion.** A face's shaded value is a pure function of
> `(face, light)` and of nothing else — not the other faces, not their order, not a depth
> buffer. Any rasterisation order produces the same per-face value.

**VERIFIED**: shading a deterministically permuted face list returns identical per-face
values. Occlusion is what this convention buys out of and it is named rather than hidden: a
painter's-algorithm depth sort is _wrong_ on interpenetrating geometry, so shipping one
would be a silent lie. A consumer wanting hidden-surface removal supplies its own.

## 8. The mutation run, and the defect it found

Twenty-four mutants, one at a time, whole test file re-run for each. **Twenty-three killed,
one control survived.**

| mutant                                                            | verdict                  | killed by                       |
| ----------------------------------------------------------------- | ------------------------ | ------------------------------- |
| M0 **CONTROL** — comment text only                                | SURVIVED (must)          | —                               |
| M1 `faceNormal8d` sums only two roots                             | KILLED                   | the normal falsifier            |
| M2 `reorderSign` always `+1`                                      | KILLED                   | the Cl(8,0) falsifier           |
| M3 `reverse` is the identity                                      | KILLED                   | the Cl(8,0) falsifier           |
| M4 hyperplane reflection drops its leading minus                  | KILLED                   | agreement with rung 3's formula |
| M5 `isOrientationDetermined` always true                          | KILLED                   | the synthetic false case        |
| M6 `compareCosines` ignores the denominators                      | KILLED                   | the exact-ordering falsifier    |
| M7 `cosineToNumber` divides by the squared denominator            | KILLED                   | the sqrt-boundary scan          |
| M8 `wedgeVectorBivector` flips the middle sign                    | KILLED                   | the Pythagorean split           |
| M9 `contractVectorBivector` drops the antisymmetry                | KILLED                   | the Pythagorean split           |
| M10 `mirrorInFacePlane` drops the derived sign                    | KILLED                   | the mirror falsifier            |
| M11 two-sided term forgets the absolute value                     | KILLED                   | the census                      |
| M12 `applyVersor` uses the versor, not its reverse                | KILLED                   | rotor norm + permutation        |
| M13 `FACE_NORMAL_NORM_SQUARED` 48 → 24                            | KILLED                   | the normal falsifier            |
| M14 `EDGE_FACE_INCIDENCE` 27 → 2                                  | KILLED                   | the incidence falsifier         |
| M15 projection-linearity compares against 1× the centroid         | KILLED                   | the 768 falsifier               |
| M16 `planeIllumination` denominator loses `\|B\|²`                | KILLED                   | the plane-split falsifier       |
| M17 `renderLitObj` collapses to one material                      | KILLED                   | the artefact falsifier          |
| M18 `reflectRootExact` rounds instead of refusing                 | KILLED                   | the reflection falsifier        |
| M19 `edgeFaceIncidence` counts one edge per face                  | KILLED                   | the incidence falsifier         |
| M20 `lit` can never be false                                      | KILLED                   | the census                      |
| M21 **`lambertCosine` numerator is always 0**                     | **SURVIVED, then fixed** | see below                       |
| M22 the sqrt **relocates** out of `cosineToNumber`, count still 1 | KILLED                   | the sqrt-boundary scan          |
| M23 `specularCosine` drops its equal-norm refusal                 | KILLED                   | the mirror falsifier            |

The control survives, which is what proves the harness discriminates rather than failing
everything it touches. M22 is the sharper test of the boundary guard: it keeps the call
count at one and only moves the call, so a guard that merely counted would pass it.

### The real defect: two implementations of one quantity, one of them untested

**M21 originally SURVIVED.** Replacing `lambertCosine`'s numerator with the constant `0`
broke nothing, across 670,000 assertions.

The cause was duplication. `shadeFaces` computed `dot(light, normal)` inline instead of
calling `lambertCosine`, so every census, every histogram and the whole artefact test
exercised the _inline copy_. `lambertCosine` itself was reached only by assertions that a
constant zero satisfies: an inequality `0 ≤ |L∧B|²`, an equivariance `0 = 0`, and an
is-it-an-integer check.

The fix is not another assertion — it is deleting the second implementation. `shadeFaces`
now delegates, so one code path carries the quantity and the census pins it. Two guards were
added for the vacuity that hid it: the rotor-equivariance test now asserts its sampled
cosines are not all zero, and the moved-face count is asserted non-zero.

**The finding worth carrying forward, and it is the same shape rung 5 found one rung
earlier:** rung 5's defect was _a filter with nothing in its input that could fail it_; this
one is _a function with a tested twin_. Both are invisible to reading and both are visible to
mutation. When one quantity has two implementations, assertions drift onto whichever one the
convenient call site uses, and the other becomes decorative.

Two further vacuity repairs were made without a mutant prompting them, on the same
principle. `isOrientationDetermined`'s false branch is unreachable from the derived face set
_by theorem_, so the test exercises it on a synthetic input and says so. The `edgeFaceIncidence`
key originally normalised its pair with a `min`/`max` branch that could never be taken,
since faces are ascending by construction — the branch was removed and the invariant is now
asserted instead.

## 9. Register, and what is not claimed

- **metered** — the construction and every count above. The falsifiers are in
  `clifford-e8-shading.test.ts` and are mutation-checked as recorded in §8.
- **unmetered** — that this is a _good-looking_ image, or useful for anything in particular.
  Not claimed and not tested.
- **toy** — the correspondence between the Lambert cosine here and physical radiometry.
  Lambert's law is used as the _definition_ of a shading value, not as a measurement of
  reflected light. No radiometric claim is made.

**Prior art, and the honest negative.** Geometric-algebra shading and GA rotor pipelines are
well established (Dorst/Fontijne/Mann chs. 7 and 13; the `ganja.js` and `clifford` ecosystems
implement versor sandwiches directly), and E8 / 4_21 visualisations are common. **No novelty
of GA shading is claimed.** Searched: the in-repo prior-art list and this repository's own
`clifford-*` modules; the general literature is cited from the standard references rather
than from a fresh survey, which is an **UNVERIFIED** basis for any claim of the form "nobody
has done X" — so no such claim is made. What is claimed, and only this, is a statement about
_this polytope's arithmetic_: the shading numerator for 4_21 under a root light is an
integer, and the model closes over `Q(√6)`. That is checked here.

## 10. Honest limits

- **Occlusion is absent by design** (§7). What renders is a correctly-shaded interpenetrating
  shell, not a solid, and no depth convention could make it one while every edge carries 27
  faces.
- **The specular term ships no exponent** (§6), so it is a cosine and not a highlight model.
  Adding one requires authoring a material, which is outside this ladder.
- **Colour is greyscale**, because the derived quantity is one scalar per face. A spectral
  model would need a second derived structure, and inventing one to get colour would be the
  hand-placement this ladder avoids.
- **One light at a time.** Superposing several root lights is linear and trivially available,
  but it is not measured here, so it is not claimed.
- **The 3D sign gauge remains open for the 768** (§7b). This rung shows the obvious repair is
  circular and routes around the need; it does not solve it. A different embedding — one not
  linear in the roots — could, and that is a rung-7 question.

## 11. The next rung

Rung 6 produces a shaded face set and a five-material OBJ. What it does not produce is an
_image_: rasterisation, occlusion, and a viewer. The interesting constraint stays the same —
each of those has an authored default and a derived alternative, and the ladder only counts
the derived one. The nearest honest step is the Coxeter-plane raster, where rung 4's exact
lattice coverage already supplies a filled-region primitive and this rung supplies the value
to fill it with, so a picture could be produced with the projection still confined to
placement.

## Anchors (Beacon), cited because they are used

- **Leo Dorst, Daniel Fontijne & Stephen Mann**, _Geometric Algebra for Computer Science_
  (Morgan Kaufmann, 2007) — the versor sandwich `-a v a⁻¹` for reflection, `R v R̃` for
  rotation, the contraction/wedge split of `L B`, and the rejection as what "normal vector"
  abbreviates.
- **David Hestenes & Garret Sobczyk**, _Clifford Algebra to Geometric Calculus_ (Reidel, 1984) — grade decomposition and the reversion antiautomorphism.
- **Johann Heinrich Lambert**, _Photometria_ (1760) — the cosine law the Lambert term is
  named for, used here as a definition.
- **Bui Tuong Phong**, _Illumination for Computer Generated Pictures_ (CACM 18(6), 1975) —
  named for the boundary this rung declines to cross.
- **H. S. M. Coxeter**, _Regular Polytopes_ (3rd ed., Dover 1973) — 4_21 and the f-vector
  entries 6,720 and 60,480 that §7a divides.
- **Thorold Gosset**, _On the Regular and Semi-Regular Figures in Space of n Dimensions_
  (Messenger of Mathematics, 1900) — the polytope being shaded.
- **Hermann Grassmann** (1844) — the outer product; the `√6` boundary is a statement about
  the norm of a Grassmann-derived normal and nothing deeper.
- **Pierre-Philippe Dechant**, _The E8 Geometry from a Clifford Perspective_ (Adv. Appl.
  Clifford Algebras 27, 2017) — the versor route the roots come from.

## Artefacts

- `src/Core.TypeScript/research/clifford-e8-shading.ts` — the module.
- `src/Core.TypeScript/research/clifford-e8-shading.test.ts` — the 15 falsifiers.
- `docs/research/2026-09-09-rung-5-the-face-set-derived-and-the-f-vector-as-its-falsifier.md`
  — the rung this one continues, and the source of both limits handled in §7.
