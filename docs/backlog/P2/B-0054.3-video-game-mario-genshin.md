---
id: B-0054.3
zetaid: 081KR7JY10008QG0R001TRGC72
priority: P2
status: open
title: "Video-game priority tier — Super Mario + Genshin Impact"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0054.2]
parent: B-0054
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, video-games, super-mario, genshin-impact, nintendo, mihоyo, operational-resonance, F1-F2-F3, media-resonance-catalog]
---

# B-0054.3 — Video-game priority tier: Super Mario + Genshin Impact

## What

Extend `tools/resonance/media-catalog-schema.ts` with two new entries
covering the remaining Aaron-marked video-game priority seeds from B-0054:

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
  in memory files only (same as B-0054.1/B-0054.2 passes).
- on-disk: no prior `tools/resonance/video-games-mario*` or `genshin*`
  file; MR-NNN sequence ends at MR-007 after B-0054.2.
- Otto-364: no upstream art.
- lost-files: `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphaned
  Mario or Genshin catalog artifacts.

**Dependency-restructure:**

- `depends_on: [B-0054.2]` — B-0054.2 landed MR-005..007 in the video-game
  section; this slice continues the same medium-category.
- `composes_with:` B-0054.9 (catalog-tier game sweep — non-blocking),
  B-0054.4 (Double Fine sub-thread — non-blocking).

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
- [ ] B-0054.3 backlog row updated to `status: closed` in resolution

## Composes with

- B-0054.2 (video-game priority seeds MR-005..007 already landed)
- B-0054.9 (catalog-tier game sweep — separate non-blocking slice)
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
