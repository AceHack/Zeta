---
id: B-0054.5
zetaid: 081KR7JY10008QG0R0038891J0
priority: P2
status: open
title: "British long-serial TV — Monty Python + Red Dwarf + Black Mirror"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0054.1]
parent: B-0054
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, tv, monty-python, red-dwarf, black-mirror, british-comedy, operational-resonance, F1-F2-F3, media-resonance-catalog, comedy-as-substrate-probe]
---

# B-0054.5 — British long-serial TV: Monty Python + Red Dwarf + Black Mirror

## What

Extend `tools/resonance/media-catalog-schema.ts` with entries from the
British long-serial TV corpus Aaron named as a priority sweep:

- **MR-011**: Monty Python's Flying Circus (BBC, 1969–1974) + film canon
  — comedy-as-substrate-probe: exposes operator-structure by breaking it;
  the Dead Parrot sketch / Spanish Inquisition / Cheese Shop each probe
  expectation-violation as structural operator
- **MR-012**: Red Dwarf (BBC, 1988–present)
  — stasis pod / time-drive / backwards-episode: retractibility operators
  rendered as plot mechanics; Cat/Lister temporal-reversal as
  append-only-retraction at narrative scale
- **MR-013**: Black Mirror (Netflix/Channel 4, Brooker 2011–)
  — San Junipero / USS Callister / Hang the DJ: substrate-extension-via-
  simulation; digital-substrate identity persistence across physical-
  substrate termination

Doctor Who (MR-001) already covers the BBC supernatural serial strand;
this slice covers the comedy / sci-fi comedy / anthology strands.

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: MR-001 (Doctor Who, TV/BBC) exists; no entries
  for Monty Python, Red Dwarf, or Black Mirror in `tools/resonance/`.
- skill-router: no `operational-resonance` skill (same as prior passes).
- on-disk: no prior files for these works.
- Otto-364: no upstream art.
- lost-files: `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphaned artifacts.

**Dependency-restructure:**

- `depends_on: [B-0054.1]` — schema foundation; independent of video-game
  slices (B-0054.2, B-0054.3).
- `composes_with:` B-0054.6 (Hollywood film sweep — non-blocking sibling),
  B-0054.10 (Bollywood — non-blocking).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-011: Monty Python — comedy-as-substrate-probe (operator-structure-by-negation)
- MR-012: Red Dwarf — stasis/time-drive retractibility operators
- MR-013: Black Mirror — substrate-extension-via-simulation + identity persistence
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-011 through MR-013 present with correct IDs
- [ ] MR-011 uses `comedy-as-substrate-probe` principle (F2 operator-shape-by-negation)
- [ ] MR-012 has retractibility-operator mechanic precision (not just "time travel vibes")
- [ ] MR-013 has at least one Black Mirror episode with specific mechanic named
- [ ] `--validate` exits 0
- [ ] B-0054.5 backlog row updated to `status: closed` in resolution

## Composes with

- B-0054.1 (schema foundation)
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
- MR-001 (Doctor Who — same BBC TV strand, different sub-genre)
