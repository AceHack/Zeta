---
id: 081M33WGEMC087G0R0037ZQ9VW
type: bug
state: done
priority: P2
slug: argocd-health-test-ts-evidence-based-terminal-degraded-soak
title: "argocd-health-test.ts: evidence-based terminal Degraded + soak phase for the live-kind-included lane"
created: 2026-09-22T06:23:03.308Z
completed: 2026-09-22T07:52:58.358Z
depends_on: ["081KSXN940008QG0R000SCP2H1"]
composes_with: []
---

# argocd-health-test.ts: evidence-based terminal Degraded + soak phase for the live-kind-included lane

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M33WGEMC087G0R0037ZQ9VW-*.md` glob. -->

Parent **081KSXN940008QG0R000SCP2H1** (Kubernetes + ArgoCD kind/k3d integration health
tests)'s daily `live-kind-included` lane has been red on the daily schedule since
2026-09-19 (runs 35456502519, 35524259964, 35628762464). Run 35628762464 aborted at
~T+10min of a 2400s budget on `asserted Application is Degraded
(kube-prometheus-stack=Synced/Degraded)` while its pods were simply `PodInitializing`.
`confirmedDegradedTerminalFailure`'s two-consecutive-poll rule cannot distinguish an
ordinary first-rollout Degraded blip from a genuinely dead workload.

Two deliverables, both in PR #17480:

- **Evidence-based terminal Degraded**: `podBlockingReason` / `podStillProvisioning` /
  `degradedApplicationTerminalEvidence` / `evidenceBasedDegradedTerminalFailure` in
  `src/Core.TypeScript/cluster/argocd-health-test.ts`, replacing the sample-count rule
  at the `waitForApplications` call site.
- **A soak phase** ("does it crash-loop after the all-Healthy verdict?"): `runSoakPhase`
  (new `--soak-sec` flag), a STARTUP-RESTARTS report (`startupRestartEntries`), and a
  threshold-based classification (`classifyStartupRestarts` /
  `classifyStartupRestartEntry`, per `(app, container)`) against
  `src/Core.TypeScript/cluster/startup-restart-baseline.json`.

Measured fix confirmed live on run 35692573183 (PR #17480, `--soak-sec 300`): the
all-Healthy verdict is now reached without the false-positive abort recurring.

**Revision 2026-09-22, in the same PR**: the STARTUP-RESTARTS gate shipped first as a
both-directions exact-match ratchet (same discipline as
`full-ai-cluster/k8s/tests/ratchet-app-failures.ts`). Measured to flake: run 35695286428
(the SAME tree as 35692573183, one push later) named two DIFFERENT (app, container) pairs
that had not restarted the first time. A 1-2-restart dependency-ordering wait is not a
stable fingerprint, so an exact-match ratchet on it fails most nights on an unrelated PR.
Replaced with a per-container threshold (`STARTUP_RESTART_HARD_FAIL_THRESHOLD = 3`): a
restart count at or above the threshold fails unless the baseline's `maxRestarts` covers
it; below the threshold and uncovered is a warning annotation, never a failure; a baseline
row not measured this run is a notice, flagged `stale` only past
`STARTUP_RESTART_STALE_DAYS` (14) unseen. Baseline reseeded from the union of both runs,
10 (app, container) pairs.

**Separately noted, not yet actioned**: a workflow_dispatch run on this branch
(35695291413) timed out at the 2400s budget with `opensearch-cluster-master-0` in
CrashLoopBackOff (11 restarts) and never reached all-Healthy, while the pull_request-
triggered run on the identical push (35695286428) reached all-Healthy with opensearch
recovering on its own within the wait. Looks like a pre-existing opensearch startup flake
on this lane, independent of this work item's fix (the fix is scoped to Synced/Degraded
Applications; opensearch showed OutOfSync/Progressing during its crash-loop, a different
ArgoCD health class the evidence-based logic does not yet cover). Not minted as a separate
work item yet -- flag for the maintainer/architect to decide whether it warrants one.

**Confirmed green, run 35699803990 (PR #17480, pull_request trigger, ubuntu-24.04,
2026-09-22T07:45:59Z)**: all-Healthy reached, 10 startup-restart entries measured -- 6
covered by the baseline (mimir distributor=4/ingester=3x3/ruler=3, spire-agent=2,
hindsight-api=1, keda-operator=1, all <= their `maxRestarts`), 2 new-and-uncovered
`dapr/dapr-scheduler-server` restarts (count=1, a StatefulSet the earlier two runs never
measured) correctly demoted to `##[warning]` annotations rather than failing the job, and
4 baseline rows not measured this run (argocd/repo-server, dapr/dapr-operator,
dapr/dapr-sentry, spire/spire-controller-manager) correctly read as notices, not stale
(`lastSeen` is today). The soak phase then ran its full 300s with `no restartCount
regression and no Application instability`. Job conclusion: success.
