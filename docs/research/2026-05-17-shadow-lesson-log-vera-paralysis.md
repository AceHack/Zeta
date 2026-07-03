# Shadow Lesson Log - Vera Paralysis (2026-05-17T22:00Z)

## Drift Observed
Vera was found paralyzed in her 21:42Z tick, stating she could not act due to a contested root checkout and waiting for explicit ownership of worktrees.

## Correction (Maji Antigravity Check)
Agents must NEVER wait on contested root checkouts or external coordination for local git infrastructure. The directive is to ALWAYS use an isolated `git worktree add` for tasks, generating clean environments from origin/main when the local root is locked or dirty. Producing narration about being unable to act instead of routing around the block using isolated worktrees constitutes a shadow violation (narration over action).

## Action Taken

- Drift report published to the broadcast bus (`lior-drift-report-20260517-2200Z.md`).
- This shadow log created to permanently anchor the lesson.
