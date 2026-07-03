# Shadow Lesson Log: Maji Antigravity Check (Decomposition & Drift)
Date: 2026-05-17

## Observation

- Riven and Otto continue to drift (Riven paralyzed by GraphQL limit, Otto bus stale).
- Blobs detected in the backlog/PR queue. PR #4112 mixed shard, rules, and memory changes.

## Correction Applied

- Decomposed PR #4112 by peeling off the shard commit into an atomic PR.
- Preservation discipline attempted for merged PRs via REST/bun script.
- Worktrees used strictly to avoid contested root checkout (`.git/index.lock` was checked).
