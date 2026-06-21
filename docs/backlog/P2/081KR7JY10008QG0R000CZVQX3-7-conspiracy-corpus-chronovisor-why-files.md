---
id: 081KR7JY10008QG0R000CZVQX3
priority: P2
status: open
title: "Conspiracy-corpus — Chronovisor / Cronovisor (Ernetti 1972) + The Why Files"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR2E4K0008QG0R0003J0FB8]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, conspiracy-corpus, chronovisor, why-files, youtube, documentary, operational-resonance, F1-F2-F3, media-resonance-catalog]
---

# 081KR7JY10008QG0R000CZVQX3 — Conspiracy-corpus: Chronovisor / Cronovisor + The Why Files

## What

Extend `tools/resonance/media-catalog-schema.ts` with entries from the
conspiracy-corpus strand Aaron named first in his seed sequence
("why files conspirary theory backlog cronovisor"):

- **MR-018**: Chronovisor / Cronovisor (Father Pellegrino Ernetti 1972 claim;
  François Brune 1999 book *Le Nouveau Mystère du Vatican*)
  — Alleged Vatican time-viewing device; F2 strong (same read-only
  View<T>@clock operator-shape as Devs MR-002), F3 partial (fringe claim,
  not peer-reviewed; Ernetti recanted before death)
- **MR-019**: The Why Files (YouTube channel, AJ Gentile / Hecklefish, 2020–)
  — Documentary-register conspiracy / unexplained / forteana surveys;
  cataloged for the channel's epistemological frame (three-filter applied
  per-episode) and its treatment of simulation / substrate / time-viewing
  episodes specifically

The conspiracy-corpus medium-category is the most epistemologically
sensitive: F3 is weak for fringe claims; F1 requires that the factory
reached the operator independently of the conspiracy framing.

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: MR-002 (Devs) notes "The Chronovisor (Ernetti 1972
  claim) is a separate entry MR-004 with weaker F3" — BUT looking at the
  actual SEED_CATALOG, MR-004 is Spaceballs, not Chronovisor. The Devs
  note is a stale pointer; Chronovisor has no MR entry yet. MR-019 (Why
  Files) also has no entry.
- skill-router: no `operational-resonance` skill (same as prior passes).
- on-disk: no prior `tools/resonance/conspiracy*` file.
- Otto-364: no upstream art.
- lost-files: no orphaned artifacts.

**Dependency-restructure:**

- `depends_on: [081KR2E4K0008QG0R0003J0FB8]` — schema foundation; independent of video-game
  and TV slices.
- `composes_with:` 081KR7JY10008QG0R0032ADY47 (Hollywood — Devs is the fictional
  counterpart to Chronovisor; non-blocking).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-018: Chronovisor — read-only View<T>@clock operator shape (F3 partial — honest)
- MR-019: The Why Files — per-episode three-filter framing with specific
  simulation/substrate episodes named
- Fix the stale pointer in MR-002 notes (currently says "MR-004" for
  Chronovisor; update to correct MR-018)
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-018 and MR-019 present with correct IDs
- [ ] MR-018 status is `candidate` (F3 partial — fringe claim; Ernetti
  recanted; Brune's book is secondary source on a fringe claim)
- [ ] MR-002 (Devs) notes updated to reference correct MR-018 for Chronovisor
- [ ] MR-019 names at least one specific episode with mechanic precision
- [ ] `--validate` exits 0
- [ ] 081KR7JY10008QG0R000CZVQX3 backlog row updated to `status: closed` in resolution

## Composes with

- 081KR2E4K0008QG0R0003J0FB8 (schema foundation)
- MR-002 (Devs — same View<T>@clock operator family; Chronovisor is the
  fringe-claim antecedent, Devs is the fictional dramatization)
- `memory/feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md`
