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

    # ── Byte-lock toolchain (Oracles 10-16 / DLA 9-substrate byte-lock) ─────────
    # All 9 compiler/runtime substrates declared in desired-state so every cluster
    # node can reproduce all byte-lock builds and run the drift check without
    # manual intervention.  The byte-lock (src/wasm-dla/bytelock/) verifies that
    # all 9 substrates produce byte-identical walker trajectories at any seed.
    # Substrates: WAT, LLVM/C, Emscripten, Rust, AssemblyScript, Zig (WASM)
    #             + JS/V8, Lua 5.4, Go (bytecode/script)
    #
    # wabt: WebAssembly Binary Toolkit -- wat2wasm, wasm2wat, wasm-validate.
    #   WAT (bare-metal) compiler substrate (697B DLA binary).
    wabt
    # binaryen: wasm-opt, wasm-as, wasm-dis -- WASM optimizer.
    #   Used by AssemblyScript (asc) for optimization passes.
    binaryen
    # emscripten: C/C++ -> WASM compiler (LLVM-based). Provides emcc.
    #   C compiler substrate (1.1KB DLA binary). Pulls llvm as a dep.
    emscripten
    # nodejs: AssemblyScript (asc) runtime host.
    #   asc is installed via pnpm (mise) but requires Node.js as the host.
    nodejs
    # zig: wasm32-freestanding compiler substrate (Oracle 11, 951B DLA binary).
    #   `zig build-exe -target wasm32-freestanding` -- no runtime overhead.
    zig
    # llvm: llc, llvm-as, opt -- LLVM IR to WASM pipeline (Oracle 13 substrate).
    #   Provides the LLVM IR layer between C source and WASM binary.
    llvm
    # Rust toolchain -- wasm32-unknown-unknown target (Oracle 12, 7.4KB opt).
    #   rustup is the canonical manager; use oxalica/rust-overlay for NixOS.
    #   wasm32 target: rustup target add wasm32-unknown-unknown
    #   NixOS: add rust-overlay to flake inputs and use:
    #     pkgs.rust-bin.stable.latest.default.override {
    #       targets = [ "wasm32-unknown-unknown" ];
    #     }
    rustup
    # go: Go WASM substrate (GOOS=js GOARCH=wasm, Oracle 16).
    #   Byte-lock harness: src/wasm-dla/bytelock/run-go-wasm.mjs
    #   Requires wasm_exec.js: cp $(go env GOROOT)/misc/wasm/wasm_exec.js bytelock/
    go
    # lua5: Lua 5.4 bytecode substrate (luac5.4 -o, Oracle 15, 2.2KB).
    #   Byte-lock harness: src/wasm-dla/bytelock/dla-canonical.lua
    #   NixOS package name: lua5 (provides lua5.4 binary)
    lua5
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
