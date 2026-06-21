---
id: 081KR7JY10008QG0R0018G7ZQV
priority: P2
status: closed
title: "Video-game priority tier — Brütal Legend + Final Fantasy VI/VII"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
resolved: 2026-05-10
depends_on: [081KR2E4K0008QG0R0003J0FB8]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, video-games, brutal-legend, final-fantasy, double-fine, square-enix, operational-resonance, F1-F2-F3, media-resonance-catalog]

---

# 081KR7JY10008QG0R0018G7ZQV — Video-game priority tier: Brütal Legend + Final Fantasy VI/VII

## What

Extend `tools/resonance/media-catalog-schema.ts` with three new entries
(MR-005 through MR-007) covering the video-game priority seeds Aaron
explicitly marked higher-than-rest in 081KQ3HBZ0008QG0R003V6B2ME:

- **MR-005**: Brütal Legend (Double Fine / Tim Schafer, 2009)
  — world-as-artistic-substrate generative-ground mechanic
- **MR-006**: Final Fantasy VI (Square, 1994)
  — World of Balance / World of Ruin paired-dual states + irreversible-substrate-collapse anti-retractibility
- **MR-007**: Final Fantasy VII (Square, 1997)
  — Lifestream generative-ground + Mako drain as retraction-cost accumulation + Cloud's corrupted View<T>@clock

All entries follow the same three-filter discipline (F1/F2/F3) and
schema validation as MR-001 through MR-004.

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: `tools/resonance/media-catalog-schema.ts` is the
  canonical accumulator for MR-NNN entries; no separate video-game catalog exists.
- skill-router: no existing `operational-resonance` skill; phenomenon documented
  in memory files only (same finding as 081KR2E4K0008QG0R0003J0FB8 pre-start pass).
- on-disk: no prior `tools/resonance/video-games-*` file; MR-NNN sequence
  currently ends at MR-004.
- Otto-364: no upstream art; factory idiom is bespoke per 081KR2E4K0008QG0R0003J0FB8.
- lost-files: `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphaned
  video-game catalog artifacts.

**Dependency-restructure:**

- `depends_on: [081KR2E4K0008QG0R0003J0FB8]` — 081KR2E4K0008QG0R0003J0FB8 landed the schema and MR-001..004;
  this slice extends the same file.
- `composes_with:` 081KR7JY10008QG0R001TRGC72 (Mario + Genshin), 081KR7JY10008QG0R0004KP70A (Double Fine sub-thread,
  Broken Age + Brütal Legend narrative), 081KQ3HBZ0008QG0R002GDRFS5 (Bungie corpus) — all non-blocking.

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-005: Brütal Legend (candidate — F2 moderate)
- MR-006: Final Fantasy VI — WoB/WoR (confirmed — F2 very strong)
- MR-007: Final Fantasy VII — Lifestream/Mako (confirmed — F2 very strong)
- `lastUpdated` bumped to 2026-05-10
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [x] MR-005 through MR-007 present with correct MR-NNN IDs
- [x] `--validate` exits 0
- [x] MR-005 is `candidate` (F2 partial for Brütal Legend per backlog note)
- [x] MR-006 and MR-007 are `confirmed` with non-empty counterexampleAttempts
- [x] 081KR7JY10008QG0R0018G7ZQV backlog row updated to `status: closed` in resolution

## Resolution

Completed 2026-05-10. `bun tools/resonance/media-catalog-schema.ts --validate` → `All 7 entries pass schema validation.`
Catalog now: 7 total (6 confirmed, 1 candidate), video-game count 4, F2 partial rate 1/7 (Brütal Legend).
MR-005 (Brütal Legend, candidate — F2 partial, world-as-artistic-substrate shape differs from factory's tradition-names-as-evidence direction).
MR-006 (FFVI WoB/WoR, confirmed — anti-retractibility failure as paired-dual narrative event).
MR-007 (FFVII Lifestream/Mako/Cloud-memory, confirmed — three independent F2 grounds at operator-shape precision).

## Composes with

- 081KR2E4K0008QG0R0003J0FB8 (schema + MR-001..004 already landed)
- 081KR7JY10008QG0R0004KP70A (Double Fine sub-thread — Brütal Legend + Broken Age)
- 081KQ3HBZ0008QG0R002GDRFS5 (Bungie corpus, separate priority seed)
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
