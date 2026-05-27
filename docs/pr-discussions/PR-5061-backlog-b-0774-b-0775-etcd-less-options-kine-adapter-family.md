---
pr_number: 5061
title: "backlog(B-0774 + B-0775): etcd-less options (kine adapter family) + HA-k8s-that-scales-beyond-etcd (CockroachDB / NATS super-cluster / Karmada / cell-based)"
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

# PR #5061: backlog(B-0774 + B-0775): etcd-less options (kine adapter family) + HA-k8s-that-scales-beyond-etcd (CockroachDB / NATS super-cluster / Karmada / cell-based)

## PR description

Two related questions from Aaron mid-iter-3-wait, bundled into one PR (both backlog rows; no code):

**B-0774** ('are there etcdless'): kine is the load-bearing standard interface; operator chooses backend (Dqlite via microk8s; SQLite / Postgres / MySQL / NATS via k3s+kine; Zeta-native DBSP+Raft via B-0766 wave 4). NATS JetStream backend particularly composes with B-0772 Rx fabric + B-0289 Reticulum + B-0773 digital twin.

**B-0775** ('ha installs of kubernets that scales better'): scale ceiling depends on ARCHITECTURE not just BACKEND. Per-tier recommendation table covering 1-5 / 5-50 / 50-500 / 500-5000 / 5000+ / multi-region / edge / multi-tenant. Options include kine+CockroachDB, NATS super-cluster, Karmada (CNCF graduated), KubeStellar, vCluster, Cluster API, cell-based custom, Zeta-native cell-based (B-0766 wave 4+ endgame).

Both sharpen B-0756 HA control-plane. Compose with B-0289 / B-0763 / B-0764 / B-0765 / B-0772 / B-0773.

## General comments

### @chatgpt-codex-connector (2026-05-26T01:09:13Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
