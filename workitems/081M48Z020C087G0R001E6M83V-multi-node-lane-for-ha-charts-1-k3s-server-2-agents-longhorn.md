---
id: 081M48Z020C087G0R001E6M83V
type: task
state: backlog
priority: P1
slug: multi-node-lane-for-ha-charts-1-k3s-server-2-agents-longhorn
title: "Multi-node lane for HA charts: 1 k3s server + 2 agents, Longhorn 3-replica + postgres-shared CNPG failover on agent hard-kill"
created: 2026-10-06T15:58:25.804Z
depends_on: []
composes_with: []
---

# Multi-node lane for HA charts: 1 k3s server + 2 agents, Longhorn 3-replica + postgres-shared CNPG failover on agent hard-kill

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M48Z020C087G0R001E6M83V-*.md` glob. -->

## Why

Aaron approved "add the multi-node lane for the HA charts". The 3-server HA test
(`k3s-ha-longhorn-cluster.nix`, job `cluster-ha`) has never passed on a hosted
4-vCPU runner (runs 35920509908, 35926193063, 35930213010: etcd fsync, then CPU
starvation / leader-election loss). It stays as-is for the control-plane claim.

## What

- `full-ai-cluster/nixos/tests/k3s-multinode-ha-agents.nix` — 1 server + 2 agents;
  Longhorn + CNPG operator + postgres-shared Cluster DERIVED from the shipped files;
  hard-kill the agent holding the Postgres primary and a Longhorn replica.
- `full-ai-cluster/nixos/tests/multinode-ha-coverage.json` + `src/Core.TypeScript/cluster/multinode-ha-lane-coverage.test.ts`
  — every HA chart (extractor UNION ledger) is covered, not-covered with a reason, or a named stale entry.
- Workflow job `cluster-multinode`, input `only_cluster_multinode`, dispatch-only until green.

## Acceptance

One green `cluster-multinode` run, with host RAM/load and phase timings recorded.
