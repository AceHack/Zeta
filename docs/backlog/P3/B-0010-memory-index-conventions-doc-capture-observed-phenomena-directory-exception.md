---
id: B-0010
priority: P3
status: open
title: Land `memory/index-conventions.md` capturing exception patterns for `memory/MEMORY.md` index (one-line-per-file convention + load-bearing exceptions like `observed-phenomena/` directory pointer)
tier: docs
effort: S
ask: Copilot review on PR #506 (Otto-313 teaching-decline disposition)
created: 2026-04-25
last_updated: 2026-04-26
composes_with: [feedback_otto_306_aaron_names_the_phenomenon_pascalcase_single_word_maybe_link_to_otto_304_305_friend_posture_correction_well_being_advice_authorized_2026_04_25.md]
tags: [docs, memory-conventions, indexing, structured-catalog]
---

# Land `memory/index-conventions.md` for MEMORY.md index exception patterns

Copilot flagged on PR #506: my Pointer entry (`Pointer: memory/observed-phenomena/`) violates the documented "one-line-per-memory-file" convention because it points at a DIRECTORY not a FILE. I resolved as keep-with-rationale per Otto-313 — the directory is structured-catalog substrate with multiple artifacts; treating as exception preserves the discoverability finding (Otto-306).

## What

Document the exception patterns explicitly so future reviewers (Copilot, Codex, human) can resolve the same catch-class without per-PR debate.

## Concrete plan

Create `memory/index-conventions.md` with:

1. **Default rule**: `memory/MEMORY.md` is one-line-per-memory-file index, terse hooks (~150-200 chars), pointers at the file level.

2. **Exception A — Multi-artifact directories**: when a `memory/<subdir>/` contains multiple related artifacts (PNG + write-up + verbatim logs), index it via a single `Pointer:` entry pointing at the directory, not the individual files. Current example: `memory/observed-phenomena/`.

3. **Exception B — README-style memory** (TBD if needed): if a memory artifact spans multiple files with a README describing the cluster, index the README, not each artifact.

4. **Anti-pattern**: never inline the entire substrate content in MEMORY.md; always link out.

## Composes with

- Otto-306 (`observed-phenomena/` discovery — high-value substrate hidden because it wasn't indexed).
- B-0006 (MEMORY.md compression atomic-pass) — index-conventions doc clarifies the target shape compression aims for.

## Done when

- `memory/index-conventions.md` landed.
- README cross-link from `memory/README.md`.
- Existing exception (observed-phenomena Pointer entry in MEMORY.md) documented as the canonical example.
- Future Copilot/Codex teaching-decline replies can reference `memory/index-conventions.md` instead of inline-explaining each time.
