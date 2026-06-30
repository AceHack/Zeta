---
id: B-0139-slice-1
priority: P1
status: open
title: B-0139 slice 1 — Branch and worktree inventory of past-recovery state
created: 2026-05-20
last_updated: 2026-05-20
depends_on: []
type: friction-reducer
decomposition: atomic
parent: B-0139
---

# B-0139 slice 1 — Branch and worktree inventory

**Priority:** P1 (Lineage-continuity; prevents pre-substrate work from being forgotten).

**Filed:** 2026-05-20 (Sliced from B-0139).

## What

Execute the first slice of B-0139: cataloging the past-recovery git branches and worktrees.
Many of these are from earlier-session work where the autonomous-loop was running under Kenji-the-architect with no formal substrate to record decisions.

## Scope

1. **Past-recovery git branches** that haven't been triaged or merged. Likely classes: in-flight feature work, abandoned experiments, drift-fixes that landed differently, recovery-from-incidents with content not yet preserved.
2. **Worktrees** still on disk that aren't referenced from substrate. This includes the *content* of those worktrees, not just their classification as LOST/SAFE.

## Acceptance criteria

1. **Branch/worktree inventory** of past-recovery state, with classification per item: integrated-into-main / abandoned / re-do-needed / preserve-in-substrate / discard-with-rationale.
