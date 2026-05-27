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

  # B-0850 Phase 1: enable Otto systemd service on control-plane.
  # Operator framing 2026-05-27: "so our usb after gh and claude device
  # code login it should reboot with a claude service using my gh login".
  # iter-5.5.0 install-time substrate (PR #5388 + #5389) persists the
  # device-code credentials + pre-clones the Zeta repo + installs claude
  # via mise-managed bun; this enable wires the systemd unit so claude
  # auto-starts on first boot AS A SERVICE. Operator can disable via
  # `systemctl disable zeta-otto` (NCI HC-8 revocable consent).
  #
  # Service deliberately runs OUTSIDE k8s as systemd unit (not as a k8s
  # pod) so it can repair cluster issues from outside the failure domain
  # ("control plane outside the control plane" architectural pattern).
  zeta.otto.enable = true;

  # Static IP recommended so worker nodes have a stable serverAddr.
  # Per-site override here:
  #   networking.interfaces.eth0.ipv4.addresses = [{
  #     address = "192.168.1.10";
  #     prefixLength = 24;
  #   }];
  #   networking.defaultGateway = "192.168.1.1";
  #   networking.nameservers = [ "1.1.1.1" "9.9.9.9" ];
}
