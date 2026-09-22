---
id: 081M34QTS06087G0R0015D7X5W
type: bug
state: backlog
priority: P2
slug: opensearch-cluster-master-0-crash-loops-after-first-boot-rep
title: "opensearch-cluster-master-0 crash-loops after first-boot-replica power-cycle (stage 8)"
created: 2026-09-22T14:20:33.158Z
depends_on: []
composes_with: []
---

# opensearch-cluster-master-0 crash-loops after first-boot-replica power-cycle (stage 8)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M34QTS06087G0R0015D7X5W-*.md` glob. -->

## What was found

WP19 added an optional stage 8 to `first-boot-replica.ts` (`--power-cycle`): after the
roster converges, hard-kill the container (`docker kill -s KILL`), restart it with its
data volume intact, and verify recovery. The FIRST two CI runs to exercise it — both on
PR #17529, `claude/first-boot-replica-power-cycle` — independently reproduced the SAME
single finding:

- Run 35725812453 (auto `pull_request` trigger): `NOT_RECOVERED` — `CONTAINER_CRASHLOOP`
  on `opensearch/opensearch-cluster-master-0[opensearch]`, restartCount rose to **11**
  during the 300s post-recovery soak.
- Run 35725819076 (`workflow_dispatch`, same commit): same finding, restartCount rose to
  **18**.

Every other rule (app-health recovery, seeded-Secret data hash, PVC rebinding) passed in
both runs — opensearch's `helm-install` Job had already succeeded pre-cut and the pod was
Healthy/Running at the stage 8 baseline in both cases, so this is a genuine POST-restart
regression, not a pre-existing convergence failure surfacing as a false positive.

## Why this is plausible, and what is NOT yet known

OpenSearch/Elasticsearch-family stores are commonly sensitive to an UNCLEAN stop:
translog replay on the data path, a stale `node.lock`, or single-node cluster-formation
timing can all produce a boot loop after a hard kill that a graceful `SIGTERM` stop would
not. This replica's `opensearch` uses `local-path-provisioner` storage (no real disk,
`.claude` divergence `no-longhorn-disks`), which is itself a possible contributor —
worth checking whether the underlying hostPath survives the container-level `docker kill`
identically to how a real block device would survive a host power cut.

NOT yet captured: the crashing container's own logs. `collectFailureDiagnostics` in
`first-boot-replica.ts` only fires when an exception is thrown during stages 1-7; stage 8
returns a verdict rather than throwing, so nothing pulled `kubectl logs
opensearch-cluster-master-0 -c opensearch --previous` before the container was torn down.

## Suggested next step

Add `kubectl logs --previous` (or an events/describe dump) for every container stage 8's
`CONTAINER_CRASHLOOP` rule flags, gated behind the same `NOT_RECOVERED` path — mirroring
what `collectFailureDiagnostics` already does for stages 1-7 — so the NEXT occurrence
carries the actual crash reason instead of only a restartCount delta. Once that lands,
re-run and read the log to decide: chart config fix (heap/resource sizing,
`bootstrap.memory_lock`), storage-class change, or confirm-and-allowlist as a replica-only
artifact (same shape as `isKnownSoakRegression`'s spire-agent entry) if metal doesn't
reproduce it.

## Evidence

- PR: https://github.com/Lucent-Financial-Group/Zeta/pull/17529
- Run 1: https://github.com/Lucent-Financial-Group/Zeta/actions/runs/35725812453
- Run 2: https://github.com/Lucent-Financial-Group/Zeta/actions/runs/35725819076
