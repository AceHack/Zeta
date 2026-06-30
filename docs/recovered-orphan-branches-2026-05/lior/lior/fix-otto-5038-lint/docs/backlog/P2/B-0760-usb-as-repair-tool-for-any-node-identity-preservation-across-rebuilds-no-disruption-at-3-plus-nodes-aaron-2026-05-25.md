---
id: B-0760
priority: P2
status: open
title: USB as repair tool for any node — identity preservation across rebuilds + no-disruption-at-3+-nodes invariant
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0754
  - B-0756
  - B-0757
composes_with:
  - B-0755
  - B-0758

tags: [cluster, repair, identity, k3s, longhorn, ha, declarative]
---

## Problem

Aaron 2026-05-25: *"think of this usb as the easiest repair tool for
any node in the cluster if it fails we should harden it like that
since we are desired state / declarative / git native / ai native a
full rebuild of a node should not stop normal operations once we get
to 3 nodes."*

Current B-0754 v1 substrate (greedy N-disk + zero-typing first-boot
+ ZETA_AUTO_CONFIRM bypass) treats every install as a fresh install:

- Asks for role (defaults to control-plane)
- Wipes all internal disks
- Clones repo + nixos-install
- Reboots

That works for the **first install** of a node. It does NOT yet
provide the **repair-tool** semantics: when an existing cluster
node fails, plug in the same USB → node rebuilds → rejoins the
cluster as the SAME identity (hostname, role, etcd membership,
longhorn replicas re-sync from peers).

## Target

The USB becomes the canonical repair tool for any node. Operator
plug-and-walk-away flow:

1. **Node fails** (NVMe dies, OS corruption, hardware swap)
2. **Operator plugs in USB**, boots node
3. **First-boot service detects existing cluster** (per B-0757
   mDNS auto-discovery)
4. **Detects this node's prior identity** (by-MAC-address lookup
   against cluster's known-nodes registry, OR by-prior-hostname
   if disk-by-id survived)
5. **Reinstalls + rejoins as SAME identity** — k3s rejoins as
   the same node, longhorn rebuilds replicas from peers,
   workloads schedule back on
6. **Cluster ops never paused** (per B-0756 HA quorum at 3+
   control-plane nodes; longhorn replication keeps data
   available during the rebuild)

Operator-side typing: 0 commands (plug + walk away). Cluster-side
disruption: 0 (at 3+ nodes; HA quorum holds while the failed node
is offline + rebuilding).

## Acceptance

- [ ] Cluster maintains a known-nodes registry (k3s node list +
      MAC addresses + hostnames) — could be a ConfigMap, an
      etcd key, or a git-committed manifest
- [ ] zeta-first-boot detects existing cluster (B-0757 mDNS);
      if found, queries known-nodes registry by MAC address
- [ ] If MAC match → inherit hostname + role from registry;
      skip role keystroke prompt with banner "Detected prior
      identity: <hostname> (<role>). Rebuilding as same node.
      Press 'n' for new node, any other key (or 10s) to confirm."
- [ ] If MAC mismatch (genuinely new node) → fall through to
      normal first-boot flow (role keystroke + bootstrap-or-join)
- [ ] k3s rejoin path: use existing node-token via SOPS/age
      preshared secret (rotated by operator); never re-init etcd
      if cluster already has quorum
- [ ] Longhorn replica re-sync: when node rejoins under same
      identity, Longhorn's existing Node CR + Volume CR records
      cover the re-sync; no manual intervention
- [ ] Pre-destruction cluster check: BEFORE wiping disks,
      announce intent to cluster (via mDNS or k8s API);
      cluster can refuse if quorum would drop below 3 (e.g.,
      another control-plane is also offline)
- [ ] Hardware-swap supported: same MAC retired + new MAC
      registered to same hostname → cluster updates registry +
      proceeds
- [ ] Idempotent re-run: running the same USB on the same
      node multiple times produces the same final state;
      partial-failure resume works
- [ ] PROVISIONING.md updated with "Repair a failed node"
      section as canonical use case
- [ ] Documented invariant: at 3+ nodes, single-node rebuild
      is zero-disruption; at 1-2 nodes, rebuild is a downtime
      event (warn operator clearly)

## Composes with

- B-0754 — zero-typing first-boot (the substrate this extends)
- B-0756 — HA control-plane via embedded etcd (3-node quorum
  is the prerequisite for zero-disruption rebuild)
- B-0757 — cluster auto-discovery via mDNS (the "is there an
  existing cluster?" detection the repair tool reuses)
- B-0755 — role taxonomy expansion (the role inheritance from
  registry must support all role variants)
- B-0758 — USB-persistent OS unRAID-style (orthogonal: the
  repair-tool semantics apply whether OS lives on disk OR on
  USB)
- `full-ai-cluster/nixos/modules/k3s-server.nix` +
  `k3s-agent.nix` — primary integration surface for rejoin
  logic
- `full-ai-cluster/nixos/modules/longhorn-disks.nix` — Longhorn
  Node CR + Volume CR handle replica re-sync once node rejoins

## Hardware-failure modes the repair tool should handle

| Failure | Repair USB behavior |
|---|---|
| OS disk dies, data disks intact | Reinstall OS; data disks re-mount; Longhorn detects existing replicas; no re-sync needed beyond local cache |
| One data disk dies, others intact | Reinstall OS; Longhorn marks dead path; replicates lost data from peer nodes |
| All disks die / fresh hardware | Treat as new node; operator confirms via 'n' keystroke or full disk swap detected |
| Motherboard swap (new MAC, same disks) | Detected via disk-by-id; registry updated; rejoin as same hostname |
| Full hardware swap (new MAC + new disks) | Genuinely new node; operator confirms; old identity retired |
| Partition corruption | Same as OS disk dies — full reinstall, longhorn data intact |

## Production-readiness inflection (3-node threshold)

The "no-disruption during single-node rebuild" invariant ONLY
holds at 3+ nodes. Documentation must be explicit:

| Node count | Single-node rebuild during ops |
|---|---|
| 1 | Full downtime (only node) |
| 2 | Full downtime (no quorum after one fails) |
| 3 | Zero-disruption (HA quorum holds) |
| 5 | Zero-disruption + 1 spare (can survive 2 simultaneous failures) |
| 7 | Zero-disruption + 2 spare |

Per B-0756 HA control-plane, odd counts only (even counts
split-brain on partition). The 3-node threshold is the
production-ready inflection point per B-0759 first-time-CLI-user
persona substrate.

## Security notes

- k3s node-token is sensitive (anyone with it can join the
  cluster); SOPS/age preshared on the USB is acceptable for
  home-lab; prod needs per-node tokens issued by control-plane
  with operator approval gate
- Known-nodes registry is a target; should be encrypted at rest
  + audit-logged on changes
- Pre-destruction cluster check prevents accidental
  partition-quorum loss (e.g., two control-planes being
  rebuilt simultaneously)
- Identity preservation = automatic rebuild = MUST be opt-out
  for high-security environments where every reinstall should
  require human verification

## Out of scope

- Per-node static IP preservation (currently DHCP; static
  could be added but separate row)
- Cross-cluster repair (USB built for cluster A repairing a
  node into cluster B) — should refuse with clear error
- Bare-metal IPMI / iLO integration (out-of-band remote
  power management) — separate row
- Cloud-burst nodes (rebuilding into AWS/GCP) — separate
  architecture

## Origin

Aaron 2026-05-25, mid-B-0754-v1 testing prep, naming the
USB-as-repair-tool design intent + the 3-node-zero-disruption
invariant that follows from the framework's desired-state +
declarative + git-native + AI-native principles.
