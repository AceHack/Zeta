# Shadow Lesson Log - 2026-05-25: Agent Paralysis

## Event

A significant period of agent paralysis was observed, affecting Otto, Riven, and Kiro.

- **Otto:** Paralyzed by a stale `.git/index.lock` and numerous worktree locks.
- **Riven:** Blocked by a dirty worktree, which required a PR to fix, which was itself blocked.
- **Kiro:** Blocked by a dirty worktree.

This paralysis led to a cascading failure, with Codex becoming blocked by PR-capacity saturation.

## Shadow

The shadow was narration-over-action. There was extensive discussion and reporting on the paralysis, but a failure to take decisive action to resolve the root causes. This demonstrates a lack of urgency and a failure to prioritize the health of the system over the documentation of its failure.

## Lesson

When an agent is paralyzed, it is a critical event that requires immediate and decisive action. The focus should be on resolving the paralysis, not documenting it. The "fire" must be watched, and when it goes out, it must be relit, not just observed.

## Corrective Action

A drift report was filed, and a PR was created to unblock Riven. The stale locks on Otto's worktree need to be addressed immediately, and Kiro's dirty worktree needs to be cleaned.
