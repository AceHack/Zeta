# infra/nixos/hosts/installer/configuration.nix
#
# Single-file declarative desired state for the USB-stick (or netboot)
# NixOS installer image used to bootstrap every machine in the AI cluster.
#
# Built by the flake at the repo root:
#     nix build .#nixosConfigurations.installer.config.system.build.isoImage
# Then `dd` the produced ISO to a USB stick, boot the target machine,
# clone this repo, and run `nixos-install --flake .#<host>` against the
# desired host config (control-plane, worker-gpu-01, ...).
#
# Scope: ONLY packages needed ON THE STICK to reach the point where
# `nixos-install` can take over and pull everything else (K3S, ArgoCD,
# Orleans, GitLab, Argo Workflows, Argo Rollouts) from the flake.
# Do NOT add cluster runtime packages here — they belong in the
# per-host modules under infra/nixos/modules/.

{ config, pkgs, lib, modulesPath, ... }:

{
  imports = [
    # Use the upstream minimal installation CD as a base.
    # Gives us a working live system, getty, nix, and the installer plumbing.
    "${modulesPath}/installer/cd-dvd/installation-cd-minimal.nix"
    "${modulesPath}/installer/cd-dvd/channel.nix"
  ];

  # ---------------------------------------------------------------------------
  # Identity
  # ---------------------------------------------------------------------------
  networking.hostName = "zeta-installer";
  time.timeZone = "America/New_York";
  i18n.defaultLocale = "en_US.UTF-8";

  # ---------------------------------------------------------------------------
  # Nix / Flakes
  # ---------------------------------------------------------------------------
  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ];
    auto-optimise-store = true;
    # Trust the live user so `nixos-install --flake` works without sudo dance
    trusted-users = [ "root" "nixos" ];
    # Big public caches so installs are fast even from the stick
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
  # Networking — wired + wireless so any machine can phone home to clone Zeta
  # ---------------------------------------------------------------------------
  networking.networkmanager.enable = true;
  networking.wireless.enable = lib.mkForce false; # NM handles wifi instead
  # Firewall ON by default. The installer ISO is a live system that often
  # boots on networks we don't control (hotel wifi, conference LAN, home
  # router with port-forwarding); leaving it firewalled keeps the install
  # session from being trivially probed.
  networking.firewall.enable = true;

  # SSH is OFF by default — installer is intended for console use. Enable
  # manually on the live system for headless installs:
  #
  #   sudo passwd nixos                # set a password first
  #   sudo systemctl start sshd        # start the service
  #
  # Key-only is enforced when enabled — never password auth, never root
  # password login. For pre-seeded headless installs, drop the maintainer
  # SSH key into `users.users.nixos.openssh.authorizedKeys.keys` here
  # before building the ISO.
  services.openssh = {
    enable = false;
    settings = {
      PermitRootLogin = lib.mkForce "prohibit-password";
      PasswordAuthentication = lib.mkForce false;
      KbdInteractiveAuthentication = lib.mkForce false;
    };
  };

  # No hard-coded credentials. The upstream installation-cd-minimal.nix
  # imported above ships with a passwordless root account usable ONLY from
  # the local console — the secure default for an ephemeral live system.
  # If you need a non-root user, set its password manually on the live
  # system with `passwd`. Sudo requires a password (default policy).
  users.users.nixos = {
    isNormalUser = true;
    extraGroups = [ "wheel" "networkmanager" ];
    # initialPassword intentionally unset — see comment above.
  };

  # ---------------------------------------------------------------------------
  # THE PACKAGE LIST — everything that must be on the USB stick
  # ---------------------------------------------------------------------------
  environment.systemPackages = with pkgs; [

    # --- Version control: pull the Zeta flake onto the target ---------------
    git
    git-lfs
    gnupg
    openssh

    # --- Editors (pick your poison; ship both, they're tiny) ----------------
    vim
    neovim
    nano

    # --- Shell quality of life ----------------------------------------------
    bash
    zsh
    tmux
    screen
    htop
    btop
    tree
    ripgrep
    fd
    fzf
    bat
    eza
    jq
    yq-go
    less
    file
    which
    unzip
    zip
    p7zip
    rsync

    # --- Network: reach the internet, GitHub, and the local LAN -------------
    curl
    wget
    iproute2          # ip(8)
    iputils           # ping
    inetutils         # traceroute, telnet
    dnsutils          # dig, nslookup
    nmap
    tcpdump
    mtr
    ethtool
    bind              # host
    networkmanager    # nmcli/nmtui
    iwd               # wifi backend for NM
    wpa_supplicant    # fallback wifi
    openvpn           # in case the install network needs VPN
    wireguard-tools

    # --- Disk / partitioning / filesystems ----------------------------------
    parted
    gptfdisk          # sgdisk
    util-linux        # fdisk, lsblk, blkid, wipefs
    cryptsetup        # LUKS for encrypted root
    dosfstools        # FAT32 for EFI
    e2fsprogs         # ext4
    xfsprogs
    btrfs-progs
    zfs               # ZFS root is common on NixOS AI rigs
    lvm2
    mdadm             # software RAID
    smartmontools     # disk health before committing

    # --- Hardware inspection (know your machine before installing) ----------
    pciutils          # lspci
    usbutils          # lsusb
    lshw
    dmidecode
    hwinfo
    inxi
    lm_sensors
    nvme-cli
    hdparm

    # --- GPU detection (NVIDIA + AMD; drivers come in per-host gpu.nix) -----
    glxinfo
    vulkan-tools
    clinfo

    # --- NixOS install tooling (already in the base image, listed for
    #     discoverability) ---------------------------------------------------
    nixos-install-tools
    nix-output-monitor    # `nom` — prettier nix build output
    nvd                   # nix version diff
    nh                    # friendly nixos rebuild wrapper

    # --- Kubernetes / GitOps clients on the stick so you can poke a
    #     just-installed control plane from the live USB before reboot ------
    kubectl
    kubernetes-helm
    k9s
    argocd                # ArgoCD CLI
    k3s                   # binary present so the installer can pre-seed if wanted

    # --- Container runtime tooling (debug only on the stick) ----------------
    skopeo
    crane

    # --- Secrets management (so encrypted secrets in the flake can be
    #     decrypted during install) -----------------------------------------
    age
    sops
    ssh-to-age

    # --- Build-time helpers you'll inevitably want -------------------------
    coreutils
    findutils
    gawk
    gnused
    gnugrep
    diffutils
    patch
    gcc                   # bootstrap compiler if a flake input needs it
    gnumake
    pkg-config

    # --- Observability of the install itself --------------------------------
    iotop
    iftop
    ncdu
    pv
    progress

    # --- Documentation on the stick (no internet? still readable) -----------
    man-pages
    man-pages-posix
    tldr
  ];

  # ---------------------------------------------------------------------------
  # ISO branding
  # ---------------------------------------------------------------------------
  isoImage = {
    isoName = lib.mkForce "zeta-installer-${config.system.nixos.release}.iso";
    volumeID = lib.mkForce "ZETA_INSTALL";
    makeEfiBootable = true;
    makeUsbBootable = true;
  };

  # Install-runbook baked onto the stick at /etc/zeta-install.md so it's
  # reachable from the live system even when offline.
  #
  # NOTE: this writes documentation only. The Zeta flake itself is NOT
  # auto-staged on the ISO — clone it from network during install
  # (`git clone https://github.com/Lucent-Financial-Group/Zeta /mnt/etc/zeta`).
  # An always-on flake-bundling pass would require build-time access to
  # the flake source from this module's evaluation, which a future
  # `flake.nix` at the repo root will wire via `imports = [ ./infra/... ]`
  # plus `environment.etc."zeta".source = inputs.self;` — track in a
  # follow-up PR.
  environment.etc."zeta-install.md".text = ''
    Zeta cluster installer
    ======================

    1. Boot this USB on the target machine.
    2. Log in at the console as `root` (no password — upstream installer
       default; only usable from the local TTY).
    3. Bring up the network (NetworkManager is enabled):
         nmtui                 # interactive, or
         nmcli device wifi connect <SSID> password <PSK>
    4. Identify the target disk:
         lsblk
    5. Clone Zeta onto /mnt/etc/zeta after partitioning:
         git clone https://github.com/Lucent-Financial-Group/Zeta /mnt/etc/zeta
    6. Generate hardware config for this machine:
         nixos-generate-config --root /mnt
       (commit the resulting hardware-configuration.nix as a per-host
        artifact under infra/nixos/hosts/<host>/ when those land.)
    7. Install:
         nixos-install --flake /mnt/etc/zeta#<host>
       — where <host> is one of the names declared in the repo-root
         `flake.nix` `nixosConfigurations`. (Today: `installer` only;
         per-host configs land in follow-up PRs.)
    8. Reboot. K3S, ArgoCD, Orleans land automatically from the flake.

    The flake itself is the tick source. Everything downstream reconciles
    toward the desired state declared in Git.
  '';

  # NixOS release that this installer targets.
  system.stateVersion = "24.11";
}
