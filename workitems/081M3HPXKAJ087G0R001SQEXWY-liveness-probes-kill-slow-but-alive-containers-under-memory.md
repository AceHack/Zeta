---
id: 081M3HPXKAJ087G0R001SQEXWY
type: bug
state: backlog
priority: P2
slug: liveness-probes-kill-slow-but-alive-containers-under-memory
title: "Liveness probes kill slow-but-alive containers under memory pressure: floor first (coredns, metrics-server), then re-derive app budgets"
created: 2026-09-27T15:14:44.690Z
depends_on: []
composes_with: []
---

# Liveness probes kill slow-but-alive containers under memory pressure: floor first (coredns, metrics-server), then re-derive app budgets

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3HPXKAJ087G0R001SQEXWY-*.md` glob. -->

## The measurement

Constrained replica lane, dispatch 36119931377 (job 108022790117): 61 kubelet
`failed liveness probe, will be restarted` events over 28 containers, six exits
137, zero OOMKilled, zero Evicted. Of the 122 `Liveness probe failed` lines in the
job log, 89 are the client-timeout shape (`context deadline exceeded` /
`Client.Timeout exceeded`) and 22 are `connection refused` -- the dominant killer
is a probe `timeoutSeconds` (Kubernetes default 1s) that a slow-but-alive process
cannot meet, which the startup-budget audit could not see.

## Done in the first PR

- **Floor:** k3s's own CoreDNS and metrics-server Deployment vendored into the
  first-boot roster (`k8s/bootstrap/k3s-coredns.yaml`, `k3s-metrics-server.yaml`)
  behind `.skip` markers, liveness `timeoutSeconds 1 -> 5`, `failureThreshold 3 -> 5`
  (upstream Kubernetes' CoreDNS values). QoS (Burstable with requests) and priority
  (`system-cluster-critical` / `system-node-critical`) were already right in k3s's
  copy and are kept. Node reservations and `eviction-hard` were already set by #17666.
- **Instrument:** `liveness-kill-budget.ts` gained the steady-state axis
  (`timeout`, `stall tolerance = (failureThreshold-1)*period + timeout`).
- **One app:** cockroachdb `db` -- the tightest stall tolerance in the catalog
  (11s), all three members killed x7-x8 each, all timeout-shaped -- widened via the
  chart's `statefulset.customLivenessProbe` to 125s.

## Remaining (re-measure the constrained lane FIRST)

The RESUME's plan is floor first, then re-measure, then the rest: an unknown share
of the other kills are downstream of DNS/metrics restarts. Census at the time of
the first PR (`liveness-kill-budget.ts --report`, stall tolerance column) for the
containers killed on 36119931377, still at the 1s default timeout:

| app / container | stall tolerance |
|---|---|
| argocd repo-server, server (owned by the roster-convergence work) | 21s |
| cert-manager webhook | 21s |
| cilium hubble-ui frontend | 21s |
| cilium-operator | 23s (timeout 3s) |
| cloudnativepg manager | 21s |
| dapr operator / placement / scheduler / sentry | 41s |
| headlamp | 21s |
| kube-prometheus-stack operator, node-exporter | 21s |
| loki canary | 21s |
| open-policy-agent manager (x2) | 21s |
| sealed-secrets controller | 21s |
| spire-controller-manager (chart hardcodes it; no coordinate) | 21s |

Killed despite already-generous tolerance, so NOT a probe-width problem on the
evidence: kube-prometheus-stack grafana (120s), spire-agent (121s; a known
replica-only DNS artifact), spire-server (63s). Not in the render census
(operator-created): prometheus.

Acceptance: a constrained-lane run on a commit carrying the floor fix, compared
against its unconstrained twin on the same commit, with the kill list re-derived.
