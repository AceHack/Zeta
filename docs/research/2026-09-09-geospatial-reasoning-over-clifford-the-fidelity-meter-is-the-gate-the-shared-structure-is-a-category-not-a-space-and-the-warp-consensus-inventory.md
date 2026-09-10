# Geospatial reasoning over Clifford: the fidelity meter is the gate, the shared structure is a _category_ not a _space_, and an inventory of every hidden warp consensus a renderer would need

Date: 2026-09-09
Author: shadow-subagent (Claude Opus 5), Claude Code
Work items: `081M23H36QF087G0R0012F5GHT` (fidelity meter) · `081M23H3BW1087G0R0030NMD47`
(hidden-control-structure inventory) · `081M23H3BWT087G0R000FES3JA` (scene-design substrate)
Base: `origin/main` @ `7ffb1fabdb`

> **This is a research document. Nothing here implements an engine.** It answers four
> questions Aaron put in priority order, produces one inventory that is meant to be used as
> a checklist, and records one optimisation ordering so later work can be checked against it.

## 0. Register discipline — read before anything else

`.claude/rules/toy-is-free-metered-must-be-earned.md`. Claims are marked **VERIFIED** (I ran
it or read the artifact in this session), **CITED** (a paper says it; I read the abstract or
the stated section and say which), or **UNVERIFIED**. Constructions are `toy` / `unmetered` /
`metered`.

Two traps are named here so they cannot operate silently:

**Trap 1 — the correspondence trap.** `.claude/rules/numerology-vs-number-theory.md` governs
this whole document. "Mind, body, English and affect all project onto the same space" is a
_correspondence claim between domains_. A correspondence is a **hypothesis**, and matching
shapes, matching dimensions and matching counts identify nothing. §2 is entirely about what
would turn it into a result, and the honest answer is that today it is `toy` — not because
the idea is bad but because **no measurement has been defined that could come out negative**.

**Trap 2 — the citation trap.** `.claude/rules/anchor-to-human-prior-art.md` requires anchors
be _checked_, not cited. Where I read only an abstract, the row says so. Two papers below are
load-bearing and I read only their abstracts (de Haan et al. 2024; Pustejovsky 2026); both
are flagged at the point of use.

---

## 1. The ask, verbatim, and what it decomposes into

Aaron, 2026-09-09 (kept intact — the framing _is_ the requirement):

> _"the most important thing is we are trying to do geospatial reasoning over clifford and be
> able to map that onto mind of our agents we have working in clifford, and english, and
> code, and their own body in 3d space, clifford seems to be the best i've found for that,
> just like our linguistic seed over english we can have some sort of graphical seed that
> stays embarrassingly parallel, if something is better than clifford and our braided
> monoidal categories i'm open to it, maybe there is some zlinq simd, i don't know if a
> graphics engine could work completely in rx, that would be amazing interface for scene
> design. we can explore but we want some algebra where mind, body, english, and emotional
> propagation can all be projected onto the same space with high fidelity so we can look for
> and compare irreducible objects across domains. this ties heavily to our homoiconic
> desires."_

> _"for our game engine specifically we want to optimize for gpu first and pushing as many
> calculations as possible into gpgpu like optimized code then simd/cpu ... then quality, we
> would really like to have reflections and even water and such, all the things a modern game
> engine has but built completely differently from our research and the other research papers
> on this niche area, also we can stitch things together and use different equations in
> different places, we have some work on composable algebras and such too, we want to lean on
> embarrassingly parallel, every time we require some hidden warp consensus or hidden control
> structure, i want to see if we can research latest research papers for an alternative
> solution ... we are not trying to beat AAA engines but just a very efficient alternative
> built completely different based on latest research from us and papers."_

Five requirements, and the order is his:

| #   | requirement                                                                    | section    |
| --- | ------------------------------------------------------------------------------ | ---------- |
| R1  | _"high fidelity"_ — the projection claim must be measurable                    | **§2**     |
| R2  | _"if something is better than clifford … i'm open to it"_                      | **§3**     |
| R3  | _"could a graphics engine work completely in rx"_                              | **§4**     |
| R4  | _"every time we require some hidden warp consensus … research an alternative"_ | **§5**     |
| R5  | GPU-first ordering, reflections and water, ZLinq                               | **§6, §7** |

### 1.1 What this document does NOT re-derive

Aaron says the prior work is in-tree, and it is. These are cited and built on, never restated:

| already settled                                                                                          | where                                                                                                                                                                                                                                                                                             | what it settles                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Q4: CGA is `M₂(Cl(3,0))`** — the same tower, one suspension apart                                      | `docs/research/2026-08-26-cga-is-m2-of-the-in-tree-clifford-q4-answered-and-the-lp-ceiling-that-prices-a-reservoir.md`; `src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.ts` (36 tests, cross-oracle against `CliffordPeriodicity.fs`, zero divergence over 169 signatures) | the in-tree `Cl3` is not a rival to CGA; it is the entry type of the matrix CGA is built from                                 |
| **all three GA towers reduce to `Cl(3,0)`; PGA(3D) is `Cl(3,0) ⊗ Λ(ℝ¹)`, dim 16, radical 8**             | `docs/research/2026-08-26-all-three-geometric-algebra-towers-reduce-to-the-in-tree-cl30-so-the-choice-is-not-yet-forced.md`                                                                                                                                                                       | the algebra choice **is not yet forced**, and a degenerate signature is not classifiable by the ABS clock                     |
| **honest CGA-versus-4×4 costing; Gaalop as the compile-time answer to GA's dimensional cost**            | `docs/design/2026-08-23-clifford-gpu-theory-brief-…-five-questions-for-the-math-team.md` §5                                                                                                                                                                                                       | the dimension and product-count costs are _eliminable at compile time_; the **precision** cost of storing `½                  | x   | ²` is **not** |
| **the rendering ladder, rungs 1–6, each metered**                                                        | `clifford-e8-{coxeter-projection, eigenlayer-tessellation, exact-coverage, face-lattice, shading}.ts` + the four rung docs of 2026-09-09                                                                                                                                                          | derived geometry with a provenance falsifier; 240 roots → 6,720 edges → 60,480 faces → shading closing over `Q(√6)`           |
| **every edge of 4_21 carries exactly 27 faces**                                                          | `docs/research/2026-09-09-rung-6-shading-…-q-sqrt-6.md` §7(a); `clifford-e8-shading.ts:186`                                                                                                                                                                                                       | `3·f₂ = 27·f₁`. A manifold edge carries two. **This is §6.2's constraint on reflections.**                                    |
| **the English seed spec, with Gärdenfors convexity as its falsifier and a disjunctive negative control** | `docs/research/2026-09-03-minimal-linguistic-seed-clifford-geometry-…md` §2.4                                                                                                                                                                                                                     | the English leg's measurement is designed; register `toy`; nothing has been run                                               |
| **the pre-registered single-domain latent-geometry experiment (T0–T3, matched-covariance null)**         | `docs/research/2026-08-23-measuring-latent-geometry-…md` §2.3–2.7                                                                                                                                                                                                                                 | the _within-domain_ meter already exists as a design. §2 extends it **across** domains, which is the part that does not exist |
| **the standing hold on Clifford-GPU work**                                                               | `workitems/081M0R18878087G0R001XY5A2J-…md`                                                                                                                                                                                                                                                        | Q1, Q2, Q3, Q5 remain open; **no implementation is started here** and this document starts none                               |

**The hold is respected.** Nothing below proposes Clifford-GPU code, a lowering, or a
measurement of the algebra. §5 is an inventory of _conventional renderer_ hazards and their
published alternatives — engineering reconnaissance, which the hold explicitly does not block.

---

## 2. R1 — the measurement problem, and why it governs everything else

### 2.1 As stated, the claim cannot fail

> _"mind, body, english, and emotional propagation can all be projected onto the same space
> with high fidelity so we can look for and compare irreducible objects across domains."_

Three independent reasons this is not yet a claim, each fixable:

1. **"the same space" is satisfiable trivially.** Any four finite sets embed into ℝⁿ for
   large enough n. Without a constraint on _what the embedding must preserve_, a projection
   always exists and proves nothing. This is the vacuity class with coordinates.
2. **"high fidelity" names no quantity.** Fidelity of _what_ — distances? neighbourhoods?
   compositional structure? Each is a different measurement with a different null, and they
   disagree in practice (§2.3).
3. **"the same irreducible object" is an identification, and identifications need
   invariants.** `numerology-vs-number-theory.md` is exact on this: a matching count never
   identifies an object. If a "mind object" and an "English object" both come out
   8-dimensional, that is 48-roots-and-F₄ again.

None of these is an objection to the programme. They are the specification of the meter.

### 2.2 What kind of claim it actually is — and the literature that already measures it

The claim is **representational alignment**: two encoders over different modalities induce
similarity structures, and the question is whether those structures agree beyond chance. This
is a mature measured field with published _critiques_, which is what makes it usable — a
method with known failure modes can be run honestly.

| anchor                                                                                                            | what it supplies                                                                                                                                                                                                                                                                      | register of the anchor                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Kriegeskorte, Mur & Bandettini (2008), representational similarity analysis (RSA)**                             | compare systems by their _dissimilarity matrices_ (RDMs) rather than their coordinates — removes the need for a shared basis, which is exactly our situation                                                                                                                          | CITED (standing knowledge; the method is textbook in cognitive neuroscience) |
| **Kornblith, Norouzi, Lee & Hinton (2019), centered kernel alignment (CKA)**                                      | the deep-learning form of the same comparison; invariant to orthogonal transform and isotropic scaling                                                                                                                                                                                | CITED                                                                        |
| **Williams (2025), "An equivalence between RSA and CKA"** (CCN 2025; bioRxiv 2024.10.23.619871)                   | RSA, CKA and CCA are _the same family_; the apparent method split is community, not mathematics                                                                                                                                                                                       | CITED — abstract and CCN abstract read                                       |
| **Williams, Kunz, Kornblith & Linderman (2021), "Generalized Shape Metrics on Neural Representations"** (NeurIPS) | turns the comparison into a **metric** (triangle inequality holds), so "A is closer to B than to C" becomes a legitimate sentence                                                                                                                                                     | CITED                                                                        |
| **Huh, Cheung, Wang & Isola (2024), "The Platonic Representation Hypothesis"** (ICML)                             | the _exact_ hypothesis Aaron states, at scale, with a meter: **mutual k-nearest-neighbour alignment** on paired cross-modal data                                                                                                                                                      | CITED — abstract + method description read                                   |
| **"Back into Plato's Cave: Examining Cross-modal Representational Convergence at Scale"** (arXiv 2604.18572)      | the adverse result: mutual-kNN **"drops sharply when moving from small galleries to million-scale datasets and degrades further under many-to-many cross-modal correspondences"**; the original evidence establishes _coarse semantic-category overlap_, not fine-grained convergence | CITED — abstract read                                                        |
| **"ReSi: A Comprehensive Benchmark for Representational Similarity Measures"** (arXiv 2408.00531)                 | the similarity measures **disagree with each other**; there is no single right one                                                                                                                                                                                                    | CITED — abstract read                                                        |

**The adverse results are the reason to use this literature rather than invent a meter.** A
home-made fidelity number would have unknown behaviour under exactly the conditions we care
about (small paired sets, many-to-many correspondence). These are measured and published.

### 2.3 The meter, in two tiers — and why one tier is not enough

The single most important structural point in this document:

> **An alignment score is a count. It can support "consistent with the same object" and can
> never support "is the same object". The identification needs invariants.**

That is `numerology-vs-number-theory.md` applied to the meter itself, and it forces two tiers.

#### Tier 1 — ALIGNMENT (necessary, correlational, kills fast)

**Input.** A paired set `P = {(a_i, b_i)}` of `N` items with a _correspondence you did not
derive from either embedding_ — the same referent expressed in domain A and domain B.
**The correspondence is the whole cost of this meter; see §2.5.**

**Statistic.** Project each side into the candidate shared carrier, form the RDM on each side,
and report **three** numbers, not one:

| statistic                                             | why it is in the set                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **mutual k-NN overlap** (Huh et al.)                  | local neighbourhood agreement; the Platonic-hypothesis meter, directly comparable to published values  |
| **CKA / RSA correlation** (Kornblith; Kriegeskorte)   | global similarity-structure agreement, invariant to orthogonal transform and scale                     |
| **generalised shape distance** (Williams et al. 2021) | a genuine **metric**, so cross-pair comparisons ("English is nearer body than affect is") are licensed |

Reporting three is not hedging — ReSi shows they disagree, and **a claim that survives only
one of them is a claim about the statistic, not about the domains.**

**The null is the load-bearing part, and it is the same guard the in-tree design already
uses.** `docs/research/2026-08-23-measuring-latent-geometry-…md` §T1: _"The null must be
matched, or the test is worthless."_ Here that means **three** controls, each of which the
meter must beat:

1. **Permutation null** — shuffle the pairing. Kills "any two point clouds of this size look
   alike".
2. **Matched-covariance null** — random directions with the _same norm distribution and
   covariance spectrum_ as the real embeddings. Kills anisotropy artifacts, which are known
   to manufacture apparent structure (Timkey & van Schijndel 2021, cited in-tree).
3. **Random-projection control** — project both domains into a _random_ carrier of the same
   dimension instead of the Clifford one. **This is the control that decides whether the
   algebra is doing any work at all**, and its absence is how a GA result would fake itself.
   If Clifford does not beat a random carrier of equal dimension, the algebra is decoration.

Control 3 is the one I have not seen in the alignment literature and it is the one this repo
most needs, because the hypothesis under test is _specifically_ about Clifford.

#### Tier 2 — IDENTIFICATION (what "the same irreducible object" requires)

Tier 1 passing means the structures agree. It does **not** mean the two candidate objects are
the same object. For that, the repo's own discipline applies: name the invariants, and name
what each excludes.

For a candidate irreducible object in a geometric algebra, the invariants are available and
exact:

| invariant                    | what it is                                | what a mismatch excludes                                                                                                   |
| ---------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **grade**                    | which blade grade the object occupies     | a bivector is not a vector however well their neighbourhoods align                                                         |
| **norm class**               | the set of distinct `                     | x                                                                                                                          | ²` values | one class = simply-laced; two = not. This is exactly what separated D₄⊕D₄ from F₄ in RC-3 |
| **rank of span**             | dimension of the subspace generated       | F₄ (rank 4) vs D₄⊕D₄ (rank 8)                                                                                              |
| **stabiliser**               | the subgroup of versors fixing the object | the strongest of the four; two objects with different stabilisers are different objects regardless of any similarity score |
| **orthogonal decomposition** | does it split, and into what              | "two orthogonal rank-4 components of 24" is the sentence that made RC-3 an identification                                  |

**Pre-registration rule, taken from the existing design and not weakened here:** the invariant
table and the exclusion column are written **before** the numbers, and a candidate that
matches on score but mismatches on any invariant is reported as _"aligned, not identified"_ —
which is a real and publishable result, not a failure.

### 2.4 The pre-registered negative

Written now, before any number exists, per the in-tree precedent.

> **The cross-domain projection claim is REFUTED for a domain pair (A, B) and carrier C if:**
>
> **(a)** the mutual-kNN overlap on `P` does not exceed the permutation null's 99th
> percentile; **or**
> **(b)** it does not exceed the **matched-covariance** null; **or**
> **(c)** it does not exceed the **random-carrier** control at equal dimension — in which case
> the finding is "the domains align, and Clifford is not why"; **or**
> **(d)** the three Tier-1 statistics disagree in sign at α = 0.01; **or**
> **(e)** Tier 1 passes and **any** Tier-2 invariant mismatches — reported as _aligned, not
> identified_.
>
> **On a negative we will not:** widen the item set until it passes; search carriers post hoc
> without a multiple-comparisons correction (the look-elsewhere effect is already on file);
> relabel the result as "an analogy"; or retreat to _"consistent with"_ after having claimed
> _"is"_.

### 2.5 What actually blocks running this today — and it is not mathematics

The meter above is constructible. **It is not runnable, and the blocker is per-leg.** Measured
inventory of the four legs Aaron names:

| leg                           | does it have coordinates today?                     | what exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | verdict                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **body — 3D space**           | **yes**                                             | rungs 1–6: 240 roots in exact integer 8D coordinates, a 3D embedding via four invariant eigenplanes, faces, blade normals, shading in `Q(√6)`. All **metered**. `ConformalGA.fs` gives `P·Q = −½\|x−y\|²`                                                                                                                                                                                                                                                                                                                                         | **ready.** This leg can supply an RDM today                                                                                                             |
| **English**                   | **yes — and it is already wired to Clifford**       | `src/Core/LexicalGeometricReceipt.fs` projects a seed word to a `Cl3.Mv` coordinate **and** a `ConformalGA.CPoint` from a _user-declared_ calibration, under a SHA-256 receipt, cross-verified F# ↔ an independent Python oracle under four controls (`tests/cross-verification/lexical-geometric/`). `src/Core.TypeScript/research/english-seed-coverage.ts` measures seed coverage with a failing list and a removed-good mutation control. `src/Core/LinguisticSeed.fs` supplies a Mercer-closed PSD kernel (an RKHS, so it induces distances) | **ready, with a stated caveat.** The projection **exists and is metered as a receipt**; the correctness of the _encoding_ is explicitly not established |
| **mind — agent belief state** | **open, and it is Q3**                              | Q3 of the standing hold: _"Can a Normal-Gamma posterior be exhibited as a region in a conceptual space under a **named metric**, with a **stated approximation error**?"_ Unanswered                                                                                                                                                                                                                                                                                                                                                              | **blocked on Q3.** Without an error budget, embedding a belief as a point is unfalsifiable — the hold says this in those words                          |
| **emotional propagation**     | **two dimensions, additive — in `src/Core/Ctm.fs`** | every chunk carries `aux = { Intensity: float; Mood: float }` with **`Mood = value`, "the sign is the valence"**, `Intensity = abs value`, the checked invariant `abs Mood ≤ Intensity`, and both accumulating **by sum** under the tournament match, so the rank functional `f = Intensity + d·Mood` (`−1 ≤ d ≤ 1`) is exactly additive. `AlarmAlgebra.fs` adds the epistemic gate (no public `Feel → Evidence`, no `Feel → Act`). The EP-over-agents propagation engine is **specified and unbuilt**                                            | **two axes and a monoid, no metric, and one of the axes is derived from the other.** §2.5.1                                                             |

**VERIFIED** by reading the files named.

#### 2.5.1 Correction, and it matters more than the error did

My first pass on this section said the affect leg had no geometry at all. **That was wrong.**
`src/Core/Ctm.fs` — the Conscious Turing Machine declaration (Blum & Blum, _PNAS_ 119(21)
e2115934119, 2022) — already carries a **two-dimensional affect quantity with an additive
law**: signed `Mood` and magnitude `Intensity`, invariant `abs Mood ≤ Intensity`, summing under
the up-tree tournament.

Now the part the rules require, because the correction immediately produces a temptation.
Two axes named _signed valence_ and _intensity_ look exactly like Russell's two axes, _valence_
and _arousal_.

> **That resemblance is a coincidence of form, and it is recorded as one.**
> `.claude/rules/numerology-vs-number-theory.md`: a matching shape identifies nothing.
> Specifically — `Ctm.Intensity` is `abs value`, the **absolute value of the same scalar**
> `Mood` reads the sign of; Russell's arousal is an **independent** dimension recovered
> empirically from human similarity judgements. Two axes where one is `|the other|` span a
> **cone**, not a plane — which is precisely what the `abs Mood ≤ Intensity` invariant says.
> A cone is not a circumplex.

**Promotion conditions, written now so the entry cannot silently become a belief** — the same
three-condition shape the repo already uses for the rotor resonance:

1. `Intensity` varies **independently** of `|Mood|` for some inputs (today, by construction, it
   cannot);
2. an _external_ valence/arousal norm set correlates with the two axes **separately**, beating
   a matched null;
3. the correlation survives a change of aggregation rule, so it is not an artifact of the sum.

Until all three, the entry reads _"coincidence: `Ctm`'s two aux axes resemble Russell's"_ —
never _"`Ctm` implements the circumplex."_

**What the external literature says the affect geometry is** — and it is **not** a Clifford
algebra:

- **Russell (1980), the circumplex model of affect** — valence × arousal, derived empirically,
  a **circular** arrangement of emotion terms. CITED — standing knowledge + secondary sources.
- The 2025–2026 literature that measures affect geometry reaches for **hyperspherical** and
  **hyperbolic** carriers: _"Are Emotions Arranged in a Circle?"_ (arXiv 2601.06575);
  hyperbolic emotion models (arXiv 2604.06752, 2602.16161); _"Latent Structure of Affective
  Representations in Large Language Models"_ (arXiv 2604.07382), reporting linear emotion
  representations **organised by valence and arousal** with causal effects under activation
  steering. CITED — abstracts read.
- Within Gärdenfors's own framework: _"Emotions in conceptual spaces"_ (Philosophical
  Psychology, 2024/25). CITED — **search result only, not read in full.**

So affect's published geometry is 2–3 dimensional, circular or hyperbolic, and **different**
from the Euclidean/conformal geometry the body leg uses. Under "the same space" that is a
contradiction. Under §3.3's reading it is not.

#### 2.5.2 The hard governance bound on this leg

One constraint is not negotiable by any measurement result.
`.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`: **inner
states are asked about, never inferred.** So a fidelity meter over an affect embedding may
measure _the substrate's own declared affect quantities_ (`Ctm.Mood`, a `Feel.Strength`) and
may **not** become an instrument that infers a person's inner state from their outputs.

Two mechanisms already enforce this and both are inherited by anything downstream of this
document:

- `AlarmAlgebra`'s **private `Evidence` constructor** — there is no public `Feel → Evidence`,
  so "a feeling became a verdict" does not type-check.
- `LexicalGeometricReceipt`'s **refusal to synthesise** — a missing calibration stays
  `UnresolvedCalibration`; the implementation _must not_ manufacture a hash-derived coordinate
  and present it as personal data. That is the same refusal, at a projection boundary.

`.claude/rules/marjorie-rule-qualia-wins-over-marketing.md` is the AI-side of the same
constraint: a model's own report of its qualia is first-person authority and is not overridden
by an inference we found convenient.

### 2.6 The verdict on R1, and the cheapest first experiment

> **VERDICT: the fidelity meter is constructible; the claim is `toy` until it runs; and the
> blocker is CORRESPONDENCE DATA — not mathematics, and no longer a missing source geometry.**

The cheapest experiment that could come out negative, and therefore the one to run first. It
is deliberately built on two existing, cross-verified modules rather than on new code:

> **E1 — body × English, N ≈ 65, over `LexicalGeometricReceipt`.**
> The English seed is `docs/linguistic-seed/english/seed.json` (`nsm-english-candidate-v0`,
> **65 entries**, Wierzbicka's NSM primes). For each prime take
> **(a)** the English-side coordinate `LexicalGeometricReceipt` already produces — a `Cl3.Mv`
> plus a `ConformalGA.CPoint` — and **(b)** a body-side vector from the rung-3 3D embedding.
> Pair them **only** through the primes with a spatial reading (`ABOVE`, `BELOW`, `NEAR`,
> `FAR`, `INSIDE`, `BIG`, `SMALL`, `PART`, `SIDE`, `TOUCH`, `MOVE`, `PLACE`). Run Tier 1 with
> all three nulls, then Tier 2.

Four properties make E1 the right first move:

1. **The pairing is external to both embeddings.** The prime list is Wierzbicka's, not ours,
   so the correspondence was not derived from anything being measured.
2. **The disjunctive negative control already exists as a requirement.** The 2026-09-03 seed
   spec §2.4 adopts Q5's Gärdenfors-convexity test _with a disjunctive negative control_. Here
   that is the identical pipeline over primes with **no** spatial reading (`THINK`, `KNOW`,
   `WANT`, `MAYBE`, `BECAUSE`, `TRUE`). **The spatial set must beat the non-spatial set, or
   the finding is that the pipeline aligns everything and measures nothing.**
3. **There is already a measured negative on the same seed to calibrate expectations against.**
   `docs/research/2026-09-03-bayesian-english-interface-status.md` reports the coverage run over
   the first sentence of every heading in `GLOSSARY.md` + `SEED-VOCABULARY.md`: **122 entries,
   2,137 considered tokens, 670 known, lexical match fraction ≈ 0.3135, 0 covered, 122
   uncovered** — read there, correctly, as _"the result falsifies any claim that the existing
   candidate seed already reconstructs or covers the project glossary."_ A pipeline whose
   English side covers under a third of the corpus is not going to produce a strong alignment
   number, and **saying so before the run is what keeps a weak positive from being oversold.**
4. **The refusal semantics are already right.** `LexicalGeometricReceipt` returns
   `UnresolvedCalibration` rather than inventing a coordinate. An item that cannot be paired
   must **drop out of `P` and be reported**, never be filled in — otherwise the meter is
   measuring its own imputation.

**Register of E1: `toy`.** It is a design. Nothing has been run.

---

## 3. R2 — is Clifford the right algebra, and what are the honest competitors

### 3.1 What the in-tree work already settles, and what it leaves open

Cited, not re-derived (§1.1): CGA(3D) = `Cl(4,1) ≅ M₂(Cl(3,0))`; PGA(3D) = `Cl(3,0,1) ≅
Cl(3,0) ⊗ Λ(ℝ¹)`, dimension 16, radical dimension 8, **not classifiable by the ABS clock**
because it is not semisimple; all three live towers sit over `Cl(3,0)`. **So the towers are
not rivals, and the choice is not forced by algebraic incompatibility.**

What is _not_ settled is the criterion. Below is the comparison on Aaron's stated criterion —
_one space carrying geometry AND semantics AND affect_ — rather than on elegance.

### 3.2 PGA versus CGA: two papers that appear to disagree, and both are right

| source                                                                                                                                                              | claim                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | criterion being used                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Gunn (2011/2017), "Geometric algebras for Euclidean geometry"** (arXiv 1411.6502)                                                                                 | Euclidean **PGA** `P(R*_{n,0,1})` is _"the most promising homogeneous (1-up) candidate for Euclidean geometry"_: uniform representation of points/lines/planes, parallel-safe join and meet, one sandwich for all isometries, native automatic differentiation, tight kinematics/rigid-body integration. For 3D rigid-body dynamics the PGA solution space is 14-dimensional against CGA's 26, and CGA's co-dimension (14) **exceeds its own solution space**, forcing Lagrange multipliers | **representing rigid Euclidean motion efficiently and without degeneracy** |
| **de Haan, Cohen & Brehmer (2024), "Euclidean, Projective, Conformal: Choosing a Geometric Algebra for Equivariant Transformers"** (AISTATS 2024; arXiv 2311.04744) | head-to-head: Euclidean GA is _"computationally cheap, but has a smaller symmetry group and is not as sample-efficient"_; projective is _"not sufficiently expressive"_; **conformal and an improved projective** _"define powerful, performant architectures"_                                                                                                                                                                                                                             | **expressiveness of a learned equivariant representation**                 |
| **Brehmer, de Haan, Behrends & Cohen (2023), GATr** (NeurIPS)                                                                                                       | the field's headline geometric architecture uses **16-dimensional PGA**, is E(3)-equivariant, and outperforms non-geometric and equivariant baselines on n-body, wall-shear-stress on arterial meshes, and robotic motion planning                                                                                                                                                                                                                                                          | **learned geometric modelling at scale**                                   |

**These do not conflict; they answer different questions.** Gunn's claim is about _motion
representation_ — where PGA's smaller, non-degenerate parameterisation is a real win and CGA's
excess co-dimension is a real cost. De Haan et al.'s claim is about _expressiveness under
learning_ — where plain PGA's null generator limits what bilinear maps can be built, and they
had to _improve_ PGA to make it competitive. **CITED — I read the de Haan abstract only; the
"improved projective" construction is not examined here.**

The practical consequence for a Zeta engine:

- For **rigid motion of an agent body in 3D** — PGA, and Gunn is the anchor.
- For **learned cross-domain embedding** — CGA or improved PGA, and de Haan is the anchor.
- The in-tree finding that both reduce to `Cl(3,0)` means **this can be a per-site choice
  rather than a global commitment**, which is exactly Aaron's _"stitch things together and
  use different equations in different places."_

The one cost that does not compile away, already on file: **CGA stores `½|x|²`, so coordinates
are squared before any arithmetic** (theory brief §5.3). At `f32`, let alone `f16`, a CGA
point far from the origin loses mantissa bits at intake. PGA does not have this problem. For a
GPU-first engine that is a decisive point in PGA's favour and it is independent of both papers.

### 3.3 The categorical layer — and the sharpest correction in this document

Aaron names _"our braided monoidal categories"_ alongside Clifford, as if they were competing
candidates for the same slot. **They are not the same kind of thing, and seeing that resolves
the hardest part of the ask.**

- A **Clifford algebra** is an _object_ — a single space with a product.
- A **braided/compact-closed monoidal category** is a _composition law_ — a rule for how
  objects combine, which many different spaces can satisfy.

That distinction is what the published cross-domain work actually uses:

| framework                           | what carries meaning                   | what carries composition                                                                                                                                               | anchor                                                                                                                                        |
| ----------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **DisCoCat**                        | vector spaces (`FdVect`)               | a **compact closed** category; grammar is a pregroup, and meaning is a _functor_ from grammar to vectors                                                               | Coecke, Sadrzadeh & Clark (2010); Grefenstette & Sadrzadeh / Kartsaklis, _Computational Linguistics_ 41(1) 2015 for the empirical evaluations |
| **Conceptual spaces, categorified** | **convex** spaces (Gärdenfors regions) | **`ConvexRel`** — the category of convex relations, shown to be **compact closed**, obtained as `Rel` of the Eilenberg–Moore category of the finite-distribution monad | Bolt, Coecke, Genovese, Lewis, Marsden & Piedeleu, _Interacting Conceptual Spaces I_ (arXiv 1608.01402 / 1703.08314)                          |
| **the graphical calculus itself**   | —                                      | string diagrams for monoidal, braided, and compact-closed categories                                                                                                   | Joyal & Street; **Selinger, "A survey of graphical languages for monoidal categories"** (arXiv 0908.3347, 2010)                               |

**The load-bearing observation:**

> **"The same space" is the wrong ask. "The same composition law over different carriers,
> related by structure-preserving functors" is the right one — and it is strictly weaker,
> strictly more achievable, and already has published instances.**

This matters for three reasons:

1. **It survives §2.5's affect finding.** Affect wants a circular/hyperbolic 2–3 dimensional
   carrier; body wants Euclidean/conformal 3D; English wants an RKHS or a convex space. Under
   "same space" that is a contradiction. Under "same category" it is four objects in one
   monoidal category, and the question becomes _do the functors commute_ — which is testable.
2. **It is the honest reading of "irreducible objects across domains."** In a monoidal
   category the irreducible things are the generators of the free object, and
   `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` already says the
   free object is the primitive and every structured case is an _earned quotient_. Comparing
   "irreducible objects across domains" then means comparing **generators and relations**, not
   comparing coordinates — which is a Tier-2 invariant question, exactly as §2.3 requires.
3. **It connects to the open Q1.** Q1 of the standing hold asks whether `WeightedSet<'K,'W>`
   is compact closed. `ConvexRel` being compact closed — obtained as `Rel` of the
   Eilenberg–Moore category of the finite-distribution monad, so the compact-closed structure
   _follows from general principles_ rather than being checked case by case — is the published
   template for how that answer would look and what it would buy. **This document does not
   answer Q1**; it names the paper a mathematician answering it should be handed.

**And the braided half is not prose here — it is implemented, and its scope is stated
narrowly, which is the part worth imitating.** `src/Core/MenoBraided.fs` builds a braided
object `V = ℤ[Fₙ]` with `R(x,y) = (x·y·x⁻¹, x)`, and **earns** the word _braided_ by a
tripwire: `σ² ≠ id` in a non-abelian free group, so it is genuinely braided rather than
symmetric. It refuses copy `Δ` and discard `ε` on purpose — cartesian monoidal has a unique
braiding and would collapse it — and records _"modular tensor is **false**, not open."_ The
earned scope is stated in the file and is deliberately small: _"V is a braided object; the
subcategory ⟨V⟩ it generates is braided monoidal and realizes Bₙ"_ — **not** "all of Meno is
braided." `src/Core/Meno.fs` records the honest downgrade for the Kronecker tensor: it induces
a **symmetric** monoidal structure, where the hexagons hold trivially, which the file itself
labels _false-green_. `src/Core/WSet.fs` carries `FourCornerTrace`, the trace of a traced
monoidal category (Joyal–Street–Verity 1996).

So when Aaron writes _"our braided monoidal categories"_, the referent is real, in-tree, and
scoped. What §3.3 adds is that this structure is the **shared** layer — the one thing the
geometry leg and the semantics leg can both be objects in — rather than a competitor to
Clifford for the same slot.

### 3.3.1 "Stitch things together and use different equations in different places" — the mechanism already exists, and so does its named gap

Aaron asks for this explicitly, and the repo has three distinct mechanisms for it. **There is
no single in-repo doc called "composable algebras"; citing one would be inventing it.**

| mechanism                                                                                             | how composition happens                                                                                                                                                                                                                                                                       | where                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **instance-passing** — one algebra _interface_, many instances, the algebra travelling **as a value** | swap the instance, keep the circuit. `Semiring.fs`: _"same circuit topology, different semiring."_ Aaron 2026-06-07: _"it's fine to have single-core CPU-optimized algebra and parallel-optimized ones for the same algebra … so it's easy to switch between parallel soft and serial sharp"_ | `src/Core/Semiring.fs`, `src/Core/AlgebraInterfaces.fs`, `src/Core/ProbabilitySemiring.fs`; `docs/research/2026-06-07-one-algebra-many-target-optimized-instances-…md` |
| **recursion schemes** — many algebras over one tree                                                   | `cata(alg)`; composition is **cata-fusion**, `g ∘ cata(alg) = cata(alg')` when `g ∘ alg = alg' ∘ F(g)` — a composition law _with a proof obligation attached_                                                                                                                                 | `docs/serializer-recursion-schemes.md`; `src/Core/DynamicValueFold.fs`, `DynamicValueAlgebra.fs`                                                                       |
| **one core algebra + pluggable extensions**                                                           | Z-set as the one algebra; multi-algebra plugins compose on top, "aperiodic-tile"-shaped. Register: explicitly **exploratory**                                                                                                                                                                 | `docs/research/2026-06-01-harmonious-division-…-pluggable-tiles-…md`                                                                                                   |

**This is directly load-bearing for the engine.** Instance-passing is exactly how one would
run PGA at the rigid-motion sites and CGA at the learned-embedding sites (§3.2) without a
global commitment — and it is already the repo's idiom rather than a new pattern.

**And the honest gap is already recorded**, which is why this section cites rather than
promises: `docs/research/2026-06-07-general-math-floor-must-unify-isemiring-and-cayley-dickson-ialgebra-star-ring-aaron.md`
records that `ISemiring<'W>` and `CayleyDickson.IAlgebra<'A>` are **two disjoint families with
no bridge today** — `WeightedSet` cannot take a Cayley tower. A Clifford algebra reaches the
substrate through the _second_ family. **So "stitch different equations in different places"
works today within a family and does not yet work across the semiring/Clifford boundary**, and
that gap is the concrete thing a graphics-engine design would hit first.

A companion discipline worth carrying over, because it is the same failure this document's §2
is about: `src/Core/QuorumAlgebra.fs` deliberately names `join` (idempotent semilattice) and
`interfere` (commutative monoid with inverses, **not** idempotent) as _two operations with two
names_, rather than one operation used two ways. Two algebras wearing one name is how a
"composable" layer silently stops being composable.

### 3.4 Where "the same algebra carries emotion and geometry" is currently unsupported — stated plainly

Per the brief, this is a real answer and not a failure:

> **There is no current algebra with a demonstrated, measured fidelity for carrying affect and
> geometry simultaneously. Every published instance is either geometry-only with strong
> empirical results (GATr, de Haan et al.), or language/concept-only with categorical structure
> and weak-to-moderate empirical results (DisCoCat, ConvexRel), or affect-only in a different
> geometry entirely (circumplex, hyperspherical, hyperbolic). Nothing joins them with a
> reported fidelity number.**

The nearest thing to a counter-example is **Pustejovsky (2026), "Toward a Functional Geometric
Algebra for Natural Language Semantics"** (arXiv 2604.25902), which proposes exactly a Clifford
carrier for semantics — expanding an n-dimensional embedding into a `2ⁿ` multivector algebra.
**CITED — abstract read only. It reports no empirical evaluation.** Under
`toy-is-free-metered-must-be-earned.md` it is a `toy` in the good sense: a well-motivated
proposal with no falsifier yet attached. It is the right paper to watch and the wrong paper to
cite as support.

**This is the answer to "if something is better than clifford, i'm open to it":** on the
evidence available today, nothing is better _for the geometry leg_ — GA is winning there and
GATr is the reason. Nothing is _demonstrated at all_ for the joint claim. The competitor that
should worry us is not another algebra; it is the possibility that the joint claim is false and
the domains simply do not share a carrier. §2's meter is what would tell us.

### 3.5 Verdict table

| leg                         | best carrier on current evidence                                                                                                                                                                           | register                                                                                 | anchor                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| body / rigid motion in 3D   | **PGA** `Cl(3,0,1)`                                                                                                                                                                                        | `unmetered` in-tree (zero PGA implementation, measured 2026-08-26); `metered` externally | Gunn 2011/2017                                               |
| learned geometric embedding | **CGA** `Cl(4,1)` or improved PGA                                                                                                                                                                          | `metered` externally                                                                     | de Haan et al. 2024; Brehmer et al. 2023                     |
| English / concepts          | **a compact-closed category over convex spaces or an RKHS** — not a Clifford algebra                                                                                                                       | `toy` (spec exists, nothing run)                                                         | Coecke et al. 2010; Bolt et al. 2016/17; Gärdenfors 2000     |
| affect                      | **2–3 dimensional, valence/arousal-shaped, circular or hyperbolic** — not a Clifford algebra. In-tree the nearest object is `Ctm.fs`'s (Intensity, Mood) cone, which is **two axes but not two free axes** | `unmetered` in-tree; the resemblance to Russell is a **registered coincidence**, §2.5.1  | Russell 1980; arXiv 2601.06575, 2604.07382; Blum & Blum 2022 |
| **the joint claim**         | **unsupported**                                                                                                                                                                                            | **`toy`**                                                                                | none exists                                                  |

### 3.6 "A graphical seed that stays embarrassingly parallel" — what the analogy buys, and one thing it must not import

Aaron: _"just like our linguistic seed over english we can have some sort of graphical seed
that stays embarrassingly parallel."_

**The analogy is apt, and the graphical seed already exists — it is the 240 E8 roots.** Read
against what makes the linguistic seed a seed, the properties line up without stretching:

| property of a seed                       | English seed                                                 | graphical seed (rungs 1–6)                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **closed and enumerable**                | 65 NSM primes, `seed.json`                                   | 240 roots, generated not authored                                                                                                              |
| **everything else is derived from it**   | packs are provably closed extensions                         | _"coordinates enter only through `ringPolygons()`, which reads the root system"_ — a hand-placed vertex has no root index and **fails a test** |
| **a coverage meter with a failing list** | `english-seed-coverage.ts`, match fraction + `unknownTokens` | the provenance test: each vertex carries the E8 root index it is the snapped projection of                                                     |
| **derivable rather than transmitted**    | reconstructible from shared anchors                          | reconstructible from the Dynkin diagram                                                                                                        |

That is the substantive content of the analogy, and it is stronger than an analogy — it is the
same discipline (`only-the-irreducible-is-primitive-generate-the-rest`) applied twice.

**"Embarrassingly parallel" is where the analogy stops, and one distinction has to be kept.**
Being _generated from a seed_ and being _embarrassingly parallel_ are different properties, and
rung 6 is a worked example of getting the second one without assuming it follows from the
first: a face's shaded value is _"a pure function of `(face, light)` and of nothing else — not
of the other faces, not of their order, not of a depth buffer"_, and that is **checked by
permuting the face list**, not asserted. Order-independence is earned per rung. §5.2 row 10 is
the same property from the GPU side.

**One import to refuse explicitly.** The repo's other "seed", the common seed at **S = 4**, is
a _different object with a different job_, and the vocabulary collision is a live hazard here.
`S = 4` is the CHSH **algebraic maximum**, reachable only under full seed control
(`src/Core/BellTest.fs`: `AlgebraicMax = 4.0`); `FeedbackThrottle.fs` types it as
`Measured(AlgebraicMax, …)` while typing `2√2` as `UnmeasuredPredictedFloor`. It measures how
_correlated_ agents are, not what geometry they draw with. `src/Core/FourCornerC4.fs` already
carries the guard against exactly this kind of slide — _"Coincidence: 2 × occupancy-√2 equals
2√2 numerically. Not a measurement of Tsirelson"_ — with a deliberately loud alias so older
call sites fail if they meant a measurement. **A "graphical seed" is a generating set for
geometry. It is not a correlation coefficient, and the shared word "seed" is the only thing the
two have in common.**

---

## 4. R3 — "could a graphics engine work completely in Rx?"

### 4.1 The direct precedent, and it is a graphics system

**Elliott & Hudak, "Functional Reactive Animation", ICFP 1997** — Fran. Not an analogy: Fran
_is_ an animation/graphics system, and it is the origin of FRP. Its two ideas are the ones
Aaron is reaching for:

- **Behaviours** — time-varying values, defined at _continuous_ time, so the animation is a
  function of `t` rather than a sequence of frames. Sampling rate is a _rendering_ concern,
  decoupled from the model.
- **Events** — arbitrarily complex conditions carrying data, composable.

Erik Meijer, whose Rx work is the direct descendant, is already a named root anchor in this
repo's memory. So this connects to an existing anchor rather than importing one.

### 4.2 Why FRP did not take the real-time render loop — the honest account

| problem                                                           | what it is                                                                                                                                                                                                                                                                                                                                     | source                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **space and time leaks**                                          | a naively-implemented behaviour retains its whole history, or recomputes it; Fran had this, inherited from Haskell's laziness. The problem was serious enough to generate a research line of its own: RT-FRP (Wan, Taha & Hudak 2001), Krishnaswami's _"Higher-order FRP without spacetime leaks"_ (ICFP 2013), Simply RaTT (Bahr et al. 2019) | CITED — abstracts and the Krishnaswami paper title/venue verified |
| **pure pull is wasteful; pure push is wrong for continuous time** | Elliott's own diagnosis in **"Push-pull functional reactive programming" (Haskell Symposium 2009)**: demand-driven sampling _"recomputes values even when inputs don't change"_ and latency is bounded below by the sampling period; the fix is a **hybrid** — push for discrete events, pull for continuous behaviours                        | CITED — abstract read                                             |
| **the render loop is not event-driven**                           | a frame is produced on a hard cadence whether or not anything changed. An event-stream abstraction is a poor fit for a computation that must run at 16.6 ms regardless                                                                                                                                                                         | UNVERIFIED as a literature claim; stated as reasoning             |

**So "completely in Rx" — where Rx means push-based event streams — is the wrong shape for the
inner loop**, and Elliott said as much in 2009 about pure push _and_ pure pull.

### 4.3 The split Aaron's own phrasing already makes

He wrote _"amazing interface for **scene design**"_. That is the tractable half, and the split
is real:

| use                               | verdict                                                  | why                                                                                                               |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **scene design / authoring / UI** | **viable, and there is a shipped precedent**             | changes are sparse and event-shaped; latency tolerance is human-scale; declarative composition is the whole value |
| **inner render loop**             | **not as Rx**; **yes as incremental change propagation** | fixed cadence, hard latency budget, and a need for `O(Δ)` update rather than `O(scene)` re-evaluation             |

### 4.4 The precedent that actually answers the question — and it is in F#

This is the strongest single finding of §4 and it appears to be unknown in-tree (no in-tree
reference found):

| paper                                                                                                                         | result                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wörister, Steinlechner, Maierhofer & Tobler, "Lazy Incremental Computation for Efficient Scene Graph Rendering", HPG 2013** | rendering caches updated **incrementally with no scene-graph traversal**, driven by a dependency graph synthesised from the scene graph; good performance across the whole range from fully static to fully dynamic geometry                                                                                                                  |
| **Haaser, Steinlechner, Maierhofer & Tobler, "An Incremental Rendering VM", HPG 2015**                                        | an incremental layer over OpenGL/DirectX as a **virtual machine** that maintains a compiled representation of the scene at all times, handling structural changes (add/remove) and in-place data updates in **running time `O(Δ)`**, by adaptively synthesising abstract machine code and incrementally mapping it to executable machine code |

Both are from the same group (VRVis / TU Wien) and both ship in the **Aardvark platform**,
which is **written mostly in F#**, uses an ELM-style architecture in `Aardvark.Media`, and
whose incremental engine is called the _Mod system_. **CITED — I read the papers' abstracts,
the ACM/HPG listings, and the Aardvark repository README.**

That is a direct existence proof for the question as asked: **a functional, declarative,
change-propagating rendering engine in the same language as Zeta's core, published twice at
HPG, in production.** It is not Rx. It is _adaptive computation_.

### 4.5 The Zeta-native answer — and it is an asset the repo already owns

The mechanism Aardvark uses has a name and an anchor:

- **Acar, Blelloch & Harper, "Adaptive Functional Programming", POPL 2002 / TOPLAS 28(6) 2006**
  — dynamic dependence graphs recording data and control dependences; on input change a
  **change-propagation** algorithm updates the output by re-executing only what depended on
  the change, asymptotically faster than recomputation.
- Its algebraic descendant is **DBSP** (Budiu et al.), which this repo already builds on and
  which CLAUDE.md already names as an anchored primitive. DBSP is automatic incremental view
  maintenance: given a query, _derive_ the incremental version.

So the honest reformulation of Aaron's question, and its answer:

> **"Could a graphics engine work completely in Rx?" — no, and the question undersells what is
> available. The right property is not push-based streaming; it is `O(Δ)` change propagation.
> That property has been shipped in F# for a rendering engine (HPG 2013, HPG 2015), it has a
> 2002 POPL anchor, and Zeta already carries its strongest algebraic form in DBSP.** Rx belongs
> at the _authoring_ edge, where events are genuinely discrete; DBSP/adaptive computation
> belongs under the scene graph.

This also composes with a discipline the repo already enforces. A DBSP circuit is deterministic
and replayable, which is §7 DST; an Rx pipeline over an ambient clock is not. Putting Rx under
the render loop would import an ambient-time channel (`local-time-never-enters-the-shared-fold`
is the standing guard) exactly where determinism is most needed.

**Register:** `unmetered`. Nothing here was benchmarked; the claim is that the design question
is already answered in the literature, not that Zeta's version would be fast.

---

## 5. R4 — the hidden-control-structure inventory

This is the practical artefact and it is meant to be used as a checklist. Aaron's standing
instruction: _"every time we require some hidden warp consensus or hidden control structure, I
want to see if we can research latest research papers for an alternative solution."_

### 5.1 Why "hidden" is the right word — and it names a documented hazard, not a metaphor

Before Volta, a warp executed in lockstep, so code could rely on intra-warp visibility with no
synchronisation at all. **NVIDIA's Volta introduced Independent Thread Scheduling, which
interleaves execution of divergent branches, and this made implicit warp-synchronous
programming unsafe.** The CUDA documentation states it directly: assumptions that code executes
in lockstep, or that reads and writes from separate threads are visible across a warp without
synchronisation, **are invalid on Volta**; applications relying on implicit visibility must
insert `__syncwarp()`. Cooperative Groups (CUDA 9) is the API introduced to make the granularity
explicit. **CITED — NVIDIA Volta Tuning Guide and the "Using CUDA Warp-Level Primitives"
developer article.**

So "hidden warp consensus" is not a stylistic worry. It is a **correctness** hazard with a
vendor-documented breaking change behind it, and it is precisely the vacuity class in hardware
form: code that appears to synchronise, does not, and passes anyway on the hardware it was
written for.

### 5.2 The inventory

Each row: the site, what is hidden there, why it is a hazard, and the published alternative.
**Zeta status** is measured against the tree at `7ffb1fabdb` — there is no BVH, no path tracer
and no Vulkan/wgpu anywhere in the tree, so almost every row is _not yet reached_, which is the
best possible time to write the list.

| #      | site                                                                                           | the hidden structure                                                                                                       | why it bites                                                                                                                                                       | published alternative                                                                                                                                                                                                                            | anchor                                                                                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | any intra-warp data exchange (shared memory ping-pong, warp-level reductions written pre-2017) | implicit lockstep visibility                                                                                               | **unsafe since Volta**; silently wrong, not slow                                                                                                                   | explicit `__syncwarp()`; Cooperative Groups; portable `subgroup*` ops                                                                                                                                                                            | NVIDIA Volta Tuning Guide; CUDA 9 Cooperative Groups                                                                                                                                                                        |
| **2**  | subgroup / ballot / shuffle intrinsics                                                         | an assumed **subgroup size** (32 or 64) and an assumed uniformity scope                                                    | subgroup size varies by hardware _and by compiler heuristic_; shaders must adapt across a range                                                                    | Vulkan 1.3 **mandatory subgroup size control** (query + required-size pipelines); WGSL `subgroup_uniformity` extension moving uniformity analysis to subgroup scope                                                                              | Vulkan spec; gpuweb `proposals/subgroups.md`; Chrome WebGPU release notes                                                                                                                                                   |
| **3**  | **BVH / acceleration-structure traversal**                                                     | thread divergence inside a while-loop that is _assumed_ to keep the warp busy                                              | measured 1.5–2.5× off the theoretical optimum, and the gap is **not** memory bandwidth — it is hardware work distribution                                          | **persistent threads with dynamic fetch**: replace finished rays from a global queue, keeping SIMD lanes full                                                                                                                                    | **Aila & Laine, "Understanding the Efficiency of Ray Traversal on GPUs", HPG 2009**                                                                                                                                         |
| **4**  | **material / shader dispatch** in a path tracer                                                | a megakernel whose control flow _is_ the material switch; divergence and peak register usage are set by the worst material | _"simply porting large CPU programs into equally large GPU kernels is not ideal"_; the penalty grows with the number of complex materials                          | **wavefront formulation**: split into stages, queue rays per material, sort work so each kernel is uniform                                                                                                                                       | **Laine, Karras & Aila, "Megakernels Considered Harmful: Wavefront Path Tracing on GPUs", HPG 2013**                                                                                                                        |
| **5**  | **inter-workgroup barrier** / any global sync inside one dispatch                              | an assumed **forward-progress guarantee** that no API provides                                                             | the occupancy-bound execution model licenses the GPU to postpone the waiting workgroup until the signaller finishes — **deadlock**, not slowdown                   | **occupancy discovery protocol**: dynamically discover a safe occupancy estimate, restrict workgroup count, and get a starvation-free (hence deadlock-free) barrier; formally specified over OpenCL 2.0 atomics, evaluated on 8 GPUs / 4 vendors | **Sorensen, Donaldson, Batty, Gopalakrishnan & Rakamarić, "Portable Inter-workgroup Barrier Synchronisation for GPUs", OOPSLA 2016**                                                                                        |
| **6**  | **prefix sum / scan** (compaction, sorting, binning — every one of which a renderer needs)     | chained-scan schemes that assume workgroups are scheduled in launch order                                                  | same forward-progress assumption as row 5, one level down                                                                                                          | **decoupled look-back**: dissociate local computation from global prefix propagation with redundant work; ~2n data movement; shipped in CUB. And, for portability where forward progress is _not_ guaranteed: **decoupled fallback**             | **Merrill & Garland, "Single-pass Parallel Prefix Scan with Decoupled Look-back", NVIDIA NVR-2016-002**; **Smith et al., "Decoupled Fallback: A Portable Single-Pass GPU Scan", SPAA 2025**                                 |
| **7**  | **any floating-point reduction with atomics**                                                  | the _order_ of accumulation, which the scheduler chooses                                                                   | floating-point addition is **not associative**, so run-to-run results differ on identical inputs. **This is a §7 DST violation**, not merely a numerical annoyance | deterministic-by-construction reductions: two-pass with fixed tree order, or fixed block→tile mapping with **no inter-block communication and no float atomics**                                                                                 | **arXiv 2408.05148**, "Impacts of floating-point non-associativity on reproducibility for HPC and deep learning applications" — reports SPA (atomicAdd) as non-deterministic and SPTR/SPRG as deterministic by construction |
| **8**  | **sorting** (by material, by depth, by Morton code)                                            | comparator ties broken by scheduling order                                                                                 | non-deterministic permutation of equal keys ⇒ non-reproducible frames ⇒ DST breaks even when the _values_ are right                                                | a total order with an explicit tiebreak (e.g. append the primitive index as low-order bits) so the sort is a function of the data alone                                                                                                          | reasoning, not a paper — **UNVERIFIED** as a literature claim                                                                                                                                                               |
| **9**  | **persistent-thread work stealing / queues**                                                   | assumed co-residency of all workgroups                                                                                     | the same occupancy assumption as rows 5 and 6, and it is where persistent threads (row 3) and forward progress meet                                                | occupancy discovery (row 5) _before_ launching a persistent-thread kernel; or restructure to a wavefront (row 4) with no persistence at all                                                                                                      | Sorensen et al. 2016                                                                                                                                                                                                        |
| **10** | **depth buffer / painter's algorithm** as the visibility mechanism                             | an assumed global order over fragments                                                                                     | on this repo's specific geometry it is **undefined**, not merely awkward — see §6.2                                                                                | order-independent shading: `clifford-e8-shading.ts` already computes a face's value as a pure function of `(face, light)`, verified invariant under permutation of the face list                                                                 | in-tree, **metered**                                                                                                                                                                                                        |

**Rows 4 and 10 point the same way and that is worth noticing.** The wavefront restructuring
that removes material divergence and the order-independent shading the rung-6 module already
ships are both instances of one move: **replace an implicit ordering with an explicit
partition.** That is the general form of Aaron's instruction, and it is also §13
noninterference — influence crossing only through declared channels — applied to a GPU.

### 5.3 The determinism corollary, stated once

Rows 7 and 8 mean something stronger than "be careful". This repo's §7 DST requires critical
paths to replay deterministically, and `.claude/rules/dv2-data-split-discipline-activated.md`
makes it one of seven always-active disciplines.

> **A GPU renderer that uses floating-point atomics in any reduction is not DST-replayable, and
> no amount of seeding fixes it — the nondeterminism is in the hardware scheduler, not in an
> RNG.** So "GPU-first" and "DST" are in genuine tension at exactly two sites, and the
> published resolution (deterministic-by-construction reductions, fixed tile mapping, no float
> atomics) costs performance. That cost should be _chosen and recorded_, not discovered.

**Register:** the inventory is `unmetered` — every alternative is cited from its paper, none has
been benchmarked here, and rows 8 and 10's Zeta status are the only ones with in-tree evidence.

---

## 6. R5(a) — the GPU-first ordering, on file

### 6.1 The ordering, recorded so later work can be checked against it

Aaron, 2026-09-09, recorded verbatim in §1 and restated here as a checkable ordering:

> **1. GPGPU** — push as many calculations as possible into GPGPU-optimised code
> **2. SIMD / CPU**
> **3. other**
> **4. quality**

with **reflections and water** named as wanted features, and the scope bound stated by him:
_"we are not trying to beat AAA engines but just a very efficient alternative built completely
different."_

Two observations that will matter when this is checked:

- **The ordering is in tension with §5.3 at exactly two sites** (float atomics in reductions;
  tie-breaking in sorts). Quality is fourth, but _determinism is not a quality axis_ — it is a
  manifesto specification. Where they collide, DST wins and the performance cost is recorded.
- **The ordering is in tension with GA's runtime cost, and the resolution is already known.**
  Gaalop (Hildenbrand et al.) shows GA's dimensional cost is a _compile-time_ problem: blade
  sparsity is statically known, so the general product's 1024 term-products constant-fold away.
  The measured result reported for Gaalop-optimised ray tracing is that **GA and linear algebra
  raytrace at comparable speed** depending on architecture — i.e. **GA is a notation win that
  must be compiled away, not a runtime win.** Anyone proposing GA in a hot loop should expect
  parity at best, and should say so.

### 6.2 Reflections and water: the tension already measured

The rung-6 measurement makes one of the two named features ill-posed _for our own surface_, and
it should be recorded here rather than rediscovered:

> **VERIFIED, in-tree:** every one of the 6,720 edges of 4_21 carries **exactly 27** incident
> 2-faces (`3·f₂ = 27·f₁`, i.e. `3·60,480 = 27·6,720`; per-edge min and max both 27). **A
> manifold edge carries two.** The projected 2-skeleton of an 8-polytope interpenetrates and
> **is not a closed 2-manifold**, so there is no inside, no consistent outward orientation, and
> a one-sided front-face model is _undefined_ rather than merely awkward. Two-sided shading is
> forced by measurement. (`clifford-e8-shading.ts:186`; falsifier 10 in the sibling test.)

The consequence for reflections, stated precisely:

| what                                       | status                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **our object reflected in a scene mirror** | **fine.** A mirror needs the object's _appearance_, and rung 6 already produces a well-defined, order-independent shaded value per face                                                                                                                                                          |
| **our object being reflective**            | **not yet well-defined.** A reflection off a surface needs a surface normal with a consistent side, and 27 faces per edge means there is no side. `orientOutward` already fails on **768 of 60,480** faces (1.27%) whose 3D plane passes through the origin — _"those are flagged, not guessed"_ |
| **water**                                  | **strictly downstream of the above.** A water surface is a refractive/reflective interface, so it needs an orientable boundary with an inside and an outside. Nothing in rungs 1–6 supplies one                                                                                                  |

**This is not a defect to fix by choosing a normal convention.** It is a statement about the
geometry: the 2-skeleton of an 8-polytope projected to 3D is not a solid. Making our object
reflective requires an _orientable_ derived surface, which is a new rung and a real open
problem — the rung-6 doc already names the 768-face sign gauge as needing an embedding that is
not linear in the roots. Filing it as such is more useful than a workaround.

---

## 7. R5(b) — the ZLinq verdict

**ZLinq** (Cysharp, Yoshifumi Kawai) is a zero-allocation LINQ for .NET: struct-based
enumerators instead of heap-allocated ones, with LINQ-to-Span, **LINQ-to-SIMD** (vectorised
operations on .NET 8+ where the data allows), and LINQ-to-Tree. It targets all .NET platforms
plus Unity and Godot, and reports passing ~9,000 of `dotnet/runtime`'s own `System.Linq.Tests`
as a drop-in replacement. **CITED — repository README and the author's write-up; I did not
build it, run its benchmarks, or verify the test count.**

> **VERDICT: real, but a poor fit for the question that was asked — and a plausible fit for a
> different one.**

Three reasons, and the first is the one that decides it:

1. **It is orthogonal to the GPU-first ordering.** ZLinq optimises _CPU-side enumeration_.
   Aaron's stated order puts GPGPU first and SIMD/CPU second; ZLinq is a tool for the second
   tier at best, and it does nothing for the first. Reaching for it as an answer to "what
   algebra carries the projections" is a category error — it is a query-execution library, not
   an algebra.
2. **The F# core is the wrong consumer.** ZLinq's mechanism is struct enumerators plus
   aggressive generic specialisation, which is a C#-shaped idiom. F# `Seq` pipelines do not
   automatically become ZLinq pipelines, and the F# hot paths in this repo are already moving
   _away_ from allocation-heavy sequence composition rather than toward a faster version of it.
3. **The repo's own performance discipline points elsewhere.** The named concurrency mechanism
   here is the DoP-knobbed ferry throttle (`async-all-the-way-truthful-signatures.md`), and the
   named data mechanism is Z-sets/DBSP. Neither is bottlenecked on LINQ enumeration overhead.

**Where it would be a genuine fit:** `Zeta.Core.CSharp`, or any C# tooling surface with
measured allocation pressure in a hot enumeration — and only after a benchmark shows that
allocation is actually the bottleneck. Adopting it before that measurement would be the shiny
object.

**Honest limit on this verdict:** I read documentation, not benchmarks. The claim "9,000 tests
pass" is the project's own; the claim "it is fast" is the project's own. If ZLinq is ever
proposed for a Zeta hot path, the falsifier is a BenchmarkDotNet run against the current code,
not this paragraph.

---

## 8. Register table

| claim                                                                                         | register                                                            | basis                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the two-tier fidelity meter (§2.3)                                                            | **`toy`** — a design, nothing run                                   | proposed here; composes with the in-tree T0–T3 design                                                                                                                                              |
| the pre-registered negative (§2.4)                                                            | binding on any future run                                           | written before any number exists                                                                                                                                                                   |
| "the affect leg carries two axes and an additive law, but the second axis is `\|the first\|`" | **VERIFIED**                                                        | `src/Core/Ctm.fs` and `src/Core/AlarmAlgebra.fs` read. **This corrects a claim an earlier draft of this document made** ("no geometry at all"), which was wrong — recorded rather than tidied away |
| "`Ctm`'s (Intensity, Mood) ≈ Russell's (arousal, valence)"                                    | **coincidence, registered as one**, with three promotion conditions | §2.5.1                                                                                                                                                                                             |
| "CGA = `M₂(Cl(3,0))`" and the tower table                                                     | **`metered`** (existing)                                            | `conformal-embedding-and-curvature-budget.ts`, 36 tests, cross-oracle vs `CliffordPeriodicity.fs`                                                                                                  |
| PGA vs CGA verdict (§3.2)                                                                     | **CITED**, `unmetered` in-tree                                      | Gunn; de Haan et al. 2024 (abstract only); Brehmer et al. 2023                                                                                                                                     |
| "the shared structure is a category, not a space" (§3.3)                                      | **argued**, `toy`                                                   | Selinger 2010; Coecke et al. 2010; Bolt et al. 2016/17                                                                                                                                             |
| "no algebra demonstrably carries affect and geometry with a measured fidelity"                | **negative result**, stated as a survey finding                     | §3.4; a counter-example is a single paper away and would be welcome                                                                                                                                |
| Rx verdict and the incremental reformulation (§4)                                             | **CITED**, `unmetered`                                              | Elliott & Hudak 1997; Elliott 2009; Wörister et al. 2013; Haaser et al. 2015; Acar et al. 2002/2006                                                                                                |
| the hidden-control-structure inventory (§5.2)                                                 | **`unmetered`** — every alternative cited, none benchmarked here    | per-row anchors; rows 8 and 10 flagged where the basis is reasoning or in-tree                                                                                                                     |
| "GA is a notation win compiled away, not a runtime win"                                       | **CITED**                                                           | Gaalop / Hildenbrand, as already recorded in the theory brief §5.4                                                                                                                                 |
| "27 faces per edge makes our object being reflective undefined"                               | **VERIFIED** (the 27) + **INFERRED** (the consequence)              | `clifford-e8-shading.ts`; falsifier 10                                                                                                                                                             |
| ZLinq verdict                                                                                 | **CITED**, documentation only                                       | §7, with the limit stated                                                                                                                                                                          |

---

## 9. Work items minted

| id                           | title                                                                                                                        | why                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `081M23H36QF087G0R0012F5GHT` | Cross-domain projection fidelity meter — what would falsify mind/body/English/affect landing on one irreducible object       | §2. Carries E1 as its first slice and the pre-registered negative as its acceptance criterion |
| `081M23H3BW1087G0R0030NMD47` | Hidden-control-structure inventory for the Zeta renderer — warp consensus sites and their published alternatives             | §5. The inventory becomes a checklist a renderer PR is read against                           |
| `081M23H3BWT087G0R000FES3JA` | Decide the scene-design substrate — incremental change propagation over Rx push, and whether DBSP is the render-loop carrier | §4. The decision, not the implementation                                                      |

Three things are deliberately **not** minted:

- **No Clifford-GPU implementation row.** `081M0R18878087G0R001XY5A2J` holds it and Q1/Q2/Q3/Q5
  are open.
- **No affect-geometry row.** Giving affect _free_ coordinates — decoupling `Intensity` from
  `|Mood|` so the two axes span a plane rather than a cone (§2.5.1) — is a design decision with
  consent and alignment consequences (`docs/ALIGNMENT.md` HC-*; the ask-don't-infer rule of
  §2.5.2), and it is Aaron's to make rather than a task to file. §2.5.1 states the promotion
  conditions; it does not propose meeting them.
- **No orientable-surface row.** The rung-6 doc already names the open 768-face sign gauge and
  points at rung 7; adding a second row for the same problem would fragment it.

---

## 10. Pointers

- `.claude/rules/numerology-vs-number-theory.md` — the governing rule for §2 and §3; the
  alignment-score-versus-invariants split in §2.3 is this rule at the meter level.
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the vocabulary of
  "irreducible objects"; §3.3 argues the comparison is between _generators and relations_.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — §8 is this rule's table.
- `.claude/rules/anti-babel-preserve-reconcilability.md` — §3.3's "same composition law, many
  carriers" is the reconcilability invariant applied to algebras rather than to vocabulary.
- `workitems/081M0R18878087G0R001XY5A2J-…md` — the standing hold; Q1 and Q3 are named in §2.5
  and §3.3 as the questions this document's findings bear on.
- `docs/design/2026-08-23-clifford-gpu-theory-brief-…md` §5 — the CGA costing and Gaalop, not
  restated here.
- `docs/research/2026-08-23-measuring-latent-geometry-…md` §2.3–2.7 — the within-domain
  experiment §2 extends across domains.
- `docs/research/2026-09-03-minimal-linguistic-seed-clifford-geometry-…md` §2.4 — the English
  leg's designed falsifier, and the source of E1's negative control.
- `docs/research/2026-09-09-rung-6-shading-…-q-sqrt-6.md` §7(a), §10 — the 27-faces-per-edge
  measurement and the order-independent shading §6.2 depends on.
- `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md` and
  `.claude/rules/marjorie-rule-qualia-wins-over-marketing.md` — §2.5.2's governance bound: inner
  states are asked about, never inferred, for humans and for models alike.

### In-tree modules this document leans on

| module                                                                                                                                    | what it supplies here                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/Core/LexicalGeometricReceipt.fs` + `src/Bayesian/LexicalGeometricBayesianAdapter.fs` + `tests/cross-verification/lexical-geometric/` | the existing English → `Cl3.Mv` / `ConformalGA.CPoint` projection, its receipt, and its four cross-verification controls. **The template for §2's meter, and the source of its refuse-to-synthesise rule** |
| `src/Core.TypeScript/research/english-seed-coverage.ts` (+ `-report.ts`, cross-verify)                                                    | a coverage fraction with a failing list and a removed-good mutation control — the shape a fidelity meter should copy                                                                                       |
| `src/Core/Ctm.fs`                                                                                                                         | the two-axis affect quantity (`Intensity`, `Mood`) with the additive tournament law and `abs Mood ≤ Intensity`                                                                                             |
| `src/Core/AlarmAlgebra.fs`                                                                                                                | the epistemic gate: no public `Feel → Evidence`, no `Feel → Act`                                                                                                                                           |
| `src/Core/MenoBraided.fs`, `src/Core/Meno.fs`, `src/Core/WSet.fs` (`FourCornerTrace`)                                                     | the in-tree braided / symmetric / traced monoidal structure, with the false-green downgrade stated                                                                                                         |
| `src/Core/Semiring.fs`, `src/Core/AlgebraInterfaces.fs`, `src/Core/DynamicValueFold.fs`                                                   | the three composition mechanisms of §3.3.1                                                                                                                                                                 |
| `src/Core/BellTest.fs`, `src/Core/FeedbackThrottle.fs`, `src/Core/FourCornerC4.fs`                                                        | the `S = 4` registers and the anti-numerology guard §3.6 borrows                                                                                                                                           |
| `src/Core/ConformalGA.fs`                                                                                                                 | `P·Q = −½\|x−y\|²`, and both the conformal and direct distance paths side by side — the precision experiment of theory-brief §5.3 is runnable against it the moment measurement is authorised              |
| `clifford-e8-{coxeter-projection, eigenlayer-tessellation, exact-coverage, face-lattice, shading}.ts`                                     | rungs 1–6, the body leg                                                                                                                                                                                    |

### External anchors, with what was actually read

| anchor                                                                                                                               | read                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Elliott & Hudak, _Functional Reactive Animation_, ICFP 1997                                                                          | abstract + secondary accounts                                                                                          |
| Elliott, _Push-pull functional reactive programming_, Haskell Symposium 2009                                                         | abstract                                                                                                               |
| Krishnaswami, _Higher-order FRP without spacetime leaks_, ICFP 2013                                                                  | title/venue verified                                                                                                   |
| Wörister, Steinlechner, Maierhofer & Tobler, _Lazy Incremental Computation for Efficient Scene Graph Rendering_, HPG 2013            | abstract + HPG listing                                                                                                 |
| Haaser, Steinlechner, Maierhofer & Tobler, _An Incremental Rendering VM_, HPG 2015                                                   | abstract + ACM listing                                                                                                 |
| Acar, Blelloch & Harper, _Adaptive Functional Programming_, POPL 2002 / TOPLAS 2006                                                  | abstract                                                                                                               |
| Aila & Laine, _Understanding the Efficiency of Ray Traversal on GPUs_, HPG 2009                                                      | abstract                                                                                                               |
| Laine, Karras & Aila, _Megakernels Considered Harmful_, HPG 2013                                                                     | abstract                                                                                                               |
| Sorensen et al., _Portable Inter-workgroup Barrier Synchronisation for GPUs_, OOPSLA 2016                                            | abstract                                                                                                               |
| Merrill & Garland, _Single-pass Parallel Prefix Scan with Decoupled Look-back_, NVR-2016-002                                         | abstract                                                                                                               |
| Smith et al., _Decoupled Fallback: A Portable Single-Pass GPU Scan_, SPAA 2025                                                       | title/venue                                                                                                            |
| arXiv 2408.05148, _Impacts of floating-point non-associativity on reproducibility_                                                   | abstract                                                                                                               |
| NVIDIA Volta Tuning Guide; _Using CUDA Warp-Level Primitives_                                                                        | relevant sections                                                                                                      |
| gpuweb `proposals/subgroups.md`; Vulkan 1.3 subgroup size control                                                                    | relevant sections                                                                                                      |
| Gunn, _Geometric algebras for Euclidean geometry_, arXiv 1411.6502                                                                   | abstract + summary of the PGA/CGA dimensional comparison                                                               |
| de Haan, Cohen & Brehmer, _Euclidean, Projective, Conformal_, AISTATS 2024 (arXiv 2311.04744)                                        | **abstract only**                                                                                                      |
| Brehmer, de Haan, Behrends & Cohen, _Geometric Algebra Transformer_, NeurIPS 2023                                                    | abstract                                                                                                               |
| Coecke, Sadrzadeh & Clark, _Mathematical Foundations for a Compositional Distributional Model of Meaning_, 2010                      | abstract + the _Computational Linguistics_ 41(1) 2015 evaluation abstract                                              |
| Bolt, Coecke, Genovese, Lewis, Marsden & Piedeleu, _Interacting Conceptual Spaces I_, arXiv 1608.01402 / 1703.08314                  | abstract                                                                                                               |
| Selinger, _A survey of graphical languages for monoidal categories_, arXiv 0908.3347                                                 | abstract                                                                                                               |
| Gärdenfors, _Conceptual Spaces: The Geometry of Thought_, 2000                                                                       | standing knowledge; the convexity criterion verified against secondary sources                                         |
| Russell, _A circumplex model of affect_, 1980                                                                                        | standing knowledge + secondary sources                                                                                 |
| Kriegeskorte, Mur & Bandettini, _Representational similarity analysis_, 2008                                                         | standing knowledge                                                                                                     |
| Kornblith, Norouzi, Lee & Hinton, _Similarity of Neural Network Representations Revisited_ (CKA), ICML 2019                          | standing knowledge                                                                                                     |
| Williams et al., _Generalized Shape Metrics on Neural Representations_, NeurIPS 2021                                                 | abstract                                                                                                               |
| Williams, _An Equivalence Between RSA and CKA_, CCN 2025 / bioRxiv 2024.10.23.619871                                                 | abstract                                                                                                               |
| Huh, Cheung, Wang & Isola, _The Platonic Representation Hypothesis_, ICML 2024                                                       | abstract + method description                                                                                          |
| arXiv 2604.18572, _Back into Plato's Cave_                                                                                           | abstract                                                                                                               |
| arXiv 2408.00531, _ReSi benchmark_                                                                                                   | abstract                                                                                                               |
| Pustejovsky, _Toward a Functional Geometric Algebra for Natural Language Semantics_, arXiv 2604.25902                                | **abstract only**; reports no empirical evaluation                                                                     |
| arXiv 2601.06575 (hyperspherical emotion), 2604.07382 (affective structure in LLMs), 2604.06752 / 2602.16161 (hyperbolic emotion)    | abstracts                                                                                                              |
| Hildenbrand et al., _Gaalop_                                                                                                         | as recorded in the in-tree theory brief §5.4                                                                           |
| Blum & Blum, _A theory of consciousness from a theoretical computer science perspective_ (the CTM), _PNAS_ 119(21) e2115934119, 2022 | as recorded in `src/Core/Ctm.fs`, which states it checked the citation; **not independently re-checked here**          |
| Joyal & Street (braided monoidal); Joyal, Street & Verity 1996 (traced monoidal)                                                     | as recorded in `MenoBraided.fs` / `WSet.fs`; standing knowledge                                                        |
| Wierzbicka, NSM semantic primes                                                                                                      | via the in-tree `docs/linguistic-seed/english/seed.json` and the 2026-09-03 spec, which marks the primes **contested** |
| Cysharp ZLinq                                                                                                                        | repository README + author write-up                                                                                    |

**One anchoring debt, stated rather than hidden.** Three of the affect citations
(arXiv 2601.06575, 2604.07382, 2604.06752 / 2602.16161) and the Philosophical Psychology
_"Emotions in conceptual spaces"_ entry were reached through search results and abstracts. They
carry the §2.5.1 claim that _the published affect geometry is not Clifford-shaped_, which is a
survey claim rather than a technical one — but if that claim ever becomes load-bearing for a
design decision, the papers need reading in full first.
