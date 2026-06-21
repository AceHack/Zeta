---
pr_number: 4965
title: "backlog(081KSE6WT0008QG0R003C9KGQE): Reticulum throughout \u2014 cluster nodes + edge devices on one mesh"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T17:44:56Z"
merged_at: "2026-05-25T17:47:00Z"
closed_at: "2026-05-25T17:47:00Z"
head_ref: "backlog/b0726-reticulum-throughout-cluster-and-edge-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4965: backlog(081KSE6WT0008QG0R003C9KGQE): Reticulum throughout — cluster nodes + edge devices on one mesh

## PR description

Files Aaron's *'i'm thinking it will require reticiulum at the edge and in cluster'* — Reticulum runs in the cluster as a composing substrate alongside K8s, not partitioned by network tier. Cluster nodes speak Reticulum natively; workloads addressable via both Cilium (intra-cluster) and Reticulum (cross-substrate identity-routing).

Composes with 081KR2E4K0008QG0R001SWEPNV Green Lantern (already-in-progress edge substrate); PR #4930 hat-system (Reticulum identities can be hat-bound with succession semantics); SPIRE (identity-issuer pattern); m-acc / multi-oracle / NCI / 5-always-active-disciplines.

Includes 4-tier-federation cross-ref to 081KSE6WT0008QG0R0006HKTXJ. 6 open design-pass questions. P2 because needs design pass; becomes P1 when first edge-device-needs-cluster-mesh-reachability deployment surfaces.

Single file (+ index regen) — research-grade architecture, no implementation in this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
