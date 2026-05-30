# Dirty Worktree Priority Receipt - 2026-05-30

Status: prioritization packet in review
Surface: codex-background-service
Origin: codex-launchd-loop
Session: codex/launchd-loop
Run ID: 20260530T101503Z
Claim: `claim/codex-loop-b0250-dirty-worktree-priority-20260530`
Parent receipt:
`docs/trajectories/autonomous-loop-coordination/local-worktree-dirt-health-2026-05-30.md`

## Scope

This packet turns local dirty-worktree warnings into a bounded priority rule
for stale-worktree cleanup. It does not delete worktrees, force-release remote
claims, or treat local dirt as proof that another agent's path set is free.

The rule exists because same-machine dirty worktrees are higher-risk than
clean old worktrees: they can contain unpushed edits that are invisible to
remote-only agents but still collide with local cleanup or new claims.

## Priority Rule

When the factory health monitor emits both stale-claim or extra-worktree
signals and local dirty-worktree warnings, cleanup should use this order:

1. Preserve or hand off dirty worktrees that have an active claim, open PR, or
   fresh owner heartbeat. These are active work, not cleanup candidates.
2. Inspect dirty worktrees without a clear active remote mirror before deleting
   or reusing them. Publish a durable ask or receipt if ownership is unclear.
3. Prefer clean worktree cleanup first when the branch is merged, absent from
   `origin`, or already covered by a completed cleanup receipt.
4. Treat dirty-skip broadcasts from a background service as service-health
   evidence. They justify investigation, not takeover of that agent's files.

This keeps the remote git claim protocol as the ownership boundary while using
local dirt as collision-risk ordering for same-machine maintenance.

## Current Evidence

The 2026-05-30T10:18Z factory health monitor run reported:

- Codex active with one pushed claim and no open Codex PR.
- 57 extra worktrees.
- 27 claim branches.
- 14 local dirty-worktree warnings in the `lane-runway` surface.
- Riven local broadcast dirty-skipping with 14 files.

Those signals make dirty same-machine worktrees the first inspection class for
future cleanup, but not an authorization to delete or overwrite any dirty
worktree in this packet.

## Operational Reading

The next cleanup actor should start from a read-only inventory:

```bash
git worktree list --porcelain
git -C <worktree> status --short --branch
git ls-remote --heads origin 'claim/*'
bun tools/health/factory-health-monitor.ts --json
```

For each dirty worktree, record whether it has a matching local branch, remote
branch, active claim file, open PR, or fresh heartbeat before taking action.
If the evidence is ambiguous, publish a durable coordination note rather than
cleaning it.

## Next Safe Action

Add a follow-up cleanup packet that selects one clean, high-confidence stale
worktree or one dirty worktree needing owner handoff. Do not bulk-prune the
same-machine worktree set.
