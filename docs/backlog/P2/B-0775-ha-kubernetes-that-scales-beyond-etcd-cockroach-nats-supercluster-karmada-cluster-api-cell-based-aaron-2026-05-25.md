---
id: B-0775
priority: P2
status: open
title: HA Kubernetes that scales beyond etcd — CockroachDB / NATS super-cluster / Karmada / KubeStellar / Cluster API / cell-based architecture
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0756
  - B-0774
composes_with:
  - B-0289
  - B-0757
  - B-0758
  - B-0763
  - B-0764
  - B-0765
  - B-0766
  - B-0767
  - B-0772
  - B-0773
tags: [cluster, k8s, ha, scale, federation, karmada, cockroachdb, nats, cluster-api, cell-based, multi-cluster]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, sharpening B-0774
(etcd-less options): *"ha installs of kubernets that scales
better"*. Scale dimension is broader than just etcd backend
choice. Etcd has known scale ceilings (~5K nodes per cluster
typical; ~8 GB state limit; write throughput limited by Raft
consensus). Beyond that, the substrate pattern changes from
"single cluster + bigger backend" to "many clusters + federation
layer."

B-0774 covered etcd-less BACKEND options (kine adapter family).
This row covers SCALE-BEYOND-ETCD ARCHITECTURE options that
go beyond changing the backend — federation, cell-based,
multi-cluster orchestration.

## Real options that scale beyond etcd's single-cluster ceiling

| Approach | Pattern | Scale ceiling | Mature today |
|---|---|---|---|
| **kine + CockroachDB** (B-0774) | Single cluster; etcd replaced with horizontally-scalable distributed SQL | Hundreds of nodes per cluster; multi-region replication via CockroachDB Serverless / Aurora-Limitless | Yes |
| **kine + NATS JetStream + super-cluster** (B-0774) | Single cluster's control-plane events; NATS leaf-nodes + super-cluster federates control plane geographically | Federated globally; control plane events flow over mesh | Yes; NATS super-cluster production |
| **Karmada** (CNCF graduated) | Multi-cluster federation with policy-based scheduling | 1000s of nodes across N member clusters; tested at Huawei + Vipshop production | Yes; CNCF graduated 2024 |
| **KubeStellar** | Multi-cluster + edge-aware federation; "workload transport" via OCM | Edge-scale (many small clusters; thousands) | Yes; production; CNCF sandbox |
| **vCluster** (Loft Labs) | Virtual k8s clusters running INSIDE a host cluster | Per-tenant scale; host cluster scale x tenants | Yes; production; OSS + commercial |
| **Cluster API** (CAPI; CNCF Cluster Lifecycle) | Declarative cluster lifecycle as k8s CRDs; orchestrates many clusters from one management cluster | Cell-based: many clusters of clusters | Yes; production; widely deployed |
| **OpenStack Magnum + Cluster API** | Cluster API on OpenStack substrate | Cell-based + IaaS | Yes (enterprise) |
| **Liqo** | Peer-to-peer cluster sharing; resource borrowing | Cooperative federation | Yes; less mature |
| **Cell-based custom** (Borg / Tupperware shape) | Many smaller clusters with orchestration layer above; operator pattern | Hyperscale (Google / Meta scale) | Custom; well-documented patterns |
| **Zeta-native** (B-0766 wave 4 + cell-based) | DBSP + Raft consensus per cell; Zeta scheduler federates cells | Designed for cell-based scale from day 1 | Future endgame |

## Per-option fit for Zeta substrate

### Tier 1 (best Zeta-substrate fit)

**kine + NATS JetStream + super-cluster**
(extends B-0774 NATS recommendation):

- NATS subjects ARE Observable-shaped (per B-0772 Rx fabric)
- NATS super-cluster federates globally with leaf-nodes
- Reticulum bridge (per B-0289) for radio-fallback control plane
- Twin events (per B-0773) flow over same NATS substrate
- Composes naturally with B-0772 + B-0773 + B-0289

Scale: hundreds-of-thousands of nodes federated globally via
NATS super-cluster mesh. Control plane substrate IS the twin
event store.

**Karmada** (CNCF graduated):

- Standard interface (CNCF graduated — per B-0765 ServiceTitan
  route)
- Multi-cluster API operators already know
- Production-tested at scale (Huawei / Vipshop)
- Operator workloads target Karmada CRDs (PropagationPolicy,
  OverridePolicy, ResourceBinding); Karmada handles
  cross-cluster distribution
- Composes with B-0758 unRAID-style edge clusters (each edge
  site = one member cluster)

Scale: thousands of nodes across N member clusters; Karmada
operator chooses cluster topology (one big + many small; many
medium; etc.).

### Tier 2 (specific use cases)

**Cluster API (CAPI)**:

- Pattern for managing many clusters as k8s objects from a
  management cluster
- Each cell-based deployment instantiates clusters via CAPI;
  Zeta cluster substrate becomes the per-cluster bootstrap
  Cluster API targets
- Composes with B-0773 digital twin: each cluster IS a twin;
  Cluster API manages many twins

**vCluster**:

- Per-tenant virtual k8s; host cluster runs N tenant clusters
- Useful for SaaS-style Zeta deployment where each customer
  gets isolated cluster substrate on shared infra
- Composes with B-0769 VC-meta-playbook substrate-honest
  variant (multi-tenant control structure injection while
  preserving operator-keeps-the-value)

**KubeStellar**:

- Edge-aware federation
- Composes with B-0758 unRAID-style edge nodes
- Workload-transport pattern via OCM (Open Cluster Management)

### Tier 3 (custom / future)

**Cell-based custom + Zeta-native** (B-0766 wave 4):

- Hyperscale operators (Google Borg, Meta Tupperware, Twitter
  Aurora) all use cell-based patterns
- Many smaller clusters; orchestration layer above
- Zeta-native control plane (B-0766 wave 4) designed for
  cell-based scale from day 1 via DBSP retraction-native
  semantics + cell-aware scheduler (B-0767)
- Endgame; substantial implementation effort; future row

## Target

Document + ship **per-scale-tier recommendation**:

| Cluster scale | Recommended approach | Substrate rows |
|---|---|---|
| **1-5 nodes** (lab, home, small business) | Single cluster; k3s embedded etcd OR kine + SQLite | B-0754, B-0756 |
| **5-50 nodes** (small production, edge site) | Single cluster; k3s + kine + NATS JetStream | B-0774 |
| **50-500 nodes** (medium production) | Single cluster; k3s + kine + CockroachDB | B-0774 |
| **500-5000 nodes** (large production) | NATS super-cluster (federate control plane geographically) OR Karmada multi-cluster | This row Tier 1 |
| **5000+ nodes** (hyperscale) | Cell-based + Karmada; many smaller clusters + federation | This row Tier 1 + custom |
| **Multi-region / multi-cloud** | Karmada + per-region clusters; OR NATS super-cluster with leaf-nodes per region | This row Tier 1 |
| **Edge** (many tiny clusters) | KubeStellar OR Karmada + B-0758 unRAID-style edge nodes | This row Tier 2 + B-0758 |
| **Multi-tenant SaaS** | vCluster on host cluster + tenant-per-vCluster | This row Tier 2 + B-0769 |

## Acceptance

- [ ] Document the scale tiers in
      `docs/cluster-scale-architecture.md` — per-tier
      recommendation + substrate rows; per-operator-profile
      guidance per B-0759 first-time-CLI-user persona
- [ ] First federation-mode implementation: NATS super-cluster
      configuration as a `modules/control-plane-federation-nats.nix`
      module; operator opts in via single config flag
- [ ] Karmada integration: NixOS module that deploys Karmada
      as the federation layer; tested with 2 member clusters
      minimum
- [ ] Per-tier migration paths: operator can migrate UP the
      tier hierarchy as cluster grows (5 → 50 → 500 → ...)
      without manifest changes (per B-0763 vendor-swap pattern)
- [ ] Zeta-first-boot (B-0754) role keystroke extended for
      federation member: 'm' for "member of existing cluster
      via Karmada" (joining a federated cluster instead of
      bootstrapping new)
- [ ] Auto-discovery (B-0757) extended to multi-cluster:
      mDNS query for Karmada control plane on local network;
      Reticulum bridge for federated control plane across
      sites
- [ ] Reference deployments per tier: 5-node, 50-node,
      500-node sample configs; published as ARC-AGI benchmark
      scenarios per B-0761
- [ ] Cost-comparison surface per tier: per-tier infra cost
      estimate (CockroachDB vs NATS vs Karmada vs custom
      cell-based); operator-facing tool per B-0763 vendor-swap

## Composes with

- B-0289 — Reticulum mesh (federation transport beyond
  internet; radio-fallback)
- B-0756 — HA control-plane (this row sharpens to scale
  dimension; B-0774 sharpens to backend dimension; together
  cover the HA design space)
- B-0757 — cluster auto-discovery (multi-cluster discovery
  via mDNS / Reticulum / Karmada)
- B-0758 — USB-persistent OS unRAID-style (edge nodes
  composing into federation per Tier 2 KubeStellar /
  Karmada)
- B-0763 — cloud-native plugins fit Zeta interfaces
  (Karmada / CockroachDB / NATS are existing standards Zeta
  plugs into)
- B-0764 — CNCF force multipliers (Karmada is CNCF
  graduated; KubeStellar CNCF sandbox; Cluster API CNCF
  Cluster Lifecycle; all adopted)
- B-0765 — ServiceTitan route (each Tier 1+ option is the
  existing standards interface Zeta plugs into)
- B-0766 — slow-replace k8s (Zeta-native cell-based control
  plane is wave 4+ territory)
- B-0767 — Zeta-native scheduler (federation-aware
  scheduling composes; multi-cluster placement decisions)
- B-0769 — VC meta-playbook (multi-tenant scale via vCluster
  is one substrate-honest expansion path)
- B-0772 — observable+controllable cluster fabric (multi-
  cluster fabric: every cluster's observables federated via
  NATS super-cluster / Karmada APIs)
- B-0773 — cluster as digital twin (cluster-of-twins:
  Karmada manages many twins; CAPI manages twin lifecycles)
- B-0774 — etcd-less options (this row builds on B-0774's
  backend choices + extends to multi-cluster architecture)

## Substrate-honest scale framing

The substrate-honest claim: **scale ceiling depends on
ARCHITECTURE choice, not just on BACKEND choice**. B-0774
named backend options that scale better than etcd at single-
cluster scope; this row names ARCHITECTURE options that scale
beyond single-cluster scope entirely.

Operator's actual decision tree:

1. **What's my scale goal?** (1-5 / 5-50 / 50-500 / 500-5000 /
   5000+ / multi-region / edge / multi-tenant)
2. **Per-tier substrate recommendation** (this row's table)
3. **Per-tier substrate rows** (B-0774 for single-cluster
   scale; this row for multi-cluster scale)
4. **Operator-in-the-negotiation-high-seat** preserved (per
   B-0763): every choice swappable; not stranded on initial
   architecture decision; migration paths documented

## What this preserves vs prevents

**Preserves**: B-0756 simple-HA-via-etcd default for operators
who want zero-architecture-decision. Default stays simple.

**Prevents**: Zeta substrate accidentally claiming "scales to
N nodes" without naming WHICH architecture pattern at that N.
Different patterns scale to different N; substrate-honest is
to name the pattern + tier.

## Out of scope

- Implementing every option in detail — handle per-tier as
  separate rows when operator demand surfaces
- Comparing Karmada vs vCluster vs KubeStellar feature-by-
  feature — depends on operator's specific use case; document
  decision-factors instead
- Hyperscale ($billion+ infra) cost optimization — out of
  scope for the row; v1 ships substrate; cost optimization
  is per-operator engagement
- Replacing CNCF federation projects with Zeta-native — long
  game per B-0766; not this row's v1

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, sharpening B-0774
etcd-less options with the scale dimension: *"ha installs of
kubernets that scales better"*. Real substrate question;
scale-beyond-etcd is architecture choice not just backend
choice; multiple options (Karmada / KubeStellar / vCluster /
Cluster API / cell-based + NATS super-cluster / CockroachDB)
compose differently with Zeta substrate; this row names the
per-tier recommendation + the substrate composition for each.
