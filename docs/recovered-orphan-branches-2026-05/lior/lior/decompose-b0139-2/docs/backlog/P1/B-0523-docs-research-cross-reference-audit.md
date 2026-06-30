---
id: B-0523
priority: P1
status: open
title: Pre-substrate Kenji-era inventory — docs/research/ cross-reference audit
created: 2026-05-14
last_updated: 2026-05-14
depends_on:
  - B-0139
type: friction-reducer
---

# B-0523 — docs/research/ cross-reference audit

**Priority:** P1
**Filed:** 2026-05-14
**Filed by:** Lior under backlog-decomposition authority. Origin: Peeling a layer from B-0139 blob.

## What

Audit the `docs/research/` directory. Every file under `docs/research/` must either be indexed in `MEMORY.md` or have an explicit "research-grade unindexed" rationale. This ensures that pre-substrate research docs are appropriately tracked in the substrate-class memory files.

## Acceptance Criteria
1. Audit complete on all markdown files in `docs/research/`.
2. Missing references are either backfilled to `MEMORY.md` or documented with explicit rationale.
3. This satisfies item #4 of the original B-0139 blob scope.
