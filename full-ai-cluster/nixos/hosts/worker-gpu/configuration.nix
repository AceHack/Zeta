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
    ../../modules/gpu-passthrough.nix
    ../../modules/docker.nix
    ../../modules/local-storage.nix
  ];

  networking.hostName = "worker-gpu";

  # Cluster join target. Override per-site.
  services.k3s.serverAddr = "https://control-plane:6443";

  # The GPU device plugin is declared on the CONTROL PLANE, not here. It installs via
  # `services.k3s.manifests`, which only a k3s SERVER applies — declared on this
  # role="agent" node the files were written and nothing read them, so GPUs were never
  # advertised to the scheduler (081M1XXA0FC087G0R002F92ZQC). This node still provides
  # the hardware-level half: drivers, the containerd runtime, and the `zeta.io/gpu`
  # label the DaemonSet's nodeSelector targets.

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
