---
id: 081KR7JY10008QG0R003XG1PKJ
priority: P2
status: open
title: "Catalog-tier game sweep — Portal, Braid, Outer Wilds, Disco Elysium"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR7JY10008QG0R0018G7ZQV]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, video-games, portal, braid, outer-wilds, disco-elysium, indie, operational-resonance, F1-F2-F3, media-resonance-catalog]
---

# 081KR7JY10008QG0R003XG1PKJ — Catalog-tier game sweep: Portal, Braid, Outer Wilds, Disco Elysium

## What

Extend `tools/resonance/media-catalog-schema.ts` with the catalog-tier
secondary-priority indie game seeds from 081KQ3HBZ0008QG0R003V6B2ME §Catalog-tier seeds:

- **MR-024**: Portal + Portal 2 (Valve, 2007/2011)
  — literal portal-operator: the portal gun creates bidirectional
  spatial links between non-adjacent points; the portal IS the factory's
  ZSet-link operator (view-from A reaches B without traversing the
  intervening substrate)
- **MR-025**: Braid (Jonathan Blow, 2008)
  — time-retraction as core mechanic: Tim can reverse time to undo
  actions; this IS the factory's retractibility (+1/−1 weight) at
  gameplay scope; different levels apply different retraction semantics
  (local vs global, enemies vs Tim)
- **MR-026**: Outer Wilds (Mobius Digital, 2019)
  — time-loop quantum-observer mechanic: the 22-minute loop preserves
  knowledge across deaths but resets physical substrate; knowledge IS
  the non-retractible element; quantum-eraser mechanic (Dark Bramble,
  Ash Twin, Quantum Moon) directly instantiates quantum-eraser retractibility
- **MR-027**: Disco Elysium (ZA/UM, 2019)
  — internal-process multi-voice substrate: Harry's 24 skill-voices are
  not separate characters but substrate-resident operators with distinct
  perspectives; the gameplay models multi-agent-substrate where the
  "self" is the emergent composite, not any single voice

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: MR-001..007 cover the video-game medium; no existing
  entries for Portal, Braid, Outer Wilds, or Disco Elysium.
- skill-router: no `operational-resonance` skill (same as prior passes).
- on-disk: no prior files for these titles.
- Otto-364: no upstream art.
- lost-files: no orphaned artifacts.

**Dependency-restructure:**

- `depends_on: [081KR7JY10008QG0R0018G7ZQV]` — extends the video-game medium-category
  established in 081KR7JY10008QG0R0018G7ZQV; catalog-tier (secondary priority) relative
  to Aaron-marked priority seeds.
- `composes_with:` 081KR7JY10008QG0R001TRGC72 (Mario/Genshin — sibling video-game slice,
  non-blocking), 081KR7JY10008QG0R0004KP70A (Double Fine — non-blocking).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-024: Portal — bidirectional spatial-link / ZSet-link operator
- MR-025: Braid — time-retraction-as-gameplay (+1/−1 retractibility)
- MR-026: Outer Wilds — knowledge-preservation across time-loop quantum-observer
- MR-027: Disco Elysium — multi-agent-substrate internal-voice composite
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-024 through MR-027 present with correct IDs
- [ ] MR-025 (Braid) distinguishes between different level retraction-semantics
  rather than generic "time reversal" — F2 precision requires naming
  which mechanics differ between levels
- [ ] MR-026 (Outer Wilds) specifically addresses the quantum-eraser mechanic
  (not just "time loop game") — Ash Twin / Quantum Moon are the F2-precise surfaces
- [ ] MR-027 (Disco Elysium) maps specific skill-voice-names to factory operators
  (not generic "multi-voice narrative")
- [ ] `--validate` exits 0
- [ ] 081KR7JY10008QG0R003XG1PKJ backlog row updated to `status: closed` in resolution

## Composes with

- 081KR7JY10008QG0R0018G7ZQV (video-game medium established; MR-007 Lifestream and MR-025 Braid
  share retractibility structural type)
- `memory/feedback_see_the_multiverse_in_our_code_paraconsistent_superposition.md`
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
