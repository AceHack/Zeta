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

## Pointers

- `full-ai-cluster/k8s/wp11-ci-envelope.json` -- the sanctioned exclusion mechanism; its arithmetic
  stops at "the three that tipped it" and does not reach the full envelope above.
- `.claude/worktrees` is not durable: the two replica reports are artifacts of run 36831938019.
