---
id: 081M3812659087G0R001NP3WR6
type: task
state: backlog
priority: P2
slug: qemu-3-node-ha-cluster-test-embedded-etcd-servers-replicated
title: "QEMU 3-node HA cluster test: embedded-etcd servers, replicated Longhorn, survive losing a replica-holding node; product etcd peer admission replaces harness-only ports"
created: 2026-09-23T20:59:36.489Z
depends_on: []
composes_with: []
---

# QEMU 3-node HA cluster test: embedded-etcd servers, replicated Longhorn, survive losing a replica-holding node; product etcd peer admission replaces harness-only ports

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3812659087G0R001NP3WR6-*.md` glob. -->

## What this delivers

- `full-ai-cluster/nixos/tests/k3s-ha-longhorn-cluster.nix` — three role=server
  nodes (one founds, two join through the shipped `injected-server-join.nix`),
  all Ready on the real Cilium, Longhorn at the prod chart version with a
  TEST-ONLY `defaultReplicaCount: 3`, one emulated block device per node. A PVC
  binds; 32 MiB + sha256 are written from server3; three replicas are asserted
  on three DISTINCT nodes from Longhorn's Replica CRs; server3 is hard
  power-cut; /readyz answers on both survivors, a ConfigMap write commits
  (etcd quorum 2/3), and `sha256sum -c` passes from a pod on server1 with the
  volume `degraded`.
- `full-ai-cluster/nixos/modules/k3s-etcd-peers.nix` — the product fix for the
  P1 false green 081M10ZG61D087G0R001A70F0P: `zeta.k3sServer.etcdPeers`,
  default empty (hardware firewall unchanged), admits 2379/2380 from the named
  peers ONLY; evaluation refuses a JOINING server that nothing admits etcd
  traffic to. `k3s-server-join.nix` now uses the option instead of opening the
  ports itself.
- `k3s-etcd-peers-model` eval check pinning the above, including the mutation
  that made the first draft's refusal vacuous (NixOS's implicit trusted `lo`).
- `cluster-ha` job in `build-ai-cluster-iso.yml` (push / schedule / dispatch;
  `only_cluster_ha` dispatch input runs it alone), with a host-memory sampler.

## Found while writing it — NOT fixed here

**Losing the FOUNDER is not survivable for the CNI.** Cilium's
`k8sServiceHost: control-plane` resolves to the founder on every joiner (that
is what `injected-cluster-address.nix` writes on hardware and what the tests
write by hand). With the founder gone, the surviving Cilium agents' API
endpoint is dead even though the apiservers on the other two servers are
healthy and etcd holds quorum. So "3-server HA" today tolerates losing a
JOINER, not the founder. The test deliberately loses server3 and says so in
its header. REGISTER: reasoned from the config, NOT measured by any run.
Fix candidates (a maintainer call): map `control-plane` to
127.0.0.1 on every SERVER once it is a member (keeping the join endpoint
separate from the CNI endpoint), or a VIP / kube-vip-style address.

## Still open (named, not hidden)

- The FOUNDER half of 081M10ZG61D087G0R001A70F0P: a founder with
  `etcdPeers = [ ]` still refuses joiners at runtime; only a joiner-side
  runtime probe before k3s starts can catch that.
- Where a real host's peer list comes from: nothing auto-populates
  `etcdPeers` (a firewall default on the hardware path is the maintainer's
  decision), so hardware server HA needs an explicit host setting.
- 081M10ZG63M087G0R000SG5KV6: the generic "harness posture must be a subset of
  the product" eval check. The known violation is gone; the check is not built.
- `longhorn-volume-binds.nix` pins chart 1.7.2 while prod runs 1.12.1; this
  test uses 1.12.1.
