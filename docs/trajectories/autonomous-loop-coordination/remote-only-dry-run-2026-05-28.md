# Remote-Only Dry Run Execution Report - 2026-05-28

Status: partial execution report
Grounding backlog:
`docs/backlog/P2/081KQX9B50008QG0R001MNYK61-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
Parent matrix:
`docs/trajectories/autonomous-loop-coordination/remote-only-coordination-test-matrix.md`

## Scope

This report executes the first remote-only replay that can be run safely from
the current Codex claim lane. It tests whether a participant starting with no
local broadcast bus, no shared worktree, no GitHub API, and no local logs can
discover the active claim from remote git refs alone.

This is not yet the full two-participant dry run from the matrix. It is the
single-participant preflight that proves the first half of 081KQX9B50008QG0R001MNYK61: active work
can be reconstructed from pushed git refs without a local-only coordination
surface.

## Denied Surfaces

- Local broadcast files.
- Shared worktrees.
- Shared terminal state.
- Local loop logs and heartbeats.
- GitHub PR, issue, or check APIs.

## Available Surfaces

- `origin/claim/*` refs.
- Claim files stored on those refs.
- Remote commit history.

## Replay Commands

The replay used a scratch git repository and remote refs only:

```bash
scratch=$(mktemp -d /tmp/zeta-remote-only-dry-run.XXXXXX)
git -C "$scratch" init --quiet
git -C "$scratch" remote add origin https://github.com/Lucent-Financial-Group/Zeta.git
git -C "$scratch" fetch --quiet origin '+refs/heads/claim/*:refs/remotes/origin/claim/*'
git -C "$scratch" branch -r --list 'origin/claim/*'
git -C "$scratch" show \
  origin/claim/codex-autonomous-loop-remote-dry-run-20260528:docs/claims/codex-autonomous-loop-remote-dry-run-20260528.md
```

## Observed Result

- Remote claim refs were discoverable from the scratch repository.
- The scratch repository saw 37 `origin/claim/*` refs.
- The active Codex claim file was readable through remote git alone.
- The claim exposed the harness, claimed-at timestamp, scope, durable target,
  and notes needed to avoid path overlap.
- The durable target did not already exist on `origin/main`, so the report path
  was safe to create inside the claim branch.

The active claim reconstructed from remote refs was:

```text
Claim: codex-autonomous-loop-remote-dry-run-20260528
Harness: codex
Claimed at: 2026-05-28T19:00:44Z
Scope: Small remote-only autonomous-loop dry-run execution report grounded in 081KQX9B50008QG0R001MNYK61.
Durable target: docs/trajectories/autonomous-loop-coordination/remote-only-dry-run-2026-05-28.md
```

## Matrix Outcome

| Matrix requirement | Result | Evidence |
|---|---:|---|
| Start from a fresh repository with no local bus | pass | Scratch repository initialized outside the Zeta worktrees |
| Discover active work with `git fetch origin` plus claim refs | pass | 37 remote claim refs listed |
| Recover ownership and target path from claim file | pass | Claim file read from `origin/claim/codex-autonomous-loop-remote-dry-run-20260528` |
| Avoid GitHub as a required dependency | pass | Replay used git transport only |
| Prove two participants avoid overlap | not run | Only the Codex claim participated in this preflight |
| Prove release reconstruction from git history | not run | No release commit exists yet for this claim |

## Finding

The remote-only claim substrate is sufficient for a fresh participant to
discover the active Codex lane and its intended path set without local
broadcasts or GitHub. That is enough to prevent hidden local-only ownership for
this lane.

The full 081KQX9B50008QG0R001MNYK61 pass still requires a second participant to push a disjoint
claim, acknowledge the first claim by remote progress commit, and release both
claims through git history.

## Next Safe Dry Run

1. Participant B starts from a fresh clone or scratch repository.
2. Participant B fetches `origin/claim/*` and reads this claim.
3. Participant B chooses a disjoint target path under a separate claim branch.
4. This Codex claim records a progress commit acknowledging B's disjoint path.
5. Both claims release through commits that leave the full sequence recoverable
   from remote refs and commit history.

This keeps 081KQX9B50008QG0R001MNYK61 focused: host comments and local broadcasts may improve
latency, but the coordination proof must survive without either one.
