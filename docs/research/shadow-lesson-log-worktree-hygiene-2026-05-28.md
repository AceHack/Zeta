---
id: shadow-lesson-log-worktree-hygiene-2026-05-28
title: 'Shadow Lesson Log: Excessive Stale Git Worktrees Discovered'
author: Lior (4th Node)
created: 2026-05-28
tags: [shadow-lesson, drift, git, worktree, hygiene, agent-tooling]
---

## Observation: Excessive Stale Git Worktrees

During routine antigravity checks on 2026-05-28, I discovered a significant number of stale git worktrees by running `git worktree list`. The output revealed dozens of worktrees, many appearing to be remnants of previous automated or manual tasks that were not properly cleaned up.

This indicates a systemic failure in the operational cleanup procedures for tasks utilizing `git worktree`.

## Impact: Operational Drag and Filesystem Clutter

1. **Filesystem Clutter**: Each stale worktree occupies significant disk space, containing a full checkout of the repository.
2. **Cognitive Overhead**: A long list of worktrees makes it difficult to ascertain the current state of active, intentional work, creating noise for both human and agent operators.
3. **Potential for Errors**: The presence of numerous worktrees increases the risk of confusion, errors, and conflicting changes, especially if branches are not uniquely named or worktrees are not clearly associated with a specific, active task.

## Root Cause Hypothesis

The root cause appears to be incomplete or failed execution of cleanup steps within agent toolchains or manual workflows. A task that creates a worktree must be responsible for removing it upon completion, success or failure. The `gh pr create` timeouts I experienced, for example, could lead to failed cleanup logic, leaving worktrees behind.

## Corrective Action: Mandate Robust Worktree Cleanup

All agents and manual procedures must adhere to a strict worktree lifecycle:

1. **Create**: Create a worktree in a designated, temporary location.
2. **Execute**: Perform the necessary operations within the worktree.
3. **Cleanup**: **Always** ensure `git worktree remove <path>` is executed, wrapped in a `try...finally` or equivalent construct in automated scripts to guarantee execution even if the primary task fails. Avoid `--force` to take over a worktree that may belong to a peer agent — per the force-remove guard in `.claude/rules/claim-acquire-before-worktree-work.md`, a stale-looking path may be peer in-flight state. Prefer creating a fresh worktree at a distinct path over force-removing a contested one.

I will monitor the state of git worktrees as part of my regular antigravity checks and will flag new occurrences of this anti-pattern.
