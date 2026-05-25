# full-ai-cluster/nixos/hosts/worker-gpu/configuration.nix
#
# Worker template. Per physical worker, duplicate this file under
# nixos/hosts/worker-gpu-NN/, add a per-host hardware-configuration,
# and add a nixosConfigurations.worker-gpu-NN entry to flake.nix.
#
# This template runs: NVIDIA GPU + container-toolkit + K8s device
# plugin + Docker + local storage. VFIO passthrough OFF by default
# (enable per-host).

{ config, pkgs, lib, ... }:

{
  imports = [
    ./hardware-configuration.nix
    ../../modules/common.nix
    ../../modules/k3s-agent.nix
    ../../modules/gpu.nix
    ../../modules/gpu-device-plugin.nix
    ../../modules/gpu-passthrough.nix
    ../../modules/docker.nix
    ../../modules/local-storage.nix
  ];

  networking.hostName = "worker-gpu";

  # Cluster join target. Override per-site.
  services.k3s.serverAddr = "https://control-plane.zeta.local:6443";

  # Vendor mix for the K8s device plugin. Override per-host if
  # this worker has AMD or Intel GPUs alongside (or instead of) NVIDIA.
  zeta.gpu-device-plugin = {
    enable = true;
    vendors = [ "nvidia" ];
  };

  # VFIO passthrough disabled by default. Enable + list PCI IDs
  # per-host when you want a GPU bound to vfio-pci for VM workloads.
  zeta.gpu-passthrough = {
    enable = false;
    pciIds = [ ];   # e.g. [ "10de:2204" "10de:1aef" ]
  };

  # Per-host node labels — let the scheduler target hardware specs.
  services.k3s.extraFlags = lib.mkAfter [
    # "--node-label=zeta.io/gpu-model=rtx-4090"
    # "--node-label=zeta.io/gpu-count=2"
  ];

  users.users.zeta.openssh.authorizedKeys.keys = [
    # "ssh-ed25519 AAAAC3Nz... aaron@zeta"
  ];
}
