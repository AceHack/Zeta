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

  # B-0850 Phase 3 refactor: enable AI agent systemd services on
  # control-plane. Operator framing 2026-05-27:
  #   "we should have three systemd agents and the cluster running on
  #   bootup"
  #   "the mutual repair is critical too because of you can see your
  #   own future self boot script failures"
  #
  # The parameterized zeta-ai-agent.nix module supports ≥3 vendor-
  # diverse personas (otto/alexa/riven/vera/lior); each opt-in
  # independently. Currently only otto enabled — alexa/riven/vera/
  # lior enable as B-0850 Phase 3 sub-rows (3a-3d) ship per-vendor
  # install + login flows for each. Target state at pc-two is ≥3
  # personas enabled for mutual-repair + self-modification-safety
  # BFT margin.
  #
  # Services deliberately run OUTSIDE k8s as systemd units (not as
  # k8s pods) so they can repair cluster issues from outside the
  # failure domain ("control plane outside the control plane"
  # architectural pattern). Operator can disable any persona via
  # `systemctl disable zeta-<persona>` per NCI HC-8 revocable consent.
  zeta.aiAgents.enable.otto = true;
  # zeta.aiAgents.enable.alexa = true;  # B-0850.3a pending
  # zeta.aiAgents.enable.lior = true;   # B-0850.3d pending
  # zeta.aiAgents.enable.vera = true;   # B-0850.3c pending
  # zeta.aiAgents.enable.riven = true;  # B-0850.3b pending

  # Static IP recommended so worker nodes have a stable serverAddr.
  # Per-site override here:
  #   networking.interfaces.eth0.ipv4.addresses = [{
  #     address = "192.168.1.10";
  #     prefixLength = 24;
  #   }];
  #   networking.defaultGateway = "192.168.1.1";
  #   networking.nameservers = [ "1.1.1.1" "9.9.9.9" ];
}
