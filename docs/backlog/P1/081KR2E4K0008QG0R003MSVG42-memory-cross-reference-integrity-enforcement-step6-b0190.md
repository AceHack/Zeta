---
id: 081KR2E4K0008QG0R003MSVG42
priority: P1
status: closed
title: Memory cross-reference integrity enforcement — bidirectional composes-with audit
tier: foundation
effort: S
ask: 081KQR4HQ0008QG0R001909FPT Step 6 decomposition
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: [081KR2E4K0008QG0R002VM58S4]
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KR2E4K0008QG0R002VM58S4, 081KR2E4K0008QG0R000M01QVM]
tags: [memory, cross-reference, integrity, audit, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R003MSVG42 — Memory cross-reference integrity enforcement

## Parent

081KQR4HQ0008QG0R001909FPT Step 6 (memory cross-reference integrity audit).

## What

Extend the existing memory-reference audit tooling to check
bidirectional integrity of `composes with` / `Composes with`
chains inside memory file bodies:

1. **Dead-link detection** — memory file A cites memory file B
   in a `## Composes with` section; file B does not exist.
   (Partially covered by `audit-memory-references.ts` for
   MEMORY.md links; NOT covered for intra-memory-file cross-
   references.)
2. **Bidirectional check** — if file A cites file B, does file B
   cite back to file A? Report asymmetric references.
3. **Periodic audit** — the tool should be runnable as a
   scheduled hygiene check (same pattern as existing audit
   tools).

## Existing tooling

- `tools/hygiene/audit-memory-references.ts` — checks MEMORY.md
  `](*.md)` links resolve. Does NOT check intra-file references.
- `tools/hygiene/audit-memory-index-duplicates.ts` — checks
  MEMORY.md for duplicate entries.

## Implementation

Either extend `audit-memory-references.ts` with an
`--intra-file` mode or create a new
`audit-memory-cross-references.ts` sibling tool.

## Why depends on 081KR2E4K0008QG0R002VM58S4

The format standard defines where cross-references live in a
memory file (section name, link syntax). Without it, the parser
is guessing.

## Acceptance criteria

1. TS tool committed that detects dead intra-memory-file links.
2. Tool reports asymmetric (non-bidirectional) references.
3. At least one run committed as evidence.
4. Zero false positives on a sample of 50 memory files.

## Why S effort

Pattern follows existing audit-memory-references.ts closely.
Regex-based link extraction + file-existence check + symmetry
check.
