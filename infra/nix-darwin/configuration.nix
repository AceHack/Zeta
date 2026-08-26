# infra/nix-darwin/configuration.nix
#
# nix-darwin host configuration for maintainer Macs (Apple Silicon).
# Activates the Linux builder VM so the canonical AI-cluster installer
# ISO build (`cd full-ai-cluster && nix build .#installer-iso`)
# works locally on Apple Silicon without manual cross-compile gymnastics.
#
# Apply on a Mac that already has Nix installed. Recommended installer:
# the Determinate Nix macOS package at <https://dtr.mn/determinate-nix>
# (handles existing /nix volume + keychain edge cases). Full setup
# walkthrough including prerequisites in
# infra/nix-darwin/README.md (this directory).
#
#   nix run nix-darwin/nix-darwin-26.05#darwin-rebuild -- switch \
#     --flake /path/to/Zeta#zeta-mac
#
# After the first switch, the canonical AI-cluster ISO builds from
# full-ai-cluster/usb-nixos-installer/ via Apple Virtualization.framework
# + Rosetta 2 — no Parallels, no Lima, no remote builder.
# (Root-flake installer-iso package retired 2026-05-26 in USB cleanup PR 2.)

{ config, pkgs, lib, ... }:

{
  # ---------------------------------------------------------------------------
  # Nix daemon settings — flakes + nix-command, trusted caches
  # ---------------------------------------------------------------------------
  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ];
    # The `admin` group on macOS (every Mac admin user is a member by
    # default) can use trusted nix operations without sudo. The
    # `@admin` syntax is nix.settings.trusted-users group-member
    # reference. Linux-builder dispatches need this.
    trusted-users = [ "@admin" ];
    substituters = [
      "https://cache.nixos.org"
      "https://nix-community.cachix.org"
    ];
    trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };

  # ---------------------------------------------------------------------------
  # THE linux-builder — the actual reason this config exists
  # ---------------------------------------------------------------------------
  # Spins up a tiny aarch64-linux NixOS VM via Apple Virtualization
  # .framework. Nix dispatches any *-linux build to it. With Rosetta
  # enabled (next block), it also handles x86_64-linux fast.
  nix.linux-builder = {
    enable = true;

    # Keep the VM warm so the first build of the day isn't slow.
    ephemeral = false;

    # Sizing tuned for the installer ISO closure (≈8 GB working set
    # during build). Concrete values declared below — bump for heavier
    # closures like building Orleans container images locally.
    maxJobs = 4;
    config = {
      virtualisation = {
        darwin-builder = {
          diskSize = 40 * 1024;   # 40 GB — big enough for ISO + caches
          memorySize = 8 * 1024;  # 8 GB RAM
        };
        cores = 6;                # 6 vCPU
      };
    };
  };

  # ---------------------------------------------------------------------------
  # Rosetta 2 inside the Linux builder VM
  # ---------------------------------------------------------------------------
  # Lets the aarch64-linux VM execute x86_64-linux binaries at near-
  # native speed (Apple's Linux Rosetta build, not just QEMU emulation).
  # Removes the need for a separate x86_64-linux remote builder.
  nix.settings.extra-platforms = [ "x86_64-linux" ];
  nix.linux-builder.supportedFeatures = [ "kvm" "benchmark" "big-parallel" ];

  # ---------------------------------------------------------------------------
  # Standard nix-darwin housekeeping
  # ---------------------------------------------------------------------------

  # `nix.useDaemon = true;` used to live here, with the note "use the
  # determinate-nixd daemon if Determinate was the installer path".
  # REMOVED for nix-darwin-26.05, which asserts on it at eval time:
  #
  #   The option definition `nix.useDaemon' ... no longer has any effect;
  #   please remove it. nix-darwin now only supports managing multi-user
  #   daemon installations of Nix.
  #
  # So the behaviour the option asked for is now the ONLY behaviour, and
  # the option is gone rather than defaulted. Deleting it is the whole
  # migration — there is no replacement setting to carry the intent to.
  # This is the single eval break the 24.11 -> 26.05 jump produced.

  # nixpkgs the system uses for its own modules. Stays separate from
  # whatever individual flakes pull in.
  nixpkgs.hostPlatform = "aarch64-darwin";

  # System packages every maintainer Mac wants. Mirrors a subset of
  # what's on the installer USB so the workflow is consistent across
  # workstation and cluster.
  environment.systemPackages = with pkgs; [
    git
    gh
    jq
    yq-go
    ripgrep
    fd
    htop
    kubectl
    kubernetes-helm
    k9s
    argocd
    age
    sops
    nix-output-monitor
    nvd
    nh
  ];

  # Required nix-darwin module hygiene — version of the module API.
  system.stateVersion = 5;
}
