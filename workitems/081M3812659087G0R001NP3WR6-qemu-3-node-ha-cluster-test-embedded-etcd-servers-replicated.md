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

## Run log

- **Run 35920509908 (first CI run, #17569 as merged): RED at the PVC bind.**
  PASSED: server2 + server3 joined as etcd members, one CA, source-scoped etcd
  rules present, all three nodes Ready on Cilium, Longhorn manager Ready on all
  three with each node's own disk registered, StorageClass `numberOfReplicas=3`
  — 1476 s of test-script time. FAILED: `pvc ha-proof` never Bound in 900 s.
  Cause, from the journal: etcd starved of disk on the shared runner disk
  (`slow fdatasync` > 1 s, applies up to 5.7 s, raft re-elections), k3s exiting
  on `failed to wait for apiserver being healthy` on every server, 20+
  restarts. Host RAM peak 14572 / 15989 MiB. Also found: Longhorn's disk
  annotator `wants` k3s, so the joiners' held-back k3s started at boot anyway.
  Fix in the follow-up PR: /var/lib/rancher on its own `cache=unsafe` disk,
  guests 3584 MiB, annotator held back with the joiners' k3s, and a
  diagnostic dump on every long wait.
- **Run 35926193063 (rancher on a cache=unsafe disk, 3584 MiB): RED at the PVC
  bind again.** Much faster formation (3 Ready at 336 s, Longhorn at 1155 s),
  but 26847 `slow fdatasync` warnings and continued k3s restarts; the CSI
  sidecars were only created 2 min before the timeout (driver-deployer had
  restarted 16 times). Host RAM peak 13213 / 15989 MiB. Next: etcd's db dir
  on tmpfs, and the job moved to workflow_dispatch only until it has a green
  run on a hosted runner.
- **Run 35930213010 (etcd db on tmpfs): RED at the PVC bind, cause now CPU.**
  slow-fdatasync gone (1 warning); 3 Ready at 329 s, Longhorn up at 566 s. But
  16825 `apply request took too long` (2-5 s on read-only ranges) and 12 k3s
  exits on `leaderelection lost` (renew deadline missed), so Longhorn's CSI
  never settled. Host RAM 13156 / 15989 MiB.
  **Verdict: this 3-server + Cilium + Longhorn test does not fit a 4-vCPU
  hosted runner.** Options, not done here: (a) run it on an 8+ vCPU runner;
  (b) a hosted-runner variant with 1 server + 2 agents (agents run no
  apiserver/etcd), keeping this one for the HA claim. NOT an option: relaxing
  leader-election timers in the harness, which would hide starvation.
