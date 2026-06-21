---
id: 081KR7JY10008QG0R0021QGMM6
priority: P2
status: open
title: "Music corpus — progressive rock + Tool / Meshuggah / NIN first pass"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR2E4K0008QG0R0003J0FB8]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, music, progressive-rock, tool, meshuggah, nin, pink-floyd, yes, king-crimson, operational-resonance, F1-F2-F3, media-resonance-catalog]
---

# 081KR7JY10008QG0R0021QGMM6 — Music corpus: progressive rock + Tool / Meshuggah / NIN first pass

## What

Extend `tools/resonance/media-catalog-schema.ts` with entries from the
music corpus strand (Aaron: "hollywood bollywood inde, music information
backlog"). This is the factory's first pass at the `music` medium-category.

Candidates from 081KQ3HBZ0008QG0R003V6B2ME §Music:

- **MR-020**: Pink Floyd — *Dark Side of the Moon* (1973)
  — concept-album substrate: the album is a unified structural argument
  about mental collapse vs coherence; "Money" as economic-algebra critique;
  "Any Colour You Like" as freedom-within-constraint operator
- **MR-021**: Tool — *Lateralus* (2001)
  — Fibonacci sequence in lyric syllable count + time signature nesting;
  mathematical structure embedded in the substrate (not thematic reference
  to mathematics — the substrate IS structured mathematically)
- **MR-022**: Meshuggah — polyrhythm as paraconsistent-superposition
  — multiple rhythmic grids coexist without collapse; listeners hold
  both simultaneously; operator-shape matches the factory's
  paraconsistent-superposition of retractible + append-only
- **MR-023**: NIN — *The Fragile* (1999)
  — fragmentation-to-reconstitution arc: Part I (fragmented substrate)
  and Part II (reconstituted substrate) form a paired-dual; the album
  is structurally isomorphic to WoB/WoR (MR-006)

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: no existing MR entries for `music` medium; the
  `MediaMedium` type already includes `"music"` in the schema (081KR2E4K0008QG0R0003J0FB8).
- skill-router: no `operational-resonance` skill (same as prior passes).
- on-disk: no prior `tools/resonance/music*` file.
- Otto-364: no upstream art.
- lost-files: no orphaned artifacts.

**Dependency-restructure:**

- `depends_on: [081KR2E4K0008QG0R0003J0FB8]` — schema foundation; independent of video-game
  and TV/film slices.
- `composes_with:` 081KR7JY10008QG0R0038891J0 (British TV — Monty Python shares the
  comedy-as-probe register with absurdist prog-rock; non-blocking).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-020: Pink Floyd *Dark Side* — concept-album-as-unified-argument
- MR-021: Tool *Lateralus* — mathematical-structure embedded in medium
- MR-022: Meshuggah polyrhythm — paraconsistent-superposition operator-shape
- MR-023: NIN *The Fragile* — fragmentation/reconstitution paired-dual
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-020 through MR-023 present with correct IDs
- [ ] MR-021 (Tool *Lateralus*) makes the F2 claim at mechanism-level
  (syllable count IS Fibonacci, not "the song feels mathematical") —
  this is the F2 precision test for music medium
- [ ] MR-022 (Meshuggah) mechanic field specifies which album/track
  demonstrates polyrhythmic superposition (not vague "polyrhythm")
- [ ] Each entry has a counterexample attempt before `confirmed` promotion
- [ ] `--validate` exits 0
- [ ] 081KR7JY10008QG0R0021QGMM6 backlog row updated to `status: closed` in resolution

## Composes with

- 081KR2E4K0008QG0R0003J0FB8 (schema foundation — `music` medium already in schema type)
- MR-006 (FFVI WoB/WoR — same paired-dual type as NIN *The Fragile*)
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
