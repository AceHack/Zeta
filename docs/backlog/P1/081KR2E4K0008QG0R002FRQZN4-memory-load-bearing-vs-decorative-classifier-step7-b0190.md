---
id: 081KR2E4K0008QG0R002FRQZN4
priority: P1
status: closed
title: Memory load-bearing-vs-decorative classifier — identify which memory files are cited from bootstrap surfaces
tier: foundation
effort: S
ask: 081KQR4HQ0008QG0R001909FPT Step 7 decomposition
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQR4HQ0008QG0R001909FPT
depends_on: []
composes_with: [081KQR4HQ0008QG0R001909FPT, 081KR2E4K0008QG0R00175HQR9, 081KR2E4K0008QG0R001B6K45W, 081KR2E4K0008QG0R001CCWHZ2]
tags: [memory, classification, load-bearing, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R002FRQZN4 — Memory load-bearing-vs-decorative classifier

## Parent

081KQR4HQ0008QG0R001909FPT Step 7 (memory load-bearing-vs-decorative classification).

## What

Classify every memory file as **load-bearing** or **decorative**:

- **Load-bearing**: cited from CLAUDE.md, AGENTS.md,
  GOVERNANCE.md, docs/ALIGNMENT.md, or reachable transitively
  from those bootstrap surfaces. A fresh agent WILL read these.
- **Decorative**: not cited from any bootstrap surface. A fresh
  agent MAY read these if the topic comes up, but they are not
  in the wake-time read path.

Implementation: a TS tool (`tools/hygiene/classify-memory-load-bearing.ts`)
that:

1. Parses CLAUDE.md, AGENTS.md, GOVERNANCE.md, docs/ALIGNMENT.md
   for `memory/` path references.
2. Follows transitive references (memory file A cites memory
   file B).
3. Outputs a two-column report: file path + load-bearing / decorative.

## Why no deps

This is a read-only analysis of existing citation chains. No
format standard needed — it traces file paths, not content types.

## Acceptance criteria

1. TS classifier tool committed under `tools/hygiene/`.
2. Tool output covers all files under `memory/`.
3. At least one run committed as evidence (e.g., in the PR body
   or a `docs/research/` file).
4. Load-bearing count and decorative count reported.

## Why S effort

Single-purpose grep/parse tool. The classification itself is
mechanical — follow the citation graph.

## Prior art

- CLAUDE.md — the primary bootstrap surface with ~50+ memory
  file references.
- `tools/hygiene/audit-memory-references.ts` — similar
  link-following pattern.
