---
id: 081M3TS67PE087G0R002ZZ1XYT
type: bug
state: backlog
priority: P1
slug: platform-controllers-die-under-node-contention-1s-liveness-t
title: "platform controllers die under node contention: 1s liveness timeouts and BestEffort QoS on sealed-secrets, headlamp, gatekeeper, NFD, cert-manager, spire, argocd, headscale"
created: 2026-10-01T03:47:34.734Z
depends_on: []
composes_with: []
---

# platform controllers die under node contention: 1s liveness timeouts and BestEffort QoS on sealed-secrets, headlamp, gatekeeper, NFD, cert-manager, spire, argocd, headscale

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3TS67PE087G0R002ZZ1XYT-*.md` glob. -->

## Evidence (measured, not inferred)

Scheduled first-boot replica on `main`, 2026-09-30, run 36685251210, constrained lane
(4 vCPU / 12 GiB, 38 Applications): **17 Healthy, 2 DIVERGENCE, 19 FAIL**. Platform
controllers in CrashLoopBackOff or restarting: sealed-secrets, headlamp, trust-manager,
spire-server, cert-manager-webhook (CRASHLOOP) plus cert-manager controller/cainjector,
argocd repo-server (restartCount 3) / server (1), headscale-0, NFD gc/master/worker. The
unconstrained lane on 2026-09-29 (run 36538162478) had all of these Healthy: the same tree
dies when the node is contended, and the mechanism is the one already measured on
dispatch 36119931377 -- liveness probes kill containers that are slow, not dead.

Rendered chart defaults: `timeoutSeconds: 1`, `failureThreshold: 3` -> a RUNNING container is
killed after (3-1)*10+1 = 21s of slow answers (`probeStallToleranceSeconds`).

## What lands

Probes widened through each chart's own values coordinates (timeout 5s x 12 failures at a
10s period: kill budget 120s, stall tolerance 115s): sealed-secrets, headlamp, NFD
(gc/worker/master), cert-manager controller + webhook (+ the k3s bootstrap twin), argocd
server + repo-server (both pin sites), spire-server (+ bootstrap twin), headscale
(in-repo manifest), gatekeeper (timeout only -- the chart hardcodes period/threshold).

Falsifier: `liveness-kill-budget.ts` now GATES a `STALL_TOLERANCE_FLOORS` list -- red against
the pre-fix tree with exactly 13 violations (every container above), green after.

## Not fixed here, and why

- `cilium-operator`, `spire-controller-manager`, spiffe CSI registrar, hubble-ui: probe is
  hardcoded in the chart template, no values coordinate (upstream change only).
- `trust-manager`, external-secrets: no liveness probe at all; their CrashLoop is process exit
  (leader election / API timeouts under load), not a probe kill. UNVERIFIED cause.
- Resource requests (BestEffort QoS) on cert-manager, trust-manager, sealed-secrets,
  external-secrets, dapr, spire, longhorn-manager, argo-rollouts, argo-workflows, headlamp --
  `missing-resource-requests.ts` lists them ACTIONABLE. Each needs a `resourceClaims` row in
  `storage-profiles.json`, a regenerated snapshot and a budget re-fit, so it is its own change.

## Second change: BestEffort QoS (this PR)

`missing-resource-requests.ts` listed 18 ACTIONABLE Applications. Nine platform controllers
are priced here, with requests (no limits -- the ArgoCD WP32 precedent): cert-manager (3),
trust-manager, sealed-secrets, external-secrets (3), argo-rollouts (2), argo-workflows (2),
headlamp, dapr (5 workloads, scheduler is 3 pods even with ha disabled), spire (5 containers).
Numbers are ESTIMATES sized to leave BestEffort, not usage readings -- said in each row.

Cost, stated: dev lane CPU 1990m -> 2385m (still inside 2500m: a 15m dev floor, because the
catalogue's usual 25m would have been 625m and tipped it), dev memory 9868Mi -> 11268Mi (the
already-acknowledged shortfall re-keyed `dev memory 11268>9216`), metal all-50 13215m/27659Mi ->
14015m/29635Mi against the smallest node's 16000m/62942Mi. Metal CPU is deliberately small
(25m for idle controllers, 50-100m for the hot ones: +800m total) because of the next finding.

### The request nobody counted: Longhorn's instance-manager pod

Longhorn creates one instance-manager pod per node AT RUNTIME, requesting
`guaranteedInstanceManagerCPU` percent of the node's total allocatable CPU (chart 1.12.1
values/README: default `{"v1":"12","v2":"12"}`). No manifest renders it, so no ledger row
has ever counted it. On the smallest registered node (16000m, 15250m allocatable after the
750m kube+system reservation in k3s-server.nix) 12% is 1830m: the metal roster before this
change (13215m) plus that pod was already 15045m of 15250m -- 98.7% -- and pricing the
controllers at their first-draft 1000m would have made the last pods to schedule go Pending
forever. Set to 5% (762m) through the chart's own key: roster 14015m + 762m = 14777m, 473m
spare. STILL TIGHT: metal CPU requests are ~97% of a 16-core node before the kubelet's own
overhead, so any further pricing on metal needs this arithmetic redone. Guarded by
`platform-controllers-requests.test.ts` (roster + instance manager <= allocatable).

Falsifier: `platform-controllers-requests.test.ts` reads the checked-in snapshot and fails on
any non-hook workload of these nine that requests nothing -- red against the pre-change
snapshot (13 workloads), green after.

Still BestEffort in this group, not priced: longhorn-manager, cilium (agent/envoy/operator/hubble,
pod is Burstable only through an init container), openbao unseal sidecar (pod Burstable via
the main container), keda/NFD already priced.

Not touched: gitlab's snapshot row is main's own (14 workloads / 2445m now render against a
declared 2375m) -- left for its owner to re-measure; the snapshot here keeps main's gitlab entry.
