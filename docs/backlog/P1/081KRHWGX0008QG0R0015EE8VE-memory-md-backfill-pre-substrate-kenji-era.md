---
id: 081KRHWGX0008QG0R0015EE8VE
priority: P1
status: not-started
title: MEMORY.md backfill for pre-substrate Kenji-era artifacts (081KQGDBJ0008QG0R002S9SWH6 decomposition)
created: 2026-05-14
depends_on: [081KRHWGX0008QG0R001Z1JM61, 081KRHWGX0008QG0R000BWQM0J, 081KRHWGX0008QG0R00264BDSB]
type: friction-reducer
decomposition: atomic
---

# 081KRHWGX0008QG0R0015EE8VE — MEMORY.md backfill for Kenji-era artifacts

**Priority:** P1
**Filed:** 2026-05-14
**Filed by:** Lior (decomposed from 081KQGDBJ0008QG0R002S9SWH6 blob)

## What

This is a specific atomic slice decomposed from 081KQGDBJ0008QG0R002S9SWH6. Perform the `MEMORY.md` backfill for any artifact identified during the pre-substrate Kenji-era work inventory whose substrate-reference doesn't currently exist.

This composes with task #291 (MEMORY.md index audit + backfill). It relies on the artifacts identified by 081KRHWGX0008QG0R001Z1JM61 (F# src/Core inventory), 081KRHWGX0008QG0R000BWQM0J (docs/research cross-reference audit), and 081KRHWGX0008QG0R00264BDSB (branch/worktree content inventory).

## Acceptance Criteria

1. Every identified pre-substrate Kenji-era artifact (from 081KRHWGX0008QG0R001Z1JM61, 081KRHWGX0008QG0R000BWQM0J, 081KRHWGX0008QG0R00264BDSB) without a substrate reference has an appropriate pointer added to `MEMORY.md` (or the relevant persona memory index).
2. The backfill respects the memory pruning/compression guidelines.
