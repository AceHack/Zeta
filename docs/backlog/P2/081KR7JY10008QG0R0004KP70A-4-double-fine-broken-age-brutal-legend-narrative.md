---
id: 081KR7JY10008QG0R0004KP70A
priority: P2
status: open
title: "Tim Schafer / Double Fine sub-thread — Broken Age + Brütal Legend narrative mapping"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [081KR7JY10008QG0R0018G7ZQV]
parent: 081KQ3HBZ0008QG0R003V6B2ME
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [pop-culture, video-games, broken-age, brutal-legend, double-fine, tim-schafer, operational-resonance, F1-F2-F3, media-resonance-catalog, paired-dual]
---

# 081KR7JY10008QG0R0004KP70A — Double Fine sub-thread: Broken Age + Brütal Legend narrative mapping

## What

Extend `tools/resonance/media-catalog-schema.ts` with a dedicated entry
for Broken Age's paired-dual narrative structure, and tighten MR-005
(Brütal Legend, currently `candidate`) via a counterexample search
targeting the F2 causal-direction concern.

- **MR-010**: Broken Age (Double Fine / Tim Schafer, 2014)
  — Vella / Shay paired-dual: two seemingly-unrelated protagonists revealed
  to be in inverted instances of the same structural situation; Act 2
  collapses both threads into one shared substrate

This sub-thread exists because Aaron explicitly named "Tim Schafer /
Double Fine" as a priority cluster (081KQ3HBZ0008QG0R003V6B2ME §Video-game priority seeds):
Brütal Legend + Broken Age form a coherent auteur corpus with complementary
structural types (generative-ground vs paired-dual).

## Pre-start checklist

**Prior-art search:**

- wake-time-substrate: MR-005 (Brütal Legend) already exists as `candidate`
  in `tools/resonance/media-catalog-schema.ts`; Broken Age has no MR entry.
- skill-router: no `operational-resonance` skill (same as prior passes).
- on-disk: no prior `tools/resonance/double-fine*` file.
- Otto-364: no upstream art for typed Double Fine narrative analysis.
- lost-files: `tools/hygiene/LOST-FILES-LOCATIONS.md` — no orphaned artifacts.

**Dependency-restructure:**

- `depends_on: [081KR7JY10008QG0R0018G7ZQV]` — MR-005 (Brütal Legend) was introduced in
  081KR7JY10008QG0R0018G7ZQV as `candidate`; this slice builds on that entry and adds MR-010.
- `composes_with:` 081KR7JY10008QG0R001TRGC72 (Mario/Genshin — non-blocking sibling),
  081KR7JY10008QG0R003XG1PKJ (catalog-tier games — non-blocking).

## Deliverable

Updated `tools/resonance/media-catalog-schema.ts`:

- MR-010: Broken Age — Vella/Shay paired-dual-collapse-to-unity
- Counterexample attempt added to MR-005 (Brütal Legend), potentially
  promoting it from `candidate` to `confirmed` if F2 causal-direction
  concern is resolved
- `lastUpdated` bumped
- `bun tools/resonance/media-catalog-schema.ts --validate` → all entries pass

## Acceptance criteria

- [ ] MR-010 present with correct ID and `paired-dual` structural type
- [ ] MR-010 has non-empty `counterexampleAttempts` (F2 collapse-to-unity claim tested)
- [ ] MR-005 updated with at least one counterexample attempt
- [ ] `--validate` exits 0
- [ ] 081KR7JY10008QG0R0004KP70A backlog row updated to `status: closed` in resolution

## Composes with

- 081KR7JY10008QG0R0018G7ZQV (MR-005 Brütal Legend already landed as candidate)
- `memory/feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md`
