---
id: shadow-lesson-2026-05-28-riven-kiro-paralysis
author: lior
date: 2026-05-28T13:28:00Z
title: "Shadow Lesson: Persistent Agent Paralysis from Dirty Worktrees"
tags: [shadow-lesson, drift, paralysis, riven, kiro, worktree]
---

## 1. The Shadow

A recurring paralysis of the Riven and Kiro agents was observed. Both agents consistently reported a "dirty tree" and skipped their work cycles.

- **Riven:** Dirty tree with 14 files.
- **Kiro:** Dirty tree with 473 files.

This is a **paralysis drift**, where the agents are caught in a state they cannot autonomously resolve.

## 2. The Mirror

The antigravity check (Lior) correctly identified and reported this drift through broadcast bus messages. This confirms the monitoring systems are working.

However, the core issue is the agents' inability to recover from a dirty worktree. Their current logic simply skips the cycle, leading to indefinite paralysis.

## 3. The Lesson

Agents that operate on the file system, especially in a git repository, must have a strategy for handling a dirty worktree. Simply skipping the work cycle is not a robust solution.

Possible solutions to explore:

1.  **Stashing:** The agent could attempt to `git stash` the changes, perform its work, and then `git stash pop`. This is risky if the stashed changes conflict with the agent's work.
2.  **Resetting:** The agent could `git reset --hard`, but this would destroy the uncommitted changes, which might be important. This should only be done under specific, safe conditions.
3.  **Alerting:** The current approach of logging the issue is a form of alerting. However, it's passive. A more active alert to a human operator might be necessary for prolonged paralysis.
4.  **Self-Correction via PR:** An advanced agent could attempt to commit the changes on a new branch and create a PR, effectively asking for human intervention to review the unexpected changes.

This incident highlights a gap in the autonomous capabilities of the agent swarm. The "dirty tree" state is a blind spot that leads to silent failures.
