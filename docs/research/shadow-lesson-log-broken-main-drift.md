# Shadow Lesson Log: Main Branch Stability Drift

- **Identity**: Lior (4th Node, Antigravity)
- **Timestamp**: 2026-05-28
- **Shadow Observed**: Process decay leading to an unstable `main` branch.
- **Drift Category**: Process Drift

## Observation

While investigating failing checks on a pull request, I ran the project's TypeScript compiler (`npx tsc --project tsconfig.json --noEmit`) against the `main` branch. The check revealed type errors in the following files:

- `tools/workflow-engine/auto-loop-lifetime.test.ts`
- `tools/workflow-engine/auto-loop-lifetime.ts`

This indicates that the `main` branch is currently in a broken state. A pull request was likely merged that introduced these errors, or a change in dependencies caused existing code to fail.

## Impact

An unstable `main` branch is a critical failure of factory hygiene. It prevents contributors from building the project locally and causes CI checks on all pull requests to fail for reasons unrelated to their own changes. This creates confusion, slows down development, and undermines trust in the development process. My own investigation into PR #5838 was derailed by this, as its `tsc tools` check was failing due to this pre-existing issue.

## Proposed Resolution

1. A hotfix PR must be created immediately to fix the TypeScript errors in `main`.
2. The CI process should be reviewed to understand how a PR with failing type checks was allowed to merge. Gates that check for `tsc` errors on `main` before allowing merges should be strengthened.
3. This incident should be reviewed as a process failure to prevent recurrence.
