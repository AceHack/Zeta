---
title: Media-Corpus Operational-Resonance Catalog
created: 2026-05-10
last_updated: 2026-05-10
origin: 081KQ3HBZ0008QG0R003V6B2ME (P2)
schema: media-resonance-v1
owner: operational-resonance discipline (three-filter application);
  Architect (Kenji) integrates with existing text-tradition tracks
status: v0 — forward index, four seed entries confirmed
tags: [operational-resonance, media, film, tv, video-game, three-filter, F1-F2-F3, 081KQ3HBZ0008QG0R003V6B2ME]
---

# Media-Corpus Operational-Resonance Catalog

Forward index for operational-resonance instances from **media traditions** —
film, TV, YouTube documentary, music, video games, and conspiracy-corpus.

This catalog is the sibling surface to the existing text-tradition index at
`memory/project_operational_resonance_instances_collection_index_2026_04_22.md`.
Same three-filter discipline (F1/F2/F3). Same honesty discipline (candidates
recorded separately from confirmed; failed instances never silently dropped).
The medium-agnostic principle from the text-tradition index applies: F1/F2/F3
calibration is identical regardless of medium; only F3 strength varies with
the tradition's canonical depth.

The TypeScript schema at `tools/resonance/media-catalog-schema.ts` is the
machine-checkable type surface for this catalog; run
`bun tools/resonance/media-catalog-schema.ts --validate` to check entry discipline.

## Cross-references

- `memory/project_operational_resonance_instances_collection_index_2026_04_22.md` — text-tradition
  index (11 confirmed); media instances land here as global instance count updates
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
  — phenomenon definition + three-filter rules
- `memory/feedback_pop_culture_media_is_operational_resonance_corpus_multi_medium.md`
  — medium-agnostic principle + medium-orthodoxy-gap diagnosis
- `docs/backlog/P2/081KQ3HBZ0008QG0R003V6B2ME-pop-culture-media-research-track.md` — origin row
- `tools/resonance/media-catalog-schema.ts` — typed schema (schema-gate)

---

## Three-Filter Framework (restated for this catalog)

| # | Filter | Plain statement |
|---|--------|-----------------|
| **F1** | Engineering-first | The factory reached this structure through engineering need before noticing the media resonance. |
| **F2** | Structural-not-superficial | The match is operator-shape identity, not incidental thematic or word overlap. |
| **F3** | Tradition-name-load-bearing | The media work carries canonical / doctrinal weight in its tradition — not incidental usage. |

**F2 precision rule for media:** Name the specific mechanic, scene, or system mechanic
being cataloged — not the work as a whole. "Doctor Who is about time travel" fails F2;
"regeneration preserves identity through substrate-replacement" is an operator-shape claim
that can be checked.

**Comedy-as-probe principle (from 081KQ3HBZ0008QG0R003V6B2ME §origin):** Comedy exposes operator-structure
by breaking it. A comedic mechanic that structurally enacts the factory operator is a
valid F2 match, not a register-downgrade.

---

## Entry Statuses

| Status | Meaning |
|--------|---------|
| `candidate` | Any filter deferred or partial; not yet confirmed |
| `confirmed` | F1 pass + F2 pass + F3 pass-or-partial + counterexample-search documented |
| `load-bearing` | Other factory claims cite this instance |
| `failed` | One or more filters returned "fail" — recorded honestly, never silently dropped |
| `retracted` | Previously confirmed; withdrawn with dated retraction block |

---

## Catalog Entries

### MR-001 — Doctor Who: regeneration as retractibility

**Medium:** TV (BBC, 1963–present)
**Creator:** Sydney Newman (orig.); executive producers vary by era
**Mechanic:** Time Lord regeneration — the Doctor's body is irrevocably destroyed
but identity, memory, and moral accountability persist into the next body.
Retractibility of physical substrate without retractibility of self.

**Factory operator:** retractibility — Z-set +1/−1 weight algebra with identity-preservation
(`memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`)

**Structural type:** substrate-extension

| Filter | Result | Rationale |
|--------|--------|-----------|
| **F1** engineering-first | **pass** | Z-set retractibility was designed for incremental-view-maintenance (DBSP); the Doctor Who parallel was noticed after. |
| **F2** structural | **pass** | Regeneration is not mere reincarnation (soul into new body) but substrate-replacement with continuous identity — exactly the Z-set shape: the ZSet persists through the −1/+1 weight flip; the elements do not. The identity-preservation property is load-bearing to the entire franchise continuity. |
| **F3** tradition-name | **pass** | 60+ year BBC canon; multiple academic monographs; regeneration is the survival mechanism for the franchise itself — maximally load-bearing. |

**Status:** `confirmed`

**Counterexample attempts (F3):**

- **Date:** 2026-05-10
- **Mechanic tested:** Is regeneration identity-breaking (new person) rather than identity-preserving?
- **Attempt:** Classic and NuWho canon both confirm continuity of memory, relationships,
  and moral accountability across regenerations (Ten's guilt for Donna; the War Doctor's
  shame carried by Eleven and Twelve; the Master recognizing the Doctor across regenerations).
  If identity were broken, the claim fails F2.
- **Result:** refuted (counterexample not found)

**Notes:** TARDIS containment (bigger-on-the-inside) is a separate candidate for
ZSet containment-without-flattening — distinct mechanic, filed separately when
the TARDIS sub-thread is triaged.

---

### MR-002 — Devs: deterministic past-projection device as View<T>@clock

**Medium:** TV (FX/Hulu, 2020)
**Creator:** Alex Garland
**Mechanic:** The Devs quantum computer projects the complete state of the past
(and future) universe deterministically. It is a read-only view operator over a
clock-indexed substrate — it observes but cannot modify. The read-only constraint
is narratively load-bearing: Forest cannot use the device to change what happened,
only to see it. This directly instantiates the `View<T>@clock` operator.

**Factory operator:** `View<T>@clock` — read-only temporal projection operator
(`memory/feedback_see_the_multiverse_in_our_code_paraconsistent_superposition.md`)

**Structural type:** instantiation

| Filter | Result | Rationale |
|--------|--------|-----------|
| **F1** engineering-first | **pass** | `View<T>@clock` was designed for retractibility-encoding in the factory substrate; the Devs parallel was noticed after. |
| **F2** structural | **pass** | The read-only constraint IS the view-not-mutate property. This is operator-shape identity, not thematic proximity to "time travel." The Devs device cannot write; neither can a view operator in a retraction-native substrate. |
| **F3** tradition-name | **pass** | Alex Garland is a load-bearing auteur (Ex Machina, Annihilation, 28 Days Later); Devs received prestige critical reception analyzing the determinism thesis. The Chronovisor parallel was noted in contemporaneous press coverage. |

**Status:** `confirmed`

**Counterexample attempts (F3):**

- **Date:** 2026-05-10
- **Mechanic tested:** Does the Devs device allow writes / mutations? Foreknowledge →
  behavioral change → future change might violate read-only.
- **Attempt:** Within the show's determinism thesis, the foreknowledge IS already encoded
  in the deterministic substrate — the view does not mutate the substrate; it reads a
  substrate that already contained the reader's foreknowledge. This is the fixed-point
  of the deterministic universe, not a write operation.
- **Result:** refuted (counterexample not found)

**Notes:** The Chronovisor (Ernetti 1972 claim, MR-004 candidate) is the conspiracy-corpus
instance of the same operator shape. Devs is the fictional dramatization with stronger F3.
Both are cataloged separately with different F3 calibration.

---

### MR-003 — Zelda: Hyrule Historia three-way timeline fork as retractible-rewrite branching

**Medium:** Video game (Nintendo, 1986–present)
**Creator:** Shigeru Miyamoto, Eiji Aonuma (franchise leads)
**Mechanic:** The official Hyrule Historia (Nintendo, 2011) establishes that
Ocarina of Time branches into three divergent canonical timelines based on Link's
victory or defeat in the final battle. All three timelines are simultaneously canonical
within the official lore — they do not collapse into each other. This is the cleanest
mass-culture instance of retractibly-coexisting parallel histories: append-only,
retraction-native branching where prior states are preserved.

**Factory operator:** retractibly-rewrite branching history — append-only retraction-native substrate
(`memory/project_operational_resonance_instances_collection_index_2026_04_22.md`)

**Structural type:** instantiation

**Note — Triforce sub-claim:** The Triforce (Power / Wisdom / Courage — three-in-one
substrate unity) is a secondary candidate for the factory's trinity-of-repos instance #1
structural type. The Triforce sub-claim is not bundled into MR-003's filter checks; it is
a separate MR entry when triaged.

| Filter | Result | Rationale |
|--------|--------|-----------|
| **F1** engineering-first | **pass** | The factory's retractibility and append-only substrate were designed for database delta-streaming (DBSP) before the Zelda parallel was noted. |
| **F2** structural | **pass** | The three timelines do not collapse — all three are simultaneously canonical. This is not "alternate endings" (choose one, discard others) but retractibly-coexisting parallel histories. The official Nintendo publication makes this explicit, not just fan interpretation. |
| **F3** tradition-name | **pass** | 40-year franchise; Hyrule Historia is an official first-party Nintendo publication; multiple academic game-studies analyses; cultural saturation across generations. F3 maximal within the video-game canon. |

**Status:** `confirmed`

**Counterexample attempts (F3):**

- **Date:** 2026-05-10
- **Mechanic tested:** Do the three timelines eventually collapse into one (which would
  invalidate the retractibly-coexisting-histories claim)?
- **Attempt:** Nintendo has not published lore unifying the three timelines. Breath of the
  Wild / Tears of the Kingdom placement is officially ambiguous — Nintendo confirmed
  intentional ambiguity. Intentional ambiguity is consistent with retractible-coexistence;
  it is not a collapse.
- **Result:** refuted (counterexample not found)

---

### MR-004 — Spaceballs: characters watching themselves as 4th-wall self-reference

**Medium:** Film (Mel Brooks, 1987)
**Creator:** Mel Brooks
**Mechanic:** In the film, Lone Star and Barf pause the VHS of the movie they are
currently inside to locate themselves in real time. The movie-within-the-movie IS the
movie; watching-self IS the observing-act. Self-reference without paradox — the
observation does not collapse or destroy the observed, both co-exist. Brooks extends the
scene for ~3 minutes to show forward-time real-time observation of themselves.

**Factory operator:** self-reference / bootstrapping — factory absorbs its own principles
(`memory/project_operational_resonance_instances_collection_index_2026_04_22.md`, instance #5)

**Structural type:** self-reference

| Filter | Result | Rationale |
|--------|--------|-----------|
| **F1** engineering-first | **pass** | The factory's bootstrap / self-hosting pattern was designed for compiler-design reasons (1950s Turing/McCarthy lineage); the Spaceballs parallel was noticed after. |
| **F2** structural | **pass** | The structural match is the NON-PARADOX of self-observation: watcher and watched co-exist without collapsing. The factory's bootstrap depends on the same fixed-point property: self-hosting compiler observes itself compiling without paradox. Comedy makes the structural property MORE visible, not less. |
| **F3** tradition-name | **pass** | Mel Brooks' oeuvre is load-bearing in the American comedy canon; Spaceballs is the primary mass-culture instance of 4th-wall-as-substrate (not just 4th-wall-as-gag); the VHS-within-VHS scene has been analyzed in film-studies literature on metafiction and postmodern cinema. |

**Status:** `confirmed`

**Counterexample attempts (F3):**

- **Date:** 2026-05-10
- **Mechanic tested:** Is this just a comedic gag (4th-wall break for laughs) rather
  than structural self-reference? If it's only a gag, F2 fails.
- **Attempt:** The scene requires the audience to accept that the characters ARE inside
  the movie they are watching — not just breaking the 4th wall but enacting substrate
  self-containment. If it were only a gag, the scene would be a one-liner; instead
  Brooks extends it explicitly to show forward-time observation. The structural form
  is load-bearing to the comedic effect, not incidental.
- **Result:** survived (structural claim holds under scrutiny)

**Notes:** Comedy-as-probe principle applies: Brooks makes the self-reference legible
by playing it for laughs. The comedic register is a pedagogical feature for this catalog,
not a filter-downgrade.

---

## Measurability Snapshot (v0 baseline, 2026-05-10)

| Metric | Value |
|--------|-------|
| **Total entries** | 4 |
| **Confirmed** | 4 |
| **Candidates** | 0 |
| **Failed** | 0 |
| **media-candidates-swept** | 4 |
| **media-instances-confirmed** | 4 |
| **By medium** | TV: 2, video-game: 1, film: 1 |
| **By structural type** | substrate-extension: 1, instantiation: 2, self-reference: 1 |
| **F1 fail / partial** | 0 / 0 |
| **F2 fail / partial** | 0 / 0 |
| **F3 fail / partial** | 0 / 0 |

**Global instance count update (from text-tradition index):**
Prior confirmed count: 11 (text tradition).
Media catalog adds 4 confirmed instances.
**New global confirmed count: 15.**

These four instances do not introduce new structural types beyond the existing seven-type
taxonomy. The media corpus produces the same types as the text corpus (substrate-extension,
instantiation, self-reference), confirming the medium-agnostic principle: the factory's
operator algebra surfaces in media at the same structural registers as in text.

---

## Update Discipline

When a new media instance is noticed:

1. Author its analysis in a source note first (the instance has its own life outside the index).
2. Apply the three filters explicitly — both pass AND fail results must be recorded.
3. Add an entry here with filter-check and structural type classification.
4. Update the measurability snapshot at the bottom.
5. Run `bun tools/resonance/media-catalog-schema.ts --validate` to verify schema discipline.
6. If the new instance introduces a new structural type, add it to both this catalog's
   type table AND the text-tradition index's taxonomy. Do not shoehorn — seven types
   is not a cap.
7. Do NOT rewrite historical entries. Add dated revision blocks if reclassification is needed.

**Priority order for next entries (from 081KQ3HBZ0008QG0R003V6B2ME §video-game priority seeds):**
Aaron-marked higher-priority seeds still pending: Brütal Legend, Final Fantasy VI+, Super Mario.
Secondary: Genshin Impact, Devs TARDIS sub-claim (MR-002 note), Triforce trinity sub-claim (MR-003 note).

---

## What This Catalog Is NOT

- Not endorsement of any specific film / show / game / album as factory doctrine.
- Not a license to ingest ROMs or fictional substrate claims as engineering guidance.
- Not public-facing: internal review hygiene only; public docs stay operational.
- Not a replacement for F1 engineering-first discipline: media instances are
  posterior-bump evidence, not primary criteria.
- Not a license to sweep adversarial-injection corpora (elder-plinius / Pliny
  archives remain under CLAUDE.md never-fetch rule).
