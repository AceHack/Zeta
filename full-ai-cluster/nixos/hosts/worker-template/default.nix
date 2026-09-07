# full-ai-cluster/nixos/hosts/worker-template/default.nix
#
# Cookie-cutter worker node config. Adding a new identical box:
#
#   1. cp -r nixos/hosts/worker-template nixos/hosts/worker-gpu-NN
#   2. Edit the new file — change placeholder values:
#        - networking.hostName        (line ~30)
#        - networking.hostId          (line ~32; new random 8-hex)
#        - networking.interfaces      (per-host MAC / static IP)
#        - zeta.disko.bootDisk        (per-host /dev/disk/by-id)
#        - zeta.disko.extraDisks      (optional; [] for single-disk)
#        - users.users.zeta.openssh.authorizedKeys  (maintainer key)
#   3. Add `worker-gpu-NN` to flake.nix nixosConfigurations
#   4. Boot the box on the installer USB, then:
#        nix run github:nix-community/disko -- \
#          --mode disko \
#          --flake /mnt/etc/zeta/full-ai-cluster#worker-gpu-NN
#        nixos-install --flake /mnt/etc/zeta/full-ai-cluster#worker-gpu-NN
#   5. Reboot. Node joins cluster, Longhorn picks up disk paths,
#      ArgoCD reconciles workloads.
#
# Hardware shape: x86_64, UEFI, 1+ internal disks (any size),
# 1+ NVIDIA GPU. For AMD-only or Intel-only GPU nodes change the
# GPU nodes are labelled `zeta.io/gpu`; for non-GPU workers
# drop the GPU imports entirely.

{ config, pkgs, lib, inputs, ... }:

{
  imports = [
    # Declarative disk layout — disko shapes the partitions,
    # longhorn-disks wires the mounts to Longhorn data paths.
    inputs.disko.nixosModules.disko
    ../../modules/disko-shapes/longhorn-node.nix
    ../../modules/longhorn-disks.nix

    # Cluster role + hardware-class modules.
    ../../modules/common.nix
    ../../modules/k3s-agent.nix
    ../../modules/gpu.nix
    ../../modules/gpu-passthrough.nix
    ../../modules/docker.nix
    ../../modules/local-storage.nix
  ];

  # ── PLACEHOLDER: change per-host ─────────────────────────────
  networking.hostName = "worker-template";
  networking.hostId = "00000000";   # `head -c4 /dev/urandom | od -A n -t x4 | tr -d ' '`
  # ─────────────────────────────────────────────────────────────

  # ── PLACEHOLDER: change per-host (disk IDs) ──────────────────
  # On the live system, run: ls -l /dev/disk/by-id/
  zeta.disko = {
    bootDisk = "/dev/disk/by-id/nvme-REPLACE_ME_BOOT_DISK";
    extraDisks = [
      "/dev/disk/by-id/nvme-REPLACE_ME_LONGHORN_DISK"
    ];
    # Single-disk node: set bootDisk only; extraDisks = [ ] (or omit).
    # longhorn1Tail = "1G";  # default; root max-fills boot disk between ESP and tail
  };
  # ─────────────────────────────────────────────────────────────

  # ── PLACEHOLDER: per-host static IP if not using DHCP ────────
  # networking.useDHCP = false;
  # networking.interfaces.eno1.ipv4.addresses = [{
  #   address = "10.0.0.21";
  #   prefixLength = 24;
  # }];
  # networking.defaultGateway = "10.0.0.1";
  # networking.nameservers = [ "10.0.0.1" "1.1.1.1" ];
  # ─────────────────────────────────────────────────────────────

  # K3S join target — same for every worker in the cluster.
  services.k3s.serverAddr = "https://control-plane:6443";

  # The GPU device plugin is declared on the CONTROL PLANE, not here. It installs via
  # `services.k3s.manifests`, which only a k3s SERVER applies — declared on a role="agent"
  # node the files are written and nothing reads them, so GPUs are never advertised to the
  # scheduler (081M1XXA0FC087G0R002F92ZQC). Set the cluster's vendor mix on the control
  # plane. This template still provides the hardware-level half below: drivers, the
  # containerd runtime, and the `zeta.io/gpu` label the DaemonSet's nodeSelector targets.

  # VFIO passthrough off by default; enable per-host with PCI IDs.
  zeta.gpu-passthrough = {
    enable = false;
    pciIds = [ ];
  };

  # Node labels — uncomment + customize per hardware spec so the
  # scheduler can target nodes by GPU model / count.
  services.k3s.extraFlags = lib.mkAfter [
    # "--node-label=zeta.io/gpu-model=rtx-4090"
    # "--node-label=zeta.io/gpu-count=2"
    # "--node-label=zeta.io/dram-gb=128"
  ];

  # ── PLACEHOLDER: maintainer SSH keys ─────────────────────────
  users.users.zeta.openssh.authorizedKeys.keys = [
    # "ssh-ed25519 AAAAC3Nz... aaron@zeta"
  ];
  # ─────────────────────────────────────────────────────────────

  system.stateVersion = "25.11";
}
