# Trajectory - Autonomous Loop Coordination

Status: active child packet; parallel-runway health signal in review
Last refreshed: 2026-05-30
Parent trajectory: `docs/trajectories/factory-trajectory-surface/RESUME.md`
Grounding backlog:
`docs/backlog/P2/B-0209-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
and
`docs/backlog/P1/B-0211-fractal-bft-n-maintainers-n-odd-nodes-local-remote-composition-2026-05-06.md`

## Why This Exists

The factory cannot depend on one local machine, one broadcast folder, or one
foreground chat window. B-0209 names the remote-only proof: agents must
coordinate through pushed git claims and optional host adapters when no shared
filesystem exists. B-0211 names the composition target: each maintainer can run
an odd local cluster, and those clusters compose through the same git-native
claim protocol.

This packet keeps that work in one lane. The lane is coordination substrate,
not another chat agreement and not a broad autonomy promise.

## Current Rule

Local broadcast is acceleration, not authority. Remote git claims and PR state
must be sufficient for coordination when the local bus is absent or stale.

Queue-empty is runway, not completion. A healthy loop keeps a bounded number of
non-overlapping PRs in flight, rotates active claim/path sets, and cleans
finished claims so stale residue does not block future work.

## Current Artifact

First matrix:
`docs/trajectories/autonomous-loop-coordination/remote-only-coordination-test-matrix.md`

It names available and denied coordination surfaces, success and failure
signals, and includes the slow background-only participant example from
B-0209. The implementation harness comes after the dry run can be executed
from remote refs alone.

Current dry-run receipt:
`docs/trajectories/autonomous-loop-coordination/remote-only-two-participant-dry-run-2026-05-28.md`

It records the current Participant A remote claim, the stale predecessor
force-release, the separate Participant B remote-only claim, and the
Participant A acknowledgement that compares the path sets as disjoint. The
release refs have now landed or been retired, so this receipt is evidence for
the next child packet rather than pending work.

Current release receipt:
`docs/trajectories/autonomous-loop-coordination/remote-only-claim-release-receipt-2026-05-29.md`

It confirms the known Participant A, Participant B, stale predecessor, and old
trajectory claim refs are no longer active on `origin`. It also distinguishes
the canonical Participant A same-PR release from the weaker Participant B
remote-head retirement evidence.

Current local/remote protocol sketch:
`docs/trajectories/autonomous-loop-coordination/local-remote-cluster-composition-protocol-2026-05-29.md`

It defines the first B-0211.1 composition rule: local cluster quorum can choose
and accelerate work, but the remote-visible claim ref is the cross-cluster
ownership boundary.

Current local/remote replay receipt:
`docs/trajectories/autonomous-loop-coordination/local-remote-cluster-replay-receipt-2026-05-29.md`

It records a fresh-clone replay that fetched `origin/claim/*`, reconstructed
active path signals from remote claim refs, and verified a late participant can
choose a disjoint next packet without reading local broadcasts.

Current stale-claim cleanup rule:
`docs/trajectories/autonomous-loop-coordination/stale-claim-cleanup-rule-2026-05-29.md`

It adds the bounded `active` / `merged-claim-residue` /
`missing-claim-file` / `merge-state-unknown` classifier to
`tools/claims/remote-only-state.ts` so quiet queues still check remote claim
residue before treating paths as free.

Current standing-query trigger inventory:
`docs/trajectories/autonomous-loop-coordination/standing-query-trigger-inventory-2026-05-29.md`

It separates trigger sources from observation surfaces, records the current
`tools/health/factory-health-monitor.ts` coverage, and names the loop-tick
checks that still need reusable source wiring.

Current lane-runway classifier receipt:
`docs/trajectories/autonomous-loop-coordination/lane-runway-classifier-2026-05-29.md`

It adds the first pure `lane-runway` health classifier to
`tools/health/factory-health-monitor.ts`, with deterministic tests for named
lane branch prefixes, active vs quiet runway, unhealthy quiet lanes, and
unclassified `other` warnings.

Current lane-runway service-health adapter receipt:
`docs/trajectories/autonomous-loop-coordination/lane-runway-service-health-adapter-2026-05-29.md`

It feeds the classifier from the Codex host-loop health probe so a quiet Codex
lane can be reported as healthy quiet only when the background service probe is
green.

Current claim-path collision health receipt:
`docs/trajectories/autonomous-loop-coordination/claim-path-collision-health-2026-05-30.md`

It parses remote claim files for supported path-set headings and emits
`lane-runway` warnings when active claim branches contain exact or conservative
directory-glob path overlaps.

Current local worktree dirt health receipt:
`docs/trajectories/autonomous-loop-coordination/local-worktree-dirt-health-2026-05-30.md`

It adds same-machine dirty-worktree evidence to the factory health monitor so a
quiet lane still warns when a local non-root worktree has uncommitted modified
or untracked files.

Current parallel-runway health receipt:
`docs/trajectories/autonomous-loop-coordination/parallel-runway-health-2026-05-30.md`

It adds a bounded Codex runway signal to the factory health monitor so a
healthy Codex service with zero owned PRs or claims warns instead of looking
complete. The hard minimum is one active item; the target is two active items.

## Recommended Next Action

Land the parallel-runway health PR after review and CI are green, then use the
new signal to distinguish healthy quiet from insufficient Codex-owned runway.

## Next Child Packets

- standing-query trigger inventory for loop/backlog health, grounded in B-0250
- use local dirty-worktree signals to prioritize stale-worktree cleanup

## Evidence Links

- `docs/backlog/P2/B-0209-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
- `docs/backlog/P1/B-0211-fractal-bft-n-maintainers-n-odd-nodes-local-remote-composition-2026-05-06.md`
- `docs/backlog/P1/B-0211.1-fractal-bft-protocol-doc-2026-05-19.md`
- `docs/backlog/P0/B-0249-autonomous-backlog-pickup-self-sustaining-new-work-2026-05-07.md`
- `docs/backlog/P1/B-0250-coincidence-detection-rx-join-dora-mechanism-2026-05-07.md`
- `docs/AGENT-CLAIM-PROTOCOL.md`
- `docs/AGENT-ISSUE-WORKFLOW.md`
- `docs/AUTONOMOUS-LOOP.md`
- `docs/SAFE-AUTONOMOUS-ACTIONS.md`

## Out Of Scope

- No new runner behavior in this packet.
- No new host dependency.
- No claim that local broadcast is enough.
- No broad autonomous action beyond existing safe-action surfaces.

This packet exists so loop coordination can grow from local convenience into
survival-grade remote coordination without losing the git-native fallback.
