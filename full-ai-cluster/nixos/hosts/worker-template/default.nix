# full-ai-cluster/nixos/hosts/worker-template/default.nix
#
# Cookie-cutter worker node config. Adding a new identical box:
#
#   1. cp -r nixos/hosts/worker-template nixos/hosts/worker-gpu-NN
#   2. Edit the new file — change SIX placeholder values:
#        - networking.hostName        (line ~30)
#        - networking.hostId          (line ~32; new random 8-hex)
#        - networking.interfaces      (per-host MAC / static IP)
#        - zeta.disko.nvme0           (per-host /dev/disk/by-id)
#        - zeta.disko.nvme1           (per-host /dev/disk/by-id)
#        - users.users.zeta.openssh.authorizedKeys  (maintainer key)
#   3. Add `worker-gpu-NN` to flake.nix nixosConfigurations
#   4. Boot the box on the installer USB, then:
#        nix run github:nix-community/disko -- \
#          --mode disko \
#          --flake /mnt/etc/zeta/full-ai-cluster#worker-gpu-NN
#        nixos-install --flake /mnt/etc/zeta/full-ai-cluster#worker-gpu-NN
#   5. Reboot. Node joins cluster, Longhorn picks up both disks,
#      ArgoCD reconciles workloads.
#
# Hardware shape: x86_64, UEFI, 2 NVMes (any size, same shape),
# 1+ NVIDIA GPU. For AMD-only or Intel-only GPU nodes change the
# `zeta.gpu-device-plugin.vendors` setting; for non-GPU workers
# drop the GPU imports entirely.

{ config, pkgs, lib, inputs, ... }:

{
  imports = [
    # Declarative disk layout — disko shapes the partitions,
    # longhorn-disks wires the mounts to Longhorn data paths.
    inputs.disko.nixosModules.disko
    ../../modules/disko-shapes/2nvme.nix
    ../../modules/longhorn-disks.nix

    # Cluster role + hardware-class modules.
    ../../modules/common.nix
    ../../modules/k3s-agent.nix
    ../../modules/gpu.nix
    ../../modules/gpu-device-plugin.nix
    ../../modules/gpu-passthrough.nix
    ../../modules/docker.nix
    ../../modules/local-storage.nix
  ];

  # ── PLACEHOLDER: change per-host ─────────────────────────────
  networking.hostName = "worker-template";
  networking.hostId = "00000000";   # `head -c4 /dev/urandom | od -A n -t x4 | tr -d ' '`
  # ─────────────────────────────────────────────────────────────

  # ── PLACEHOLDER: change per-host (disk IDs) ──────────────────
  # On the live system, run: ls -l /dev/disk/by-id/ | grep nvme
  zeta.disko = {
    nvme0 = "/dev/disk/by-id/nvme-REPLACE_ME_BOOT_DISK";
    nvme1 = "/dev/disk/by-id/nvme-REPLACE_ME_LONGHORN_DISK";
    # rootSize = "256G";  # default; override if needed
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

  # GPU device plugin vendor mix. Override per-host if AMD or Intel.
  zeta.gpu-device-plugin = {
    enable = true;
    vendors = [ "nvidia" ];
  };

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
