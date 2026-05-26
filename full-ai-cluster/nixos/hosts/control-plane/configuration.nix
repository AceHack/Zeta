# full-ai-cluster/nixos/hosts/control-plane/configuration.nix
#
# K3S server + ArgoCD bootstrap. Cilium CNI takes over from flannel.
# No GPU on this host — control-plane stays lean.

{ config, pkgs, lib, ... }:

{
  imports = [
    ./hardware-configuration.nix
    ../../modules/common.nix
    ../../modules/k3s-server.nix
    ../../modules/docker.nix
    ../../modules/local-storage.nix
    # Iter-4 credential substrate (per B-0789):
    ../../modules/initial-password.nix      # zeta user has known initial password (rotate on first login)
    ../../modules/operator-ssh-keys.nix     # operator pubkey(s) injected by zeta-install.sh from USB
  ];

  networking.hostName = "control-plane";

  # Static IP recommended so worker nodes have a stable serverAddr.
  # Per-site override here:
  #   networking.interfaces.eth0.ipv4.addresses = [{
  #     address = "192.168.1.10";
  #     prefixLength = 24;
  #   }];
  #   networking.defaultGateway = "192.168.1.1";
  #   networking.nameservers = [ "1.1.1.1" "9.9.9.9" ];
}
