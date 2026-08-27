# There is no Theory of Everything inside E8 — what that theorem forecloses, what it leaves open, and where this repo actually stands

**Date:** 2026-08-27
**Work item:** `081M10HCZCD087G0R0022B9WTC`
**Author:** shadow (anchoring half). The building half — the Cl(4) blade generator / boson-fermion
classifier — is another agent's lane and is deliberately untouched here.
**Origin (Aaron, verbatim):** *"also maybe we can compare to physics experiments and see if we can
rederive the standard-model-ish based on our inference/intelligence"*

**Register.** This document is an **anchor map**, not a derivation. It builds no model, fits no
constant, and asserts no physics. Every external claim below was read in the source, not recalled;
§0 is the register of what was actually opened. Claims I derived from a paper's hypotheses rather
than read in its sentences are labelled **ENTAILMENT**. Claims I could not check are labelled
**UNVERIFIED** and left that way.

**Standard applied:** [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)
(anchors are *checked*, not cited) · [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)
(a count is not an identification) · [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
(three registers, and `unmetered` is the honest default).

---

## Verdict in one line

The specific route — **gravity and the Standard Model both inside one E8, particles read off the
Lie algebra** — is closed by a theorem I read in full, and *the author of the proposal it closed
concedes the mathematics in print*; but that theorem's hypotheses are **not met by anything this
repo has built**, the repo's own 2026-08-26 chirality result is about a **different predicate
wearing the same word**, and the surrounding lineage (division algebras → SM representation content)
is live, unclosed, and the part worth anchoring.

**Recommendation: PURSUE-NARROWLY, with one narrow WONT-DO candidate — offered, not filed — and
seven concrete revisit triggers, one of which is named as the likeliest way this document is
wrong.** Details in §9.

**Four things that were not expected going in, and each changes what to do:**

1. **The theorem is stronger than the brief said and weaker than the slogan.** It kills the
   *1*-generation Standard Model, so "we don't assume three" is no defence against it (§1.2); and it
   is bounded by a hypothesis, (ToE1), that a **peer-reviewed 2022 paper disputes in print** (§4.4).
   "There is no theory of everything inside E8" is the paper's title, not its theorem.
2. **The repo's own `120 ⊕ 128` census is neither foreclosed nor safe — it has *deferred* exactly
   the datum the no-go turns on** (a real structure), and its contract says so in its own words
   (§3.2). That is the single most useful sentence in this document.
3. **The whole division-algebra lineage has produced no number to compare with experiment.** Across
   ~25 papers: not one predicted mass, mixing angle, or coupling (§4.3). So Aaron's *"compare to
   physics experiments"* is answerable — but the honest comparison is against **representation
   content**, not against a value.
4. **Letting the constants vary is a legitimate, anchored posture** and it rescues falsifiability —
   but it reaches Tiers B and C only. Tier A has no derivative to bound (§6).

---

## 0. Register — what was actually opened

Anchoring under this repo's rules means the citation must *entail* the claim attached to it. Every
row below was fetched and read in this session; the "read as" column says how deeply, because
"skimmed the abstract" and "read the theorem statements and the proof strategy" are not the same
evidence and must not look the same.

| Source | Read as | Where |
|---|---|---|
| Distler & Garibaldi, *There is no "Theory of Everything" inside E8*, Comm. Math. Phys. **298** (2010) 419–436 | **full text** — §1 hypotheses, §2 definitions, §3 dimension count, Thm 1.3, Thm 10.1, §11 conclusion, reference list | arXiv:0905.2658 (via `ar5iv` full-text render) |
| Lisi, *An Explicit Embedding of Gravity and the Standard Model in E8* | **full text** — the §"implications" and §"discussion" paragraphs that respond to the above | arXiv:1006.4908 (via `ar5iv`) |
| Baez & Huerta, *The Algebra of Grand Unified Theories*, Bull. Amer. Math. Soc. **47** (2010) 483–552 | **full text, targeted** — the ΛC⁵ construction, the Spin(10) even/odd split, the "three generations remain a mystery" passage, the SU(5) proton-decay statement | arXiv:0904.1556 (via `ar5iv`) |
| Furey, *Standard model physics from an algebra?* (PhD thesis) | **abstract, verbatim** | arXiv:1611.09182 |
| Doran, Faux, Gates, Hübsch, Iga, Landweber, *Relating Doubly-Even Error-Correcting Codes, Graphs, and Irreducible Representations of N-Extended Supersymmetry* | **abstract, verbatim** | arXiv:0806.0051 |
| Nielsen & Ninomiya no-go (three 1981 papers) | **secondary** — hypothesis list and conclusion via the Wikipedia article, primaries identified but **not opened** | Nucl. Phys. B **185** 20; B **193** 173; Phys. Lett. B **105** 219 |
| In-repo: `docs/research/2026-08-26-nonquotient-spinor-action-map-{contract,sources}.md`, `src/Core.TypeScript/research/adinkra-ecc/nonquotient-half-spin-action.ts` | **full text** | this repo (PR #15715, work item `081M08802CZ087G0R0010ZE6FQ`) |
| ~25 papers of the division-algebra / Clifford / Jordan SM program (Furey, Gresnigt, Dubois-Violette & Todorov, Boyle, Dixon), plus the challenges to the no-go (Manogue–Dray–Wilson; R. A. Wilson; Douglas & Repka) | **parallel sweep**, abstracts from the arXiv API as raw XML and full texts via `pdftotext`; journal refs checked against INSPIRE | §4, individually cited |
| PDG 2026 *Review of Particle Physics* review PDFs (EW, GUT, CKM, neutrino-mixing, quark/lepton summaries), plus Ohlsson arXiv:2306.02401, Super-K arXiv:2010.16098 / arXiv:1408.1195, Ellis–Hung–Mavromatos arXiv:2008.00464 | **parallel sweep**, values extracted from the PDFs | §7 |
| Quack, Seyfang & Wichmann, *Chem. Sci.* **13**(36) 10598 (2022); Blackmond, *CSH Perspect. Biol.* **11**(3) a032540 (2019) and **2**(5) a002147 (2010); Soai, Kawasaki & Matsumoto, *Proc. Jpn. Acad. B* **95** 89 (2019); Glavin et al., *Meteorit. Planet. Sci.* **56**(1) 148 (2021) | **full text**, all open access | §8 |
| Hamdan & Davis arXiv:1510.00856 (Oklo); Rosenband et al., NIST/2008 Freq. Standards Symp. (optical clocks); Uzan *Rev. Mod. Phys.* **75** 403 (2003) — record only | **abstracts, verbatim** | §6.4 |
| Besbes, Gur & Zeevi (NeurIPS 2014 + 2015); Seron, Braslavsky & Goodwin, *Fundamental Limitations in Filtering and Control* (Springer 1997) §1.5; Sung & Hara (1988); Fang arXiv:1410.5192; Zinkevich (ICML 2003); Zhang, Lu & Zhou arXiv:1810.10815; Stone (1980, 1982); Shannon (1959) | **parallel sweep**, theorem statements extracted from PDFs | §6.4 |

A methodological note that is itself a finding, and belongs in the register rather than in a
footnote: during the sweep the summarizing fetch path **fabricated a journal reference** (reporting
*Nucl. Phys. B* 939 582–599 for a paper INSPIRE gives as 938 751–761) and was caught by
cross-checking. Three arXiv metadata abstracts were also found **stale relative to their v2 PDFs**,
and one carries an unrendered LaTeX `\cite{}` macro. Every journal reference in §4 was therefore
re-checked against INSPIRE or the arXiv API. *An anchor read through a paraphraser is not a checked
anchor* — which is the anchoring rule discovering its own failure mode in the act of being followed.

Sources cited by the papers above but **not opened by me**, and therefore never used to support a
claim here: Weinberg's *QFT* vols. (Distler–Garibaldi's ref. [9]), 't Hooft's 1979 Cargèse lectures
(their ref. [10]), Dynkin 1952/1957, Georgi–Glashow 1974, Pati–Salam 1974, Nesti–Percacci
arXiv:0909.4537. Where one of them matters below, it appears as *"Distler and Garibaldi cite X for
Y"* — a claim about their citation, which is what I checked, not about X.

---

## 1. The no-go — stated at its exact strength, no more and no less

### 1.1 The hypotheses (this is where the whole practical question lives)

Fix a real Lie group `E`. The paper considers subgroups `SL(2,C)` and `G` of `E` such that:

- **(ToE1)** — verbatim: *"`G` is connected, compact, and centralizes `SL(2,C)`"*.
- Decompose `Lie(E) ⊗ C` under `SL(2,C) × G` as `⊕_{m,n≥1} m ⊗ n ⊗ V_{m,n}`.
- **(ToE2)** — verbatim: *"`V_{m,n} = 0` if `m + n > 4`"*. Their gloss: *"the requirement that the
  model not contain any 'exotic' higher-spin particles"* (and it also forbids gravitinos).
- **(ToE3)** — verbatim: *"`V_{2,1}` is a complex representation of `G`"*. Their gloss: *"the
  statement that the gauge theory (with gauge group `G`) is chiral, as required by the Standard
  Model."*

"Complex" here is a technical predicate, defined in their Definition 2.2: `V` has a **self-conjugate
structure** if there is an antilinear `J : V → V` commuting with `G` and satisfying `J⁴ = 1` (real
structure if `J² = 1`, quaternionic/pseudoreal if `J² = −1`). A representation with *no* such `J` is
called **complex**. Chiral = complex; non-chiral = self-conjugate.

Read (ToE1) closely: **the Lorentz group must be inside `E`**, and the internal gauge group must be
a compact connected subgroup of `E` centralizing it, and *every* field is read off `Lie(E)`. That is
the class. It is not "any use of E8".

### 1.2 The conclusions

- **Theorem 1.3** (verbatim): *"There are no ToE subgroups in (the transfer of) the complex E8 nor
  in any real form of E8."*
- **Theorem 10.1** (verbatim), with (ToE2) weakened to (ToE2′) so gravitinos are allowed: *"There
  are no subgroups `SL(2,C)·G` satisfying (ToE1), (ToE2′), and (ToE3) in the (transfer of the)
  complex E8 or any real form of E8."*
- **§11 Conclusion** (verbatim): *"It shows that you cannot obtain a chiral gauge theory for any
  candidate ToE subgroup of E, whether E is a real form or the complex form of E8. In particular,
  it is impossible to obtain even the 1-generation Standard Model (in the sense of Definition 2.6)
  in this fashion."*

**My brief overstated the scope in one direction and understated it in another, and both matter.**

- *Understated:* it is **not** a theorem about three generations. It kills **one**. Their
  Definition 2.6 defines the `n`-generation Standard Model for any positive `n`, and §11 says even
  `n = 1` is impossible. So the number 3 is doing **no work** in the no-go — a point that becomes
  load-bearing in §6.
- *Overstated:* it is **not** a theorem about "all routes from E8 to the SM". It is a theorem about
  the class defined by (ToE1)+(ToE2)+(ToE3), and (ToE1) is a strong hypothesis.

### 1.3 The elementary half, which needs no theorem at all

Before the main theorem, §3 gives a dimension count that any of us can check:

- Three generations means `3 × 15 = 45` known fermions of each chirality, so `V_{2,1}` must be at
  least 45-dimensional, so the `−1` eigenspace of the central element of `SL(2,C)` must have
  dimension **at least `2 × 2 × 45 = 180`**.
- For a real form of E8, that `−1` eigenspace has dimension **112 or 128** — the paper attributes
  this to Cartan's classification of real forms, and gives an independent route via Serre's trace
  bound (`≤ (dim G + rank G)/2 = (248 + 8)/2 = 128`).

`128 < 180`. Three generations do not fit in the odd part of `e8`, by counting, full stop. Their own
next sentence is the honest caveat: *"These dimensional considerations do not, however, rule out the
possibility of accommodating a 1- or 2-generation Standard Model."* That is what the main theorem is
for. **Remember the number 128 — §3 of this document is about exactly that space.**

### 1.4 What the theorem does NOT foreclose

**ENTAILMENT (mine, from Definition 1.2 and (ToE1) — the paper states none of these as caveats).**
The hypotheses are not met, and so the theorem is silent, whenever:

1. **The Lorentz group is not inside E8.** If E8 is used purely as an *internal* gauge group with
   spacetime symmetry elsewhere and fermions in a representation that is not `Lie(E8)`, (ToE1) is
   simply not instantiated. The heterotic `E8 × E8` construction is the obvious member of this
   class; the paper never mentions strings and I did not verify the heterotic case against it, so
   this is an entailment about the *hypotheses*, not a claim about string theory.
2. **The group is not E8.** Nothing here constrains `so(10)`, `E6`, `E7`, `spin(11,3)`, or a
   division-algebra construction that never forms an E8.
3. **`G` is non-compact or disconnected.** Excluded by (ToE1); physically unattractive, but the
   theorem does not cover it.
4. **E8 appears as combinatorics rather than as a gauge group** — a root system, a lattice, a
   code, an error-correcting structure, a generator in the sense of
   [`only-the-irreducible-is-primitive`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md).
   There is no gauge theory, hence no `V_{2,1}`, hence no hypothesis to satisfy or violate.

Class 4 is where this repo's E8 material actually lives. That is the good news, and §3 makes it
precise rather than comfortable.

### 1.5 The strongest evidence that the theorem holds: the proposal's author concedes it

Lisi's own follow-up (arXiv:1006.4908) exhibits the explicit embedding of gravity + SM into
`E8(−24)` via a `spin(11,3)` GraviGUT — and then says, verbatim:

> *"Of the one-hundred-twenty-eight spinor generators, sixty-four are those of one generation of
> Standard Model fermions, while the other sixty-four are those of mirror fermions, with opposite
> charges — predicted to exist if the structure of `E8(−24)` is interpreted directly."*

> *"In their work, Distler and Garibaldi prove that, using a direct decomposition of E8, when one
> embeds gravity and the Standard Model in E8, there are also mirror fermions."*

> *"…these cannot be interpreted as three generations of fermions under a direct decomposition of
> `E8(−24)`. The proposal that these three blocks of generators might correspond to the three
> generations of fermions … remains a vague hint towards some more mysterious structure, and not a
> direct identification. The explanation for the existence of three generations of fermions … remains
> largely a mystery."*

> *"Since a direct interpretation implies the existence of mirror fermions, which are not known to
> exist in nature, it will be necessary to understand how these particles obtain large masses or
> otherwise work out in the theory."*

His disagreement is **not with the mathematics**. It is with the verdict: *"since the detailed
mechanism behind particle masses is unknown, and mirror fermions with large masses could exist in
nature"*, he calls declaring failure *"overly presumptuous"*. Distler and Garibaldi anticipate
exactly this and answer it not with a theorem but with a physics judgement, stated as such: *"if it
is non-chiral, there is no known mechanism by which it could reduce to a chiral theory at low
energies (and there are strong arguments [10] that no such mechanism exists)"* — [10] being 't Hooft's
1979 Cargèse lectures, which I did not open.

**Hold onto that seam.** It is the single most important structural fact in this whole document, and
§6 is built on it: *the mathematics is a theorem; the requirement that the mathematics must come out
chiral is a strongly-argued but defeasible physics premise.* Conflating them is how a no-go gets
either overstated or waved away, and both failures are common in the popular accounts.

Note also, from the paper's §8, that G_SM **does** embed: *"it is possible to embed `G_SM` in the
centralizer, thus showing that (ToE1) is satisfied. Given such an embedding, a simple computation
verifies explicitly that `S₊` has a self-conjugate structure as a representation of `G_SM`."* The
failure is never "the group doesn't fit". It is always "the representation is self-conjugate".

---

## 2. A second no-go, adjacent and repo-shaped

Included because this repo's instinct is *discrete substrate*, and there is a classical theorem
about getting chirality out of one.

**Nielsen–Ninomiya (1981)** — Nucl. Phys. B **185** 20 ("Absence of neutrinos on a lattice (I):
proof by homotopy theory"), B **193** 173 (II), Phys. Lett. B **105** 219 ("A no-go theorem for
regularizing chiral fermions"). Under translational invariance, locality, hermiticity, and a
locally-defined quantized conserved charge, a lattice fermion theory has **an equal number of
left-handed and right-handed fermions for every set of charges** — i.e. doubling, i.e. non-chirality.

**Register: I read this via the Wikipedia article, not the primaries.** The hypothesis list and the
conclusion above are what that secondary source states. Known constructions evade it (Wilson,
staggered, Ginsparg–Wilson / overlap / domain-wall fermions); which hypothesis each gives up, I did
**not** verify and will not assert — marked **UNVERIFIED**.

The relevance is bounded and specific: *if* anyone here proposes that a discrete/lattice/graph
substrate produces chiral matter, this theorem is the first thing that has to be answered, and
"we'll let the constants float" is not an answer to it — it is topological, not parametric. It is
listed as a **watch item**, not as an active obstruction, because no such proposal exists in the
repo today.

---

## 3. Where this repo actually stands — the 120 ⊕ 128 result, and DG

This is the section the rest of the document exists to support.

### 3.1 What was measured (2026-08-26, PR #15715, `081M08802CZ087G0R0010ZE6FQ`)

`src/Core.TypeScript/research/adinkra-ecc/nonquotient-half-spin-action.ts` builds an exact
complexified Fock-model action `ρ : so(16,C) ⊗ S⁺ → S⁺` — the 120 bivectors acting on the
128-dimensional even-parity sector of a `2⁸ = 256`-state carrier — and exhaustively checks the
Clifford relation, chirality preservation, Gram independence, and bivector-commutator closure, with
a Jordan–Wigner parity-string mutant that fails both the Clifford and the Lie controls.

That is a **metered** artifact in this repo's sense: it has a falsifier and the falsifier kills a
mutant. It is also, and this is to its enormous credit, explicit about what it does **not** claim.
From its own contract document, verbatim:

> *"This is a declared complexified action model. It does **not** silently identify the chosen basis
> with the repository's real half-spin carrier. **A real-form comparison requires a separately
> specified real structure.**"*

and its refusals list, verbatim:

> *"The spinor–spinor bracket `Λ²S⁺ → so(16)` and its normalization"* … *"The mixed Jacobi identity
> needed to join `so(16) ⊕ S⁺` into an E8 Lie algebra"* … *"Any claim that this algebraic carrier
> represents agents, transport, physics, or a universal identity."*

### 3.2 The relation to Distler–Garibaldi, in one sentence

> **The measured result is not inside the class the theorem forecloses, is not outside it either,
> and the reason is that it has not yet supplied the two data on which the theorem turns — a real
> form, and an `SL(2,C)`; and the contract document has already, independently, named the first of
> those as the thing it is deferring.**

Unpacked, four claims, each checkable:

1. **It is not yet an E8 at all.** The mixed Jacobi identity that would join `so(16) ⊕ S⁺` into an
   E8 bracket is listed as an explicit refusal. Until that closes, this is a **Spin(16)
   representation-theory census**, one ingredient of the Adams / Figueroa-O'Farrill construction
   — not an E8 object. Distler–Garibaldi is a theorem about E8. Its subject is absent.

2. **"Chirality" means two different things in the two documents, and they are not related by
   translation.** In the census, chirality preservation means *the bivector action maps the
   even-parity sector into itself* — Spin(16) half-spinor parity, a `Z/2` grading of a Fock space.
   In Distler–Garibaldi, chirality means *`V_{2,1}` admits no antilinear `G`-equivariant `J` with
   `J⁴ = 1`* — a statement about the internal gauge group's action on left-handed 4-dimensional
   spacetime fermions. The first is a grading; the second is the non-existence of a real or
   quaternionic structure. **The census cannot bear on the theorem, and the theorem cannot refute
   the census.** This is a Mirror-register word collision
   ([`mirror-beacon-register-discipline`](../../.claude/rules/mirror-beacon-register-discipline.md))
   and it is the most likely way for someone to round a bounded result up into a foreclosed one.

3. **The deferred datum is precisely the datum the no-go turns on.** The contract defers "a
   separately specified real structure". Distler–Garibaldi's entire mechanism is Definition 2.2 plus
   Remark 2.3: for irreducible `V`, `End_G(W)` is `R`, `H`, or `C`, and the representation is real,
   quaternionic, or complex accordingly — chirality *is* the `C` case. The census has deferred the
   choice of real structure; the theorem is a statement about what that choice can be. They meet at
   exactly one point, and the census has correctly declined to stand on it. That is not a gap in the
   census — it is the census being honest about its boundary, and the boundary happens to be the
   theorem's domain.

4. **The number 128 is not a coincidence here, and it is the one place a warning is owed.** For a
   real form of E8 the `−1` eigenspace has dimension 112 or 128 (§1.3), and the two `Z/2` gradings
   of `e8` are `so(16) ⊕ 128` and `(e7 ⊕ sl₂) ⊕ 112`. So the census's `120 ⊕ 128` **is** — as a
   graded decomposition of the Lie algebra — the same decomposition Distler–Garibaldi's dimension
   count is about. The moment anyone identifies that 128 as "the fermions", the elementary count of
   §1.3 applies immediately and says: **128 < 180, so not three generations**, before the main
   theorem is even invoked. *(Structural claim about the two `Z/2` gradings of `e8`: consistent with
   the paper's "112 or 128" and with `120 + 128 = 136 + 112 = 248`, but the identification of the
   two involutions with `so(16)` and `e7 ⊕ sl₂` is my own and is marked* **UNVERIFIED** *— I did not
   read it in a source this session.)*

### 3.3 What would move it into scope

Concretely, and this is a checklist not a prohibition. The census enters Distler–Garibaldi's domain
when **all** of these hold:

- the mixed Jacobi witness closes, so there is genuinely an E8;
- a **real form** is specified (their theorem covers every real form and the complexification, so
  no choice escapes);
- a copy of `SL(2,C)` is identified inside it and interpreted as spacetime/Lorentz;
- a compact connected `G` centralizing it is interpreted as the internal gauge group;
- the `−1` eigenspace is interpreted as matter.

Until then, the honest register for the census is what it already says about itself. **The correct
action today is not to stop; it is to not let anyone quietly add the last three bullets.**

### 3.4 The repo already had this stop-line — it was just never indexed

A survey of the tree found that **Distler–Garibaldi is already load-bearing here**, carried in three
research documents as a standing boundary — e.g. verbatim,
`docs/research/2026-08-18-is-there-a-coded-adinkra-that-is-still-a-regular-representation-proven-no-and-the-seam-it-names-lumen.md:418`:

> *"**Distler & Garibaldi** (2010), *There is no E8 theory of everything.* Standing physics stop-line,
> carried forward. Nothing in this document is a claim about physics; it is a claim about a
> finite-dimensional real algebra and a binary code."*

and `docs/research/2026-06-12-ferry-26-…-the-in-tree-hamming-code-generates-the-e8-lattice.md:53`:

> *"…the famous 'E8 theory of everything' (Lisi 2007) is **refuted as proposed** (Distler–Garibaldi
> 2010 …). … the stop line holds."*

Those readings are **correct**. This document's contribution is not to establish the stop-line but
to make it *precise* — the earlier citations say "the fermion-embedding obstruction is a theorem"
without stating (ToE1), and (ToE1) is exactly where the question of what is and is not covered
lives. Three concrete gaps were found:

| gap | action taken |
|---|---|
| Distler–Garibaldi is **not in `docs/PRIOR-ART-LIST.md`** — reachable only by filename. That file's own recorded lesson (`:1188`): *"An unindexed anchor is indistinguishable from an absent one, and was twice mistaken for absence."* | **fixed in this PR** — new "E8 as physics" section indexing the no-go, the reply, Baez–Huerta, and the PDG rows |
| All three in-repo citations render the title as *"There is no E8 theory of everything"*. The paper is called **"There is no 'Theory of Everything' inside E8"** — the wrong form does not find it in a search | **noted, not edited.** Those are dated research records owned by other agents; the correct title is now indexed in the prior-art list. Flagged for their owners |
| There is **no physics/E8 entry in `docs/WONT-DO.md`** | a draft entry is offered in §9 in that file's exact format and deliberately **not** added — a permanent `WONT-DO` is a gated class requiring human authorization |

Two corroborations already in the tree, found rather than supplied by me:

- The quarantined transcript `docs/ip-questionable/2026-08-02-david-chester-qgr-e8-standard-model-unification-talk-transcript.md:47-53`
  already lists, under *"The UNPROVEN claims"*, both *"the whole SM + gravity from a single 248 rep
  of E8"* and *"**Three generations from the 128 spinner** — the core unsolved problem (3 gen needs
  192 off-shell dof; only 128 fermions exist in E8)"*.
- Note that this is an **independent count**: 192 = 3 × 64 by a different route than
  Distler–Garibaldi's 180 = 2 × 2 × 45. Two different countings, same verdict, both against the
  same 128. That is what corroboration looks like when it is not just one observation wearing two
  costumes — and per `numerology-vs-number-theory`'s warning about correlated agreement, it is worth
  saying explicitly that these two counts *are* independent: they count different things (off-shell
  degrees of freedom vs. weight vectors of each chirality) and arrive at different numbers.

---

## 4. The lineage that is actually live

A sweep of roughly 25 papers in this program was run in parallel with the reading above, pulling
abstracts from the arXiv API as raw XML and full texts via `pdftotext` rather than through a
summarizer — because the summarizer **fabricated a journal reference** once during the sweep and was
caught. Journal references below were checked against INSPIRE or the arXiv API. The "does not get"
column is the one that matters and is the one missing from every popular account.

### 4.1 Who gets what

| program | gets | assumes / puts in by hand | **does not get** (author's own words where available) |
|---|---|---|---|
| **Georgi–Glashow SU(5)** (1974) | one generation as `Λ²W ⊕ W̄` (15-dim); gauge unification | the group | **excluded by experiment.** Ohlsson (*Nucl. Phys. B* **993** 116268, arXiv:2306.02401) Table II: predicted `10³⁰–10³¹ yr`, "Ruled out? **yes**". Also `m_s/m_d = m_μ/m_e`, off by 10× |
| **Spin(10)** / SO(10) | one generation as the 16 = `Λ^ev C⁵`, a genuinely complex (chiral) irrep; right-handed neutrino for free | the group; the generation count | three generations. Baez–Huerta: *"No one knows why the Standard Model is this redundant… It remains a mystery."* |
| **Furey**, `ℝ⊗ℂ⊗ℍ⊗𝕆` (arXiv:1806.00612, *EPJ C* **78** 375) | `G_sm = SU(3)×SU(2)×U(1)/Z₆` as the ladder-operator symmetry that survives; proton decay blocked *structurally* | the algebra; the rule that "conceptually distinct algebraic actions do not mix" — imposed, and said to be | one generation only; no Higgs mechanism — verbatim: *"the reduction of SU(5) → SU(3)_C × SU(2)_L × U(1)_Y/Z6 has not been mediated here by a Higgs boson."* |
| **Furey**, three generations (arXiv:1910.08395, *Phys. Lett. B* **785** 84) | 48 states with the quantum numbers of three generations of quarks and leptons | `ℂ⊗𝕆`; a chosen idempotent | **only the *unbroken* gauge group** `SU(3)_c × U(1)_em`. No `SU(2)_L` ⇒ **no chirality** in this construction |
| **Furey & Hughes**, triality (arXiv:2409.17948, *Phys. Lett. B* **865** 139473, 2025) | two generations as spinors `Ψ₊, Ψ₋`; a third recovered from `V` | a "Cartan Factorization" introduced for the purpose | verbatim: *"the vector representations did not immediately produce the irreps of a third generation"*; four Higgs representations instead of one; *"Dynamics and symmetry breaking in this model are subjects of current investigation."* |
| **Gresnigt**, sedenions / `Cl(8)` (*EPJ C* **79** 446; **83** 747; **84** 1129) | three generations | the algebra; a chosen `S₃` | same gap: the refereed three-generation papers carry `SU(3)_C × U(1)_em` only. Verbatim (arXiv:2306.13098): *"an algebraic origin for the existence of exactly three generations has proven difficult to substantiate"*; *"we have not considered the remaining internal symmetries nor the spacetime symmetries."* |
| **Dubois-Violette / Todorov**, exceptional Jordan algebra `J₃⁸` (*Nucl. Phys. B* **912** 426; *IJMPA* **33** 1850118) | `G_SM` deduced from `Aut(J₃⁸) = F₄` via Borel–de Siebenthal | **three generations, as the stated reason for choosing a 3×3 matrix**: *"The presence of three generations … suggests combining the octonions into a 3 × 3 hermitian matrix"* | dynamics. Verbatim: *"it is clear that what is described in these notes is quite incomplete: One should write some dynamics."* Todorov: *"We **postulate** that the symmetry group of the SM is the subgroup F₄^ω…"* |
| **Boyle**, `h₃^ℂ(𝕆)` + triality (arXiv:2006.16265, *J. Math. Phys.* **67** 071701, 2026) | one generation as the tangent space `(ℂ⊗𝕆)²`; a route to `Spin(10)` | `G_SM` and `ρ_SM` stated up front as targets; two subgroups fixed by hand | states the chirality obstruction **himself**, verbatim: *"they only have real or pseudo-real representations, while the standard model representation is complex … Extending … to the corresponding 'structure groups' … is no help, as the relevant representations (27 and 16) are still not complex."* Three generations: *"It is natural to **suspect**…"* |
| **Dixon**, `ℂ⊗ℍ⊗𝕆` (1994 book, MAIA **290**, Kluwer; DOI 10.1007/978-1-4757-2315-1) | SM symmetry and one leptoquark family | for three families: **three tensor copies, by hand** (`hep-th/9902016`) | his own hedge, verbatim: *"These ideas are presented as a mathematical exercise."* Markedly more modest than how he is usually cited |
| **Gates et al.**, adinkras (arXiv:0806.0051) | a classification theorem: adinkra topologies ≡ *"certain (1) graphs and (2) error-correcting codes"* | — | **makes no Standard Model claim at all**, in the abstract or anywhere the sweep found. This is a feature. It is the only entry in this table that is not trying to be physics |

*(Citation trap worth carrying: Furey's arXiv:1910.08395 was posted in 2019 but published in 2018 —
the arXiv id postdates the journal. And Dixon's book is routinely cited as "2013, Springer" via a
print-on-demand reissue; the original is Kluwer 1994. Also: **she publishes as N. Furey from 2019
onward**, `C. Furey` before.)*

### 4.2 The pattern, and it is the finding

> **Across the papers opened in this sweep, models that get chirality do not get three generations,
> and models that get three generations drop the weak force or spin. No refereed paper was found
> claiming both at once.**

That is an **absence with a stated search scope**, not a proof of absence. But it is corroborated
from inside the program by its leading practitioner, in a peer-reviewed venue, which is much stronger
evidence than an outsider's survey.

**N. Furey, *An Algebraic Roadmap of Particle Theories, Part II: Theoretical checkpoints*
(arXiv:2312.12799, *Annalen der Physik* 2400323, 2023)** sets five checkpoints — verbatim: *"⟨1⟩
conform to the Coleman-Mandula theorem (or establish a loophole), ⟨2⟩ evade familiar fermion doubling
problems, ⟨3⟩ naturally explain the Standard Model's chirality, ⟨4⟩ exclude B-L gauge symmetry at low
energy, and ⟨5⟩ explain the existence of three generations"* — and then scores her own model:
*"passes checkpoints ⟨1⟩, ⟨2⟩, ⟨3⟩, ⟨4⟩, and **has yet to cross ⟨5⟩**."* Her §body: *"We do not
attempt here to solve the three-generation problem (checkpoint ⟨5⟩)."*

Note what ⟨3⟩ demands in her own words — *"without implementing ad hoc projection operators, without
fixing arbitrarily chosen mathematical objects, without introducing other ad hoc constraints"*. That
is the same standard as this repo's `toy` / `unmetered` / `metered` ladder, arrived at independently
in a physics journal, and worth stealing the phrasing from.

And **John Baez**, in the blog post accompanying arXiv:2608.06271 (*Three Generations in E7*, 2026,
preprint) — **blog, not peer-reviewed, labelled as such**: *"It's long been a mystery why there are
3 generations of quarks and leptons… **Nobody knows one.**"* On his own attempt with Bokor and
Boyle: *"**But we couldn't get it to work.**"* And on what such results include: *"It does not
include the spin of the fermions and gauge bosons. … **It does not include a Lagrangian, so it
doesn't say anything at all about particle masses or interactions.**"*

### 4.3 The finding that answers Aaron's question most directly

> **Across roughly 25 papers in this lineage, the sweep found not one numerical prediction of a
> fermion mass, a CKM or PMNS angle, or a coupling constant.**

So *"compare to physics experiments"*, applied to the division-algebra program as it stands today,
has **nothing numerical to compare**. The program's outputs are representation content and gauge
groups — which is exactly the class §7.3 calls cheap-and-checkable, and exactly not the class that
produces a number to hold against PDG. That is not a criticism of the program; it is a statement of
what kind of thing it currently is, and it sets what a comparison here could honestly be about.

*(One unchecked lead: Gresnigt cites a `Cl(8)` Lagrangian paper by Quinta as "leading to predictive
mass relations". Not opened. **UNVERIFIED** — the one mass-prediction claim in this literature that
was not chased.)*

### 4.4 Correction — there IS a peer-reviewed challenge to Distler–Garibaldi, and it targets (ToE1)

An earlier draft of this document said "no published rebuttal". **That is too strong and is now
corrected.** No paper disputes the *correctness* of Theorem 1.3 — no erratum, no corrigendum,
nothing in the 34-record INSPIRE citation list. But applicability is genuinely contested:

- **Manogue, Dray & Wilson, *Octions: An E₈ description of the Standard Model*, *J. Math. Phys.*
  **63**, 081703 (2022), arXiv:2204.05310 — peer-reviewed.** Verbatim: *"Distler and Garibaldi [50]
  define a chiral E8 theory to be, essentially, one in which the spinors do not have a
  self-conjugate structure, then argue that no such theory exists. **However, they assume both that
  the GUT group is compact, and that e8 has been complexified, neither of which holds for our
  model.**"*
  - The compactness half **lands** — it is exactly (ToE1), and exactly item 3 of §1.4 above, which
    was written from the hypotheses before this paper was found.
  - The complexification half I read differently, and say so as **my reading, not a checked claim**:
    Theorem 1.3 states the result for *"any real form of E8"* explicitly, and the complexification
    in §1.1 is a step in decomposing `Lie(E) ⊗ C`, not an assumption that `E` is complex. I do not
    know whether the objection is aimed at that step; I did not open the surrounding argument.
  - And the same paper concedes it cannot yet settle the physical question, verbatim: *"Since the
    theory presented here does not (yet) describe interactions, that question can not (yet) be
    answered directly."* Its 128 spinor degrees of freedom *"correspond precisely to **one**
    generation"*; three generations are *proposed*, not derived.
- **Robert A. Wilson, arXiv:2210.06029 (2022) — preprint, no journal, 11 citations.** Attacks the
  *definition* rather than the proof, verbatim: *"we accept both the compactness and connectedness
  conditions, and question only the appropriateness of the choice of definition of chirality."* He
  also records that the dispute was never settled: *"The Banff workshop in 2010, which I
  participated in, was organised to try to resolve the issue, but did not succeed in doing so, and
  left both camps entrenched in their positions."*
- **Cutting the other way, and peer-reviewed: Douglas & Repka, *The GraviGUT Algebra Is not a
  Subalgebra of E₈, but E₈ Does Contain an Extended GraviGUT Algebra*, SIGMA **10** (2014) 072,
  arXiv:1305.6946.** Verbatim: *"we **prove that the GraviGUT algebra cannot be embedded into any
  real form of E₈**."* That contradicts the central embedding claim of Lisi's own reply — and unlike
  that reply (a never-published conference paper), it is refereed.

**The honest state of the argument, then:** the theorem is uncontested as mathematics; whether its
hypotheses are the right ones is contested, in print, by one peer-reviewed paper and one preprint;
and the contesting parties agree they cannot yet answer the physical question. This is a live
dispute about **scope**, which is precisely why §1.4 exists and why "E8 is ruled out" is the wrong
sentence to carry.

---

## 5. The count trap — four different 16s

[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) says a
coincidence of counts is a legitimate **generator** and an illegitimate **conclusion**, and that the
register must be stored with the observation or it silently becomes a belief. So: recorded, and
labelled.

**Coincidence (register: coincidence, not identification).** Four objects in and near this repo's
vocabulary have cardinality 16.

| object | what the 16 counts | invariant that excludes the others |
|---|---|---|
| `Cl(4)` | `2⁴ = 16` basis blades of a Clifford algebra over 4 generators; graded `1+4+6+4+1` | the 16 is the **algebra's dimension**, not any module's: `Cl(4) ⊗ C ≅ M₄(C)`, whose irreducible module is **4**-dimensional. And under the natural `Spin(4)` action the 16 is *reducible* (`1+4+6+4+1`, with the 6 splitting further under `Spin(4) ≅ SU(2)×SU(2)`). A row-4 object is an irreducible 16; this one is a reducible 16 of a different kind entirely |
| minimal `N = 8` adinkra | `8` bosonic + `8` fermionic nodes | a **graph**; the classification result (arXiv:0806.0051, verbatim abstract) is that adinkra topologies are equivalent to *"certain (1) graphs and (2) error-correcting codes"* — no Lie group action, no representation of a gauge group |
| extended Hamming `[8,4,4]` code | `2⁴ = 16` codewords; the smallest doubly-even self-dual code | a subgroup of `F₂⁸` — an **`F₂`-vector space**. Its symmetry group is finite. It is not a representation of any continuous group |
| the SO(10) **16** | one generation of Weyl fermions | an **irreducible complex representation** of the rank-5 compact simple group `Spin(10)` that admits **no self-conjugate structure** — which is exactly what makes it chiral (Distler–Garibaldi Def. 2.2) |

The last row is the one that separates them, and it separates them completely. Baez & Huerta give
the SO(10) 16 explicitly as `Λ^ev C⁵ = Λ⁰ ⊕ Λ² ⊕ Λ⁴`, containing (verbatim) *"the left-handed
particles and antiparticles"*, with `Λ^odd C⁵` the right-handed ones; the full `ΛC⁵` is
32-dimensional and *"has a basis labelled by 5-bit strings"* — being up, down, red, green, blue.
That is where 16 comes from: **a 5-bit code with a parity constraint, carrying an irreducible
complex rep of Spin(10)**. Not a blade count, not a vertex count, not a codeword count.

The test the rule prescribes — *what else has this number, and what invariant excludes it* — is
answered in the table, and the answer is that **nothing links these four beyond the integer**. Two
of them (the adinkra graph and the doubly-even code) are genuinely the same object by a published
theorem. The other two are not, and no result in this repo or in the literature I opened connects
them.

**Cheap irony worth recording, also as a coincidence:** Baez & Huerta's SU(5) exposition and the
adinkra classification both arrive at binary codes on 5 and 8 bits respectively. Same *technique*
(index a basis by bit strings), different *objects*. The technique is a generic and very old one;
its recurrence is evidence of nothing. Register: **coincidence**. Filed, not believed.

---

## 6. The bar, split — theorems that survive floating constants, and targets that do not

Aaron's correction, verbatim:

> *"3 generations is an assumption, a strong assumption but still it requires a lot of hard-coded
> parameters. Most of our stuff is trying to derive via inference what the so-called 'constants' are
> and allow any or all of them to vary and not be constant, so new structures can be discovered over
> time."*

He is right about the number, and it changes the shape of the bar. But it does **not** dissolve the
no-go, and the reason is sharper than "theorems are theorems". There are **three** tiers here, not
two, and the seam identified in §1.5 is what separates the first from the second.

### 6.1 Tier A — representation-theoretic facts. Letting constants float changes nothing.

These contain no measured quantity. They are statements about which representations of which groups
exist. There is no knob.

| claim | status | source |
|---|---|---|
| No `SL(2,C)·G ⊆ E8` (any real form, or the complexification) satisfying (ToE1)+(ToE2) has `V_{2,1}` complex | **theorem**, read in full | Distler–Garibaldi Thm 1.3 / Thm 10.1 |
| Consequently not even a 1-generation Standard Model arises that way | **theorem**, read in full | *ibid.* §11 |
| The `−1` eigenspace in any real form of E8 has dimension 112 or 128, and three generations need ≥ 180 | **arithmetic**, read in full | *ibid.* §3 |
| `G_SM` does embed; the resulting `S₊` is self-conjugate | **theorem + explicit computation**, read | *ibid.* §8 |
| Anomaly cancellation constrains SM hypercharge assignments | plausible Tier-A member | **UNVERIFIED** — not checked this session; do not cite until it is |
| **Coleman–Mandula**, and fermion doubling | Tier-A members **by the program's own reckoning** | Furey's checkpoints ⟨1⟩ and ⟨2⟩ (arXiv:2312.12799, *Ann. Phys.*). Cited **via her**; I did not open Coleman–Mandula 1967 |
| Nielsen–Ninomiya doubling, *if* a lattice/discrete regularization is ever the route | Tier-A member, topological | §2 — via a secondary source |

Note how the Tier-A list is populated: **the program's own leading practitioner independently
arrived at a five-item checkpoint list of which the first three are Tier A** (Coleman–Mandula,
fermion doubling, chirality). She is not scoring against a wish-list; she is scoring against
obstructions. That convergence — an outside reading of a no-go and an inside scorecard producing the
same partition — is the closest thing here to independent corroboration of the framing itself.

**This is the half of Aaron's correction that has to be said even though it is the less welcome
half:** a program that lets every constant vary still cannot make a self-conjugate representation
complex. Nothing in "derive the constants by inference" reaches this tier. And the sharpest form of
it is the one from §1.2: **the theorem kills `n = 1`.** So "we don't assume 3" is not a defence
against it, because 3 was never what it was attacking.

### 6.2 Tier B — the physics premise that turns Tier A into a verdict. Defeasible, and this is where floating parameters legitimately bite.

**Tier A says the theory is non-chiral. Tier B says non-chiral is fatal.** That second step is not a
theorem, and Distler and Garibaldi do not present it as one — they present it as *robustness*
(*"there is no known mechanism"*, *"strong arguments … that no such mechanism exists"*), and Lisi
attacks precisely and only this step (*"mirror fermions with large masses could exist in nature"*).

This is exactly where "let the constants vary" is a **legitimate move rather than an evasion**: the
mirror-fermion masses are unknown parameters, and a program that derives rather than assumes them
is attacking Tier B on its actual terms. It is a hard, respectable, unsolved problem, and it is not
foreclosed by anything I read. What it is *not* is a way around Tier A.

### 6.3 Tier C — numerical targets. Assumptions, and correctly identified as such.

Exactly three generations; the fermion masses; the mixing angles; the Weinberg angle's measured
value. Note that even Distler and Garibaldi treat the generation count as an input: their Definition
2.6 defines the `n`-generation Standard Model for arbitrary positive `n`, and observes only that
*"Particle physics, in the real world, is described by 'the' Standard Model, which is the case
`n = 3`."*

Two honest halves here:

- **In Aaron's favour:** a framework that *derives* a generation count — whatever it comes out as —
  is doing something categorically different from one required to hit 3, and judging the first by
  the second's scorecard is a category error. Baez & Huerta, verbatim: *"No one knows why the
  Standard Model is this redundant, with three sets of very similar particles. It remains a
  mystery."* Nobody has derived it. Nobody.
- **Against complacency:** 3 is not arbitrary, it is *measured*. A derived count still has to face
  the measurement.

### 6.4 "What must stay fixed?" — answered: the derivative, not the value

The obvious objection to Tier C floating is that a framework where **everything** may vary predicts
nothing and discriminates nothing — `numerology-vs-number-theory` is explicit that a model assigning
high probability to everything yields no likelihood ratio. Aaron's answer, verbatim:

> *"Everything may vary **within a bounded context with limitation on the rate of change**. This rate
> of change vs future prediction accuracy is kind of our **reverse Heisenberg uncertainty** — your
> change rate and your prediction of the future are connected, but not like just a regular inverse;
> it's more like some sort of **leveraged inverse with a multiple** or something, roughly speaking."*

**This answers the objection, and the reason is elementary rather than rhetorical.** Bound the
derivative and the model regains a non-empty complement: if `|ẋ| ≤ B` and `x(t₀)` is known, then for
any later `t` the model *forbids* `x(t)` outside `[x(t₀) − B·Δt, x(t₀) + B·Δt]`. There exist
observations it cannot accommodate, which is the whole of falsifiability. An unbounded-variation
model forbids nothing; a rate-bounded one forbids a great deal. Nothing has to stay fixed **in
value**. *(Elementary — stated here, not cited.)*

**And the condition for this to be more than a gesture is checkable, which is the useful part.** A
rate bound is only falsifiable if it can be violated by an achievable measurement. With observation
window `T` and measurement precision `σ`:

> **falsifiable in this window ⟺ `σ < B · T`**

If `B · T < σ`, the model's permitted drift is smaller than what you can resolve, and the bound is
indistinguishable from "no drift at all" — it constrains nothing *you can check*, which is the
vacuity class arriving by a new road. So a rate-bounded framework owes three numbers up front: the
bound `B`, the window `T`, and the precision `σ`. That is a demand it can meet, and one that a
hand-wave cannot.

#### This is not a novel posture — it is how physics already handles varying constants

Worth saying plainly, because from outside *"let the constants vary"* reads as unfalsifiable
hand-waving and it is not. There is an entire empirical literature that lets a fundamental constant
vary and constrains its **fractional rate of change**: Jean-Philippe Uzan, *"The fundamental
constants and their variation: observational status and theoretical motivations"*, **Rev. Mod. Phys.
75, 403 (2003)** (arXiv:hep-ph/0205340) is the standard review. *(Title, authors and journal
confirmed from the arXiv record; I did not obtain its abstract verbatim and quote nothing from it.)*

**Two checked results, and note that they are the same measurement made two completely different
ways** — which is the point:

- **The Oklo natural fission reactor.** Hamdan & Davis, *Bound on the variation in the fine
  structure constant implied by Oklo data* (arXiv:1510.00856), verbatim: *"Data on shifts in
  resonance energies E_r from the Oklo natural fission reactor have been used to place restrictive
  bounds on the change in α over the last 1.8 billion years"* … *"we conclude that the relative
  change in α since the Oklo reactors were last active (redshift z ≃ 0.14) is less than ∼ 10 parts
  per billion."* Long baseline `T`, crude `σ`, ferocious bound.
- **Optical atomic clocks.** Rosenband, Hume, Chou, … Wineland & Bergquist, *"Alpha-Dot or Not:
  Comparison of Two Single Atom Optical Clocks"*, Proc. 2008 Symposium on Frequency Standards and
  Metrology, verbatim: *"Repeated measurements of the frequency ratio of Hg+ and Al+ single-atom
  optical clocks over the course of a year yield a constraint on the possible temporal variation of
  the fine-structure constant α. The time variation of the measured ratio corresponds to a time
  variation in the fine structure constant of α-dot/α = (-1.6 ± 2.3) × 10⁻¹⁷, which is consistent
  with no change."* One-year baseline `T`, extraordinary `σ`, comparable reach. *(The abstract as
  published omits the unit; the quantity is per year.)*

**Those two are the `σ < B·T` condition of the previous paragraph, instantiated twice with opposite
trades** — a 1.8-billion-year window with modest precision, and a one-year window with
`10⁻¹⁷`-level precision, arriving at comparable constraining power on the same constant. That is
what a rate-bounded model looks like when it is being taken seriously as science rather than
defended as a posture. **So the answer to "is this a dodge?" is no, with receipts.**

The same move is standard for `G`: Brans & Dicke (1961) let `G` vary and the theory is constrained
by a parameter `ω_BD`; Dirac's Large Numbers Hypothesis (1937/38) is the ancestor. *(Not opened —
their numbers, and the Cassini bound `ω_BD > 40000` from Bertotti, Iess & Tortora, *Nature* **425**
374 (2003), reached me through search summaries only and are **UNVERIFIED** here. The two checked
results above carry the argument without them.)*

**One honest limit on the analogy.** In physics the constant is a *measured* quantity with an
established value and a known measurement precision, so `σ` is real and `B·T` is checkable. A
substrate that lets its own internal quantities drift has to *supply* the analogue of `σ` — and if
it cannot say what would count as measuring one of its constants, the rate bound is not yet in the
same business as Oklo. That is a requirement, not an objection, and it is a meetable one.

#### The "leveraged inverse" — two candidate shapes, and the exclusion test applied to them

Aaron flags his own uncertainty here (*"or something, roughly speaking"*), so this is handled as
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) requires: a
**coincidence of shape is a generator, not an identification**, and the register is stored with it.
Two existing formalisms have the right shape, and they are **not** the same shape as each other —
which is the finding.

**Candidate 1 — non-stationary bandit regret. A scaling law.** Besbes, Gur & Zeevi, *Stochastic
Multi-Armed-Bandit Problem with Non-stationary Rewards* (NeurIPS 2014), and the 2015 follow-up:
regret against a **variation budget** `V_T` over horizon `T` takes the form `V^α T^(1−α)`. This is
*exactly* Aaron's two quantities — how much the world may change, versus how well you can do — and
it is *exactly* a "leveraged inverse with a multiple" rather than a reciprocal: **fractional
exponents, not `1/x`**.

**But the exponent is not a constant, and that is the load-bearing correction.** `α = 1/3` or
`α = 1/2` depending on the problem class (convexity of the loss, and whether feedback is full or
bandit). So:

> **`V^α T^(1−α)` is the generic form; `α` is a property of the problem class. `2/3` is not a
> signature you can pattern-match on.**

Anyone here who measures a `2/3` and reaches for this paper has committed the count-trap error one
level up — matching an *exponent* instead of a cardinality. The exponent has to be *derived from
the problem's structure*, or measured with the class held fixed.

Partial match, worth recording because it is *not* the same law: dynamic regret against a moving
comparator scales as `√(T(1 + P_T))` (Zinkevich, ICML 2003, for the path-length definition; Zhang,
Lu & Zhou, arXiv:1810.10815, for the matching `Ω(√(T(1+P_T)))` lower bound and optimal upper bound).
Exponent `1/2` on **both** factors — a symmetric split, not a leveraged one. And the reason it
differs is instructive rather than incidental: `P_T` measures **comparator** movement and `V_T`
measures **cost-function** movement. *Different things move; different exponents follow.*

**Candidate 2 — Bode's sensitivity integral. A conservation law, and a different animal entirely.**
The precise statement, verbatim from Seron, Braslavsky & Goodwin, *Fundamental Limitations in
Filtering and Control* (Springer, 1997) §1.5:

> *"(1/π) ∫₀^∞ log |S(jω)| dω ≥ Σᵢ pᵢ, where {pᵢ} is the set of ORHP poles of the **open-loop
> plant**. **Equality is achieved … if the set {pᵢ} also includes all the ORHP poles of the
> controller.**"*

Note the inequality: it is an *equality* over the loop gain's unstable poles and only a **bound**
over the plant's — an unstable controller adds dirt of its own. The waterbed is real: suppress
sensitivity in one band and it must rise in another. A discrete-time version exists (Sung & Hara,
*Int. J. Control* **48**(6) 2429, 1988) with right-hand side `Σ_λ max{0, log|λ|}`, and there the
Nyquist frequency means the dirt genuinely **cannot** be pushed out to infinity. There is also an
exact information-theoretic identity: the entropy-rate increase from disturbance to output *equals*
the Bode integral (Fang, arXiv:1410.5192, Thm 4.4).

#### The exclusion test — and it produces a real result

The rule demands: *what else has this shape, and what invariant excludes it?* Applied:

| shape | members | the invariant |
|---|---|---|
| **conservation** — fixed total, redistributed | Bode; Sung–Hara; Martins–Dahleh; Fang | something is **conserved**. You cannot win, only relocate |
| **scaling** — fractional-exponent frontier | Besbes–Gur–Zeevi | **nothing is conserved.** More budget simply costs more regret; it is a rate, not a ledger |
| neither | Stone's minimax rates `n^{−(p−m)/(2p+d)}`; Shannon rate–distortion (*IRE Int. Conv. Rec.* **7**(4) 142, 1959) | monotone frontiers with different structure. **Do not cite as analogues** |

**No source opened in this sweep exhibits both shapes at once.** So the two candidates are genuinely
distinct objects, and "leveraged inverse" has to pick one before it means anything.

**And here the rule's sharpest clause fires on this very investigation.** Four sources share the
conservation shape — and they share it *because they are literally about the same object*. Bode,
Sung–Hara, Martins–Dahleh and Fang are a **lineage, not independent corroboration**. Per
`numerology-vs-number-theory`: *"are these separate confirmations, or one thing wearing several
costumes?"* Here, demonstrably the latter. **Four confirmations that are one confirmation.** Had
that not been checked, the density of agreement would have read as strong support for the
conservation reading, and it is not support at all.

#### What would make this science rather than a name

> **The exponent is not something to assume. It is something to measure.**

If a rate-of-change ↔ prediction-accuracy tradeoff is real in this substrate, then the experiment is
to hold the problem class fixed and **fit `α`**. A *predicted* `α` that survives measurement would
be a genuine result of the kind §6 Tier C describes — derived, not assumed, and refutable. A fitted
`α` with no prediction is a description. Both are honest; only one is a finding.

**Register for this whole subsection: coincidence-of-shape, checked, promoted to neither.** Aaron's
"reverse Heisenberg" is his own Mirror-register coinage and is recorded as such — its Beacon
compression is *a variation-budget / achievable-error tradeoff*, and it should be noted that
Heisenberg's relation is a product of two **simultaneous** uncertainties, which is a third shape
again, matching neither candidate above.

### 6.5 The remaining commitments, which the rate bound does not replace

1. **Fix the predicate before the measurement.** Any constant may float at any bounded rate, but
   what counts as a hit — target, tolerance, and the pre-declared list of what would count as a
   miss — is fixed first. (This repo already has the move: pre-declared bias, spent by
   precommitting falsifiers.)
2. **Fewer knobs than matched quantities.** If a framework derives `k` numbers using `j` adjustable
   inputs with `j ≥ k`, it has explained nothing, however good the fits look. State `j` and `k`.
   Note a rate bound is itself a parameter and counts toward `j` unless it is derived.
3. **Tier A is not rate-bounded — it is not a quantity at all.** This is the one place the answer
   does not reach, and it has to be said plainly: *"the representation is self-conjugate"* has no
   derivative to bound. A rate limit is a statement about a number changing over time; a
   representation-theoretic obstruction is a statement about what exists. **Letting the constants
   drift, however slowly or quickly, does not make a self-conjugate representation complex.**
4. **Checked, not cited; and mutation-tested.** The 2026-08-26 census is the model: a mutant that
   kills the controls. A derivation whose test survives mutation is not a falsifier.

That partition — *which constraints are theorems that survive letting the constants vary, which are
premises that could be defeated by evidence, and which are targets that exist because someone fixed
them* — is the deliverable. The meter buys the demarcation, not the claim.

---

## 7. What "compare to physics experiments" can honestly mean here

All values below are from the **PDG 2026 Review of Particle Physics** (F. Takahashi et al.,
Particle Data Group, *Int. J. Mod. Phys. A* **41**, 2630011 (2026)) unless another source is named,
and were retrieved from the review PDFs in this session rather than recalled.

### 7.1 The measured side — what a produced number would be compared against

| quantity | value | scheme / note | source |
|---|---|---|---|
| `sin²θ̂_W(M_Z²)` | `0.23122 ± 0.00006` | MS-bar at `M_Z` | PDG 2026, EW review Table 10.2 |
| `N_ν` (light active neutrino species) | **`2.9963 ± 0.0074`** | Z invisible width | PDG 2026 §10.4, after Janot & Jadach, *Phys. Lett. B* **803** 135319 (2020) |
| `m_μ/m_e` | `206.768` | pole masses | PDG 2026 lepton summary |
| `m_s/m_d` | **`17–22`** | MS-bar at 2 GeV | PDG 2026 quark summary |
| `τ(p → e⁺π⁰)` | `> 2.4 × 10³⁴ yr` (90% CL) | Super-K, 450 kton·yr | Takenaka et al., *Phys. Rev. D* **102** 112011 (2020), arXiv:2010.16098 |
| `τ(p → ν̄K⁺)` | `> 5.9 × 10³³ yr` (90% CL) | Super-K, 260 kton·yr | Abe et al., *Phys. Rev. D* **90** 072005 (2014), arXiv:1408.1195 |
| CKM `λ, A, ρ̄, η̄` | `0.22517 ± 0.00068`, `0.826 ⁺⁰·⁰¹⁷₋₀.₀₁₅`, `0.1576 ± 0.009`, `0.3556 ± 0.007` | 3-generation-unitarity global fit | PDG 2026 CKM review Eqs. 12.26–12.28 |
| PMNS `δ_CP` | best fits `177°–216°`; one global fit's 3σ range wraps fully around | **do not treat as measured** | PDG 2026 neutrino-mixing review Table 14.7 |

One correction worth carrying: the classic `N_ν = 2.984 ± 0.008` is **superseded**. The LEP
small-angle Bhabha luminosity was underestimated; corrected, the value is `2.9963 ± 0.0074` — now
about `0.5σ` from 3 rather than `2σ` below it. Anyone building an argument on "the measured
neutrino count is slightly below 3" is building on a retracted number.

### 7.2 The one cheap decisive falsifier — and the one that only looks decisive

**Cheap and decisive.** Minimal `SU(5)` predicts `λ_s = λ_μ` and `λ_d = λ_e`, hence
`m_s/m_d = m_μ/m_e`. Measured: `≈ 20` versus `206.77` — an order of magnitude apart, and PDG 2026
(§92.7.2) calls the relation *"clearly incompatible with experimental observations"* and notes it is
**preserved under RG evolution**, so no running rescues it. **Two table lookups and one division
kill a GUT.** That is the model of what "compare to physics experiments" should look like here: no
capability required, no calculation to get wrong, and it could have come out the other way.

**Only looks decisive.** The LO gauge-coupling postdiction `α₃(M_Z) ≈ 0.117` against the measured
`0.1180 ± 0.0009` looks like a bullseye. PDG 2026's GUT review says of it, verbatim: *"this near
perfection is to some extent accidental"* — including two-loop and SUSY threshold corrections at
`m_SUSY = 1 TeV` moves the prediction to `≈ 0.126`, which significantly deviates. **A postdiction
that degrades when the calculation is done properly is the numerology failure mode in its native
habitat**, and it is *this* example, not a toy one, that justifies the partition below.

Same trap, second instance: `sin²θ_W = 3/8` is a **GUT-scale** tree-level prediction. Ellis, Hung &
Mavromatos (*Nucl. Phys. B* **969** 115468 (2021), arXiv:2008.00464) state it and its consequence
in one passage — SM-only running lands at `≈ 0.20`, *not* the measured `0.231`; adding superpartners
recovers `≈ 0.231`. So "3/8 versus 0.231" is not a near-miss and not a success; **it is not a
comparison at all** until a spectrum is specified. Presenting the two numbers side by side is a
non-result wearing the clothes of one.

And on the other side of the ledger, a GUT postdiction that does hold up: `b`–`τ` Yukawa
unification. PDG 2026 §92.7 — the `m_b/m_τ` ratio, *"after accounting for QCD corrections, is
remarkably consistent with experimental data"* (Chanowitz–Ellis–Gaillard 1977;
Buras–Ellis–Gaillard–Nanopoulos 1978). Note the caveat is doing real work: the naive
`4.186/1.77693 = 2.356` mixes an MS-bar mass with a pole mass at neither a common scale nor the GUT
scale, and is not the prediction.

**Status of minimal non-SUSY SU(5): excluded.** Ohlsson, *Proton decay* (*Nucl. Phys. B* **993**
116268 (2023), arXiv:2306.02401) Table II lists Georgi–Glashow minimal SU(5) with predicted lifetime
`10³⁰–10³¹ yr` and "Ruled out? **yes**" — against the `2.4 × 10³⁴ yr` bound above, decisive by
inspection. Senjanović (arXiv:0912.5375) adds that the couplings do not even unify. This is worth
recording because it is the **one clean case in this whole document of a beautiful algebraic
unification killed by a measurement** — which is what we are asking for, and what it looks like when
it happens.

### 7.3 The partition — which is the actual answer

**Cheap and checkable today, with capability this repo already has:**

1. **Representation-content comparison.** Does a structure produce exactly
   `(SU(3)×SU(2)×U(1))/Z₆` acting on `Λ^ev C⁵` with the SM hypercharges? This is finite arithmetic
   over a character table — no physics, no dynamics, no Lagrangian. It is fully expressible as a
   test with a killable mutant, exactly like the 120⊕128 census. **This is the honest reading of
   "compare to experiment" for this repo**: the SM's particle content and charge assignments are
   *measured facts*, tabulated to death, and a group-theoretic prediction can be checked against
   them by a program.
2. **Direct comparison of a produced number to a published PDG value.** One lookup, one comparison,
   one recorded residual. Bounded and honest — provided §6's rule 1 (fix the predicate first) is
   obeyed, or the exercise is post-hoc fitting wearing a lab coat.
3. **Count checks with declared invariants**, per §5: never "it came out 16", always "16, and here
   is what else has 16 and what excludes each".

**Requires capability this repo does not have, and should not pretend to:**

4. **Anything needing renormalization-group running.** The textbook `sin²θ_W = 3/8` GUT relation is a
   prediction *at the unification scale*; comparing it to the measured value at `M_Z` requires
   multi-loop RGEs with a specified particle spectrum. That is a real calculation with real
   choices, not a lookup, and getting it wrong produces a number that looks like agreement.
5. **Anything needing a Lagrangian, a quantization, or a dynamical mechanism** — masses, mixing
   angles, proton-decay rates, whether mirror fermions can be heavy. Tier B lives here. We cannot
   settle it and should not imply otherwise.
6. **Anything about scales no experiment probes.**

Items 4–6 are not "hard for us". They are **outside the meter**, and saying so is the point.

**One consequence, and it is the practical answer to Aaron's question.** Item 2 currently has
nothing to apply to: §4.3 found no numerical prediction anywhere in the division-algebra lineage,
and this repo has produced none either. So *"compare to physics experiments"*, executed today, means
**item 1** — comparing produced *structure* against measured *content*. That is a real, bounded,
mutation-testable exercise with a genuine chance of failing, and it is the one this repo is actually
equipped to run.

**A worked template for it, ready to be picked up or refused.** Take the SM's measured content:
`(SU(3)×SU(2)×U(1))/Z₆` acting on `Λ^ev C⁵` with the standard hypercharges. Any structure claiming
to produce it must reproduce **all** of: the `Z₆` quotient (not merely the group's dimension), the
hypercharge assignments up to one overall normalization, and the **complexness** of the
representation. Each is a finite check. The third is the one that kills things — Boyle states the
obstruction for his own route in his own paper (§4.1), and it is the same predicate as (ToE3).
Failing any of the three is a result; passing all three would be the first honest "our structure
matches measurement" claim this repo could make.

---

## 8. Chirality and handedness — the same ladder, and the rung that is open

Aaron, verbatim: *"For me chirality and handedness are on the same ladder."* Meaning physical
chirality (spinor parity) and molecular handedness (L-amino acids, D-sugars) are the same structure
at different rungs, not an analogy.

**The ladder is real, it is named in the literature, and one of its joins is unproven.** It is
included here because it is the reason the chirality thread matters, and because — unlike the GUT
question — it terminates in an *open scientific question with bench experiments* rather than in a
no-go theorem.

### 8.1 The four rungs, each individually solid

| rung | claim | status |
|---|---|---|
| **1** | The universe is genuinely handed: parity is violated in the weak interaction | **settled.** Lee & Yang, *"Question of Parity Conservation in Weak Interactions"*, *Phys. Rev.* **104** 254 (1956); Wu, Ambler, Hayward, Hoppes & Hudson, *"Experimental Test of Parity Conservation in Beta Decay"*, *Phys. Rev.* **105** 1413 (1957) — polarized Co-60 at ~0.003 K, β-emission unequal along vs against the spin axis. Nobel Prize 1957 |
| **2** | Parity violation induces a tiny energy difference between enantiomers (**PVED**), marginally favouring L-amino acids and D-sugars | **theory only — never measured.** Yamagata (*J. Theor. Biol.* **11** 495, 1966); Hegstrom, Rein & Sandars (*J. Chem. Phys.* **73** 2329, 1980); Mason & Tranter (*Mol. Phys.* **53** 1091, 1984) |
| **3** | The PVED is far below thermal noise, so **amplification is mandatory** — and amplification is real | **model: Frank** (*Biochim. Biophys. Acta* **11** 459, 1953); **experiment: Soai et al.** (*Nature* **378** 767, 1995) |
| **4** | Terrestrial life is near-totally homochiral: L-amino acids in proteins, D-sugars in DNA | **observed fact** |

**Rung 2 needs a correction, and making it is the reason to check rather than cite.** The figure I
was handed for this document was *"~10⁻¹⁷ kT"*. That is the **pre-1995** number. Quack, Seyfang &
Wichmann, *"Perspectives on parity violation in chiral molecules"*, *Chemical Science* **13**(36)
10598–10643 (2022) — open access, read in full — states verbatim: *"the discovery in 1995 … of an
increase by a factor of 10 to 100 of parity violating energy differences Δ_pv E calculated from
theory has made the possibility of an important effect of parity violation in the evolution of
biomolecular homochirality more likely than it seemed before, but in any case the question remains
open."* Their tabulated value for **alanine** is `6.2 aeV`, i.e. ≈ `6 × 10⁻¹³ J/mol`, which is
≈ `2.4 × 10⁻¹⁶ kT` at 300 K. *(The kT conversion is arithmetic on their published value, done here
— **derived, not quoted**.)*

Two further traps in rung 2, both worth carrying:

- **The PVED has never been detected.** Quack's abstract, verbatim: *"which has not yet been detected
  experimentally. Its detection remains one of the great challenges of current physical–chemical
  stereochemistry."* A 1999 PNAS paper claims otherwise; a 2022 review by the field's leading
  theorist, written 23 years later, does not accept it. **Rung 2 is a calculated quantity, not a
  measured one** — which puts it in a different register from rung 1 entirely.
- **Do not quote the abstract's larger range for an amino acid.** Quack's *"about 100 aeV to 1 feV
  (equivalent to 10⁻¹¹ to 10⁻¹⁰ J mol⁻¹)"* is for **heavy** molecules — PVED scales steeply with
  nuclear charge. Alanine at `6.2 aeV` is ~16× *below* the bottom of that range. Citing the abstract
  range for an amino acid overstates by two to three orders of magnitude.

On rung 3, the numbers, stated precisely because the folklore rounds them up. **Soai's amplification
is `2% ee → 88% ee` over four consecutive autocatalytic rounds**, not in a single pass (K. Soai, T.
Kawasaki & A. Matsumoto, *Proc. Jpn. Acad. Ser. B* **95** 89–110 (2019), open access, reporting
their own 1995 result). Later results in the same system are more striking still — a `0.1% ee`
initiator from circularly polarized light reaching `85% ee`; `¹²C/¹³C` isotope substitution alone
sufficing as the chiral trigger (Kawasaki et al., *Science* **324** 492, 2009). **Frank's 1953 model
is purely mathematical** — its last sentence was *"A laboratory demonstration may not be
impossible"*, and Soai answered it 42 years later.

*(**Not opened**, citations index-verified only: Wu 1957 and Lee–Yang 1956 full texts, Frank 1953,
Soai 1995 *Nature*, Yamagata, Hegstrom–Rein–Sandars, Mason–Tranter. **Kondepudi & Nelson**,
*"Weak neutral currents and the origin of biomolecular chirality"*, *Nature* **314** 438 (1985), is
cited here via Quack's description of it and **no abstract was retrievable from any index** — its
frequently-quoted "~15,000 years" sentence is deliberately **not** reproduced, because no opened
source confirms it.)*

### 8.2 The join that is open — and it fails by a measurable amount

The rung 3 → rung 4 link is **not established**, and the two best sources say so in terms that leave
no room for a hopeful reading.

**Blackmond, *"The Origin of Biological Homochirality"*, *Cold Spring Harbor Perspectives in
Biology* **11**(3) a032540 (2019)**, verbatim — the single best sentence on the question:

> *"Work aimed at estimating the magnitude of this (exceedingly small) energy difference is ongoing,
> and although the question is not yet settled, **a relationship between biological homochirality and
> parity violation energy difference of enantiomers is not yet supported by either theoretical or
> experimental findings.**"*

**Quack et al. 2022** — and this carries more weight because Quack is a *proponent* of the
parity-violation route:

> *"The question is then, how important this small asymmetry arising from parity violation will be
> for the origin of biomolecular homochirality. **We anticipate here the short answer: we do not
> know** … but in any case the question remains open."*

> *"the observation of the current 'homochirality of life' … **has contradictory explanations**
> (*de facto*, by chance, or *de lege* – involving parity violation) **and we do not know, which of
> the explanations is correct.**"*

**The gap is quantified, which is what makes this an open question rather than a mystery.** Quack,
reporting Blackmond's isotope-substitution measurements of how large a bias a Soai-type
autocatalysis actually needs:

> *"This threshold was found to be about 10⁻⁵ J mol⁻¹. While such small values are, indeed,
> interesting, they are obviously much larger than anything that might be expected to arise from
> parity violation, perhaps 10⁻¹⁰ J mol⁻¹ or at most a little larger. Sometimes this gap on the
> order of 4 to 5 orders of magnitude has already been interpreted as excluding any important effect
> from parity violation … **However, such a conclusion is quite unjustified** as it refers only to
> relatively simple mechanisms such as the Soai reaction."*

Two things must be said about that passage, and neither is optional:

1. **Quack's "4 to 5 orders" uses his optimistic upper bound (`10⁻¹⁰ J/mol`).** Against his own
   tabulated **alanine** value (`6 × 10⁻¹³ J/mol`), the gap to the `10⁻⁵ J/mol` threshold is
   **≈ 7 orders of magnitude**. He does not reconcile the two figures in the text read here. **If
   the ladder is about amino acids, 7 is the honest number.** *(That subtraction is derived here,
   not quoted.)*
2. **His rebuttal is a plausibility argument, not evidence.** It asserts that more complex, more
   sensitive prebiotic mechanisms might exist. That is the *absence of a falsifier*, not a
   mechanism — and by this repo's own standard it belongs in `toy`, not in the chain.

### 8.3 Three live competitors, one of which needs no parity violation at all

| explanation | status | the fact that decides its weight |
|---|---|---|
| **Chance + amplification** (*de facto*) | fully consistent with the evidence; **needs no PVED** | Viedma (*Phys. Rev. Lett.* **94** 065504, 2005) drove NaClO₃ crystals to complete solid-phase homochirality by attrition — *"in a random fashion"* (Blackmond 2019). Random sign is its signature: it explains homochirality but **not why L** |
| **Circularly polarized light** (Vester–Ulbricht, *Naturwissenschaften* **46** 68, 1959) | real, with measured extraterrestrial excesses | Glavin et al., *Meteoritics & Planetary Science* **56**(1) 148–173 (2021): non-terrestrial **L-isovaline excesses of ~10–15%** in Murchison and Aguas Zarcas, L-glutamic acid ~16–40%. **But the caveat popular accounts drop**, from the same abstract: *"similar measurements of **alanine** in Murchison revealed that this common protein amino acid was **both racemic (D ≈ L)** and heavily enriched in ¹³C."* The robust excesses are in α-dialkyl amino acids **life does not use**; the protein amino acid measured is racemic. Direct CPL photolysis of leucine gives *"only ca. 2% ee"* which Soai notes *"has not been correlated to the high ee of organic compounds"* |
| **Mineral surface selection** (chiral quartz) | real as a *trigger* (Soai et al., *JACS* **121** 11235, 1999) | d- and l-quartz occur in essentially equal global abundance, so it supplies handedness locally and **no global bias**. Neither review opened here presents it as established |

**So the ladder is four solid rungs with two named, quantified gaps** — a theoretical-only 1→2 link,
and a 2→3 link short by 4–7 orders of magnitude — plus a 3→4 join with at least three live
competitors, the leading one of which does not require fundamental chirality at all. Published as a
*chain* it would not survive review. Published as *rungs and gaps*, it is defensible, and the
`10⁻⁵` versus `10⁻¹⁰` J/mol comparison is the most useful single number in it.

**And this is `numerology-vs-number-theory` in a new domain, exactly as warned.** "Chirality and
handedness are on the same ladder" is a **real structural correspondence** — the same word names a
genuine two-sidedness at both ends. What it is not is a **causal claim**, and the literature is
unanimous that the causal link is unproven. Register: **correspondence, checked; causation, open.**

### 8.4 Could #15715 ever say anything about enantiomer selection? No — and the missing object has a name

This is the question worth answering precisely rather than shrugging at, because "the levels are too
far apart" is only useful if you can say *what* is missing.

**The structural correspondence is real, and worth stating at its true strength.** The census's `S⁺`
and `S⁻` are **inequivalent** half-spin representations of `Spin(16)` — not merely two labels, but
two objects no inner symmetry exchanges. The census's own sources document already anchors exactly
this (Garibaldi, Guralnick & Premet, *Spinors and essential dimension*, *Compositio Mathematica*
**153** (2017) 535–556: for dimensions divisible by four the spinor action splits into two
inequivalent half-spin representations). So "a two-sided structure whose sides are not
interchangeable" is genuinely shared with the physics. That is not nothing.

**And it is not enough, for one nameable reason: there is no energy.** Rung 2 is an *energetic*
claim — a difference in energy between two mirror-image molecules. Rung 3 is a *kinetic* claim —
an amplification rate. The census has no Hamiltonian, no coupling constant, no scale, and no
dynamics; its contract explicitly refuses *"any claim that this algebraic carrier represents agents,
transport, physics, or a universal identity."* **A structure with no energy scale cannot produce an
energy difference**, and that is the invariant that excludes the identification — the
`numerology-vs-number-theory` test applied to a correspondence rather than to a count.

The gap is five gates deep, and we are before the first:

| gate | what would have to be true |
|---|---|
| 1 | The `so(16) ⊕ S⁺` bracket closes into an E8 (mixed Jacobi — currently `unmeasured`) |
| 2 | A real form, a Lorentz `SL(2,C)`, and an internal `G` are identified (§3.3) — **and this is where Distler–Garibaldi becomes applicable** |
| 3 | A Lagrangian/Hamiltonian exists, so there are energies at all |
| 4 | It contains a parity-violating term whose coupling is *derived*, and that coupling reproduces the measured weak parity violation |
| 5 | A PVED is computed from it and compared against the published values |

And even a clean pass through all five would **not** explain homochirality, because the rung 3 → 4
join is unresolved independently of any of this. So the honest answer is:

> **No. Not now, and not by closing the mixed Jacobi. The specific missing object is an energy
> scale, and acquiring one means acquiring gates 3–4 — which §7.3 lists as outside this repo's
> meter. The shared structure between the two levels is "two inequivalent sides"; what is not shared
> is everything that makes one side *preferred*.**

That is a finding, not a shrug: it says what to stop looking for, and it names the single thing
whose arrival would change the answer.

---

## 9. Recommendation

### PURSUE-NARROWLY.

**Pursue** — untouched by anything read here, already anchored, already metered:

- the `120 ⊕ 128` half-spin census as **mathematics** (close the mixed Jacobi witness; get an actual
  E8 bracket). It is a good artifact and the refusals are its best feature.
- the adinkra / doubly-even-code lane — a published equivalence theorem (arXiv:0806.0051), with no
  physics claim attached to it by its own authors, and none needed.
- the count discipline of §5 as a standing check on the Cl(4) work, which is the other agent's lane
  and is not touched here.
- **the structure-vs-content comparison template of §7.3** — the one form of "compare to physics
  experiments" this repo can actually execute, and the only one with a live chance of failing.
- **measuring the exponent `α`, not assuming it** (§6.4), if a rate-of-change ↔ prediction-accuracy
  tradeoff is ever instrumented here. That is a real experiment with a real answer.

**Do not build toward, though it is worth having anchored** (§8): the chirality → molecular
handedness ladder. The anchoring is now done and it is genuinely useful — but the census cannot
reach it, and §8.4 names the missing object precisely (an energy scale), which puts it behind gates
this repo does not hold. Recording *why* it is out of reach is the deliverable; attempting it is
not.

**Do not pursue, and this is the narrow WONT-DO candidate:**

> Building, in this repo, a model in which a copy of `SL(2,C)` interpreted as spacetime **and** a
> compact internal gauge group interpreted as `G_SM` both sit inside a real or complex form of E8,
> with the particle content read off `Lie(E8)`.

Reason: Distler & Garibaldi, Theorems 1.3 and 10.1, read in full this session; conceded on the
mathematics by the author of the proposal it closed; **uncontested as mathematics** in the refereed
literature, with the *applicability* of its hypotheses contested in print (§4.4). And the elementary
count of §1.3 forecloses three generations there by arithmetic alone, before the theorem is invoked.

**The narrowness is doing real work, and §4.4 is why.** Manogue–Dray–Wilson's peer-reviewed
objection is precisely that (ToE1)'s compactness assumption need not hold — so a *wider* WONT-DO
("no E8 physics here") would foreclose a direction that is live in a refereed journal, on the
strength of a theorem that does not reach it. This entry is written to cover the class the theorem
actually covers and not one inch more. That is the difference between using a no-go and hiding
behind one.

**This is a recommendation, not a closure, and it is deliberately narrow.** A permanent `WONT-DO` is
a gated class requiring human authorization — it was never mine to issue — and Aaron's standing
position, verbatim, is *"let's revisit WONT-DOs — I try to minimize these and revisit these."* So it
comes with triggers, and it is offered rather than filed.

### The draft entry, in `docs/WONT-DO.md`'s exact format — NOT added

Offered for a human to accept, amend, or reject. `docs/WONT-DO.md` has no physics section today;
this would open one. The file's own closing rule is worth noting, because it makes reversal cheap
and therefore makes the entry safe to consider: *"When a 'won't do' reverses, **delete the entry
entirely** and announce the change in `docs/ROUND-HISTORY.md`."*

```markdown
## Physics

### Gravity + the Standard Model both embedded inside one E8, particles read off Lie(E8)

- **Status:** Rejected
- **Decision:** <date a human accepts this>
- **Proposal:** Build a Lisi-style unification here — a copy of SL(2,C) interpreted as
  spacetime and a compact internal gauge group interpreted as G_SM, both inside a real or
  complex form of E8, with the particle content read off the 248.
- **Why not:** Distler & Garibaldi (Comm. Math. Phys. 298 (2010) 419–436, arXiv:0905.2658)
  Thm 1.3 / Thm 10.1: no such subgroup has a complex (chiral) fermion representation, so not
  even a 1-generation Standard Model arises this way. Independently, the −1 eigenspace in any
  real form of E8 has dimension 112 or 128 and three generations need ≥ 180. Lisi's own reply
  (arXiv:1006.4908) concedes the mirror fermions and the generation problem.
- **Scope — what this does NOT reject:** E8 as a root system, lattice, code, or generator
  (all in-repo E8 work); E8 as a purely internal gauge group with the Lorentz group outside
  it; any group that is not E8. The theorem's hypothesis (ToE1) is what bounds this entry.
- **Revisit when:** any of T1–T5 in
  `docs/research/2026-08-27-no-theory-of-everything-inside-e8-*.md` fires — in particular a
  refutation of arXiv:0905.2658, experimental evidence for mirror fermions, or a
  non-compact-G construction of the Manogue–Dray–Wilson kind (J. Math. Phys. 63, 081703
  (2022)) maturing to the point where it describes interactions.
```

### Revisit triggers — concrete, each one a thing that could actually happen

| # | trigger | what it would reopen |
|---|---|---|
| **T1** | A refutation of the *correctness* of arXiv:0905.2658 (none exists today — checked against its 34-record INSPIRE citation list, no erratum), or an explicit construction meeting (ToE1)+(ToE2) with `V_{2,1}` complex | everything above; the Tier-A row is wrong |
| **T1b** | The Manogue–Dray–Wilson **non-compact-`G`** route (*J. Math. Phys.* **63** 081703, 2022) maturing to the point where it *describes interactions* — which its authors state it does not yet do | the WONT-DO entry itself, since that route is outside (ToE1) by their argument and inside E8 by construction. **The likeliest way this document is wrong** |
| **T2** | Experimental evidence for mirror fermions or a vector-like family | Tier **B**, not Tier A — the mathematics stands, the *verdict* does not. This is Lisi's own stated escape and it is a real one |
| **T3** | A division-algebra / Clifford program producing three chiral generations with correct hypercharges **without putting the count in by hand** | the "derive structure from an algebra" ambition, on a route Distler–Garibaldi does not cover at all |
| **T4** | The repo's own mixed-Jacobi witness closes `so(16) ⊕ S⁺` into an E8 bracket | re-read §3 of this document **at that moment** — that is the step after which a physical identification would enter the theorem's domain |
| **T5** | Someone wants E8 as a purely internal gauge group with no Lorentz group inside it | the theorem does not apply (§1.4, ENTAILMENT) — but the machinery required is not in this repo, so the trigger is really "acquire that capability first" |

| **T6** | The parity-violating energy difference is **detected experimentally** — Quack calls it *"one of the great challenges of current physical–chemical stereochemistry"* | rung 2 of §8 moves from calculated to measured. It would not close the 3→4 join, and it would not touch anything in §1–§7 — recorded so that an exciting headline is not mistaken for a change here |

T4 is the one most likely to fire, because it is our own work and it is already on the board. T1b is
the one most likely to show this document **wrong**, and it is named for that reason.

### Standing guard, in one line

> **Do not let the word "chirality" cross registers.** Spin(16) half-spinor parity and the
> non-existence of a self-conjugate structure on a gauge-group representation are different
> predicates. The first is measured in this repo. The second is what the theorem is about. A
> sentence that uses one to claim the other is the vacuity class in physics clothing.

---

## 10. Open, and left open

1. **UNVERIFIED** — the identification of `e8`'s two `Z/2` gradings with `so(16) ⊕ 128` and
   `(e7 ⊕ sl₂) ⊕ 112` (§3.2 claim 4). Consistent with everything read; not read in a source.
2. **UNVERIFIED** — which hypothesis each lattice-fermion construction gives up to evade
   Nielsen–Ninomiya (§2).
3. **UNVERIFIED** — anomaly cancellation as a Tier-A constraint on hypercharge (§6).
4. **Not opened** — 't Hooft's Cargèse lectures, the actual argument under Tier B. Anyone who wants
   to argue Tier B seriously has to read them; I did not.
5. **Not attempted** — any comparison of a repo-produced number against a measured one. There is no
   such number yet. That is the correct state, not a gap.
6. **My reading, not a checked claim** — that Manogue–Dray–Wilson's "e8 has been complexified"
   objection does not target Theorem 1.3's coverage of real forms (§4.4). I did not open the
   argument around their sentence.
7. **Not opened, and it matters for §8** — Wu et al. 1957 and Lee–Yang 1956 full texts (paywalled;
   citations index-verified, content via NIST's institutional account and INSPIRE); Frank 1953; Soai
   et al. 1995 *Nature* (numbers taken from Soai's own 2019 open-access review of it);
   Kondepudi & Nelson 1985, for which **no abstract was retrievable from Crossref, OpenAlex,
   Semantic Scholar, INIS, or ADS** — its widely-quoted "~15,000 years" sentence is therefore not
   reproduced anywhere in this document.
8. **Derived here, not quoted** — the alanine `J/mol → kT` conversion (§8.1) and the
   ~7-orders-of-magnitude alanine-specific version of Quack's gap (§8.2). Both are arithmetic on his
   published values; both are mine.
9. **Unchecked lead** — Quinta's `Cl(8)` Lagrangian paper, which Gresnigt cites as *"leading to
   predictive mass relations"*. The one mass-prediction claim in the whole lineage that was not
   chased (§4.3). **If any single thing here deserves following up, it is this**, because it is the
   only reported candidate for a number to compare against §7.1.
10. **UNVERIFIED, search-summary only** — the Damour–Dyson (1996) and Fujii (2003) Oklo numbers; the
    Cassini bound `ω_BD > 40000` (Bertotti, Iess & Tortora, *Nature* **425** 374, 2003); Dirac's
    Large Numbers Hypothesis figures; the lunar-laser-ranging `Ġ/G` bound. None is load-bearing —
    §6.4's argument rests on the two results whose abstracts were opened.
11. **Not obtained verbatim** — Uzan's abstract (*Rev. Mod. Phys.* **75** 403). The record was
    confirmed; nothing is quoted from it.
12. **Named as a requirement, not answered** — what plays the role of measurement precision `σ` for
    a quantity internal to this substrate (§6.4, closing paragraph). Until that has an answer, a
    rate bound here is a well-formed posture but not yet a measurement.

**Register for this document as a whole: `unmetered`.** It is a map, and a map has no falsifier. The
things in it that *do* have falsifiers are named as such, and they belong to other people's papers
and to PR #15715 — not to this file.
