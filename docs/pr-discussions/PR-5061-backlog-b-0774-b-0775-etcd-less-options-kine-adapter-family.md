---
pr_number: 5061
title: "backlog(081KSE6WT0008QG0R001AZQA5Z + 081KSE6WT0008QG0R000QXSG91): etcd-less options (kine adapter family) + HA-k8s-that-scales-beyond-etcd (CockroachDB / NATS super-cluster / Karmada / cell-based)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T01:09:09Z"
merged_at: "2026-05-26T01:10:26Z"
closed_at: "2026-05-26T01:10:26Z"
head_ref: "otto-cli/b0774-b0775-etcdless-and-scale-options-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:37Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5061: backlog(081KSE6WT0008QG0R001AZQA5Z + 081KSE6WT0008QG0R000QXSG91): etcd-less options (kine adapter family) + HA-k8s-that-scales-beyond-etcd (CockroachDB / NATS super-cluster / Karmada / cell-based)

## PR description

Two related questions from Aaron mid-iter-3-wait, bundled into one PR (both backlog rows; no code):

**081KSE6WT0008QG0R001AZQA5Z** ('are there etcdless'): kine is the load-bearing standard interface; operator chooses backend (Dqlite via microk8s; SQLite / Postgres / MySQL / NATS via k3s+kine; Zeta-native DBSP+Raft via 081KSE6WT0008QG0R00049EFBD wave 4). NATS JetStream backend particularly composes with 081KSE6WT0008QG0R003WMG4XV Rx fabric + 081KR2E4K0008QG0R001SWEPNV Reticulum + 081KSE6WT0008QG0R0008483B2 digital twin.

**081KSE6WT0008QG0R000QXSG91** ('ha installs of kubernets that scales better'): scale ceiling depends on ARCHITECTURE not just BACKEND. Per-tier recommendation table covering 1-5 / 5-50 / 50-500 / 500-5000 / 5000+ / multi-region / edge / multi-tenant. Options include kine+CockroachDB, NATS super-cluster, Karmada (CNCF graduated), KubeStellar, vCluster, Cluster API, cell-based custom, Zeta-native cell-based (081KSE6WT0008QG0R00049EFBD wave 4+ endgame).

Both sharpen 081KSE6WT0008QG0R001NG9JZH HA control-plane. Compose with 081KR2E4K0008QG0R001SWEPNV / 081KSE6WT0008QG0R000WVYAJ2 / 081KSE6WT0008QG0R0009YYNP4 / 081KSE6WT0008QG0R00063R6HB / 081KSE6WT0008QG0R003WMG4XV / 081KSE6WT0008QG0R0008483B2.

## General comments

### @chatgpt-codex-connector (2026-05-26T01:09:13Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
