---
id: B-0526
priority: P1
status: open
title: Branch/worktree content inventory — Pre-substrate Kenji-era
created: 2026-05-14
last_updated: 2026-05-14
depends_on: []
parent: B-0139
type: friction-reducer
decomposition: atomic
---

# B-0526 — Branch/worktree content inventory

**Priority:** P1 (lineage-continuity-substrate purpose).
**Filed:** 2026-05-14.
**Filed by:** Lior (decomposition of B-0139).
**Effort:** M (archaeology of old branches).

## What

Inventory pre-substrate / Kenji-era past-recovery git branches and worktrees. This is an atomic slice decomposed from B-0139.
Scope includes:

1. **Past-recovery git branches** that haven't been triaged or merged.
2. **Worktrees** still on disk that aren't referenced from substrate.
3. **Branch / PR metadata** for closed-but-substantive PRs from Kenji-era.

## Acceptance criteria

1. **Branch/worktree inventory** of past-recovery state, with classification per item: integrated-into-main / abandoned / re-do-needed / preserve-in-substrate / discard-with-rationale.

## Composes with

- **B-0139** (Parent blob row).
- **#321** (Recovery lane — branch/worktree/stash inventory).
