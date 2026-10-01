---
id: 081M3VKWF4N087G0R00258SBT4
type: task
state: backlog
priority: P2
slug: wp11-unconverged-apps-cilium-lb-service-essential-tier-prior
title: "WP11 unconverged apps: cilium LB Service, essential-tier priority, guest capacity (run 36832486494)"
created: 2026-10-01T11:34:06.229Z
depends_on: []
composes_with: []
---

# WP11 unconverged apps: cilium LB Service, essential-tier priority, guest capacity (run 36832486494)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3VKWF4N087G0R00258SBT4-*.md` glob. -->

## What was measured (run 36832486494, main 07d5445638, WP11 installed-disk lane)

26/48 Synced+Healthy at t=3221s. Two reference reports exist for the SAME tree at
15bbbc3433 (first-boot-replica run 36831938019, artifacts `first-boot-replica-report` and
`first-boot-replica-constrained-report`):

| lane | substrate | result for forgejo, headlamp, argo-workflows, arc-controller, orleans, headscale, dapr |
|---|---|---|
| first-boot replica, unconstrained | docker, host 4 vCPU / 16 GiB, no cgroup caps | all Healthy |
| first-boot replica, constrained | docker, 4 cpus / 12288m (memory cap binds) | argo-workflows, headlamp, headscale, dapr FAIL: restartCount 1-5, ComparisonError `lookup argocd-repo-server ... connection refused` |
| WP11 installed disk | QEMU 4 vCPU / 12 GiB | forgejo, headlamp, argo-workflows, arc-controller Degraded; headscale, orleans Progressing; dapr undecidable |

So none of those seven has a defect that reproduces when the node is not starved. The WP11
guest's own pressure diagnostics (serial log, `[wp11-pressure]`) show the control plane
failing: k3s NRestarts=14, 10 of 65 roster probes got no API server, etcd `slow fdatasync`
and `apply request took too long 5.4s`, apiserver `Handler timeout` on lease PUTs, cpu PSI
some avg60 73-90, io PSI some avg10 93, kubepods.slice 9.1 GB of 11.9 GB.

## Capacity, computed (rendered-resource-requests.snapshot.json, WP11 envelope = full tree minus gitlab/temporal/game-hosting/gmod)

The committed tree is the `metal` rung and the guest applies it unmodified.

| | CPU | memory | pods |
|---|---|---|---|
| metal-rung requests, WP11 envelope | 9122m | 21822 Mi | 123 |
| dev-rung requests, WP11 envelope | 2702m | 14158 Mi | 123 |
| guest allocatable (4000m / 12288 Mi less reservations, wp11-ci-envelope.json) | 3250m | 9228 Mi | |

At the rung the guest uses, requested CPU is 2.8x and memory 2.4x allocatable. The scheduler
therefore fills the node in sync-wave order and leaves the rest Pending, which Argo reports as
Progressing then (after the 600 s progress deadline) Degraded, and the starved control plane
turns that into restarts. `mimir` alone is 2612m / 6180 Mi / 20 pods at metal; `hindsight`
(1000m / 1792 Mi) can never converge on a fresh cluster (operator-supplied API key).

## Cilium (proven)

`ingressController.enabled: true` renders Service `cilium-ingress` as `type: LoadBalancer`;
with no Cilium LB-IPAM pool it never gets an address and ArgoCD reports the Application
Progressing. k3d run 35924216557 measured it directly ("every workload healthy ... the
`cilium-ingress` LoadBalancer sat at EXTERNAL-IP <pending> for 42 min with `cilium-lb-pool: No
resources found`"). Nothing uses Cilium's Ingress surface. Fixed: ingress controller off in the
Application and in the first-boot HelmChart.

## Live evidence from the guest (WP11 run 36858893664, per-app diagnostics of #17812)

This run carried the cilium fix (#17811) and the staged LB range (#17814). 24/42 Synced+Healthy,
`zeta-root` still OutOfSync, 11 of 61 samples with no API server.

- **cilium**: no longer in the unconverged list. Proven fixed.
- **lbPool note**: PASS -- `cilium-lb-ipam-pool` exists and `zeta-lb-pool` lists 10.0.2.240-10.0.2.250. The
  installer did not refuse the SLIRP range.
- **Pending: Insufficient cpu -- PROVEN** (the scheduler's own PodScheduled message, pods Pending 37-41 min):
  arc-controller, argo-rollouts-dashboard, agent-memory, every dapr pod, headlamp, orleans-silo-0,
  platform-controller and portal. 38 of 79 not-ready pods at t=3162s; 32 of 46 at t=912s. Not defects
  in those apps: each is Healthy in the unconstrained replica.
- **Memory**: opensearch-cluster-master-0 Pending `Insufficient memory` (2048 Mi request).
- **Longhorn validating webhook down** blocked VolumeBinding for headscale-0 and nats-0..2 for minutes
  (transient; pods scheduled later). `longhorn-critical` PriorityClass was absent when its first
  ReplicaSets tried to create pods (`FailedCreate`, transient) -- a custom class referenced by a pod
  before it exists is rejected, which is why the essential tier uses a BUILT-IN class.
- **Real defect, fixed (#17823)**: `platform` OutOfSync forever -- Blueprints arma-reforger, gmod, unturned
  `SyncFailed: .spec.sidecars[0].configMaps: field not declared in schema`. The CRD never learned the
  field #17736 added.
- **Real defect, fixed (#17824)**: `cilium-lb-ipam-pool` Progressing/Degraded because Job
  `gitlab-lan-address` waits 24 h for a `gitlab` Application the envelope excludes. Visible since
  #17814 staged the range; the Job is now ignored for health.
- Node CPU actually used at t=912s: 3653m of 3250m allocatable (112%); argocd-application-controller 666m,
  repo-server 582m.

Essential tier (#17815) decides who wins under pressure but cannot create capacity: the Pending apps
above are priority-0 peers of the priority-0 hogs that arrived first (mimir 20 pods, hindsight, seaweedfs).

## What would make the guest converge (NOT done; an owner decision)

Requested CPU of the WP11 envelope is 2.8x allocatable at the metal rung the guest runs. With the DEV
rung (2702m / 14158 Mi) CPU fits; subtracting mimir (437m / 3328 Mi), opensearch (250m / 1024 Mi) and
hindsight (75m / 896 Mi) gives 1940m / 8910 Mi against 3250m / ~8897 Mi allocatable. A guest-side dev
rung needs the lane-tree staging (as the first-boot replica does) served to the guest over the SLIRP
gateway 10.0.2.2. Excluding mimir/opensearch/hindsight in `wp11-ci-envelope.json` is refused by
`wp11-ci-envelope.test.ts` unless the dev/kind lanes exclude them too (that test enforces it).

A second dispatch (36870188468) failed before any verdict: `boot medium mounted from the WHOLE disk
(/dev/sda)` after the install phase, while run 36858893664 on the same install path passed. It
carried the three fixes of #17815/#17823/#17824, so they are verified offline only.

## Pointers

- `full-ai-cluster/k8s/wp11-ci-envelope.json` -- the sanctioned exclusion mechanism; its arithmetic
  stops at "the three that tipped it" and does not reach the full envelope above.
- The two replica reports are the `first-boot-replica-report` and `first-boot-replica-constrained-report` artifacts of run 36831938019 (CI artifacts expire; the numbers above are copied from them).
