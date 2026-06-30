---
id: B-0554
priority: P1
status: open
title: Pre-substrate Kenji-era branch and worktree inventory
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
type: friction-reducer
---

# B-0554 — Pre-substrate Kenji-era branch and worktree inventory

**Priority:** P1
**Origin:** Decomposed from B-0139 (Pre-substrate Kenji-era inventory blob).

## What

Inventory past-recovery git branches and worktrees from the Kenji-era that haven't been triaged or merged. Many of these are from earlier-session work where the autonomous-loop was running under Kenji-the-architect with no formal substrate to record decisions.

Specific scope:
1. **Past-recovery git branches**: Identify in-flight feature work, abandoned experiments, drift-fixes that landed differently, and recovery-from-incidents.
2. **Worktrees**: Inventory worktrees still on disk that aren't referenced from substrate.

## Acceptance criteria

1. **Branch/worktree inventory** of past-recovery state, with classification per item: integrated-into-main / abandoned / re-do-needed / preserve-in-substrate / discard-with-rationale.
