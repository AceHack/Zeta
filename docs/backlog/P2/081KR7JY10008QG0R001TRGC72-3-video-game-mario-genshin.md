---
id: 081KR7JY10008QG0R001TRGC72
priority: P2
status: open
title: "Video-game priority tier — Super Mario + Genshin Impact"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR7JY10008QG0R0018G7ZQV]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, video-games, super-mario, genshin-impact, nintendo, mihоyo, operational-resonance, F1-F2-F3, media-resonance-catalog]
---

# 081KR7JY10008QG0R001TRGC72 — Video-game priority tier: Super Mario + Genshin Impact

## What

Extend `tools/resonance/media-catalog-schema.ts` with two new entries
covering the remaining Aaron-marked video-game priority seeds from 081KQ3HBZ0008QG0R003V6B2ME:

- **MR-008**: Super Mario (Nintendo, 1985–present)
  — warp-pipe portal-operator + power-up substrate-state transitions +
  Galaxy gravity-operators + Odyssey hat-capture-as-identity-transfer
- **MR-009**: Genshin Impact (miHoYo, 2020–)
  — seven-element substrate (Anemo / Geo / Electro / Dendro / Hydro /
  Pyro / Cryo) + Traveler paired-dual search across worlds

All entries follow the same three-filter discipline (F1/F2/F3) and
schema validation as MR-001 through MR-007.

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: `tools/resonance/media-catalog-schema.ts` is the
  canonical accumulator; no separate Mario/Genshin catalog exists.
- skill-router: no `operational-resonance` skill; phenomenon documented
  in memory files only (same as 081KR2E4K0008QG0R0003J0FB8/081KR7JY10008QG0R0018G7ZQV passes).
- on-disk: no prior `tools/resonance/video-games-mario*` or `genshin*`
  file; MR-NNN sequence ends at MR-007 after 081KR7JY10008QG0R0018G7ZQV.
- Otto-364: no upstream art.
- lost-files: `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphaned
  Mario or Genshin catalog artifacts.

**Dependency-restructure:**

- `depends_on: [081KR7JY10008QG0R0018G7ZQV]` — 081KR7JY10008QG0R0018G7ZQV landed MR-005..007 in the video-game
  section; this slice continues the same medium-category.
- `composes_with:` 081KR7JY10008QG0R003XG1PKJ (catalog-tier game sweep — non-blocking),
  081KR7JY10008QG0R0004KP70A (Double Fine sub-thread — non-blocking).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-008: Super Mario — warp pipes / power-ups / Odyssey hat-capture (candidate — F2 strong at mechanic level)
- MR-009: Genshin Impact — seven-element substrate + paired-dual Traveler (candidate — F2 strong, F3 moderate)
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-008 and MR-009 present with correct MR-NNN IDs
- [ ] `--validate` exits 0
- [ ] Both entries have honest filter assessments with rationale
- [ ] 081KR7JY10008QG0R001TRGC72 backlog row updated to `status: closed` in resolution

## Composes with

- 081KR7JY10008QG0R0018G7ZQV (video-game priority seeds MR-005..007 already landed)
- 081KR7JY10008QG0R003XG1PKJ (catalog-tier game sweep — separate non-blocking slice)
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
