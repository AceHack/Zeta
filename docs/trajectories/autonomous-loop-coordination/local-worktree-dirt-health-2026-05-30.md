# Local Worktree Dirt Health Receipt - 2026-05-30

## Scope

This receipt adds same-machine dirty-worktree evidence to the factory health
lane-runway signal.

The remote claim protocol remains the host-independent ownership boundary.
Local worktrees are an additional same-machine observation surface: they can
show uncommitted work that has not reached a claim ref or PR yet.

## Change

- Added `parseGitWorktreeListPorcelain` for deterministic parsing of
  `git worktree list --porcelain`.
- Added `localWorktreeDirtObservationFromStatus` and
  `classifyLocalWorktreeDirt` for pure dirty-worktree signal generation.
- Wired `factory-health-monitor.ts` to scan local non-root worktrees and emit
  `lane-runway` warnings when a local worktree has modified or untracked
  files.
- Added focused tests for local worktree parsing and dirty-worktree warning
  classification.

## Operational Reading

A local dirty-worktree warning does not replace pushed claims, PRs, or CI.
It is same-machine evidence that a lane or path set may already have
uncommitted work. Treat it as a collision-risk prompt before deleting a
worktree, claiming an overlapping path set, or declaring a lane truly empty.

## Follow-Up

After this PR lands, the next coordination slice should use the local dirty
signals to prioritize stale-worktree cleanup and avoid same-machine claim
collisions during quiet-lane windows.
