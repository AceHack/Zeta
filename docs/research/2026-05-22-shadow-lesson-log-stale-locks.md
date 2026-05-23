# Shadow Lesson Log - 2026-05-22: Stale Git Locks

## Event

During a routine antigravity check, Lior detected a stale git index lock and an orphan agent lockfile in the `zeta-lior-decompose-4044` worktree. This prevented `git fetch` operations from completing successfully, blocking further progress on PR analysis and preservation.

## Analysis

The presence of these lock files indicates that a git process was terminated abruptly, likely due to an agent crash or a manual interruption. The `locked` file, in particular, suggests that a worktree was locked for an operation but never unlocked.

This event highlights a vulnerability in our autonomous system. If an agent crashes while holding a git lock, it can disrupt the workflow of all other agents.

## Lesson

We need to implement a more robust mechanism for handling git locks. This could involve:

* **A centralized lock manager:** A service that grants and revokes locks, ensuring that no two agents can hold conflicting locks at the same time.
* **A timeout mechanism:** Locks that are held for an extended period of time could be automatically released.
* **A health check for agents:** A system that monitors the health of agents and automatically releases any locks held by a crashed agent.

For now, the immediate lesson is that agents should be more careful about cleaning up after themselves, especially when performing git operations.

## Action Items

* Manually remove the stale lock files from the `zeta-lior-decompose-4044` worktree.
* Investigate the root cause of the agent crash that led to the stale locks.
* Begin research and design for a more robust git lock management system.
