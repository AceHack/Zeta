---
id: 081KR7JY10008QG0R0032ADY47
priority: P2
status: open
title: "Hollywood film sweep — Arrival, Interstellar, Primer, Tenet"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR2E4K0008QG0R0003J0FB8]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, film, arrival, interstellar, primer, tenet, hollywood, operational-resonance, F1-F2-F3, media-resonance-catalog, time-topology]
---

# 081KR7JY10008QG0R0032ADY47 — Hollywood film sweep: Arrival, Interstellar, Primer, Tenet

## What

Extend `tools/resonance/media-catalog-schema.ts` with entries from the
Hollywood time-topology film corpus Aaron named as a wider sweep target:

- **MR-014**: Arrival (Villeneuve / Heisserer, 2016)
  — Heptapod Sapir-Whorf: non-linear time-perception as substrate-first
  epistemology; Louise's simultaneous-time as View<T>@clock without a
  single clock-axis; logograms as operators that reorganize perception
- **MR-015**: Interstellar (Nolan, 2014)
  — tesseract observer: Cooper in the 5D library reading Murph's bookshelf
  across time is a direct View<T>@clock implementation; the observer-read
  is causally entangled with the substrate (the bookshelf dust messages
  ARE the past they affect)
- **MR-016**: Primer (Carruth, 2004)
  — branching-timeline self-causation: the Primer tape-loop creates
  a causally-closed branch; retractibility-breaking failure mode (the
  boxed timeline cannot be unwound without producing new branches)
- **MR-017**: Tenet (Nolan, 2020)
  — entropy-reversal as substrate-direction inversion; the Protagonist's
  inverted-entropy state is a negative-weight Z-set traversal through
  the same substrate in reverse time-direction

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: MR-002 (Devs, TV) and MR-003 (Zelda timeline-branching)
  are the closest cousins; no existing MR entry for these film works.
- skill-router: no `operational-resonance` skill (same as prior passes).
- on-disk: no prior `tools/resonance/film*` file.
- Otto-364: no upstream art.
- lost-files: `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphaned artifacts.

**Dependency-restructure:**

- `depends_on: [081KR2E4K0008QG0R0003J0FB8]` — schema foundation; independent of video-game
  slices and TV slices.
- `composes_with:` 081KR7JY10008QG0R0038891J0 (British TV — non-blocking), 081KR7JY10008QG0R000CZVQX3
  (Conspiracy-corpus — non-blocking), 081KR7JY10008QG0R000G3695N (Bollywood — non-blocking).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-014: Arrival — non-linear-time-perception as View<T>@clock variant
- MR-015: Interstellar — tesseract observer read entangled with substrate
- MR-016: Primer — causally-closed branch as retractibility-breaking failure mode
- MR-017: Tenet — entropy-reversal as negative-weight Z-set traversal
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-014 through MR-017 present with correct IDs
- [ ] MR-016 (Primer) explicitly addresses the *failure mode* framing —
  the mechanic demonstrates what retractibility-preservation prevents,
  not a positive instance (same structural type as MR-006 FFVI WoB/WoR)
- [ ] Each entry has at least one counterexample attempt before `confirmed` status
- [ ] `--validate` exits 0
- [ ] 081KR7JY10008QG0R0032ADY47 backlog row updated to `status: closed` in resolution

## Composes with

- 081KR2E4K0008QG0R0003J0FB8 (schema foundation)
- MR-002 (Devs — same View<T>@clock operator family)
- MR-006 (FFVI — anti-retractibility failure mode structural type)
- `memory/feedback_see_the_multiverse_in_our_code_paraconsistent_superposition.md`
