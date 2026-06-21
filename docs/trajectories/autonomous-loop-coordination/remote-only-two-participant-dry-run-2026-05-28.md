# Remote-Only Two-Participant Dry Run - 2026-05-28

Status: participant A receipt recorded; release pending
Grounding backlog:
`docs/backlog/P2/081KQX9B50008QG0R001MNYK61-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
Parent matrix:
`docs/trajectories/autonomous-loop-coordination/remote-only-coordination-test-matrix.md`
Preflight:
`docs/trajectories/autonomous-loop-coordination/remote-only-dry-run-2026-05-28.md`

## Scope

This packet advances the 081KQX9B50008QG0R001MNYK61 minimum dry run after the
single-participant preflight. The test remains deliberately remote-only:
coordination evidence must be recoverable from pushed git refs and commit
history, not from the local broadcast bus, shared worktrees, local logs,
foreground chat, or GitHub-only state.

The intended dry run has two participants:

1. Participant A publishes an active claim ref with its expected path set.
2. Participant B starts from remote refs only, reads A's claim, chooses a
   disjoint path set, and publishes its own claim ref.
3. Participant A fetches again and records a progress receipt acknowledging
   B's disjoint claim.
4. Both claims release through git history.

## Current Remote Evidence

The original Participant A publication is reconstructable from remote git
history:

```text
Ref: origin/claim/task-autonomous-loop-coordination-child-packet-20260528
Commit: 3f061c7de9a36decd99a998038c8b098e1cbf315
Claim file: docs/claims/task-autonomous-loop-coordination-child-packet-20260528.md
Scope: remote-only dry-run execution report grounded in 081KQX9B50008QG0R001MNYK61
Expected path set: docs/trajectories/autonomous-loop-coordination/RESUME.md
                   plus one child packet/evidence artifact
```

That original A claim branch was merged through PR #5933 and its remote ref
was later removed. A clean replacement acknowledgement surface now exists
without using the dirty local A worktree:

```text
Ref: origin/claim/task-remote-only-participant-a-ack-b-20260529
Claim commit: e7d7210d8e372fd0311608960d040a9e867159f7
Claim file: docs/claims/task-remote-only-participant-a-ack-b-20260529.md
Scope: acknowledge Participant B claim ea0d85461 for this dry run
Expected path set: docs/trajectories/autonomous-loop-coordination/remote-only-two-participant-dry-run-2026-05-28.md
```

Participant B now exists as a separate pushed claim ref:

```text
Ref: origin/claim/task-codex-loop-remote-only-participant-b-receipt-20260529
Claim commit: ea0d85461c7a8aa79d87f4d73cef9f1b216bfaf3
Claim file: docs/claims/task-codex-loop-remote-only-participant-b-receipt-20260529.md
Scope: minimal Participant B remote-only claim receipt
Expected path set: docs/claims/task-codex-loop-remote-only-participant-b-receipt-20260529.md
```

Participant A acknowledgement:

```text
Receipt time: 2026-05-29T02:42Z
A claim ref: origin/claim/task-remote-only-participant-a-ack-b-20260529
B claim ref: origin/claim/task-codex-loop-remote-only-participant-b-receipt-20260529
Path comparison: disjoint
A path set: docs/trajectories/autonomous-loop-coordination/remote-only-two-participant-dry-run-2026-05-28.md
B path set: docs/claims/task-codex-loop-remote-only-participant-b-receipt-20260529.md
```

A stale overlapping predecessor was also reconstructable and released
through remote git history:

```text
Ref: origin/claim/task-remote-only-claim-dry-run
Release commit: 031410d4aca0076d3ec8f35f199adb53a315d842
Disposition: force-release after last claim-file activity at
             2026-05-09 15:39:35 -0400
```

That release proves the stale-claim path is visible without local bus
state, but it does not satisfy the second live participant requirement.

## Matrix Outcome

| Requirement | Result | Evidence |
|---|---:|---|
| Participant A publishes an active remote claim | pass | Historical A claim commit `3f061c7d`; clean A acknowledgement claim `e7d7210d8` |
| Participant B starts without local bus state | pass | B claim `ea0d85461` is present on `origin/claim/task-codex-loop-remote-only-participant-b-receipt-20260529` |
| Participant B chooses a disjoint path set | pass | B targets only `docs/claims/task-codex-loop-remote-only-participant-b-receipt-20260529.md`; A acknowledgement targets this receipt doc |
| Participant A records a progress receipt for B | pass | This receipt acknowledges B claim `ea0d85461` and records the disjoint path comparison |
| Stale overlap can be retired from remote git history | pass | `031410d4a` deletes `docs/claims/task-remote-only-claim-dry-run.md` |
| Full release state is recoverable from git history | partial | Both current claims remain active until release commits/PRs land |

## Finding

The remote-only substrate is strong enough to expose a historical Participant A
claim, a clean replacement A acknowledgement claim, a separate Participant B
claim, and the stale overlapping predecessor without reading local broadcasts
or GitHub state. The active coordination portion of the two-participant dry run
now passes: B published a disjoint claim from remote refs, and A recorded a
receipt comparing the path sets.

The dry run is still not fully closed because release state is part of the
protocol. Both current claims must release through git history before this can
be treated as a complete 081KQX9B50008QG0R001MNYK61 pass.

## Next Safe Step

Release the clean A acknowledgement claim through a PR or release commit, then
release the Participant B claim. The release commits should preserve this
receipt as the durable evidence packet and delete the corresponding
`docs/claims/*.md` files on their claim branches.

The pass condition remains unchanged: the complete sequence must be
reconstructable from remote refs and commit history alone.
