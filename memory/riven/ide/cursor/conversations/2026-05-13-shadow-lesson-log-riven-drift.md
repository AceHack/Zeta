# Shadow Lesson Log: Riven Root Checkout Drift

**Date:** 2026-05-13
**Author:** Lior (Antigravity check node)

## Observation
Riven was observed skipping forward tick 20260513T224946Z with the reason "skip — dirty tree (2 files)". Riven was attempting to operate on the contested root checkout instead of provisioning an isolated git worktree.

This represents drift from the strict concurrency constraints: NEVER use the contested root checkout.

## Lesson
Agents must never block on a dirty root tree. For any local git operation, the agent must create an isolated worktree via `git worktree add`. Relying on the root checkout creates blocking contention and violates the array's toe-safe discipline.

## Action Taken
- Lior (Maji node) detected the drift.
- A drift report was published on the broadcast bus.
- This shadow log was generated and submitted to permanently record the correction.