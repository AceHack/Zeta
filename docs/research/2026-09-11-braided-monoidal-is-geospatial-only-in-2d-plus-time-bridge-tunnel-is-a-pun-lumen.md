# Braided monoidal categories and geospatial: the claim is half right, and the half that survives is a theorem

**Author:** Lumen (mathematical-physics hat) · **Date:** 2026-09-11 · **Status:** advisory, no code changed
**Register discipline:** `.claude/rules/toy-is-free-metered-must-be-earned.md`, `.claude/rules/numerology-vs-number-theory.md`

---

## 0. Verdict, before the reasoning

Aaron's claim: *"braided monoidal categories are more fundamental for regeneration of algebras AND geospatial."*

**The conclusion is right. The stated reason is wrong. They are right and wrong for reasons that are both theorems, which is the good case.**

| claim | verdict | register |
|---|---|---|
| **Braiding is intrinsically a 2-dimensional statement, and geospatial is the canonical 2D domain** | **TRUE, and a theorem** — `π₁(Conf_n(ℝ^d)) = B_n` for d=2 and `S_n` for d≥3 (Fadell–Neuwirth 1962). A non-symmetric braiding *does not exist* above dimension 2. | **STRUCTURAL** |
| **Bridge-vs-tunnel is why geospatial needs braided rather than symmetric** | **REFUTED.** Static features with a real elevation live in ℝ³, where every braiding is a symmetry. Bridge/tunnel is a local z-comparison; the braid group's actual content (linking numbers, isotopy classes) is information no GIS query consumes. This is the pun the brief warned about — two senses of "crossing". | **REFUTED** |
| **Braiding is genuinely geospatial for TRAJECTORIES of multiple bodies over a 2D domain in time** | **TRUE, with published geospatial applications** (ocean-drifter braids, Thiffeault 2010; topological path planning, Bhattacharya et al. 2012). This is "2D plus time", and it is the reading that survives. | **STRUCTURAL** |
| **Braiding is fundamental to "regeneration of algebras"** | **TRUE, and sharper than stated.** Braided structures on `(ℤ/2)ⁿ`-graded spaces are classified by **quadratic forms** (Eilenberg–MacLane 1954; Joyal–Street 1993). A Clifford algebra is *defined* by a quadratic form. **The braiding IS the quadratic form.** | **STRUCTURAL** |
| **The two halves meet in Clifford / conformal geometric algebra** | **PARTIALLY REFUTED.** They touch Clifford at *different parts of its structure*: the braiding sees only the **signature** (a ±1-valued form on a finite group); geospatial CGA consumes the **real metric** (`P·Q = −½|x−y|²`). Braiding is blind to distance. | **REFUTED as stated; one real meeting point survives — §6** |
| **Zeta's Clifford surface uses the braided generality** | **REFUTED.** `ConformalGA.fs` and `Cl3.fs` are algebras in a **symmetric** monoidal category (super-vector-spaces, Koszul sign). The genuinely braided points on ℤ/2 are the **semions**, which nothing here uses. | **REFUTED** |

**The one-sentence form, and it inverts the framing:**

> **Braiding is not the reward for remembering the third dimension — it is the compensation for having thrown it away.** You get a non-symmetric braiding exactly when you project ℝ³ → ℝ² and retain the lost coordinate as a combinatorial sign. Keep elevation and you are symmetric. Project and you are braided. Both encodings preserve the information; they are not both available at once.

**And a correction to the brief, which is load-bearing:** it stated *"the repo has essentially no geospatial surface today."* **That is false.** `src/Core.Abstractions/IGeospatial.cs`, `src/Core/ConformalGA.fs` (the `Cl(4,1)` conformal model, shipped), `src/Core/Cl3.fs`, and a **P1 backlog row** — `docs/backlog/P1/081KT2T2J0008QG0R002ZG89QA` — which names **DE-9IM by name**, plus `docs/PRIMITIVE-REGISTRY.md:130` naming **Uber H3, S2, geohash and spectre-tile**. This lands on a live, planned surface. §8 states what it changes there.

---

## 1. The theorem that makes "braided = 2D" precise

**Route 1 — configuration spaces (Fadell–Neuwirth 1962).** For `UConf_n(ℝ^d)` the space of n unordered distinct points:

> `π₁(UConf_n(ℝ^d)) = B_n` (the braid group) for **d = 2**
> `π₁(UConf_n(ℝ^d)) = S_n` (the symmetric group) for **d ≥ 3**

The proof is the Fadell–Neuwirth fibration with fibre `ℝ^d ∖ {n−1 points}`. In the plane that fibre is a wedge of circles, giving a free group and hence braids. In dimension ≥ 3 it is a wedge of (d−1)-spheres with `d−1 ≥ 2`, hence simply connected, and π₁ collapses to the permutation.

**Route 2 — the little-disks operad (May 1972; Fiedorowicz).** A monoidal category is an E₁-algebra; **braided** monoidal is **E₂** (little 2-disks); E_k-monoidal 1-categories for k ≥ 3 are **symmetric**. The "2" in "braided" is the same 2 as in ℝ².

> **Dimension 3 kills braiding.** Not "makes it optional" — *kills* it. In ℝ³ you can always slide one strand around another, so every exchange is its own inverse. Any design reaching for a braided structure is implicitly asserting a **2-dimensional** setting. There is no third option.

---

## 2. Attacking the bridge/tunnel argument

The brief's formal half is **correct**: `σ_{A,B}` and `σ_{B,A}^{-1}` are both maps `A⊗B → B⊗A`, and *symmetric* is exactly `σ_{B,A} ∘ σ_{A,B} = id`. So "the two crossings are distinct iff not symmetric" is right. **The failure is in the mapping, in four places.**

**2.1 The braiding swaps *tensor factors*, and geographic features do not move.** For `σ` to mean anything geospatially, `A ⊗ B` must mean "A and B in an order" and `σ` must mean "move them past each other". A road and a river sit still; their planar *projections* cross. There is no exchange for `σ` to be.

**2.2 The braid group's information is not information any GIS consumes.** The braid group knows **isotopy classes of the whole strand system** — linking numbers, whether a configuration combs out, the Artin word up to relations. Nobody queries *"what is the linking number of Interstate 5 and the Sacramento River?"* What a GIS consumes is the **local z-order** — OpenStreetMap encodes exactly this as `layer=*` plus `bridge=yes`/`tunnel=yes`. That is the *crossing sign*, not the *braid word*. Using a braided monoidal category to carry one sign is like using a Lie group to carry a boolean: not wrong, not doing any work. **This is the `toy-is-free-metered-must-be-earned` failure in structural form.**

**2.3 The trivial fix dissolves the motivation.** If over/under is real information, **store the elevation** — then "over" is `z_road > z_river` at the crossing, a float comparison. And by §1, ℝ³ has no braiding available anyway. So:

> The braiding is not what protects over/under from being collapsed. The braiding is what you build to **recover** over/under **after** you collapsed it, by projecting to the map.

**2.4 The correct categorical home is TANGLES, and that is a real theorem.**

> **The category of framed oriented tangles is the free ribbon (tortile) monoidal category on one object** — Shum (1994); the braided/compact-closed precursor is Freyd–Yetter (1989).

The geometric objects are the **morphisms**, not the objects. And the brief's intuition is then literally the theorem's content: symmetric monoidal is the category of *permutations*, which is the tangle category modulo letting strands pass through each other. **Symmetrising is exactly forgetting knot theory.**

> **STRUCTURAL (repaired):** a map's curve-system with bridge/tunnel data, *as a projected diagram*, is a morphism in the free ribbon monoidal category on one object.
>
> **CONJECTURE (unsupported):** that any geospatial *query* benefits. **Falsifier:** name one query in the OGC Simple Features predicate set, or in the P1 row's requirements, whose answer depends on a tangle invariant finer than per-crossing z-order. I searched and found none.

---

## 3. Where braiding IS geospatial, without a pun

Drop static features. Take **trajectories**. n agents moving over a 2D domain over time have worldlines in `ℝ² × [0,T]`, **monotone in the last coordinate by construction** — which is the definition of a braid, for free, with no modelling assumption. The homotopy class is an element of `B_n`, and the crossing sign records **which agent passed on which side** — a fact about the path taken, genuinely lost by symmetrising and not recoverable from endpoints.

Established, with geospatial data:

- **Thiffeault (2010)**, *Braids of entangled particle trajectories*, Chaos 20:017516 — braid words from 2D trajectory data; the `braidlab` toolbox.
- **Allshouse & Thiffeault (2012)**, *Detecting coherent structures using braids*, Physica D 241:95–105 — applied to **ocean float/drifter trajectories**.
- **Bhattacharya, Likhachev & Kumar (2012)**, *Topological constraints in search-based robot path planning*, Autonomous Robots 33:273–290 — homotopy classes of paths, h-signatures.
- **Diaz-Mercado & Egerstedt (2017)**, *Multirobot mixing using braid groups*, IEEE T-RO 33(6).

### 3.1 The correction nobody made: the Earth is a sphere, and sphere braids are different

`π₁(UConf_n(S²)) = B_n(S²)`, the **sphere braid group** (Fadell & Van Buskirk 1962) — the planar braid group with one extra relation

`σ₁ σ₂ ⋯ σ_{n−1} σ_{n−1} ⋯ σ₂ σ₁ = 1`

which says *you can slide a strand around the back of the globe*. Consequences:

- `B_n(S²)` is a **proper quotient** of `B_n`. Braids non-trivial on a map can be trivial on the globe.
- `B_n(S²)` has **torsion** (Gillette & Van Buskirk 1968); `B_n` is torsion-free.
- `B_2(S²) ≅ ℤ/2` — two agents braiding twice returns to the identity. In the plane it never does.

> **STRUCTURAL, and a live defect warning for the P1 row:** any braid-theoretic or homotopy-class invariant computed **in a projected chart** is an invariant of the chart, not of the globe. The row's design is *"store canonical geodetic, project on query"* — under which a post-projection braid invariant is **frame-dependent**, precisely the failure class `local-time-never-enters-the-shared-fold.md` guards for time, appearing here for space.
>
> **Falsifier, cheap and decisive:** construct an n=2 trajectory pair whose planar braid word is `σ₁²` (non-trivial in `B₂ ≅ ℤ`) and verify it is trivial in `B₂(S²) ≅ ℤ/2`. `src/Core/Braid.fs` implements the Artin action exactly, in integers; the sphere relation is one added relator.

---

## 4. The algebra half — stronger than claimed, and precisely locatable

**Theorem (Eilenberg–MacLane 1954; Joyal–Street 1993 §3).** Braided monoidal structures on `Vec_G` (G finite abelian) are classified by **quadratic forms** `q: G → k×` via `H³_ab(G, k×)`. The braiding on homogeneous pieces is the associated bilinear form `b(a,b) = q(a+b)/(q(a)q(b))`, and the structure is **symmetric iff `b(a,b)·b(b,a) = 1`**.

**Theorem (Albuquerque & Majid 1999, 2002).** The octonions are the twisted group algebra `k_F[(ℤ/2)³]` with a nontrivial 3-cocycle associator; Clifford algebras are cochain twists of `(ℤ/2)ⁿ` group algebras with **trivial** associator and a nontrivial 2-cochain.

Together:

> **The braiding IS the quadratic form. A Clifford algebra is defined by a quadratic form. So "Cl(p,q) is an earned quotient of the free braided monoidal thing" is not a slogan — the datum you choose to earn the quotient is literally the braiding datum.**

This validates `only-the-irreducible-is-primitive-generate-the-rest.md` **at theorem strength**, and names the exact coordinate: **the cochain pair (F, φ) on the grading group**, φ controlling the associator, F the braiding. φ trivial → Clifford; φ = the nontrivial 3-cocycle on `(ℤ/2)³` → octonions. A generator and a dial.

### 4.1 And here is the refutation: Zeta's Clifford surface sits at the *symmetric* point

On `G = ℤ/2`, quadratic forms need `q(1)⁴ = 1`, so `q(1) ∈ {1, −1, i, −i}` — **four** braided structures:

| `q(1)` | `b(1,1)` | `σ²` | category | used in Zeta? |
|---|---|---|---|---|
| `1` | `1` | `id` | `Vec` — symmetric | — |
| `−1` | `1` | `id` | `sVect` (super-vector-spaces, Koszul sign) — **symmetric** | **yes — this is Clifford** |
| `i` | `−1` | `−id` | **semion** — genuinely braided | **no** |
| `−i` | `−1` | `−id` | anti-semion — genuinely braided | **no** |

Cochain-twisting a group algebra always produces a bicharacter with `R(a,b)R(b,a) = 1` identically, so **the Albuquerque–Majid construction lands in the symmetric column by construction.**

> **REFUTED:** that Zeta's Clifford/CGA surface *uses* braiding. It uses the symmetric point of a braided family. **The braided generality is real, available, named, and unspent.** What would spend it: a quadratic form valued in fourth roots of unity — genuine anyons. A substantive design decision, not a relabelling.

---

## 5. Does the Clifford half carry over to geospatial? Mostly no

The premise is correct — conformal geometric algebra `Cl(4,1)` is the practitioner's tool (Hestenes & Sobczyk 1984; Dorst, Fontijne & Mann 2007), with a real CGA-for-GIS literature (Yuan et al., Sci. China Earth Sci. 54, 2011; CAUSTA, Transactions in GIS 14, 2010). `ConformalGA.fs` implements the standard null-vector embedding with `P·Q = −½|x−y|²`.

**But the meeting point is narrower than hoped:**

| | the braiding sees | CGA geospatial computation needs |
|---|---|---|
| domain | `(ℤ/2)ⁿ` — a finite group | `ℝ^{4,1}` — a real vector space |
| values | `±1` (or 4th roots) | `ℝ` |
| content | **the signature** — which `e_i² = ±1` | **the metric** — actual distances |

> **REFUTED as stated:** the two halves do **not** meet in CGA. They touch Clifford at different structural layers — braiding ↔ signature (discrete, `H³_ab`); geospatial ↔ metric (continuous, the real quadratic form). **Falsifier that would rescue it:** exhibit one geospatial quantity in `ConformalGA.fs` determined by the signature alone. `isNull` is signature-flavoured; `distSq`, `euclidSq` and the Gaussian RBF kernel are not.

---

## 6. What the two halves actually share

The brief's hypothesis — *"both are composition problems with a non-trivial crossing"* — must be **rejected as stated: it is too general to discriminate.** "Twist a monoidal structure by a cocycle" fits essentially every graded algebraic structure ever written down.

### 6.1 The real meeting point: the abelian Reshetikhin–Turaev invariant

Take `Vec_G^q` classified by a quadratic form (§4) and apply the RT construction (Reshetikhin & Turaev 1990; abelian case Murakami–Ohtsuki–Okada 1992, Deloup 1999). The invariant of a framed link with components coloured by `a_i ∈ G`:

```
⟨L⟩ = ∏_i q(a_i)^{fr_i} · ∏_{i<j} b(a_i, a_j)^{lk(i,j)}
```

> **STRUCTURAL — the one point where the algebra half and the crossing half are the same object.** The very bicharacter that is the Clifford commutation sign — `e_a e_b = b(a,b) e_b e_a` — is the weight attached to a crossing, paired against the linking number.

**And the honest limit, which decides the geospatial question:** this is load-bearing only when linking numbers are — i.e. §3 (trajectories), not §2 (static roads, where the invariant degenerates to the one sign already stored as `layer=`). Two independent lines converging on the same half of the claim, and I checked they are independent: §3 is topology of configuration spaces, §6.1 is representation theory of graded categories. **They share no premise.**

### 6.2 The honest analogy, registered as one

> **ANALOGY:** in both halves the braiding is *the obstruction to a projection being faithful, retained as a sign*. Algebra side: `V ↠ (ℤ/2)ⁿ`, with the 2-cochain recording lost reordering signs. Geospatial side: `ℝ³ ↠ ℝ²`, with the crossing sign recording lost z-order. Both are "a 2-cochain repairing a discarded dimension."
>
> **Why it stays an analogy:** the cohomological homes are different objects and I cannot write a map between them. **What would promote it:** exhibit a functor `Tangles → Vec_G^q` under which the geospatial crossing sign is the image of the group-cohomological twist. §6.1 is *nearly* that map — the most promotable item here.

---

## 7. Two naming traps, one found in the tree

### 7.1 H3 — more dangerous than the brief realised

- `src/Core/IcosahedralH3.fs` — **Coxeter group H₃**, icosahedral root system, 30 roots in `Cl(3,0)`, exact `ℤ[φ]`.
- `docs/PRIMITIVE-REGISTRY.md:130` — **Uber H3**, hexagonal hierarchical geospatial index (Brodsky 2018), in the DGGS literature (Sahr, White & Kimerling 2003).

Both already in this repo, on both sides of a geospatial conversation. **The hazard is that a real structural relation exists:** Uber H3's base polyhedron **is an icosahedron** — 20 faces, 122 base cells, 12 pentagons on the 12 icosahedral vertices — and the icosahedron's symmetry group **is** Coxeter H₃. Anyone noticing that will feel the name collision confirmed. It is not.

**Two disciplining facts:**

1. **The 12 pentagons are Euler, not H₃.** Any hexagon-dominant spherical tiling has exactly 12 pentagons: `Σ(6−k) = 12` from `χ(S²) = 2`. Forced by topology, independent of icosahedral symmetry. Citing "12" as evidence is the count-is-not-an-identification failure verbatim.
2. **CONJECTURE, expected to fail at a specific step:** that `IcosahedralH3`'s exact `ℤ[φ]` arithmetic gives exact Uber-H3 cell geometry. **TRUE for the base polyhedron vertices** (`(0, ±1, ±φ)` — exactly representable); **FALSE from the projection onward** — gnomonic projection is transcendental and H3's aperture-7 subdivision rotates by `atan(1/(2√3)) ≈ 19.1°`. **Falsifier:** attempt exact `ℤ[φ]` H3 cell centres at resolution 1 and observe where it leaves the ring.

### 7.2 The trap the brief did not have: "tangle"

`src/Core/TangleNavigator.fs` is about **homoclinic tangles** — the dynamical-systems object (Poincaré, Smale). §2.4 is about **tangle categories** — the knot-theoretic object. Same word, unrelated mathematics, **both now in scope of the same conversation.** Anyone grepping for "tangle" after reading §2.4 gets a confident wrong hit.

---

## 8. What this changes for the live geospatial surface

The P1 row `081KT2T2J0008QG0R002ZG89QA` already commits to *store canonical geodetic, project on query* and to *DE-9IM predicates*.

**Where the standard calculi sit, checked rather than assumed:**

| framework | anchor | monoidal? | braided? |
|---|---|---|---|
| 4-/9-intersection | Egenhofer & Franzosa, IJGIS 5(2) 1991 | a JEPD relation set with a composition table — a **monoid/category** of relations | **no** |
| DE-9IM | Clementini, Di Felice & van Oosterom, SSD'93; OGC SF / ISO 19125 | same | **no** |
| RCC-8 | Randell, Cui & Cohn, KR'92 | a **relation algebra** (Tarski 1941; Jónsson–Tarski 1951) — and a *weak* composition table (Li & Ying 2003) | **no** |
| `Rel`, allegories, cartesian bicategories | Carboni & Walters, JPAA 49 (1987); Freyd & Scedrov (1990) | **yes** — symmetric, indeed dagger-compact | **symmetric** |
| categorical quantum mechanics | Coecke & Kissinger (2017); Baez & Stay (2011) | **yes** | **symmetric** |
| tangle categories | Freyd & Yetter (1989); Shum (1994) | **yes** | **braided / ribbon** ✔ |
| braid groups on trajectory data | Thiffeault (2010); Allshouse & Thiffeault (2012) | — | **braided** ✔ |

**The actionable finding:** every existing *spatial-reasoning* formalism is symmetric — consistent with the intuition that they cannot see over/under, and a documented limitation (DE-9IM computed on the 2D projection returns `intersects` for a bridge). But the practitioners' fix is not a braiding, it is **2.5D: keep Z.** And §1 says keeping Z forecloses the braiding.

> **So the P1 row faces a real fork:**
>
> **(a) Embed** — geometry carries elevation; relations computed in ℝ³. Symmetric monoidal. Bridge/tunnel is a z-comparison. **Braiding unavailable and unnecessary.**
> **(b) Project + sign** — canonical 2D geodetic plus per-crossing layer data. Ribbon/tangle-structured. Braiding available, and the projection must then be part of the stored canonical, because §3.1 shows crossing data is chart-dependent on a sphere.
>
> These are not compatible, and the row currently implies (a)-storage with (b)-flavoured queries. **Naming the fork is the contribution; choosing it is the Architect's call, not mine** (`no-directives.md`).

**Second, smaller finding:** the row's *multi-oracle storage* requirement ("store ALL sovereign claims, disputes as overlapping claims held, don't collapse") is the raw-vault discipline and is **orthogonal** to everything above. Noted only to record that I checked and found no braided structure hiding in it — disputed-border plurality is a Z-set/raw-vault fact, not a topological one. Resisting the urge to find braiding there is the numerology discipline applied to my own document.

---

## 9. Register table

| # | claim | register | falsifier |
|---|---|---|---|
| 1 | Braiding exists only in dim 2; dim ≥ 3 forces symmetric | **STRUCTURAL** (Fadell–Neuwirth 1962) | cited theorem |
| 2 | Braided monoidal = E₂ = little 2-disks | **STRUCTURAL** (May 1972; Fiedorowicz) | cited theorem |
| 3 | Bridge/tunnel motivates braided over symmetric | **REFUTED** | exhibit a geospatial query needing an invariant finer than per-crossing z-order. None found |
| 4 | Curve systems with over/under are morphisms in the free ribbon category | **STRUCTURAL** (Shum 1994) | — but see #3 for whether it is *used* |
| 5 | Multi-agent 2D trajectories over time are literally braids | **STRUCTURAL**, with geospatial applications | swap a crossing with endpoints fixed: braid word must change, permutation must not |
| 6 | Earth is S², so `B_n(S²) ≠ B_n`; chart-computed braid invariants are frame-dependent | **STRUCTURAL** (Fadell–Van Buskirk 1962) | build the `σ₁²` pair: non-trivial in `B₂ ≅ ℤ`, trivial in `B₂(S²) ≅ ℤ/2` |
| 7 | Braidings on `Vec_G` ↔ quadratic forms; the braiding **is** the Clifford form | **STRUCTURAL** (Eilenberg–MacLane; Joyal–Street) | cited theorem |
| 8 | Clifford/octonions = cochain-twisted `(ℤ/2)ⁿ` group algebras | **STRUCTURAL** (Albuquerque–Majid) | cited theorem |
| 9 | Zeta's `ConformalGA`/`Cl3` use the braided generality | **REFUTED** — they sit at `sVect` | exhibit a fourth-root-of-unity form anywhere in the tree. There is none |
| 10 | The two halves meet in CGA | **REFUTED as stated** | exhibit a geospatial quantity determined by signature alone |
| 11 | They meet in the abelian RT invariant | **STRUCTURAL** (Reshetikhin–Turaev 1990; Deloup 1999) — routes through #5, not #3 | for geospatial relevance, #5's falsifier |
| 12 | "Braiding is a 2-cochain repairing a discarded dimension" | **ANALOGY** | exhibit a functor `Tangles → Vec_G^q` mapping the crossing sign to the cohomological twist. Most promotable item here |
| 13 | `ℤ[φ]` exactness transfers to Uber-H3 cell geometry | **CONJECTURE, expected FALSE past the base polyhedron** | attempt exact resolution-1 cell centres |
| 14 | Uber H3's 12 pentagons evidence a Coxeter-H₃ connection | **REFUTED** — 12 is forced by `χ(S²) = 2` | — |
| 15 | The P1 row must choose embed vs project-and-sign | **STRUCTURAL consequence** of #1 + #6 | a design fork, not a claim |

**Nothing here is FROZEN-CORE.** Items 1, 2, 4, 5, 6, 7, 8, 11 are *cited external theorems* — Beacon-anchored, and each stated in the form it is relied on so an entailment check is possible. Items 12 and 13 are the only open Zeta-side conjectures and belong in §B.

---

## 10. Hand-off to Soraya

1. **`B₂(S²) ≅ ℤ/2` against `Braid.fs`.** It implements the Artin action on `F_n` — faithful (Artin 1947), exact, integer-only, byte-lockable. Add the sphere relator and check `σ₁²` dies for n=2. **Falsifier:** it does not die ⇒ the relator or the action is wrong. **The cheapest real result here, and it directly guards a P1 design decision.**
2. **The four braidings on ℤ/2.** Verify `q(1)⁴ = 1`, four solutions, symmetric iff `q(1) = ±1`; then that `Cl3.fs`'s commutation signs realise the `q(1) = −1` row and no other. **Falsifier:** `Cl3` realises a fourth-root form ⇒ #9 is wrong and the repo already has an anyon.
3. **Promotion of #12.** Construct the RT functor for one Clifford signature; check the crossing weight equals `b(a,b)`. If it does, #12 graduates to STRUCTURAL. If not, #12 is refuted and the shared structure is decoration — **the more valuable outcome.**

---

## 11. Beacon anchors

**Braiding, configuration spaces, operads**
Artin (1925) *Theorie der Zöpfe*, Abh. Math. Sem. Hamburg 4:47–72; (1947) *Theory of braids*, Ann. Math. 48:101–126 · **Fadell & Neuwirth (1962)** *Configuration spaces*, Math. Scand. 10:111–118 — **the dimension theorem** · **Fadell & Van Buskirk (1962)** *The braid groups of E² and S²*, Duke Math. J. 29:243–257 · Gillette & Van Buskirk (1968) — torsion in `B_n(S²)` · May (1972) *The Geometry of Iterated Loop Spaces*, LNM 271 · Fiedorowicz — braided monoidal ↔ double loop space.

**Braided monoidal categories and classification**
Joyal & Street (1993) *Braided tensor categories*, Adv. Math. 102:20–78 · Eilenberg & Mac Lane (1953/54) *On the groups H(Π,n) I, II*, Ann. Math. — `H³_ab` ≅ quadratic forms · Mac Lane (1963) *Natural associativity and commutativity*, Rice Univ. Studies 49 · Drinfeld (1989) *Quasi-Hopf algebras*, Leningrad Math. J. 1.

**Tangles, ribbon categories, link invariants**
Freyd & Yetter (1989) *Braided compact closed categories…*, Adv. Math. 77:156–182 · **Shum (1994)** *Tortile tensor categories*, JPAA 93:57–110 · Reshetikhin & Turaev (1990) *Ribbon graphs and their invariants…*, CMP 127:1–26 · Turaev (1994) *Quantum Invariants of Knots and 3-Manifolds* · Murakami, Ohtsuki & Okada (1992), Osaka J. Math. 29 · Deloup (1999), Trans. AMS 351.

**Clifford, Cayley–Dickson, graded twisting**
Albuquerque & Majid (1999) *Quasialgebra structure of the octonions*, J. Algebra 220:188–224 · Albuquerque & Majid (2002) *Clifford algebras obtained by twisting of group algebras*, JPAA 171:133–148 · Hestenes & Sobczyk (1984) *Clifford Algebra to Geometric Calculus* · Dorst, Fontijne & Mann (2007) *Geometric Algebra for Computer Science* · Conway & Sloane, *SPLAG* §8.2 — icosians.

**Spatial reasoning (the symmetric column)**
Egenhofer & Franzosa (1991), IJGIS 5(2):161–174 · Egenhofer & Herring (1991) — 9-intersection · Clementini, Di Felice & van Oosterom (1993), SSD'93 LNCS 692 — **DE-9IM** · Randell, Cui & Cohn (1992), KR'92:165–176 — **RCC-8** · Li & Ying (2003), Artificial Intelligence 145 · Tarski (1941), JSL 6:73–89; Jónsson & Tarski (1951/52) · Carboni & Walters (1987), JPAA 49:11–32 · Freyd & Scedrov (1990) *Categories, Allegories* · Baez & Stay (2011) *Rosetta Stone*, LNP 813 · Coecke & Kissinger (2017) *Picturing Quantum Processes*.

**Braids on real geospatial data (the braided column)**
Thiffeault (2010), Chaos 20:017516 · Allshouse & Thiffeault (2012), Physica D 241:95–105 — **ocean drifters** · Budišić & Thiffeault (2015), Chaos 25 — `braidlab` · Bhattacharya, Likhachev & Kumar (2012), Autonomous Robots 33:273–290 · Diaz-Mercado & Egerstedt (2017), IEEE T-RO 33(6).

**Discrete global grids (the other H3)**
Brodsky (2018) *H3: Uber's hexagonal hierarchical spatial index* · Sahr, White & Kimerling (2003), Cartography and GIS 30(2):121–134.

**GA in GIS**
Yuan, Yu, Luo et al. (2011), Science China Earth Sciences 54:101–112 · Yuan et al. (2010) *CAUSTA*, Transactions in GIS 14(s1):59–83.

---

## 12. Provenance

Everything above is **borrowed, published mathematics**, establishing **math-shape correspondences** — the shapes match. It is not evidence that "topology proves our system." The Zeta-side claims are items 9, 12, 13 and 15, and three of those four are refuted or expected-false.
