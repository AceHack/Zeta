---
id: 081KSE6WT0008QG0R000CV98PV
title: Cluster auto-discovery — mDNS bootstrap-or-join so 1st/2nd/3rd/Nth USB self-organizes into a growing cluster unattended
status: open
priority: P3
size: L
created: 2026-05-25
authors: [aaron, otto-cli]
composes_with: [081KSGS9H0008QG0R002T3BJ2R, 081KSE6WT0008QG0R003612WGJ, 081KSE6WT0008QG0R001NG9JZH]
depends_on: [081KSGS9H0008QG0R002T3BJ2R, 081KSE6WT0008QG0R001NG9JZH]
labels: [cluster, mdns, k3s, bootstrap, ux]
---

## Problem

Aaron 2026-05-25: *"can we make this auto matic as i add and others
create their own clusers so 1, 2, 3, 4, etc... are all setup correctly
unattended unless you interrupt?"*

Current 081KSGS9H0008QG0R002T3BJ2R v1 flow assumes the operator knows their role at
boot time. For a growing cluster:

- 1st USB: needs `--cluster-init` (bootstrap)
- 2nd USB: needs `--server https://<1st-cp>:6443` (join)
- 3rd USB: same — but worker or control-plane HA?
- Nth USB: depends on cluster state, not on flash-time choice

Requiring the operator to know which node is which scales badly
and breaks the zero-typing experience that 081KSGS9H0008QG0R002T3BJ2R set up.

## Target

Boot any USB on any node → node auto-discovers cluster state →
self-organizes into the right role:

- **No cluster found** (after ~20s mDNS probe): become bootstrap
  control-plane (`--cluster-init`)
- **Cluster found**: join as worker (auto-detect hardware shape:
  GPU present → worker-gpu, multi-disk + no GPU → worker-storage,
  else → worker-cpu) OR as additional HA control-plane if operator
  pressed 'h' during the 10-sec prompt
- **Interrupt window**: 10-sec keystroke prompt always offered;
  operator can override auto-pick

## Acceptance

- [ ] mDNS service `_zeta-cluster._tcp.local` published by every
      control-plane node (via avahi or systemd-resolved publish)
- [ ] First-boot service probes mDNS for ~20s:
      - If responder found: get join token + bootstrap IP via mDNS
        TXT record OR via authenticated HTTPS GET to the control-plane
      - If no responder after timeout: become bootstrap
- [ ] Auto-role detection at boot:
      - `lspci | grep -i nvidia` → has GPU
      - `lsblk -d -o NAME,TRAN | grep nvme | wc -l` → disk count
      - role priority: control-plane (if 1st) > worker-gpu (if nvidia)
        > worker-storage (if 4+ disks) > worker-cpu (else)
- [ ] Operator-interrupt keystroke prompt extended (per 081KSE6WT0008QG0R003612WGJ +
      081KSE6WT0008QG0R001NG9JZH role expansions): override auto-pick with any role
- [ ] Token distribution security: for home-lab v1, ship token
      via mDNS TXT (acceptable since the cluster network is trusted);
      for prod v2, use SOPS/age preshared at flash time
- [ ] Workers store discovered cluster bootstrap IP in
      `/etc/zeta-cluster.conf` so subsequent reboots don't re-probe
- [ ] PROVISIONING.md updated: "boot Nth USB → boot, walk away"
      as the canonical flow
- [ ] 081KSGS9H0008QG0R002T3BJ2R v1 zeta-first-boot.sh extended to call discovery
      before showing the role prompt; auto-pick + 10-sec override
      window remains

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (this row extends the first-boot
  flow with discovery)
- 081KSE6WT0008QG0R003612WGJ — role taxonomy expansion (the roles discovery can pick
  among)
- 081KSE6WT0008QG0R001NG9JZH — HA control-plane (the join-as-HA-control-plane option
  needs the multi-master substrate)
- `avahi` NixOS module — mDNS publish/discover infrastructure

## Security notes

- mDNS join token broadcast IS insecure on untrusted networks —
  acceptable for home-lab; flag for prod scope
- For prod: SOPS/age preshared secret in the ISO at build time,
  rotated by operator; or per-node tokens issued by control-plane
  with operator approval gate
- Cluster discovery should ONLY accept Zeta clusters (mDNS service
  type filter); won't accidentally join someone else's k3s

## Out of scope

- Internet-routable discovery (joining a cluster across networks)
- Auto-removal of nodes (cluster shrink); operator-initiated only
- Multi-region / federated clusters

## Origin

Aaron 2026-05-25, immediately after the 081KSE6WT0008QG0R001NG9JZH HA-control-plane
file, surveying the unattended-growth UX.
