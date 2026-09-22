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

## Root cause (WP19c, 081M34QTS06087G0R0015D7X5W)

The suggested `kubectl logs --previous` capture landed (`collectCrashLoopDiagnostics` in
`first-boot-replica.ts`) and run 35744676325 (PR #17534) caught the crashing container's own
log on its first try:

```
Password 50032e0a391aa2ba552cb1720559dcfa64885acb95d1edce6a6e96f0340ec431 failed validation:
"Password does not match validation regex". Please re-try with a minimum 8 character password
and must contain at least one uppercase letter, one lowercase letter, one digit, and one
special character that is strong.
```

`opensearch-cluster-master-0`'s admin password is minted by
`full-ai-cluster/k8s/bootstrap/internal-secret-seeding.yaml`'s `seed-opensearch-admin` Job:

```
head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > /work/admin-password
```

`od -An -tx1` hex-encodes — its output alphabet is exactly `0-9a-f`, so the drawn password
can **never** contain an uppercase letter or a non-alphanumeric character. OpenSearch
Security's `install_demo_configuration.sh` (`org.opensearch.security.tools.democonfig.Installer`)
validates the admin password against
`(?=.*[A-Z])(?=.*[^a-zA-Z\d])(?=.*[0-9])(?=.*[a-z]).{8,}` before it lets `opensearch` start
(docs.opensearch.org/latest/security/configuration/demo-configuration/; this demo-installer
check is separate from the runtime `plugins.security.restapi.password_validation_regex`
setting — opensearch-project/security#4081). So validation fails **deterministically, on
every boot** — first boot included, not only after the power cycle. `describe pod` on the
same run shows the container already crash-looping (6 restarts) well before stage 8's hard
kill; WP19's power-cycle soak window is simply the first check in this harness sensitive
enough to catch it, since it compares the SOAK-window restart delta rather than relying on
Argo Application health (which this StatefulSet apparently reports loosely).

Ruled out by this evidence: stale `node.lock`, translog/cluster-state corruption, JVM heap
OOM, and the stage-6/WP18 liveness-kill-budget probes (the chart ships NO liveness probe by
default — only `startupProbe`/`readinessProbe` — so the restarts are the OpenSearch process
itself exiting, not a probe killing it).

**Fix:** `seed-opensearch-admin`'s `draw-entropy` script now draws two extra CSPRNG bytes,
hex-maps each through a 16-symbol `tr` table into a guaranteed uppercase letter and a
guaranteed special character (bijective, no entropy lost), and prepends them to the same
248-bit hex body every other credential here uses — so the minted password satisfies
OpenSearch's strength regex by construction on every draw, not by chance. Verified locally:
1000s of real `/dev/urandom` draws through the exact shell pipeline, each checked against the
literal regex in Python — 100% pass. `internal-secret-seeding.test.ts` (66 tests) and
`first-boot-replica.test.ts` (105 tests) pass unchanged.

Evidence: PR https://github.com/Lucent-Financial-Group/Zeta/pull/17534, run
https://github.com/Lucent-Financial-Group/Zeta/actions/runs/35744676325.
