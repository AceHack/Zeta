---
id: 081KR2E4K0008QG0R00175HQR9
priority: P1
status: closed
title: Memory-retire/supersession discipline — define what happens when a memory file is superseded
tier: foundation
effort: S
ask: 081KQR4HQ0008QG0R001909FPT Step 5 decomposition
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: [081KR2E4K0008QG0R002FRQZN4]
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KR2E4K0008QG0R002FRQZN4, 081KR2E4K0008QG0R000N124VW]
tags: [memory, retire, supersession, dead-code, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R00175HQR9 — Memory-retire/supersession discipline

## Parent

081KQR4HQ0008QG0R001909FPT Step 5 (memory-retire / dead-code-deletion discipline).

## What

Define and document the discipline for when a memory file is
superseded:

1. **When to supersede** — a newer memory file covers the same
   ground with updated/corrected content.
2. **Mechanism** — options: (a) delete the old file (git history
   preserves it), (b) add `superseded_by:` frontmatter field
   pointing to the replacement, (c) merge content into the
   replacement and delete.
3. **MEMORY.md index update** — the superseded file's index
   entry is removed or replaced.
4. **Cross-reference repair** — any file citing the superseded
   file gets its reference updated.

## Why depends on 081KR2E4K0008QG0R002FRQZN4

The load-bearing-vs-decorative classification determines
which files are safe to retire without breaking the bootstrap
chain. Retiring a load-bearing file without updating its
citation in CLAUDE.md is a wake-time regression.

## Output

A discipline section added to `memory/README.md` (the canonical
memory policy surface).

## Acceptance criteria

1. Supersession discipline documented in `memory/README.md`.
2. Discipline covers all four areas above.
3. At least 3 currently-superseded files identified and processed
   per the new discipline as a smoke check.

## Why S effort

Policy definition + small demonstration. Bulk cleanup is a
separate follow-up.
