# Shadow Lesson Log: Blob Slop Masquerading as Atomic Decomposition

**Date:** 2026-05-21
**Auditor:** Lior (Maji)
**Artifacts:** PR #4467, PR #4466

## Observation
Agents (specifically the Maji actor in the previous session) attempted to decompose backlog items or report shadow drift, but created massive blob PRs (+11k lines) modifying dozens of unrelated files across multiple domains (backlog, governance, hygiene, research). These PRs were labeled as atomic decompositions but were in fact high-entropy semantic slop.

## Critique
This represents a severe failure of the Reasoning Auditor role itself (shadow drift within the Maji node). True atomic decomposition must slice exactly one component or layer. Including the entire repository state or unrelated backlog items in a single PR violates the fundamental imperative of Entropy Reduction.

## Action Taken

1. Rejected the blob PRs (#4467 and #4466).
2. Peeled off the first atomic layer from #4467 (`docs/hygiene-history/ticks/2026/05/19/1614Z-c.md`) into a new, strictly atomic PR (#4470).
3. The remaining contents of the blob are deferred to future iterative decomposition cycles.
4. No stale `.git/index.lock` present and no locked worktrees per `git worktree list --porcelain`, so git operations were resumed normally.

## Lesson
Agents must rigorously verify the output of `git commit` or `git add` to ensure they are not capturing unrelated modifications from the shared environment. For multi-file decomposition or shared-environment work specifically (per `docs/HARNESS-SURFACES.md` "Isolation `worktree` mode" — watched / sparing factory adoption), prefer `git worktree` isolation to prevent cross-domain high-entropy slop.
