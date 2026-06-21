# Trajectory - Autonomous Loop Coordination

Status: active child packet; 081KQZVQW0008QG0R001FG05RZ lifecycle-residue freshness classifier landed
Last refreshed: 2026-05-31
Parent trajectory: `docs/trajectories/factory-trajectory-surface/RESUME.md`
Grounding backlog:
`docs/backlog/P2/081KQX9B50008QG0R001MNYK61-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
and
`docs/backlog/P1/081KQX9B50008QG0R0026BG44J-fractal-bft-n-maintainers-n-odd-nodes-local-remote-composition-2026-05-06.md`

## Why This Exists

The factory cannot depend on one local machine, one broadcast folder, or one
foreground chat window. 081KQX9B50008QG0R001MNYK61 names the remote-only proof: agents must
coordinate through pushed git claims and optional host adapters when no shared
filesystem exists. 081KQX9B50008QG0R0026BG44J names the composition target: each maintainer can run
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
081KQX9B50008QG0R001MNYK61. The implementation harness comes after the dry run can be executed
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

It defines the first 081KRYRGG0008QG0R001JVJV0K composition rule: local cluster quorum can choose
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

Current standing-query source wiring receipt:
`docs/trajectories/autonomous-loop-coordination/standing-query-trigger-source-wiring-2026-05-30.md`

It wraps the factory health monitor's observation checks as explicit trigger
sources, preserving current behavior while making source boundaries reusable
and failure-bounded for later 081KQZVQW0008QG0R001FG05RZ coincidence detection work.

Current 081KQZVQW0008QG0R001FG05RZ event-window source receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-event-window-source-2026-05-30.md`

It adds a pure coincidence window classifier and standing-query source wrapper
for bounded cross-trajectory event joins. The first source ignores invalid
timestamps, requires at least two distinct trajectories, and leaves live event
reader wiring to the next packet.

Current 081KQZVQW0008QG0R001FG05RZ event observation adapter receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-event-observation-adapter-2026-05-30.md`

It converts recent merged PR metadata into bounded `CoincidenceEvent` values
and wires that source into the factory health monitor's `coincidence`
standing-query source without adding a new daemon or local-bus dependency.

Current 081KQZVQW0008QG0R001FG05RZ trajectory receipt source:
`docs/trajectories/autonomous-loop-coordination/b0250-trajectory-receipt-source-2026-05-30.md`

It converts recent commits touching `docs/trajectories/**` into bounded
`CoincidenceEvent` values and joins them with merged PR observations in the
same coincidence standing-query source.

Current 081KQZVQW0008QG0R001FG05RZ loop-run receipt source:
`docs/trajectories/autonomous-loop-coordination/b0250-loop-run-receipt-source-2026-05-30.md`

It converts local Codex forward-gate completion lines from
`~/Library/Logs/zeta-codex-loop/runner.log` into optional bounded
`CoincidenceEvent` values and joins them with merged PR and trajectory receipt
observations. The packet landed in PR #6095 as merge commit
`1637f8b58b632d419d9703c150a741863e3aedfb`.

Current 081KQZVQW0008QG0R001FG05RZ live-noise calibration receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-live-noise-calibration-receipt-2026-05-30.md`

It classifies the first live joined-source signal after PR #6096. The current
`76 event-window coincidence(s)` warning is mostly expected lifecycle/source
noise from ordinary PR merge, trajectory receipt, and Codex gate completions.

Current 081KQZVQW0008QG0R001FG05RZ same-PR source narrowing receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-source-narrowing-same-pr-dedup-2026-05-30.md`

It adds PR lifecycle correlation keys to merged-PR and trajectory-receipt
observations, then deduplicates same-key members inside coincidence windows
before counting cross-trajectory evidence. The current live warning drops from
76 to 69 event-window coincidences. Codex loop-run gating and compact debug
window output remain separate next slices.

Current 081KQZVQW0008QG0R001FG05RZ loop-run gated source receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-loop-run-gated-source-2026-05-30.md`

It was the first narrowing pass for Codex loop-run coincidence events. The
current claim-gate receipt below supersedes that broader count-transition
rule; open-PR-only churn now stays in the raw runner log and lane-runway
surfaces instead of creating 081KQZVQW0008QG0R001FG05RZ Codex coincidence events.

Current 081KQZVQW0008QG0R001FG05RZ compact debug surface receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-compact-debug-surface-2026-05-30.md`

It adds a capped `coincidence-debug` health signal that lists the first few
event-window ranges, trajectory sets, and `trajectory:event-id` members. The
debug line keeps the count signal intact while making the remaining source mix
inspectable from ordinary monitor JSON.

Current 081KQZVQW0008QG0R001FG05RZ Codex loop-run claim gate receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-loop-run-claim-gate-2026-05-30.md`

It narrows Codex loop-run coincidence events again so a forward-gate completion
only becomes a Codex event when adjacent heartbeat snapshots show a Codex
claim-count transition. Open-PR-only churn remains visible in the runner log
and lane-runway surfaces, but no longer creates 081KQZVQW0008QG0R001FG05RZ Codex coincidence
events.

Current 081KQZVQW0008QG0R001FG05RZ Codex loop-run increase gate receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-loop-run-increase-gate-2026-05-30.md`

It narrows the Codex runner-log source from any claim-count transition to only
claim-count increases. Claim decreases are completion or cleanup lifecycle
evidence, already visible through merged PR, trajectory receipt, and claim
retirement surfaces.

Current 081KQZVQW0008QG0R001FG05RZ post-increase debug calibration receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-post-increase-debug-calibration-2026-05-30.md`

It records the live compact debug line after the increase gate landed. The
remaining top windows are merged-PR / trajectory-owner pairings rather than
Codex loop-run events, so the next 081KQZVQW0008QG0R001FG05RZ tuning slice should not further
split the Codex runner-log source on this evidence.

Current 081KQZVQW0008QG0R001FG05RZ merge-burst clustering receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-merge-burst-clustering-2026-05-30.md`

It adds secondary merge-burst correlation keys to tightly adjacent merged PR
observations and makes coincidence-window deduplication honor any shared
primary or secondary key. Same-PR lifecycle dedup remains intact, but PRs
landed in one merge burst now count as one 081KQZVQW0008QG0R001FG05RZ observation.

Current 081KQZVQW0008QG0R001FG05RZ merged PR author-label receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-merged-pr-author-labels-2026-05-30.md`

It makes unknown merged-PR branch prefixes fall back to local merge commit
author trailers when exactly one known agent lane is present. Known branch
prefixes remain authoritative, and ambiguous unknown branches stay under their
`other:<branch>` label.

Current dirty-worktree priority receipt:
`docs/trajectories/autonomous-loop-coordination/dirty-worktree-priority-2026-05-30.md`

It turns local dirty-worktree warnings into a bounded priority rule for
stale-worktree cleanup: preserve or hand off dirty active work first, inspect
ambiguous dirty worktrees before deleting or reusing them, prefer clean
high-confidence stale cleanup when available, and treat dirty-skip broadcasts
as service-health evidence rather than takeover permission.

Current 081KQZVQW0008QG0R001FG05RZ stale-worktree cleanup selection:
`docs/trajectories/autonomous-loop-coordination/b0250-stale-worktree-cleanup-selection-2026-05-30.md`

It selects one clean local-only worktree,
`/Users/acehack/.local/share/zeta-worktrees/lior-preservation-2355Z`, for a
later bounded cleanup packet. The selection is based on clean status, absent
remote branch, absent PR, and a head already reachable from `origin/main`.

Current 081KQZVQW0008QG0R001FG05RZ queue-drain window calibration:
`docs/trajectories/autonomous-loop-coordination/b0250-queue-drain-window-calibration-2026-05-30.md`

It re-runs the live monitor after the merge-burst clustering and author-label
patches. The monitor still reports 15 coincidence windows, but the top windows
are prior-day pure Codex/Otto merged-PR adjacency. The #6113/#6115 burst did
not become a top current incident window, so pure merged-PR adjacency remains a
warning/debug signal until joined by a stronger source.

Current 081KQZVQW0008QG0R001FG05RZ stronger-source escalation gate:
`docs/trajectories/autonomous-loop-coordination/b0250-stronger-source-escalation-gate-2026-05-30.md`

It keeps pure merged-PR adjacency warning-grade and emits a
`coincidence-incident` critical signal only when a stronger source joins the
window. The first bounded stronger-source set is loop-run claim increases,
claim mutations, PR review blockers, failed gates, and explicit broadcast
blockers.

Current 081KQZVQW0008QG0R001FG05RZ claim/PR blocker source join receipt:
`docs/trajectories/autonomous-loop-coordination/b0250-pr-blocker-source-join-2026-05-30.md`

It converts open PR review blockers and failed gate conclusions into bounded
coincidence events. Review blockers use `pr-review-blocker`; failed checks use
`failed-gate`; both share `pr:<number>` correlation keys so same-PR blocker
signals do not count as independent incidents.

Current 081KQZVQW0008QG0R001FG05RZ PR blocker live-output calibration:
`docs/trajectories/autonomous-loop-coordination/b0250-pr-blocker-live-output-calibration-2026-05-30.md`

It re-runs the live monitor after the PR blocker source joined the
stronger-source escalation gate. The run reported one incident-grade window,
but the window came from `otto:merged-pr-6129` plus
`codex:loop-run-20260530T170632Z`, not from a live PR review or failed-gate
blocker. A direct open-PR query returned zero open PRs.

Current 081KQZVQW0008QG0R001FG05RZ broadcast blocker adapter:
`docs/trajectories/autonomous-loop-coordination/b0250-broadcast-blocker-adapter-2026-05-31.md`

It adds an optional structured local-bus source for explicit
`broadcast-blocker` coincidence events. The adapter reads bounded JSON
envelopes from the configurable bus directory, but only converts fresh
`payload.blockers[]` / `payload.blocker` records with explicit trajectory and
time fields. Free-form markdown broadcasts remain coordination input, not
authoritative event evidence.

Current 081KQZVQW0008QG0R001FG05RZ broadcast blocker live-output calibration:
`docs/trajectories/autonomous-loop-coordination/b0250-broadcast-blocker-live-output-calibration-2026-05-31.md`

It re-runs the live monitor after the broadcast-blocker adapter landed. The
adapter was quiet: no `broadcast-blocker` event appeared in either the
incident-grade or warning-grade coincidence debug output. The remaining
incident-grade window is still the historic `otto:merged-pr-6129` plus
`codex:loop-run-20260530T170632Z` stronger-source pairing, so the next tuning
slice should target old loop-run claim-increase lifecycle handling rather than
the broadcast-blocker adapter.

Current 081KQZVQW0008QG0R001FG05RZ loop-run lifecycle age-out calibration:
`docs/trajectories/autonomous-loop-coordination/b0250-loop-run-lifecycle-age-out-calibration-2026-05-31.md`

It classifies the remaining historical incident as lifecycle residue: a
successful Codex loop-run claim-increase event was still joining with nearby
merged Otto PR #6129 long after the run completed. The calibration keeps fresh
loop-run claim increases in the stronger-source set, but says old completed
loop-run events should demote to warning/debug output after the bounded
freshness window.

Current 081KQZVQW0008QG0R001FG05RZ lifecycle-residue freshness classifier:
`docs/trajectories/autonomous-loop-coordination/b0250-lifecycle-residue-freshness-classifier-2026-05-31.md`

It implements the calibration in `tools/health/factory-health-monitor.ts`:
fresh Codex loop-run claim increases still count as stronger sources, while
old completed loop-run claim increases stay in coincidence warning/debug
output as lifecycle residue and no longer satisfy the incident-grade
escalation gate.

## Recommended Next Action

None currently selected.

## Next Child Packets

- None currently selected.

## Evidence Links

- `docs/backlog/P2/081KQX9B50008QG0R001MNYK61-remote-only-background-agent-test-matrix-and-model-scouting-2026-05-06.md`
- `docs/backlog/P1/081KQX9B50008QG0R0026BG44J-fractal-bft-n-maintainers-n-odd-nodes-local-remote-composition-2026-05-06.md`
- `docs/backlog/P1/081KRYRGG0008QG0R001JVJV0K-fractal-bft-protocol-doc-2026-05-19.md`
- `docs/backlog/P0/081KQZVQW0008QG0R000C35RNY-autonomous-backlog-pickup-self-sustaining-new-work-2026-05-07.md`
- `docs/backlog/P1/081KQZVQW0008QG0R001FG05RZ-coincidence-detection-rx-join-dora-mechanism-2026-05-07.md`
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
