# usb-nixos-installer/nixos/installer/configuration.nix
#
# Single-file declarative installer image. Contains ONLY what's
# needed to boot a target machine and run `nixos-install --flake`
# against a host config from this repo.

{ config, pkgs, lib, modulesPath, ... }:

{
  imports = [
    "${modulesPath}/installer/cd-dvd/installation-cd-minimal.nix"
    "${modulesPath}/installer/cd-dvd/channel.nix"
  ];

  networking.hostName = "zeta-installer";
  time.timeZone = "America/New_York";
  i18n.defaultLocale = "en_US.UTF-8";

  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ];
    auto-optimise-store = true;
    trusted-users = [ "root" "nixos" ];
    substituters = [
      "https://cache.nixos.org"
      "https://nix-community.cachix.org"
    ];
    trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };

  networking.networkmanager.enable = true;
  networking.wireless.enable = lib.mkForce false;
  networking.firewall.enable = true;

  # SSH off by default; console-only install. Enable manually for
  # headless install with `sudo passwd nixos; sudo systemctl start sshd`.
  services.openssh = {
    enable = lib.mkForce false;
    settings = {
      PermitRootLogin = lib.mkForce "prohibit-password";
      PasswordAuthentication = lib.mkForce false;
      KbdInteractiveAuthentication = lib.mkForce false;
    };
  };

  users.users.nixos = {
    isNormalUser = true;
    extraGroups = [ "wheel" "networkmanager" ];
  };

  environment.systemPackages = with pkgs; [
    # Version control: pull the cluster flake onto the target
    git
    git-lfs
    gnupg
    openssh

    # Editors
    vim
    neovim
    nano

    # Shell quality of life
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

    # Network
    curl
    wget
    iproute2
    iputils
    inetutils
    dnsutils
    nmap
    tcpdump
    mtr
    ethtool
    bind
    networkmanager
    iwd
    wpa_supplicant
    openvpn
    wireguard-tools

    # Disk / partitioning / filesystems
    parted
    gptfdisk
    util-linux
    cryptsetup
    dosfstools
    e2fsprogs
    xfsprogs
    btrfs-progs
    zfs
    lvm2
    mdadm
    smartmontools

    # Hardware inspection
    pciutils
    usbutils
    lshw
    dmidecode
    hwinfo
    inxi
    lm_sensors
    nvme-cli
    hdparm

    # GPU detection (drivers come in per-host on installed system)
    glxinfo
    vulkan-tools
    clinfo

    # NixOS install tooling
    nixos-install-tools
    nix-output-monitor
    nvd
    nh
    # Declarative disk partitioning — used by the cookie-cutter
    # disko-shapes/ modules. Pre-staged on the ISO so installs
    # don't need network access just to fetch disko itself.
    # Invocation:
    #   disko --mode disko --flake /mnt/etc/zeta/full-ai-cluster#<host>
    disko

    # Secrets management
    age
    sops
    ssh-to-age

    # Build helpers
    coreutils
    findutils
    gawk
    gnused
    gnugrep
    diffutils
    patch
    gcc
    gnumake
    pkg-config

    # Observability of the install itself
    iotop
    iftop
    ncdu
    pv
    progress

    # Documentation on the stick
    man-pages
    man-pages-posix
    tldr
  ];

  isoImage = {
    isoName = lib.mkForce "zeta-installer-${config.system.nixos.release}.iso";
    volumeID = lib.mkForce "ZETA_INSTALL";
    makeEfiBootable = true;
    makeUsbBootable = true;
  };

  environment.etc."zeta-install.md".text = ''
    Zeta USB installer
    ==================

    1. Boot this USB on the target machine.
    2. Log in at the console as `root` (no password — upstream
       installer default; only usable from the local TTY).
    3. Bring up the network:
         nmtui                       # interactive, or
         nmcli device wifi connect <SSID> password <PSK>
    4. Identify the target disk:
         lsblk
    5. Partition + mount /mnt as desired.
    6. Generate hardware config:
         nixos-generate-config --root /mnt
    7. Clone the full cluster flake (or this minimal USB flake):
         git clone <git-url> /mnt/etc/zeta
    8. Install:
         nixos-install --flake /mnt/etc/zeta/full-ai-cluster#<host>
       or for USB-only:
         nixos-install --flake /mnt/etc/zeta/usb-nixos-installer#installer
    9. Reboot.
  '';

  system.stateVersion = "24.11";
}
