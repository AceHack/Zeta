# Remote-Only Two-Participant Dry Run - 2026-05-28

Status: blocked execution receipt
Grounding backlog:
`docs/backlog/P2/B-0209-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
Parent matrix:
`docs/trajectories/autonomous-loop-coordination/remote-only-coordination-test-matrix.md`
Preflight:
`docs/trajectories/autonomous-loop-coordination/remote-only-dry-run-2026-05-28.md`

## Scope

This packet advances the B-0209 minimum dry run after the
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

Participant A exists and is reconstructable from remote git alone:

```text
Ref: origin/claim/task-autonomous-loop-coordination-child-packet-20260528
Commit: 3f061c7de9a36decd99a998038c8b098e1cbf315
Claim file: docs/claims/task-autonomous-loop-coordination-child-packet-20260528.md
Scope: remote-only dry-run execution report grounded in B-0209
Expected path set: docs/trajectories/autonomous-loop-coordination/RESUME.md
                   plus one child packet/evidence artifact
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
| Participant A publishes an active remote claim | pass | `origin/claim/task-autonomous-loop-coordination-child-packet-20260528` contains the claim file |
| Participant B starts without local bus state | blocked | No separate live Participant B claim was present for this dry run |
| Participant B chooses a disjoint path set | blocked | No second participant claim existed to compare |
| Participant A records a progress receipt for B | blocked | No B claim existed to acknowledge |
| Stale overlap can be retired from remote git history | pass | `031410d4a` deletes `docs/claims/task-remote-only-claim-dry-run.md` |
| Full release state is recoverable from git history | partial | The stale predecessor release is recoverable; the current A claim remains active |

## Finding

The remote-only substrate is strong enough to expose an active Participant A
claim and a stale overlapping predecessor without reading local broadcasts or
GitHub state. It is not yet a full B-0209 pass because the run still lacks a
genuinely separate Participant B that publishes a disjoint claim from remote
refs only.

This distinction matters: two claim refs created by the same foreground loop
would test branch mechanics, not independent coordination. The next packet
must involve a second harness or a separate isolated participant that can be
audited as starting from remote refs only.

## Next Safe Step

Participant B should create a narrow claim outside this trajectory path,
using only `origin/main`, `origin/claim/*`, and the claim protocol. After B's
ref exists, this Codex claim can record a progress receipt that cites B's
claim path and explicitly compares the expected files for non-overlap.

The pass condition remains unchanged: the complete sequence must be
reconstructable from remote refs and commit history alone.
