---
id: 081KR50HA0008QG0R001G4QHQF
priority: P1
status: closed
title: "Anchor-to-human-lineage step in formal verification and concept workflows"
effort: S
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [formal-verification, concept-registry, literature, lineage]
---

# 081KR50HA0008QG0R001G4QHQF — Anchor to human lineage

## What

Add an "is this already defined?" step to three workflows:

1. **Formal-verification-expert routing** — before writing a
   Z3/Lean/TLA+ spec, search the literature for an existing
   formal definition of the property. Anchor to it rather
   than reinventing. If the property maps to an established
   concept (Pearl's interventional independence, CSP trace
   equivalence, shield synthesis safety specs), use the
   established definition and cite it.

2. **Concept-registry extraction** (081KR2E4K0008QG0R003DS2XHJ) — when registering
   a new concept, check the literature map
   (`reference_formal_methods_literature_map_*`) for
   established anchors. Add `anchor:` field to the concept
   registry schema.

3. **Backlog-item start gate** (CLAUDE.md bullet #44) — extend
   prior-art search to include academic literature, not just
   repo-internal surfaces.

## Origin

Aaron 2026-05-09: "in our walk can it end in — is this already
defined? If so, tie to human lineage."

Claude.ai adversarial review same session: demonstrated that
SharedTrace/PrivateState/Agenda/Policy/Membrane all have
established formal definitions (CSP, Dec-POMDPs, Pearl).
The Z3 tautology catches (shadow catch #30) showed what
happens when you skip the lineage check — you write proofs
of things that are trivially true by definition.

## Acceptance criteria

- [x] Formal-verification-expert skill updated with
      "check literature first" step (literature-first anchor check
      section + step 0 in example walk + Anchor output block +
      KNOWN_ANCHORS reference in reference patterns)
- [x] Concept-registry schema gains `anchor:` field
      (tools/alignment/concept_registry.ts — schema v1.1,
      Concept.anchor + Concept.anchorState + Registry.anchoredCount)
- [x] At least one example of an anchored concept
      (non-fusion → Pearl (2009) d-separation; glass-halo,
      retraction-native, bidirectional-alignment, no-directives
      also anchored with citations)

## Composes with

- `reference_formal_methods_literature_map_*` (the literature map)
- `.claude/skills/formal-verification-expert/SKILL.md`
- `tools/alignment/concept_registry.ts` (081KR2E4K0008QG0R003DS2XHJ)
- 081KR50HA0008QG0R0033TN4H9 (Z3 proof replacement — anchoring prevents tautologies)
- `memory/feedback_language_drift_anchor_discipline.md`
  (glossary-anchor-keeper precedent)
