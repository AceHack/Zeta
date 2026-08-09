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
    # 081KZETP6AT: FHS loader (nix-ld) for foreign dynamically-linked ELFs. The
    # live ISO is where zeta-install.sh Step 6.95a runs `tools/setup/install.sh`,
    # and mise's prebuilt toolchains (bun/node/python/rust/java/dotnet) cannot
    # execve without an interpreter — the deterministic first-boot failure.
    ../modules/foreign-binaries.nix
  ];

  networking.hostName = "zeta-installer";
  time.timeZone = "America/New_York";
  i18n.defaultLocale = "en_US.UTF-8";

  # Enable serial console output alongside VGA tty1.
  # Two use cases:
  #   1. CI QEMU boot smoke-test (USB cleanup PR 3 cascade #5 per PR
  #      #5322) captures serial output to verify the installer boots
  #      to login. Without console=ttyS0, the cascade test times out
  #      because all systemd/getty output goes to VGA only (which
  #      QEMU's -display none hides).
  #   2. Real hardware with serial headers (some Beelinks; most
  #      server-class boards; debugging scenarios where the only
  #      output is RS-232) can capture installer output too.
  # tty1 stays primary (VGA console for the keyboard-attached install
  # flow); ttyS0 is mirrored secondary at 115200 8N1 (standard).
  boot.kernelParams = [
    "console=ttyS0,115200n8"
    # aarch64 (QEMU -machine virt / Pi): the PL011 serial is ttyAMA0,
    # not ttyS0. Each arch ignores the console= naming a UART it does
    # not have, so listing both keeps ONE config for both ISOs
    # (B-1024 slice 1). tty1 stays last = primary /dev/console.
    "console=ttyAMA0,115200n8"
    "console=tty1"
  ];

  # B-0754 iter-3 hardware-firmware cleanup: enable redistributable
  # firmware on the installer (Intel SoF / linux-firmware). Without
  # this, modern Intel chipsets (Meteor Lake / Lunar Lake / Arrow
  # Lake) print scary `ASoC: failed to instantiate card -2` /
  # `snd_soc_register_card failed -2` errors during boot because
  # their HD Audio Controller probes a SoundWire codec topology that
  # needs SoF firmware blobs. Cosmetic — audio is not load-bearing
  # for cluster substrate — but per B-0759 first-time-CLI-user
  # persona, scary 'ERROR' lines in dmesg are UX noise we don't
  # need. Redistributable-only (no allowUnfree needed); ~80MB
  # added to ISO; covers WiFi/BT/NIC firmware too as a side benefit.
  hardware.enableRedistributableFirmware = true;

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
    # iter-5.4.0 (B-0794 homelab-mode): operator authenticates at
    # install time via `gh auth login`; `gh ssh-key list` extracts
    # operator's SSH pubkeys for injection into authorized_keys per
    # the Mika 2026-05-26 homelab-first substrate ("USB ships with NO
    # embedded credentials; first boot prompts gh auth login").
    gh

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
    # File-backed zflash image substrate: mcopy writes ESP payloads
    # into raw QEMU boot images without mounting physical USB devices.
    mtools
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
    hwloc       # lstopo — visualize NUMA / PCI / cache hierarchy
                # BEFORE install so disk-by-id picks + GPU socket
                # assignments are informed by the real topology.

    # GPU detection (drivers come in per-host on installed system)
    mesa-demos
    vulkan-tools
    clinfo

    # NixOS install tooling
    nixos-install-tools
    nix-output-monitor
    nvd

    # iter-5.3 prompt-password substrate (zeta-install.sh Step 6.55):
    # mkpasswd is provided by the `mkpasswd` nixpkgs package; needed
    # at install-time to hash the operator-typed password before
    # writing to /mnt/etc/zeta/initial-hashedpassword.
    mkpasswd
    nh
    # iter-5.5.0 (B-0848): target bootstrap (zeta-install.sh Step 6.95a)
    # runs tools/setup/install.sh on the live ISO as the zeta user. Nix-provided
    # mise is required — upstream release tarballs are not FHS-compatible on NixOS.
    mise
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

    # Guided install script — greedy N-disk: enumerates ALL internal
    # disks (NVMe / SATA SSD / HDD / SAS), sorts by speed class, OS on
    # the fastest as ESP + root + longhorn1, every other disk becomes
    # one whole-disk longhorn{2..N}. Single-disk through arbitrary-N
    # supported. Lives in the installer's PATH as `zeta-install`.
    # Source lives at full-ai-cluster/usb-nixos-installer/zeta-install.sh
    # in the repo and is baked into the ISO via the writeShellScriptBin
    # below.
    (writeShellScriptBin "zeta-install"
      (builtins.readFile ../../zeta-install.sh))

    # First-boot auto-install wrapper (B-0754 zero-typing scope):
    # waits for ethernet DHCP, auto-launches nmtui if no ethernet
    # internet, then execs zeta-install non-interactively. Invoked by
    # the zeta-first-boot.service systemd unit on tty1 right after
    # boot when /etc/zeta-firstboot-enabled is present.
    (writeShellScriptBin "zeta-first-boot"
      (builtins.readFile ../../zeta-first-boot.sh))
  ];

  # ── B-0754 zero-typing first-boot auto-install ──────────────────────
  #
  # Default config baked into the ISO: HOST defaults to control-plane
  # (first node of a fresh cluster). Override per-ISO at build time by
  # patching this file, or per-flash later via the zflash `--role` flag
  # (B-0754 v2 scope).
  environment.etc."zeta-firstboot.conf".text = ''
    # zeta-first-boot config — read by /run/current-system/sw/bin/zeta-first-boot
    # at first boot of the installer ISO. Lines are sourced as bash.
    HOST=control-plane
    REPO_URL=https://github.com/Lucent-Financial-Group/Zeta
    ETHERNET_WAIT_SECS=30
  '';

  # Marker file: presence enables the first-boot service. Absent on the
  # *installed* host (this config only ships on the live ISO), so the
  # service can't accidentally re-fire on the freshly installed system.
  environment.etc."zeta-firstboot-enabled".text = "1";

  # Replace the standard getty@tty1 with the first-boot installer so
  # the operator sees the install banner immediately on boot — no
  # need to log in first. Other ttys (tty2-tty6) retain normal getty
  # for manual recovery / parallel work.
  systemd.services."getty@tty1".enable = lib.mkForce false;
  systemd.services.zeta-first-boot = {
    description = "Zeta installer first-boot auto-install (B-0754)";
    wantedBy = [ "multi-user.target" ];
    after = [ "systemd-user-sessions.service" "NetworkManager.service" ];
    conflicts = [ "getty@tty1.service" ];
    # B-0754 iteration-2 PATH fix: systemd services on NixOS get a
    # minimal PATH by default (coreutils + findutils + grep + sed +
    # systemd); bare commands (clear, nmtui, ping, etc.) outside that
    # set failed with 'command not found' on first real-hardware run.
    # NixOS systemd module already defines a default PATH at
    # mkOptionDefault priority; use lib.mkForce to replace with the
    # union that includes /run/current-system/sw/bin and
    # /run/wrappers/bin so every tool in environment.systemPackages
    # is reachable + setuid wrappers work. TERM=linux so any tput-
    # based tools (curses TUIs like nmtui) get a sane terminal
    # capability database without per-invocation setup.
    environment = {
      PATH = lib.mkForce "/run/current-system/sw/bin:/run/current-system/sw/sbin:/run/wrappers/bin";
      TERM = "linux";
    };
    serviceConfig = {
      Type = "idle";
      ExecStart = "/run/current-system/sw/bin/zeta-first-boot";
      StandardInput = "tty";
      # tty1 for the operator; zeta-first-boot.sh tees the same stream to
      # /dev/ttyS0 (x86) or /dev/ttyAMA0 (aarch64) so QEMU serial (B-0891)
      # sees [iter-5.1] + retention markers (/dev/console is tty1 here).
      StandardOutput = "tty";
      StandardError = "tty";
      TTYPath = "/dev/tty1";
      TTYReset = true;
      TTYVHangup = true;
      Restart = "no";
      # Run as root so the script can invoke disko, sudo-class
      # operations, etc. The ISO already grants root via wheel/sudo.
      User = "root";
    };
    # Only fire when the marker file is present (always on live ISO).
    unitConfig = {
      ConditionPathExists = "/etc/zeta-firstboot-enabled";
    };
  };

  isoImage = {
    isoName = lib.mkForce "zeta-installer-${config.system.nixos.release}.iso";
    volumeID = lib.mkForce "ZETA_INSTALL";
    makeEfiBootable = true;
    makeUsbBootable = true;
  };

  environment.etc."zeta-install.md".text = ''
    Zeta USB installer
    ==================

    DEFAULT (zero-typing on ethernet-DHCP, single TUI on wifi):
      Boot the USB. The first-boot service auto-launches on tty1:
        - 10-sec keystroke prompt: 'c' control-plane / 'w' worker-gpu
          (timeout accepts default from /etc/zeta-firstboot.conf)
        - Waits up to 30s for ethernet DHCP + internet
        - If no ethernet internet, auto-launches nmtui for wifi
        - Once online, runs zeta-install non-interactively
        - Reboots when install completes
      Total typing: 0 commands (ethernet-DHCP) or 1 nmtui form (wifi).

    MANUAL OVERRIDE (recovery / debug):
      Switch to tty2 (Ctrl-Alt-F2) to bypass the first-boot service
      and get a normal login. Then:
        nmtui                                 # network if needed
        zeta-install <host>                   # greedy N-disk guided install
                                              # (any combo of NVMe/SSD/HDD)
      Or fully manual (zero-disk machines, advanced layouts):
        lsblk                                 # pick disks
        # partition + mkfs + mount /mnt manually
        nixos-generate-config --root /mnt
        git clone <git-url> /mnt/etc/zeta
        nixos-install --flake /mnt/etc/zeta/full-ai-cluster#<host>

    Reboot when done.
  '';

  system.stateVersion = "25.11";
}
