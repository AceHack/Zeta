---
id: B-0723
priority: P3
status: open
title: "Multi-kubelet per machine — 2-3 K3S agents per physical box, each in a different cluster, so botched upgrades fail over instead of taking down the whole physical cluster"
created: 2026-05-25
last_updated: 2026-05-25
classification: research-then-buildable
decomposition: needs-design-pass
type: cluster-architecture
discovered_by: aaron
owners: [aaron, maintainer]
composes_with:
  - full-ai-cluster/
related_prs:
  - PR-4953  # k3d dev cluster + ArgoCD sync-wave design lane (closed unmerged 2026-05-25; substrate informs this row's failure-domain framing)
  - PR-4954  # B-0722 CI ephemeral cluster smoke (in flight; row will land via #4954 and can be added to composes_with then)
---

# B-0723 — Multi-kubelet-per-machine failure-domain pattern

## Carved blade

> Each physical worker runs 2-3 K3S agent processes, each joining a different control plane. A botched upgrade of one control plane only takes down the agent talking to it; the other 1-2 keep serving. Cluster = failure domain. The hard part is CNI namespace collisions.

## Origin

Aaron 2026-05-25, during the dev-cluster session:

> *"i prefer to always have two k8s clusters running or 3 per actual physical cluster so each machine participates in two communication channels so a botched upgrade can fail it. we should backlog this pattern."*

Then on the implementation shape:

> *"so like basically running two or three kublets permachine almost"*

And on the main pitfall:

> *"then it's just networking naspace collisions on cni ususally that fuck you"*

## The pattern

Each physical worker machine runs N (= 2 or 3) independent K3S agent processes, each joining a different K3S control plane. The agents share the physical machine's CPU / RAM / disk / GPU but participate in independent K8s clusters.

| Property | Standard single-cluster | Multi-kubelet pattern |
|----------|-------------------------|----------------------|
| Kubelets per machine | 1 | 2-3 |
| Control planes the machine talks to | 1 | 2-3 |
| Workload sharding | All workloads share one cluster's lifecycle | Workloads sharded across clusters; each has 2-3 cluster homes |
| Upgrade failure mode | Botched upgrade takes down the whole physical cluster's workloads | Botched upgrade isolated to one cluster; peer clusters keep serving |
| Operator complexity | Lower | Higher (3 ArgoCDs, 3 kubeconfigs, sharded workload graph) |
| Resource overhead | Baseline | +30-60% (each K3S agent is ~150 MB + extra containerd state) |

The end-state: physical cluster = federated set of 2-3 logical K8s clusters where every machine is a node in every cluster. Upgrades are per-control-plane; rolling upgrade across N clusters means at most 1/N of the cluster's workload-serving capacity is at risk at any moment.

## Why K3S makes this practical

Vanilla kubeadm + kubelet is hostile to multi-instance on one machine (assumes exclusive `/var/lib/kubelet`, container runtime socket, kubelet config paths). K3S is friendlier:

- **`--data-dir`** isolates state per agent (`/var/lib/rancher/k3s-a`, `/var/lib/rancher/k3s-b`, `/var/lib/rancher/k3s-c`)
- **Small footprint** — each K3S agent is ~150 MB resident vs ~500 MB for full kubelet + containerd
- **Bundled containerd** can be parameterized per-agent (different `--containerd-socket`)
- **Embedded etcd** for the control plane stays on dedicated control-plane nodes, not the workers

## The CNI collision problem (Aaron's named pitfall)

Running multiple K3S agents on one machine, each with its own CNI plugin, causes:

1. **Pod CIDR overlap** — both CNIs hand out IPs from default ranges (10.42.0.0/16 etc.) → routing conflicts, broken pod-to-pod communication
2. **BPF program collisions** — only one CNI can attach eBPF programs to a given network interface; second installation either fails or silently displaces the first
3. **iptables / nftables rule fights** — kube-proxy + CNI both write rules; two of them double-write or stomp each other
4. **veth pair naming** — pod-side veth pairs reuse names → bind failures
5. **Service VIP overlap** — each cluster's Services need non-overlapping VIP ranges or kube-proxy fights

### Mitigations to evaluate (this row's design pass should pick one)

| Approach | How | Cost |
|----------|-----|------|
| **Non-overlapping CIDRs per cluster** | `cluster-a: pod=10.42.0.0/16, svc=10.43.0.0/16`; `cluster-b: pod=10.44.0.0/16, svc=10.45.0.0/16`; etc. Each CNI configured with its assigned ranges | Operator discipline; spreadsheet to maintain |
| **Different NICs per cluster** | kubelet-A binds eth0, kubelet-B binds eth1 — physical NIC isolation | Requires multi-NIC machines; doubles network cable count |
| **CNI per cluster with isolated IPAM pools** | Cilium supports `clusterPoolIPv4PodCIDR` per install; configure each agent's Cilium with its own pool | Per-Cilium-install config drift risk |
| **netns isolation via systemd-nspawn** | Each K3S agent runs inside its own systemd-nspawn container with isolated network namespace; bind-mount GPU + storage | Heavy; defeats some of the "shared physical resource" benefit |
| **vcluster on a single host K3S** | One K3S host cluster + N vclusters; each vcluster has its own K8s API but shares the host's CNI | Different architecture — not actually multi-kubelet; trade-off is failure domain is the host cluster |

## Composition with prod hardware shape

Per the existing 2-NVMe disko shape (`disko-shapes/2nvme.nix`):

- nvme0 has the OS + 256 GB root + Longhorn data path 1
- nvme1 has Longhorn data path 2

Multi-kubelet per machine needs each K3S agent to have its own `--data-dir`. Options:

- Three subdirs under root: `/var/lib/rancher/k3s-{a,b,c}` (simple; share the 256 GB OS partition)
- Carve a new partition off nvme0 for K3S state isolation
- Per-agent ZFS dataset for finer-grained ops (snapshots per cluster)

Decision: probably simplest path is subdirs; revisit if state-isolation becomes a debugging issue.

## Why P3 not P2

Pure operational substrate; doesn't gate first-cluster bring-up. Becomes valuable once:

1. First cluster is in production and the pain of single-cluster upgrade risk is felt
2. There are 5+ machines (point of failure-domain math becoming meaningful)
3. Workloads exist that BENEFIT from cross-cluster redundancy (stateful services with replication, anything with strict SLO)

Pre-production it's premature.

## Acceptance (when picked up)

This row needs a design pass before implementation. Acceptance for the design pass:

- [ ] Pick the CNI-collision mitigation (from the table above)
- [ ] Document the per-machine kubelet topology in a `nixos/modules/multi-kubelet.nix` module that takes `zeta.multiKubelet.clusters = [ ... ]` and emits N systemd `k3s-agent-{name}.service` units
- [ ] Workload-sharding strategy: which apps go in 1-cluster, which in 2-cluster, which in 3-cluster
- [ ] Update `nixos/hosts/worker-template/default.nix` to expose `zeta.multiKubelet` option
- [ ] Update the bare-metal install path (`zeta-install` script) to support multi-cluster join URLs
- [ ] CNI per-cluster IPAM configuration template
- [ ] Operator runbook for "upgrade cluster A while keeping B + C serving"

## References

- K3S agent multi-instance: https://docs.k3s.io/installation/configuration
- Cilium multi-cluster: https://docs.cilium.io/en/stable/network/clustermesh/
- vcluster (alternative architecture): https://www.vcluster.com/
- Cluster API (CAPI) for declarative multi-cluster: https://cluster-api.sigs.k8s.io/
- Cluster-as-failure-domain pattern (industry write-ups from Lyft, Airbnb, Cloudflare on multi-cluster topologies)

## Composes with substrate

- B-0722 (CI ephemeral cluster smoke) — once this lands, smoke tests need to run against the multi-cluster pattern (does my PR break cluster-A but not cluster-B + C?)
- Disko cookie-cutter (PR #4950) — multi-kubelet shape may want to allocate a separate partition for state isolation
- Dev cluster (PR #4953) — the local k3d-based dev environment could simulate this with 2-3 k3d clusters running in parallel (Docker Desktop's native multi-cluster support); useful for dev-testing the topology before bare-metal rollout
- Hat-system (PR #4930) — Hat / HatBinding CRDs may need cross-cluster awareness if a wearer's SPIFFE ID is valid in multiple clusters

## Not in scope (yet)

- Multi-region multi-cluster (per-region clusters; this row is per-machine sharing of clusters within a single physical rack)
- Cross-cluster service mesh (Cilium ClusterMesh, Istio multi-cluster) — overlaps but is its own row
- Multi-control-plane HA (separate consideration; orthogonal — multi-kubelet works whether each control plane is 1-node or 3-node HA)
