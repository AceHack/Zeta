# infra/nixos/hosts/worker-gpu-01/configuration.nix
#
# Worker node #01 — runs GPU-accelerated AI workloads. Joins the K3S
# cluster as an agent and advertises its NVIDIA GPU(s) for pod
# scheduling via `nvidia.com/gpu` resource requests.

{ config, pkgs, lib, ... }:

{
  imports = [
    # Per-machine hardware config. Ships as a minimal placeholder
    # so the flake evaluates in CI before the host is provisioned;
    # replace with `nixos-generate-config --root /mnt` output during
    # real install. See ./hardware-configuration.nix for the stub
    # shape and the comment block inside it for the generator command.
    ./hardware-configuration.nix

    # Shared baseline.
    ../../modules/common.nix

    # K3S agent role.
    ../../modules/k3s-agent.nix

    # NVIDIA driver + container toolkit + node labels.
    ../../modules/gpu.nix
  ];

  # ---------------------------------------------------------------------------
  # Identity
  # ---------------------------------------------------------------------------
  networking.hostName = "worker-gpu-01";

  # ---------------------------------------------------------------------------
  # K3S join — point at the control-plane and provide the cluster token.
  # The token file should be sops-nix / agenix decrypted at boot in
  # production; for initial bootstrap copy it manually after install.
  # ---------------------------------------------------------------------------
  services.k3s.serverAddr = "https://control-plane.zeta.local:6443";
  # services.k3s.tokenFile = config.sops.secrets.k3s-token.path;

  # ---------------------------------------------------------------------------
  # Worker-specific node labels — exposed to the scheduler for placement.
  # gpu.nix already adds zeta.io/gpu=nvidia; k3s-agent.nix adds
  # zeta.io/role=worker. Add hardware-specific labels here, e.g.:
  #   zeta.io/gpu-model=rtx-4090
  #   zeta.io/gpu-count=2
  #   zeta.io/cpu-cores=32
  # ---------------------------------------------------------------------------
  services.k3s.extraFlags = lib.mkAfter [
    # "--node-label=zeta.io/gpu-model=rtx-4090"
    # "--node-label=zeta.io/gpu-count=2"
  ];

  # ---------------------------------------------------------------------------
  # SSH keys for the zeta admin user.
  # ---------------------------------------------------------------------------
  users.users.zeta.openssh.authorizedKeys.keys = [
    # "ssh-ed25519 AAAAC3Nz... aaron@zeta"
    # "ssh-ed25519 AAAAC3Nz... addison@zeta"
  ];
}
