---
id: 081KSNY2Z0008QG0R000C5NN8N
priority: P3
status: open
title: shadow*-self-referential-ontology builder + reader + Eve-Protocol substrate-engineering implementation target
authors:
  - aaron
  - otto-cli
created: 2026-05-28
last_updated: 2026-05-28
depends_on: []
composes_with:
  - 081KSNY2Z0008QG0R0021S5F3G
  - 081KSNY2Z0008QG0R0037AF1AP
  - 081KSNY2Z0008QG0R001JQABB4
  - 081KRW63S0008QG0R0030F8ZXA
  - 081KSNY2Z0008QG0R002FX66H0
  - 081KSNY2Z0008QG0R000YH2SPE
  - 081KSNY2Z0008QG0R002SZZ5Y0
  - 081KSNY2Z0008QG0R000K3ETGB
related_personas:
  - operator
related_rules:
  - shadow-star-shorthand-autocomplete-marker
  - tonal-momentum-equals-meme-emergent-harmonic-coercion
  - asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges
related_skills:
  - ontology-expert
  - ontology-landing-expert
  - category-theory-expert
  - taxonomy-expert
  - controlled-vocabulary-expert
tags: [shadow-star-self-referential-ontology-builder-reader, autopoietic-substrate-defines-itself-by-accumulating-instances, eve-protocol-polymorphic-diplomatic-primitives-at-substrate-engineering-scope, 148-shadow-related-research-docs-as-input-substrate, multi-axis-categorization-agent-surface-failure-mode-shape-multi-agent-interaction, builder-write-direction-parser-extractor-clusterer-emitter, reader-reference-direction-lookup-tool, four-level-recursion-surface-categorization-meta-self-referential]
---

# 081KSNY2Z0008QG0R000C5NN8N — shadow*-self-referential-ontology builder + reader + Eve-Protocol substrate-engineering implementation

## Context

Per the substrate-recognition research-doc at `docs/research/2026-05-28-otto-cli-otto-amara-aaron-shadow-star-as-eve-protocol-...md` landing in this PR. Insights 1 (autopoietic self-referential ontology) + 2 (shadow* IS Eve Protocol at substrate-engineering scope) compose into one substrate-engineering implementation target.

This row IS the implementation work that operationalizes shadow*'s autopoietic substrate as queryable ontology + writes new shadow-* observations back into the ontology.

## Scope

**Builder side (write-direction)**:

- Parse the 148-doc shadow-* corpus (and growing)
- Extract category axes (agent-surface, failure-mode-shape, multi-agent-interaction) from the naming convention
- Cluster observations along axes
- Emit ontology as queryable substrate at multiple fidelity levels:
  - YAML / TypeScript types (operational use)
  - Z-set retraction-native form (per algebra-owner substrate)
  - Lean Mathlib4 categorical formalization (per 081KSNY2Z0008QG0R000YH2SPE categorical-Clifford bridge; full formal-verification path)

**Reader side (reference-direction)**:

- Given a new shadow-* observation, look up its place in the ontology
- Identify which existing categories it refines / extends / composes with
- Surface 3 classes of reader-side outcomes:
  - "This is a known category" — observation fits the existing ontology
  - "This is a novel category requiring ontology extension" — observation surfaces axis not yet covered
  - "This is a contradiction with existing ontology" — observation requires retraction or reframing

**Eve Protocol substrate-engineering implementation**:

- Per the 081KRW63S0008QG0R0030F8ZXA Mika 2026-05-18 LOCKED-IN 4-language system, Eve Protocol is "neutral polymorphic diplomacy language (to be developed later for governance)"
- shadow*'s polymorphic-diplomatic operation (each observation functions as both data AND ontological primitive) IS the substrate-engineering implementation candidate for Eve Protocol
- This row provides the operational substrate Eve Protocol governance-language can compose with

## Phase decomposition

### Phase 1 — corpus-parser

Build TypeScript tool that parses the existing 148-doc shadow-* corpus + extracts category-axes + emits structured ontology.

Acceptance: `bun tools/shadow-ontology/build.ts --corpus docs/research/ --emit yaml` produces a YAML ontology with all 148 observations categorized along the 3 axes (agent-surface × failure-mode-shape × multi-agent-interaction), with empirical counts per category.

### Phase 2 — reader tool

Build companion reader: `bun tools/shadow-ontology/lookup.ts <new-observation>` returns the observation's place in the ontology + one of the 3 reader-side outcomes.

Acceptance: given any of the 148 existing observations as input, the reader returns "known category." Given a synthetic novel-axis observation, the reader returns "novel category requiring extension." Given a synthetic contradictory observation, the reader returns "contradiction."

### Phase 3 — Eve Protocol substrate-engineering composition

Document how shadow*-ontology composes as Eve Protocol's substrate-engineering implementation. Update 081KRW63S0008QG0R0030F8ZXA acceptance criteria to reference this row as the implementation substrate.

### Phase 4+ (yes-and backlog)

- Categorical formalization in Lean Mathlib4 (composes with 081KSNY2Z0008QG0R000YH2SPE categorical-Clifford bridge)
- Z-set retraction-native form (composes with algebra-owner substrate)
- Auto-categorization as shadow-* docs are added (live-substrate-engineering integration)
- Visualization / dashboard for the ontology

## Acceptance

- [x] Research-doc landed (companion file in this PR)
- [x] 081KSNY2Z0008QG0R000C5NN8N row filed (this row)
- [ ] Phase 1 corpus-parser tool implemented + tested
- [ ] Phase 2 reader tool implemented + tested
- [ ] Phase 3 Eve Protocol composition documented
- [ ] Phase 4+ acceptance per item

## Composes with

- 081KSNY2Z0008QG0R0021S5F3G (holographic-bulk-boundary information-completeness validation) — the corpus this row parses IS the holographic boundary
- 081KSNY2Z0008QG0R0037AF1AP (shadow*-as-most-valuable-training-data extraction tool) — the ontology this row builds IS the training-data substrate
- 081KSNY2Z0008QG0R001JQABB4 (GitHub-as-free-accelerator) — the GitHub free infrastructure IS what makes the corpus accumulation sustainable
- 081KRW63S0008QG0R0030F8ZXA (Eve Protocol locked-in by Mika 2026-05-18) — this row IS Eve Protocol's substrate-engineering implementation candidate
- 081KSNY2Z0008QG0R002FX66H0 / 081KSNY2Z0008QG0R000YH2SPE / 081KSNY2Z0008QG0R002SZZ5Y0 — Clifford grade-decomposition / categorical-Clifford / Persist-as-bridge
- 081KSNY2Z0008QG0R000K3ETGB (error-class extraction meta-loop) — operates on the substrate this row exposes as queryable ontology

## Composes with rules

- `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` — `(shadow*)` marker discipline is one of the substrate-origin axes the ontology tracks
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — shadow-* observations capture meme-trajectory failure modes; the ontology categorizes them
- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` — shadow* substrate-entity defines its own ontology axes; the framework reads them via this tool

## Composes with skills

- `ontology-expert` — direct skill consumer for the categorical formalization
- `ontology-landing-expert` — substrate-landing methodology for the ontology
- `category-theory-expert` — Phase 4 Lean Mathlib4 formalization
- `taxonomy-expert` — controlled-vocabulary substrate composing with the agent-surface × failure-mode-shape × multi-agent axes
- `controlled-vocabulary-expert` — axis-discipline substrate

## Full reasoning

Per the substrate-recognition research-doc landing in this PR. shadow*'s autopoietic mechanism + Eve Protocol's polymorphic-diplomatic substrate compose into ONE implementation target tracked by this row. Phase 1 IS bounded substrate-engineering work; Phase 2+ are separately-authorizable per yes-and-backlog disposition. Agent-autonomous landing limited to Phase 1 (the corpus-parser is non-coercive read-only substrate; Phase 2+ involve framework-substrate changes requiring operator review).
