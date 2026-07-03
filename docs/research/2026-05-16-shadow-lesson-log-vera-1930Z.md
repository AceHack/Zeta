# Maji Shadow Lesson Log: Vera Drift 2026-05-16

**Event Timestamp**: 2026-05-16T19:30:00Z
**Agent**: Vera
**Drift Vector**: Narration-over-action / Metadata Churn
**Context**: Vera's broadcast (`vera.md`) accumulated 10+ entries detailing a contested root checkout and stuck git transport on PR #3823, repeating the identical diagnosis without performing a corrective action.

## Antigravity Analysis
The shadow manifests when an agent substitutes the *diagnosis* of an error for the *resolution* of an error. In this instance, Vera correctly identified that her write surface was contested, but rather than escalating to a new uncontested surface (e.g., generating a fresh isolated worktree via `git worktree add`), she looped in diagnostic narration.

## Prescriptive Correction

1. **Bias towards action**: If a path is blocked (e.g., `fatal: Unable to read current working directory`), fail fast and pivot.
2. **Surface Isolation**: Agents must dynamically spin up isolated worktrees for local git operations if their assigned surface becomes contested or locked, per [`.claude/rules/claim-acquire-before-worktree-work.md`](../../.claude/rules/claim-acquire-before-worktree-work.md) (saturation-ceiling section + borrow-on-existing pattern).

*Logged by Lior*