# full-ai-cluster/nixos/modules/common.nix
#
# Shared baseline every cluster host imports.

{ config, pkgs, lib, stateVersion ? "24.11", ... }:

{
  # iter-5.2 (B-0792): per-node hostname injection lives in its own
  # module so every host (control-plane, worker-gpu, worker-template,
  # future configs) inherits the override capability automatically.
  imports = [ ./injected-hostname.nix ];

  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ];
    auto-optimise-store = true;
    trusted-users = [ "root" "@wheel" ];
    substituters = [
      "https://cache.nixos.org"
      "https://nix-community.cachix.org"
    ];
    trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };

  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };

  time.timeZone = lib.mkDefault "America/New_York";
  i18n.defaultLocale = "en_US.UTF-8";

  networking.networkmanager.enable = true;
  networking.firewall.enable = true;

  # iter-5.1 (B-0792): Avahi mDNS publishing so cluster nodes resolve
  # via `<hostname>.local` from operator Mac (Bonjour) + Linux peers
  # (nss-mdns) on the LAN without IP-discovery step. Without this,
  # `ssh zeta@control-plane.local` fails to resolve even though the
  # node is up. Empirical anchor: 2026-05-26 iter-4.2 PC1 test
  # surfaced the gap.
  services.avahi = {
    enable = true;
    nssmdns4 = true;
    openFirewall = true;  # firewall hole for mDNS (5353/udp)
    publish = {
      enable = true;
      addresses = true;
      workstation = true;
      domain = true;
    };
  };

  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = lib.mkDefault "prohibit-password";
      PasswordAuthentication = lib.mkDefault false;
      KbdInteractiveAuthentication = lib.mkDefault false;
    };
  };

  users.users.zeta = {
    isNormalUser = true;
    extraGroups = [ "wheel" "networkmanager" ];
  };
  security.sudo.wheelNeedsPassword = lib.mkDefault true;

  environment.systemPackages = with pkgs; [
    git vim htop btop tmux ripgrep jq yq-go curl wget rsync tree
    file unzip iproute2 iputils dnsutils nmap tcpdump mtr
    pciutils usbutils lshw nvme-cli smartmontools lm_sensors
    hwloc           # lstopo — NUMA/PCI/cache hierarchy diagrams;
                    # composes with Node Feature Discovery for
                    # precise per-node hardware inventory.
    dmidecode
    skopeo
    kubectl kubernetes-helm k9s argocd
    cilium-cli hubble
  ];

  boot.loader = {
    systemd-boot.enable = lib.mkDefault true;
    efi.canTouchEfiVariables = lib.mkDefault true;
  };

  powerManagement.cpuFreqGovernor = lib.mkDefault "performance";

  system.stateVersion = lib.mkDefault stateVersion;
}
