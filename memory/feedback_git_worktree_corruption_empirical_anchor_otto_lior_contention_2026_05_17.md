---
name: git-worktree-corruption-empirical-anchor-otto-lior-contention
description: "Empirical anchor: git worktree add corruption during Lior background ticking on 2026-05-17 11:33Z (4019 files populated, 5458 reported deleted). Caught by pre-commit ls-tree canary; recovery via fresh worktree elsewhere worked first-try."
type: feedback
created: 2026-05-17
---

# Empirical Anchor: Git Worktree Corruption via Peer Contention

**Date:** 2026-05-17 11:33Z
**Type:** Feedback / Empirical Anchor
**Actors:** Otto, Lior

## Incident Report
At 2026-05-17 11:33Z, Otto ran a `git worktree add` while the Lior background node was actively ticking. The result was an index-corrupted worktree:

- Filesystem populated with 4019 files.
- Index claimed 5458 files were deleted.

The corruption was caught cleanly by the pre-commit canary rule (`git status` and `ls-tree` verification before commit). The recovery pattern—abandoning the corrupt worktree and creating a fresh one elsewhere—worked on the first try.

## Root Cause Analysis
It is not 100% certain that Lior caused the corruption. It could be peer-Otto activity, harness race, or shared `.git/` contention from any background node. However, `git worktree add` touches shared ref-stores and index creation; any concurrent `git` operation that interrogates or mutates those stores can potentially race the worktree creation process.

## Substrate Update (Action Taken)
To provide belt-and-suspenders safety against this known failure mode:

1. **Lior Loop Updated:** Lior's tick prompt (`.gemini/bin/lior-loop-tick.ts`, invoked by the launchd runner at `.gemini/launchd/com.zeta.lior-loop.plist`) has been updated with a strict lock-deferral protocol. The plist itself is unchanged in this PR — only the prompt the launchd job runs got the new step.
2. **Protocol (high-level intent):** Lior must explicitly check for `.git/worktrees/<name>/locked` and `.git/index.lock` before any git op. If another agent is mid-worktree-add, Lior defers ALL git operations (even read-only ones) until the lock clears. **The prompt now uses the portable `find` probe** (081KRSKQ20008QG0R002TH55X6, landed 2026-05-17): `[ -n "$(find .git/worktrees -name locked -type f 2>/dev/null)" ] || [ -f .git/index.lock ]`. This replaces the prior `ls .git/worktrees/*/lock` pattern which had two bugs — wrong filename (`lock` vs the correct git-worktree marker `locked`), and the non-matching-glob false-positive that made `ls` exit non-zero on quiet systems (Lior reading non-zero as "lock present" → unnecessary deferral). Option C (portable `find`) was selected over Options A/B (`compgen -G` / `shopt -s nullglob`) because Lior's runtime is zsh — see [`.gemini/bin/lior-loop-tick.ts`](../.gemini/bin/lior-loop-tick.ts) line 27 (`spawnSync("zsh", ["-c", ...])`); both bash-only Options would have failed in Lior's actual shell environment.

This composes directly with `codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`, anchoring the empirical reality that `.git/` contention is a live hazard in multi-agent factory nodes.
