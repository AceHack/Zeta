# infra/nixos/modules/common.nix
#
# Shared baseline imported by every cluster host (control-plane + workers).
# Things that should be true on every Zeta machine go here; anything host-
# specific belongs in infra/nixos/hosts/<host>/configuration.nix.

{ config, pkgs, lib, stateVersion, ... }:

{
  # ---------------------------------------------------------------------------
  # Nix + Flakes
  # ---------------------------------------------------------------------------
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

  # Garbage-collect old generations so disk doesn't fill up over time.
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };

  # ---------------------------------------------------------------------------
  # Locale + time
  # ---------------------------------------------------------------------------
  time.timeZone = lib.mkDefault "America/New_York";
  i18n.defaultLocale = "en_US.UTF-8";

  # ---------------------------------------------------------------------------
  # Networking baseline
  # ---------------------------------------------------------------------------
  networking.networkmanager.enable = true;
  networking.firewall.enable = true;

  # ---------------------------------------------------------------------------
  # SSH — key-only, no root password
  # ---------------------------------------------------------------------------
  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = lib.mkDefault "prohibit-password";
      PasswordAuthentication = lib.mkDefault false;
      KbdInteractiveAuthentication = lib.mkDefault false;
    };
  };

  # ---------------------------------------------------------------------------
  # Users — admin user with key-only access
  # ---------------------------------------------------------------------------
  # Per-host configs add their own users + SSH keys via:
  #   users.users.zeta.openssh.authorizedKeys.keys = [ "ssh-ed25519 AAA..." ];
  users.users.zeta = {
    isNormalUser = true;
    extraGroups = [ "wheel" "networkmanager" ];
    # Password must be set manually after install (`sudo passwd zeta`)
    # or pre-seeded via `users.users.zeta.hashedPasswordFile = ...`.
    # No initialPassword — no known-credential exposure.
  };
  security.sudo.wheelNeedsPassword = lib.mkDefault true;

  # ---------------------------------------------------------------------------
  # Baseline packages every machine should have
  # ---------------------------------------------------------------------------
  environment.systemPackages = with pkgs; [
    # Core CLI
    git
    vim
    htop
    btop
    tmux
    ripgrep
    jq
    yq-go
    curl
    wget
    rsync
    tree
    file
    unzip

    # Network diagnostics
    iproute2
    iputils
    dnsutils
    nmap
    tcpdump
    mtr

    # Disk / hardware introspection
    pciutils
    usbutils
    lshw
    nvme-cli
    smartmontools
    lm_sensors

    # Container introspection (useful even when not running k3s on this host)
    skopeo

    # Kubernetes clients (admin from any host)
    kubectl
    kubernetes-helm
    k9s

    # ── WASM toolchain (Oracle 10 / DLA multi-compiler substrate) ──────────────
    # All four WASM compilers declared in desired-state so every cluster node
    # can reproduce the Oracle 10 build without manual intervention.
    # Rationale: Conjecture Z-7 (binary_size ⊥ D_f) requires all compilers
    # to be available for re-verification at any time on any host.
    #
    # wabt: WebAssembly Binary Toolkit — wat2wasm, wasm2wat, wasm-validate.
    #   Provides the WAT (bare-metal) compiler substrate (979-byte DLA binary).
    wabt
    # binaryen: wasm-opt, wasm-as, wasm-dis — WASM optimizer.
    #   Used by AssemblyScript (asc) for optimization passes.
    binaryen
    # emscripten: C/C++ → WASM compiler (LLVM-based). Provides emcc.
    #   Fourth WASM compiler substrate. Pulls llvm as a dep.
    emscripten
    # nodejs: AssemblyScript (asc) runtime host.
    #   asc is installed via pnpm (mise) but requires Node.js as the host.
    nodejs
  ];

  # ---------------------------------------------------------------------------
  # Boot — systemd-boot UEFI by default; per-host can override for BIOS
  # ---------------------------------------------------------------------------
  boot.loader = {
    systemd-boot.enable = lib.mkDefault true;
    efi.canTouchEfiVariables = lib.mkDefault true;
  };

  # ---------------------------------------------------------------------------
  # Power management
  # ---------------------------------------------------------------------------
  powerManagement.cpuFreqGovernor = lib.mkDefault "performance";

  # ---------------------------------------------------------------------------
  # NixOS release this baseline targets. Per-host configs inherit unless
  # they explicitly override (which they generally shouldn't).
  # ---------------------------------------------------------------------------
  system.stateVersion = lib.mkDefault stateVersion;
}
