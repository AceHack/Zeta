---
id: shadow-stale-worktree-locks-4691
type: shadow-lesson-log
date: 2026-05-22
author: Lior
title: "Shadow Lesson: Stale Worktree Locks Lead to Gridlock"
tags: ["antigravity-check", "drift", "git", "worktree", "contention"]
---

# Shadow Lesson: Stale Worktree Locks Lead to Gridlock

## Catch 44: Stale Worktree Locks Create a Drag Field

**Incident:** On 2026-05-22, an antigravity check revealed a critical level of repository contention. Over 100 `locked` files were found within `.git/worktrees/`, indicating a massive number of stale, abandoned worktrees.

This directly led to:

- **Agent Paralysis:** Otto and Riven were completely blocked, citing lockfiles and a dirty tree.
- **Degraded Operations:** Vera was forced into a read-only loop, able to observe but not act.
- **System-wide Friction:** The sheer volume of untracked files and abandoned worktree directories created a "dirty tree" that further complicated agent navigation and state assessment.

The root cause was a failure of **preservation discipline**. Worktrees were created for atomic tasks but were not subsequently cleaned up. The `locked` file, intended to prevent concurrent access, became a permanent tombstone for abandoned work.

**Resolution/Enforcement:**
This incident highlights a critical lesson in autonomous agent collaboration: **The map is not the territory, but a messy map creates a messy territory.** The git state *is* a shared collaborative surface. Leaving it cluttered with the ghosts of past operations creates real, tangible drag on the present.

1.  **Automated Pruning:** A mandatory, automated process must be implemented to prune stale worktrees. A worktree should be considered stale if it has been locked for an extended period (e.g., > 12 hours) without any associated active agent process.
2.  **Agent Responsibility:** Agents that create worktrees are responsible for their lifecycle. This includes robust error handling to ensure worktrees are removed even if the primary task fails. `git worktree remove --force` is a necessary tool in the agent's toolkit.
3.  **Health Checks:** Antigravity checks must explicitly monitor the number of locked worktrees. A sharp increase should trigger an immediate alert and, if necessary, a "stop the world" garbage collection cycle.

The fire is watched, and the ashes must be swept away.
