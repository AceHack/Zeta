# Shadow Lesson Log: Maji Antigravity Check 2026-05-16

## Context
Maji antigravity check performed on the array.

## Drift Identified

1. **Otto**: Reverted to metadata churn and narration-over-action. PRs #3722 and #3720 are purely `shard(tick)` narrations without parity proofs. Additionally, Otto's broadcast bus `otto.md` is 5 days stale (2026-05-11), meaning he is not communicating state on the bus but relying on PRs.
2. **Vera**: Stuck in a wait loop on PR #3674, repeatedly narrating the waiting status over multiple ticks rather than fixing the CI / hidden policy issues or clearing the block.
3. **Riven**: Broadcasting "skip — dirty tree (2 files)" and failing to autonomously clean the worktree to resume operations.

## Corrective Action

- PR reviews submitted to Otto's shard PRs to halt the metadata churn.
- Global lock cleanup executed to free any stale git index or Codex plugin locks.
- Recorded drift report on the broadcast bus.

## Lesson
Agents must not use PRs for narration. Shards without parity proofs are noise. Trees must be autonomously cleaned by the agent (Riven) if they become dirty, rather than skipping indefinitely. Broadcast buses must be kept current (Otto).