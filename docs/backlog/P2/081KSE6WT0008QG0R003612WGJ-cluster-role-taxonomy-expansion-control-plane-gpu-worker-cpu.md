---
id: 081KSE6WT0008QG0R003612WGJ
priority: P2
status: open
title: Cluster role taxonomy expansion — control-plane-gpu, worker-cpu, worker-storage, all-in-one fused host configs
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on: []
composes_with:
  - 081KSGS9H0008QG0R002T3BJ2R
tags: [cluster, nixos, hosts]
---

## Problem

Current `full-ai-cluster/nixos/hosts/` only has two host configs:

- `control-plane` (k3s server; runs workloads by default since
  the server does not `--disable-agent`; no GPU support)
- `worker-gpu` (k3s agent + nvidia driver + GPU device plugin
  + GPU passthrough)
- `worker-template` (scaffold for new worker-gpu-NN nodes)

Aaron's 2026-05-25 ask: *"can we i be control plane and gpu node
and what about just cpu or storage nodes or some that fuse all
three"*. The architecture supports all of these via module
composition (`modules/k3s-server.nix`, `modules/k3s-agent.nix`,
`modules/gpu.nix`, `modules/gpu-device-plugin.nix`,
`modules/gpu-passthrough.nix`), but the four common compositions
aren't materialized as host configs yet.

## Target

Host configs for:

| Role | k3s | GPU | Extra Longhorn disks | Use case |
|------|-----|-----|----------------------|----------|
| `control-plane-gpu` | server | yes | default | First node of a small cluster runs everything |
| `worker-cpu` | agent | no | default | CPU-only workload node (no nvidia hardware) |
| `worker-storage` | agent | no | extra | Storage-heavy node (lots of Longhorn replicas) |
| `all-in-one` | server | yes | extra | Single-node lab cluster; fuses all three |

## Acceptance

- [ ] `nixos/hosts/control-plane-gpu/` exists, imports
      k3s-server.nix + gpu.nix + gpu-device-plugin.nix +
      gpu-passthrough.nix; documented in README.md
- [ ] `nixos/hosts/worker-cpu/` exists, imports k3s-agent.nix
      only (no GPU modules); documented
- [ ] `nixos/hosts/worker-storage/` exists, imports k3s-agent.nix
      + extra Longhorn data-path configuration; documented
- [ ] `nixos/hosts/all-in-one/` exists, imports k3s-server.nix +
      GPU modules + extra Longhorn paths; documented
- [ ] `flake.nix` nixosConfigurations entries for all four
- [ ] 081KSGS9H0008QG0R002T3BJ2R v1 first-boot keystroke prompt extended:
      'c' control-plane / 'g' control-plane-gpu /
      'w' worker-gpu / 'p' worker-cpu / 's' worker-storage /
      'a' all-in-one. Default stays control-plane (most common
      first-node choice)
- [ ] PROVISIONING.md updated with role selection matrix
- [ ] flash-cluster-iso skill updated with new role options

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R — zero-typing USB install (the keystroke-prompt
  surface that needs to grow when new roles land)
- 081KSE6WT0008QG0R003WZAQKV — zflash + Touch ID PAM
- `full-ai-cluster/nixos/modules/` — the module library this
  row's host configs compose from

## Notes

- The all-in-one role is the natural starting point for a small
  home-lab cluster — Aaron's immediate use case if he wants the
  first node to also host GPU workloads
- Adding GPU support to an existing `control-plane` install is
  also a valid path: write a new `control-plane-gpu` host config,
  `nixos-rebuild switch --flake .#control-plane-gpu --target-host
  <ip>` from an admin machine — no reinstall needed
- worker-storage role assumes the same `2nvme` disko shape but
  with more longhorn paths; multi-disk-shape support (4-NVMe,
  NVMe+SATA-SSD mix) handled per PROVISIONING.md §multi-shape
  if needed for storage-heavy boxes

## Origin

Aaron 2026-05-25, mid-081KSGS9H0008QG0R002T3BJ2R implementation, surveying the role
options the zero-typing flow should support.
