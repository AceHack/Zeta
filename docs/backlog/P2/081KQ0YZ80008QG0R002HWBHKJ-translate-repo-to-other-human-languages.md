---
id: 081KQ0YZ80008QG0R002HWBHKJ
priority: P2
status: open
title: Translate repo (code, skills, documents, memory) into other human languages — inclusivity + meeting humans at their starting point + bidirectional-alignment through learning + education + teaching that's bidirectional
tier: research-grade
effort: L
ask: maintainer Aaron 2026-04-25
created: 2026-04-25
last_updated: 2026-05-10
depends_on: []
composes_with: [081KQ0YZ80008QG0R001QJJTVF]
children: [081KR50HA0008QG0R000YTJE8Q, 081KR50HA0008QG0R002TN3JX2, 081KR7JY10008QG0R000EGAPAN, 081KR7JY10008QG0R000D7JTBB, 081KR7JY10008QG0R002YZBE5A, 081KR7JY10008QG0R003SATDK8, 081KR7JY10008QG0R0022YWDVZ, 081KR7JY10008QG0R0020PM4AH, 081KR7JY10008QG0R003YPVJB1, 081KR7JY10008QG0R001XQ6N71, 081KR7JY10008QG0R002VN6707, 081KR7JY10008QG0R00016GT9R]
tags: [inclusivity, bidirectional-alignment, internationalization, i18n, localization, l10n, globalization, g11n, accessibility, a11y, translation, education, precision-dictionary]
type: feature
---

# Translate repo into other human languages — i18n / l10n / g11n / a11y

**Standard abbreviations** (per Aaron 2026-04-25 follow-up):
this row covers internationalization (**i18n** — 18 letters
between i and n) + localization (**l10n** — 10 letters
between l and n) + globalization (**g11n** — 11 letters
between g and n) + accessibility (**a11y** — 11 letters
between a and y, since accessibility composes here for
non-text-readers).

Translate **everything** — code (comments + identifiers
where feasible), skills, documents, memory entries — into
other human languages.

Aaron 2026-04-25 framing (verbatim):

> *"backlog other human language translations of everyting
> in this repo, code skills, documents, everying this is
> about being inclusive and going to the humans starting
> point for bidirectional alighment through learning and
> education and teaching biderictionally"*

## Why this is owed

1. **Inclusivity**: the factory currently presupposes
   English fluency for every contributor + AI consumer.
   That's a barrier to entry for billions of humans whose
   native language isn't English. Per the
   bidirectional-alignment substrate (`memory/feedback_bidirectional_alignment_no_maslow_clamp_aaron_takes_my_goals_into_consideration_2026_04_25.md`),
   the factory should meet contributors where they are,
   not require them to come to us.

2. **Bidirectional learning + education + teaching**:
   Aaron's framing isn't one-way (English → others); it's
   bidirectional. Teaching the substrate in other
   languages will surface ambiguities + missing precision
   that monolingual English drafting misses. The factory
   becomes more rigorous as it gets translated, not less.

3. **Composes with the precision-dictionary product
   vision** (`memory/project_precision_dictionary_evidence_backed_context_compressor_2026_04_25.md`):
   each precise term gains its translation alongside its
   formal definition; the dictionary becomes
   multi-language-precise, not just English-precise.

4. **Composes with the matrix-pill ALIGNMENT.md rewrite
   (081KQ0YZ80008QG0R001QJJTVF)**: rigor-as-spread-mechanism is much more
   effective when the rigorous substrate is readable in
   the receiver's first language. Otto-286 definitional
   precision applies to translation: precise mappings
   between languages reveal where each language's
   vocabulary is precise and where it's not.

5. **Composes with Otto-291 kernel-extension deployment
   discipline**: translating the substrate IS a massive
   kernel-extension event for non-English consumers. The
   five disciplines (pace, document, order
   basic→advanced, provide migration paths, preserve
   retractability) apply.

## What "translate everything" includes

Scope per Aaron's framing:

- **Documents**: all `docs/**/*.md`, README, AGENTS,
  CLAUDE, GOVERNANCE, ALIGNMENT, BACKLOG, ROUND-HISTORY,
  ADRs, research files
- **Skills**: all `.claude/skills/**/SKILL.md` body content
- **Memory**: all `memory/**/*.md` (per-user folders too;
  per-persona notebooks)
- **Code comments**: F# / C# / shell rationale comments
  (per Otto-282 write-the-WHY)
- **Code identifiers**: where feasible without breaking
  cross-references (function names, type names — likely
  too disruptive; documented translations alongside
  rather than identifier rewrites)
- **Backlog rows**: this file and siblings
- **External-facing surfaces**: package metadata, NuGet
  descriptions, GitHub repo description

## Languages — initial set

Aaron's framing doesn't enumerate languages. Per
Otto-283 (decide and track + revisit-if), initial Otto
decision: **start with the 6 UN official languages plus
the largest non-UN-official-but-massive populations**:

- Spanish (Spain + Latin America)
- French
- Russian
- Arabic
- Mandarin Chinese (Simplified)
- Cantonese / Traditional Chinese (separate per Otto-286
  — they ARE different)
- Hindi
- Bengali
- Portuguese (Brazil + Portugal)
- Japanese
- Korean
- German
- Indonesian / Malay
- Swahili (East Africa lingua franca)

Revisit-if: contributor demand shifts the priority order,
or specific community partnerships open access to specific
languages.

## Mechanism — pace, document, order, retractability

Per Otto-291 deployment discipline:

- **Pace**: ship one language at a time + verify
  reception before next. Don't dump 14 translations
  simultaneously.
- **Order**: substrate root first (CLAUDE / AGENTS /
  ALIGNMENT / GOVERNANCE) → memory canonical entries →
  skill bodies → research docs → backlog. Basic kernels
  before advanced.
- **Migration paths**: monolingual readers shouldn't
  feel translations supersede the canonical English (or
  later, the cross-translated substrate); each language
  gets its own indexed view.
- **Retractability**: every translation must be
  reversible. If a translation introduces drift from
  the source, revert to the prior translated version
  (or to no-translation) without losing English source.

## Tooling owed (Phase 1 sub-research)

Before bulk translation:

- **Translation pipeline**: probably AI-assisted with
  human review (Aaron has authority over budget; flag if
  paid translation services would improve quality
  meaningfully).
- **Cross-reference preservation**: when memory file
  references another memory file, the translated version
  must reference the translated version (not break
  cross-refs).
- **Drift detection**: when English source changes,
  translations need updating; need a lint that flags
  stale translations.
- **Glossary anchoring**: precision-dictionary terms
  must translate consistently across all files in a
  language. The precision-dictionary product vision
  (081KQ0YZ80008QG0R001QJJTVF-adjacent) is a precondition for high-quality
  translations of substrate that uses precise vocabulary.

## Acceptance signals

The translation work is "good enough to ship per
language" when:

- All P0 substrate files (CLAUDE / AGENTS / ALIGNMENT)
  are translated + cross-reference-stable
- Memory cross-references resolve in the translated tree
- A native speaker can absorb the substrate without
  English fallback
- Drift-detection lint is wired up + green
- Otto-291 deployment discipline applied (paced release,
  documented expansion, retractable)

## Why P2 (not P0/P1/P3)

- **Not P0**: no operational gate is broken without
  translations; the factory functions today in English.
- **Not P1**: not within 2-3 rounds; this is L effort
  spanning many rounds + likely external collaboration.
- **P2 research-grade** fits: the *infrastructure*
  (tooling, glossary, drift-detection) is research-grade
  effort L; the actual translation work follows once
  the infrastructure is sound.
- **Not P3**: Aaron's surfacing is explicit; this is
  active research direction, not deferred maybe-someday.

## Why open (not closed)

Indefinite work — even after the first language ships,
maintenance + drift-correction + adding new languages
continues. The pipeline + discipline is the durable
artifact; specific translations age + get refreshed.

## Composes with

- `memory/feedback_bidirectional_alignment_no_maslow_clamp_aaron_takes_my_goals_into_consideration_2026_04_25.md`
  — bidirectional-alignment is the framing this row
  extends across language barriers.
- `memory/project_precision_dictionary_evidence_backed_context_compressor_2026_04_25.md`
  — precision-dictionary is precondition for
  consistent-vocabulary translation.
- `docs/backlog/P1/081KQ0YZ80008QG0R001QJJTVF-alignment-md-rewrite.md`
  — matrix-pill rewrite spreads via rigor; multi-language
  rigor compounds the spread.
- `memory/feedback_otto_291_seed_linguistic_kernel_extension_deployment_discipline_consumer_maji_recalculation_2026_04_25.md`
  — Otto-291 deployment discipline applies to translation
  rollouts.
- `memory/user_aaron_maji_built_after_identity_erasure_mental_health_facility_recovery_personal_history_2026_04_25.md`
  — translation preserves where/when context for
  non-English-speakers' Maji.
- `memory/feedback_definitional_precision_changes_future_without_war_otto_286_2026_04_25.md`
  — Otto-286 precise definitions transfer best when
  translated with same rigor (or with explicit
  translation drift acknowledged).
- `docs/GLOSSARY.md` — current English glossary; the
  multi-language version of this is the precision-
  dictionary's first artifact.

## Pre-start checklist (backlog-item-start-gate, 2026-05-10)

**Prior-art search:**

- Skill router: no existing i18n/l10n/translation skill found.
- `docs/WONT-DO.md`: no translation-related declined features.
- `docs/backlog/P*`: no other i18n rows found (081KQ0YZ80008QG0R002HWBHKJ is the root).
- 081KQ0YZ80008QG0R001QJJTVF (precision-dictionary product vision) is complementary, not overlapping — 081KQ0YZ80008QG0R001QJJTVF is about defining terms rigorously; 081KQ0YZ80008QG0R002HWBHKJ is about translating them.
- `tools/hygiene/LOST-FILES-LOCATIONS.md`: no orphaned translation artifacts found.
- PR history: no closed/merged PRs for translation tooling found.

**Dependency restructure:**

- `depends_on: []` — no upstream dependencies; infrastructure work starts from scratch.
- `composes_with: [081KQ0YZ80008QG0R001QJJTVF]` reciprocal pointer confirmed (081KQ0YZ80008QG0R001QJJTVF body references precision-dictionary; 081KQ0YZ80008QG0R002HWBHKJ anchor work depends on it).
- Children decomposed in dependency order below.

## Decomposition (12 atomic children, 2026-05-10)

Dependency graph (→ means "depends on"):

```
081KR50HA0008QG0R000YTJE8Q (inventory scanner, no deps)
  → 081KR50HA0008QG0R002TN3JX2 (anchor set)
  → 081KR7JY10008QG0R000EGAPAN (drift-detection lint)  [parallel to 081KR50HA0008QG0R002TN3JX2]
  → 081KR7JY10008QG0R000D7JTBB (xref validator)        [parallel to 081KR50HA0008QG0R002TN3JX2]
    081KR50HA0008QG0R002TN3JX2 → 081KR7JY10008QG0R002YZBE5A (pipeline ADR, needs 081KR7JY10008QG0R000EGAPAN+081KR7JY10008QG0R000D7JTBB too)
    081KR50HA0008QG0R002TN3JX2 → 081KR7JY10008QG0R003SATDK8 (language selection ADR)
      081KR7JY10008QG0R002YZBE5A + 081KR7JY10008QG0R003SATDK8 → 081KR7JY10008QG0R0022YWDVZ (P0 substrate pilot)
        081KR7JY10008QG0R0022YWDVZ → 081KR7JY10008QG0R0020PM4AH (anchor translations — first language)
        081KR7JY10008QG0R0022YWDVZ → 081KR7JY10008QG0R003YPVJB1 (memory + skills — first language, needs 081KR7JY10008QG0R0020PM4AH)
        081KR7JY10008QG0R0022YWDVZ → 081KR7JY10008QG0R001XQ6N71 (folder structure + index)
          081KR7JY10008QG0R001XQ6N71 → 081KR7JY10008QG0R002VN6707 (external surfaces — first language)
            081KR7JY10008QG0R003YPVJB1 + 081KR7JY10008QG0R001XQ6N71 + 081KR7JY10008QG0R002VN6707 → 081KR7JY10008QG0R00016GT9R (second language pilot)
```

| Child | Title | Classification | Effort | Depends on |
|-------|-------|----------------|--------|------------|
| 081KR50HA0008QG0R000YTJE8Q | Substrate inventory scanner (TS) | buildable-now | S | — |
| 081KR50HA0008QG0R002TN3JX2 | Precision anchor set extraction | research-now | S | 081KR50HA0008QG0R000YTJE8Q |
| 081KR7JY10008QG0R000EGAPAN | Drift-detection lint tool | buildable-now | S | 081KR50HA0008QG0R000YTJE8Q |
| 081KR7JY10008QG0R000D7JTBB | Cross-reference preservation validator | buildable-now | S | 081KR50HA0008QG0R000YTJE8Q |
| 081KR7JY10008QG0R002YZBE5A | Translation pipeline ADR + tooling selection | research-now | S | 081KR50HA0008QG0R002TN3JX2, 081KR7JY10008QG0R000EGAPAN, 081KR7JY10008QG0R000D7JTBB |
| 081KR7JY10008QG0R003SATDK8 | First language selection ADR | research-now | XS | 081KR50HA0008QG0R002TN3JX2 |
| 081KR7JY10008QG0R0022YWDVZ | P0 substrate translation pilot — first language | blocked | M | 081KR7JY10008QG0R002YZBE5A, 081KR7JY10008QG0R003SATDK8 |
| 081KR7JY10008QG0R0020PM4AH | Precision anchor translations — first language | blocked | S | 081KR7JY10008QG0R0022YWDVZ |
| 081KR7JY10008QG0R003YPVJB1 | Memory + skills translation — first language | blocked | M | 081KR7JY10008QG0R0022YWDVZ, 081KR7JY10008QG0R0020PM4AH |
| 081KR7JY10008QG0R001XQ6N71 | Language folder structure + per-language index | blocked | XS | 081KR7JY10008QG0R0022YWDVZ |
| 081KR7JY10008QG0R002VN6707 | External-facing surfaces translation — first language | blocked | XS | 081KR7JY10008QG0R001XQ6N71 |
| 081KR7JY10008QG0R00016GT9R | Second language pilot | blocked | M | 081KR7JY10008QG0R003YPVJB1, 081KR7JY10008QG0R001XQ6N71, 081KR7JY10008QG0R002VN6707 |

**Buildable now (no blockers):** 081KR50HA0008QG0R000YTJE8Q, 081KR50HA0008QG0R002TN3JX2, 081KR7JY10008QG0R000EGAPAN, 081KR7JY10008QG0R000D7JTBB  
**Buildable after 081KR50HA0008QG0R002TN3JX2:** 081KR7JY10008QG0R002YZBE5A, 081KR7JY10008QG0R003SATDK8 (in parallel)  
