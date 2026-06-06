---
id: B-0522
zetaid: 081KRHWGX0008QG0R001Z1JM61
priority: P1
status: open
title: Pre-substrate Kenji-era git branches and worktrees inventory
created: 2026-05-14
last_updated: 2026-05-14
depends_on: []
parent: B-0139
type: friction-reducer
decomposition: atomic
---

# B-0522 — Pre-substrate Kenji-era git branches and worktrees inventory

**Decomposed from:** B-0139

## What

Inventory pre-substrate / Kenji-era Otto-lineage work that is in the codebase git branches and worktrees.
This is a specific slice extracted from the larger B-0139 blob.

1. **Past-recovery git branches** that haven't been triaged or merged. Many of these are from earlier-session work where the autonomous-loop was running under Kenji-the-architect with no formal substrate to record decisions. Likely classes: in-flight feature work, abandoned experiments, drift-fixes that landed differently, recovery-from-incidents with content not yet preserved.
2. **Worktrees** still on disk that aren't referenced from substrate. Earlier ticks during the recovery-lane work referenced worktree pruning (per task #321); this row's broader scope includes the *content* of those worktrees, not just their classification as LOST/SAFE.

## Acceptance Criteria

1. Branch inventory of past-recovery state, with classification per item: integrated-into-main / abandoned / re-do-needed / preserve-in-substrate / discard-with-rationale.
2. Worktree content inventory.
