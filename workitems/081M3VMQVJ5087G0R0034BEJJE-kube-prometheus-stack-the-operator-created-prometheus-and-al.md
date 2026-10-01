---
id: 081M3VMQVJ5087G0R0034BEJJE
type: bug
state: backlog
priority: P2
slug: kube-prometheus-stack-the-operator-created-prometheus-and-al
title: "kube-prometheus-stack: the operator-created Prometheus and Alertmanager pods are liveness-killed under CPU contention"
created: 2026-10-01T11:49:03.685Z
depends_on: []
composes_with: []
---

# kube-prometheus-stack: the operator-created Prometheus and Alertmanager pods are liveness-killed under CPU contention

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3VMQVJ5087G0R0034BEJJE-*.md` glob. -->

## Evidence

Constrained first-boot replica, run 36831938019 (main@15bbbc3433, 4 vCPU / 12 GiB, dev rung):
`prometheus-kube-prometheus-stack-prometheus-0` and `alertmanager-kube-prometheus-stack-alertmanager-0`
each `Restart Count: 6`, `Last State: Terminated / Completed / Exit Code: 0` (both exit 0 on SIGTERM, so a
liveness kill reads as a clean stop), beside `Unhealthy ... Liveness probe failed ... context deadline
exceeded` events. Operator-generated probes: Prometheus `timeout=3s period=5s #failure=6` (28s stall
tolerance), Alertmanager `timeout=3s period=10s #failure=10` (93s).

`liveness-kill-budget.ts` cannot see either pod: `helm template` renders the `Prometheus` and
`Alertmanager` custom resources, not the StatefulSets the operator builds from them.

## Fix

`prometheus.prometheusSpec.containers` / `alertmanager.alertmanagerSpec.containers` carry a strategic-merge
patch on the operator-generated container (same extension point the operator documents; v0.93.1
`MergePatchContainers`): timeout 5s, period 10s, failureThreshold 12 -> 115s. Pinned by
`src/Core.TypeScript/cluster/kps-operator-pod-liveness.test.ts` (4 of 7 cases red without the patch,
including a misnamed-container case, because a name that matches nothing APPENDS a second container).

## Not claimed

That these restarts were the reason `kube-prometheus-stack` read `Degraded` in the WP11 installed-disk
run 36832486494 -- there the guest is over-committed at the metal rung (9122m / 21822Mi of requests
against ~3250m / 9228Mi allocatable) and the pods may never have been scheduled. This removes one
measured, independent source of restart churn; it does not claim to be that run's cause.
