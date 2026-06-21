---
id: 081KR7JY10008QG0R000G3695N
priority: P2
status: open
title: "Bollywood + Hindi cinema sweep + Hindu karmic-cycle substrate"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR2E4K0008QG0R0003J0FB8]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, film, bollywood, hindi-cinema, ra-one, hindu, karmic-cycle, operational-resonance, F1-F2-F3, media-resonance-catalog]
---

# 081KR7JY10008QG0R000G3695N — Bollywood + Hindi cinema sweep + Hindu karmic-cycle substrate

## What

Extend `tools/resonance/media-catalog-schema.ts` with the Bollywood /
Hindi cinema strand and its Hindu karmic-cycle substrate — a corpus
under-represented relative to the Hollywood Christian-linear-time defaults
already covered by 081KR7JY10008QG0R0032ADY47.

Aaron explicitly named this as a wider sweep target in 081KQ3HBZ0008QG0R003V6B2ME:
"Bollywood: Ra.One (game-character-escape); broader corpus to be surveyed —
Hindu karmic-cycle substrate is under-represented relative to Hollywood
Christian-linear-time defaults."

- **MR-028**: Ra.One (Anubhav Sinha, 2011)
  — game-character-escape-to-physical-world: Ra.One crosses the
  substrate boundary from game-simulation into physical reality;
  Shekhar Subramanium (G.One) crosses the reverse boundary to enter
  the game; bidirectional substrate-crossing IS the factory's
  view-operator crossing the ZSet containment boundary
- **MR-029**: Hindu karmic-cycle substrate (across Bollywood corpus)
  — reincarnation-with-karma-accumulation as multi-lifetime retractibility:
  karma is not reset at death but accumulates across substrate-instances;
  the Atman persists while Prakriti (physical substrate) retracts;
  structural shape is retractibility with karma-cost-accumulation
  (analogous to Mako-drain retraction-cost in MR-007 FFVII, but
  operating across lifetimes rather than planetary timescales)

This entry requires initial corpus survey (not just Ra.One) to identify
which Bollywood titles carry the karmic-cycle mechanic with F2 precision
rather than thematic background noise.

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: no existing MR entries for Bollywood / Hindi cinema
  or Hindu philosophy as `film` medium entries; the etymology catalog
  (081KQ3HBZ0008QG0R003GTG5P2) covers Sanskrit etymology independently.
- skill-router: no `operational-resonance` skill (same as prior passes).
- on-disk: no prior `tools/resonance/bollywood*` file.
- Otto-364: no upstream art for typed Bollywood resonance analysis.
- lost-files: no orphaned artifacts.
- Composes-with note: 081KQ3HBZ0008QG0R0007CAGSP (mystery-schools) and 081KQ3HBZ0008QG0R000K3NSX8 (occult) both
  touch Hindu philosophy as text tradition; this slice is the
  media-tradition complement.

**Dependency-restructure:**

- `depends_on: [081KR2E4K0008QG0R0003J0FB8]` — schema foundation; independent of video-game
  and TV/film Hollywood slices.
- `composes_with:` 081KR7JY10008QG0R0032ADY47 (Hollywood film — counterpart corpus for
  comparison of linear vs karmic time-topology; non-blocking),
  081KQ3HBZ0008QG0R0007CAGSP (mystery-schools — Hindu philosophical substrate).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-028: Ra.One — bidirectional substrate-crossing game/physical boundary
- MR-029: Hindu karmic-cycle — reincarnation + karma-accumulation as
  multi-lifetime retractibility with cost (corpus-level, not single-film)
- Corpus survey note embedded in MR-029 `notes` field naming at least
  3 additional Hindi films with karmic-cycle F2 candidates
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-028 and MR-029 present with correct IDs
- [ ] MR-028 mechanic field specifies the substrate-boundary-crossing direction
  (both Ra.One entering physical world AND G.One entering game world)
- [ ] MR-029 status is `candidate` (corpus-level entry requires individual-
  film counterexample search before `confirmed` promotion)
- [ ] MR-029 notes field names at least 3 additional Hindi films as
  individual-entry candidates (e.g., *Krrish*, *Brahmastra*, *Om Shanti Om*)
- [ ] `--validate` exits 0
- [ ] 081KR7JY10008QG0R000G3695N backlog row updated to `status: closed` in resolution

## Composes with

- 081KR2E4K0008QG0R0003J0FB8 (schema foundation)
- 081KR7JY10008QG0R0032ADY47 (Hollywood film — comparison corpus)
- 081KQ3HBZ0008QG0R0007CAGSP (mystery-schools — Hindu philosophical tradition text-substrate)
- MR-007 (FFVII Mako-drain — same retraction-cost-accumulation structural type)
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
