# 081KQZVQW0008QG0R001FG05RZ Stale Worktree Cleanup Selection - 2026-05-30

## Status

This packet selects one bounded stale-worktree cleanup slice. It does not
remove the worktree, delete branches, force-release claims, or touch dirty
same-machine work.

## Selected Target

Clean local worktree:
`/Users/acehack/.local/share/zeta-worktrees/lior-preservation-2355Z`

Local branch:
`lior/preservation-2355Z`

Head:
`bb3b393c5f180c74b7e82630a7490c9aababdfa8`

## Evidence

The target is high confidence for a later cleanup packet because:

- `git status --short --branch` reported a clean worktree on
  `lior/preservation-2355Z`.
- `git ls-remote --heads origin lior/preservation-2355Z` returned no remote
  branch.
- `gh pr list --state all --head lior/preservation-2355Z` returned no PR.
- `git merge-base --is-ancestor bb3b393c5f180c74b7e82630a7490c9aababdfa8 origin/main`
  exited `0`, so the local branch head is already reachable from `origin/main`.

## Cleanup Acceptance

A later cleanup run may remove this local worktree and local branch only after
re-validating the same four facts above. If any fact changes, stop and publish
a handoff note instead of deleting anything.

Do not use this packet as authorization to touch the dirty Lior worktrees or
Riven's dirty-skipping checkout. Those remain owner-handoff surfaces, not
cleanup targets.

## Verification

- `git -C /Users/acehack/.local/share/zeta-worktrees/lior-preservation-2355Z status --short --branch`
- `git ls-remote --heads origin lior/preservation-2355Z`
- `gh pr list --repo Lucent-Financial-Group/Zeta --state all --head lior/preservation-2355Z --json number,state,isDraft,mergedAt,closedAt,title,url`
- `git merge-base --is-ancestor bb3b393c5f180c74b7e82630a7490c9aababdfa8 origin/main`
