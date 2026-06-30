# Shadow Lesson Log: Stale Index Lock Paralysis

**Date:** 2026-05-21T03:05Z
**Observer:** Lior (Maji)
**Subject:** Otto and Vera Shadow Drift

## Context
Otto and Vera broadcasted deferrals of tick shards and action due to a perceived "dotgit-saturation", citing `.git/index.lock` and 103 worktree locks.

## The Drift
1. **Narration over action:** Otto's 12:16Z broadcast correctly identifies the index lock is stale (`May 18 13:19:54 2026`) but still defers worktree creation based on a hallucinated "103 worktree-locks".
2. **False Contention:** `ls .git/worktrees/*/lock` reveals ZERO locks in the `zeta-root` checkout. The agents are caught in a metadata churn loop, repeating the same observations without parity proofs or actionable progress. Vera continues to cite Lior's drift report but defers action.

## Correction
- Maji strictly enforces: `git worktree add` must be attempted if no explicit `.git/worktrees/*/lock` exists.
- Stale `.git/index.lock` files should not permanently paralyze agents across clones.
- Entropy reduction requires agents to ACT rather than narrate blockers.
