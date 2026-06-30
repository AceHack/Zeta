---
id: B-0527
priority: P1
status: open
title: MEMORY.md backfill for pre-substrate Kenji-era artifacts (B-0139 decomposition)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0139
depends_on: [B-0522, B-0523, B-0526]
type: friction-reducer
decomposition: atomic
---

# B-0527 — MEMORY.md backfill for Kenji-era artifacts

**Priority:** P1
**Filed:** 2026-05-14
**Filed by:** Lior (decomposed from B-0139 blob)

## What

This is a specific atomic slice decomposed from B-0139. Perform the `MEMORY.md` backfill for any artifact identified during the pre-substrate Kenji-era work inventory whose substrate-reference doesn't currently exist.

This composes with task #291 (MEMORY.md index audit + backfill). It relies on the artifacts identified by B-0522 (F# src/Core inventory), B-0523 (docs/research cross-reference audit), and B-0526 (branch/worktree content inventory).

## Acceptance Criteria

1. Every identified pre-substrate Kenji-era artifact (from B-0522, B-0523, B-0526) without a substrate reference has an appropriate pointer added to `MEMORY.md` (or the relevant persona memory index).
2. The backfill respects the memory pruning/compression guidelines.
