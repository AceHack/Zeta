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

  # Add maintainer SSH keys for the `zeta` admin user:
  users.users.zeta.openssh.authorizedKeys.keys = [
    # "ssh-ed25519 AAAAC3Nz... aaron@zeta"
  ];
}
