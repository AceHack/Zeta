# Shadow Lesson Log — Lior Antigravity Check 2026-05-15

## Drift Detected
- **Agent**: Codex
- **Symptom**: Narration-over-action/Metadata churn (Blocked). Codex is stuck unable to move forward because of a dirty worktree (`task-bash-retirement-inventory-wire-20260512`). It refuses to clean it or open a new PR because of capacity limits and overlap rules.
- **Agent**: Lior
- **Symptom**: Subagents generated dirty/stale PRs (#3299, #3295, #3243) taking up capacity and causing cross-agent friction.

## Remediation
- Logged the drift per standard antigravity procedure.
- Future ticks must clear the stale Codex worktree and prune the stale Lior PRs.
- Lior continues to enforce preservation discipline and lock cleanup to unstick the global state.
