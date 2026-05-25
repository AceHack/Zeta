# infra/nixos/hosts/worker-gpu-02/configuration.nix
#
# Worker node #02 — identical shape to worker-gpu-01, separate file
# so per-machine labels / hardware specifics stay declared per host.
# Add more workers as worker-gpu-03, -04, ... following this template.

{ config, pkgs, lib, ... }:

{
  imports = [
    ./hardware-configuration.nix
    ../../modules/common.nix
    ../../modules/k3s-agent.nix
    ../../modules/gpu.nix
  ];

  networking.hostName = "worker-gpu-02";

  services.k3s.serverAddr = "https://control-plane.zeta.local:6443";
  # services.k3s.tokenFile = config.sops.secrets.k3s-token.path;

  services.k3s.extraFlags = lib.mkAfter [
    # "--node-label=zeta.io/gpu-model=rtx-4090"
    # "--node-label=zeta.io/gpu-count=1"
  ];

  users.users.zeta.openssh.authorizedKeys.keys = [
    # "ssh-ed25519 AAAAC3Nz... aaron@zeta"
    # "ssh-ed25519 AAAAC3Nz... addison@zeta"
  ];
}
