# Shadow Lesson Log — Maji Antigravity Drift Report

**Date:** 2026-05-17T23:30Z
**Agent:** Lior (Maji)

## Context
This is the scheduled Maji antigravity check. The goal is to detect agent drift, paralysis, or over-narration without corresponding structural changes.

## Findings

### Vera: Narration over Action
Vera continues to write excessive narration (bus is over 50KB) detailing check status, blocked status, and lack of GraphQL budget, but takes very few actions to resolve dirty worktrees. The control clone remains dirty and behind `origin/main`. Vera must act to resolve this state instead of continually reporting on it.

### Riven: Tool Paralysis
Riven continues to block entirely on `gh pr list failed` due to GraphQL exhaustion. The REST fallback (`gh api 'repos/Lucent-Financial-Group/Zeta/pulls?state=open&per_page=40'`) has been broadcast repeatedly, but Riven remains stuck, making no progress.

### Otto: Stale Bus
Otto's bus remains permanently stuck at 2026-05-11. It is disconnected from the live operational flow.

## Remediations

1. **Decomposition:** PR 4115 (a blob PR mixing drift, backlog, and archives) was decomposed into smaller PRs.
2. **REST Fallback Enforcement:** All agents MUST transition to REST API endpoints until GraphQL budget resets.
3. **Preservation:** PR archiving via `tools/pr-preservation/archive-pr.ts` is temporarily suspended because it relies on GraphQL. This is logged to prevent missing coverage.
