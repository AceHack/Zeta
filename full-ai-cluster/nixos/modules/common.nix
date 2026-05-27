# full-ai-cluster/nixos/modules/common.nix
#
# Shared baseline every cluster host imports.

{ config, pkgs, lib, stateVersion ? "25.11", ... }:

{
  # iter-5.2 (B-0792): per-node hostname injection lives in its own
  # module so every host (control-plane, worker-gpu, worker-template,
  # future configs) inherits the override capability automatically.
  # iter-5.2.2 adds login-banner.nix — shows hostname + ssh hint at
  # console pre-login per the maintainer 2026-05-26 photo-friendly
  # diagnostic discipline.
  imports = [
    ./injected-hostname.nix
    ./login-banner.nix
    # iter-5.4.0 (B-0794 homelab-mode): operator SSH pubkeys captured
    # via `gh ssh-key list` during zeta-install.sh Step 6.8. Composes
    # additively with iter-4.2 static maintainer keys.
    ./operator-authorized-keys.nix
  ];

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

  # iter-5.1 (B-0792): Avahi mDNS publishing — `<hostname>.local`
  # resolution via Bonjour (macOS) + nss-mdns (Linux peers).
  # Empirical 2026-05-27 (control-plane physical-hardware-support test):
  # mDNS alone proved unreliable — operator's Mac (en0 ethernet, also on
  # WiFi) could ping by IP + SSH but Bonjour resolution timed out;
  # unicast mDNS query to port 5353/udp also timed out from the Mac
  # even though the install completed. Multi-protocol additive
  # belt-and-suspenders below addresses the reliability gap without
  # removing the operator's preferred Bonjour-style mechanism.
  services.avahi = {
    enable = true;
    nssmdns4 = true;
    nssmdns6 = true;       # IPv6 nss-mdns alongside IPv4 (some operator
                           # macOS configs prefer AAAA queries first)
    openFirewall = true;   # firewall hole for mDNS (5353/udp)
    ipv4 = true;
    ipv6 = true;
    reflector = true;      # forward mDNS across multiple subnets (operator
                           # mac on one segment + node on another via router)
    publish = {
      enable = true;
      addresses = true;
      workstation = true;
      domain = true;
      hinfo = true;        # host info record — additional discoverability
      userServices = true; # advertise user services so dns-sd browses see node
    };
  };

  # iter-5.5 (B-0835 Bug 7 — operator 2026-05-27 reliability ask):
  # NetBIOS name resolution via Samba's nmbd as additive belt-and-
  # suspenders alongside Avahi mDNS. NetBIOS uses UDP broadcast on
  # 137 (vs mDNS multicast on 5353) — different failure modes; if
  # the network drops IGMP/multicast but allows broadcast,
  # `node-e5a176` resolves via NetBIOS where `node-e5a176.local`
  # fails via mDNS. Windows + macOS + Linux all speak NetBIOS via
  # nmblookup / smbutil / nss-winbind.
  #
  # Operator usage (from any host on the LAN):
  #   nmblookup node-e5a176          # Linux/macOS NetBIOS lookup
  #   smbutil lookup node-e5a176     # macOS native NetBIOS
  #   ping node-e5a176               # may work if nsswitch has wins
  #
  # SECURITY DISCIPLINE (P0+P1 fixes from PR #5387 Copilot review):
  # We run ONLY nmbd (NetBIOS name daemon on 137/udp + 138/udp), NOT
  # smbd (SMB file-sharing daemon on 139/tcp + 445/tcp). This is
  # genuinely "NetBIOS-only" — zero SMB attack surface:
  #   - services.samba.smbd.enable = false  (no smbd process)
  #   - services.samba.nmbd.enable = true   (nmbd ONLY)
  #   - services.samba.openFirewall = false (we control firewall manually)
  #   - networking.firewall.allowedUDPPorts = [ 137 138 ] (NetBIOS only)
  # Reviewer caught the prior `openFirewall = true` + `smb ports = "445"`
  # config that opened 139/tcp + 445/tcp despite the "name resolution
  # only" claim. Now genuinely true.
  services.samba = {
    enable = true;
    openFirewall = false;  # we open ONLY 137/138 UDP below; no SMB ports
    smbd.enable = false;   # NO SMB file-sharing daemon
    nmbd.enable = true;    # NetBIOS name daemon ONLY
    settings = {
      global = {
        "workgroup" = "ZETA";
        "server string" = "Zeta cluster node %h";
        "netbios name" = config.networking.hostName;
        "disable netbios" = "no";
        "name resolve order" = "bcast host";
      };
    };
  };

  # Explicit NetBIOS-only firewall holes (P0 fix per PR #5387 review):
  # 137/udp = NetBIOS-NS (name service queries)
  # 138/udp = NetBIOS-DGM (datagram service for browse-list announcements)
  # We do NOT open 139/tcp (NetBIOS-SSN) or 445/tcp (SMB) since smbd is
  # disabled. This is genuinely "NetBIOS name resolution only" — no SMB
  # file-share surface exposed even if smbd accidentally got re-enabled.
  networking.firewall.allowedUDPPorts = [ 137 138 ];

  # DHCP-hostname registration: NetworkManager already advertises the
  # hostname via DHCP option 12 by default. Many home routers register
  # DHCP client hostnames as DNS names (e.g., `node-e5a176.lan` from
  # Asus/Netgear/Eero). This is the 3rd reliability layer — operator's
  # router becomes a fallback name resolver for `<hostname>` and
  # `<hostname>.lan` (or `.home`/`.localdomain` depending on router).
  # No additional NixOS config needed beyond NetworkManager being on.

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

    # B-0835 fix (Aaron 2026-05-27 control-plane install): gh CLI was
    # available in the installer ISO's PATH (iter-5.4.0 used it for
    # `gh auth login` during install) but NOT in the installed system's
    # PATH after reboot. Operator empirically hit "gh: command not found"
    # on first login. The gh-auth tokens stored in ~/.config/gh during
    # install are useless without the binary. gh stays in systemPackages
    # for ongoing operator workflows (re-auth, ssh-key sync, future
    # node-register tooling).
    gh

    # iter-5.5.0 (B-0848 Phase 2, Aaron 2026-05-27): bun for the
    # node-local Claude Code agent (per .claude/rules/rule-0-no-sh-files.md
    # — bun is Zeta's canonical TS/JS runtime, NOT nodejs). claude-code
    # is published as an npm package but bun has high Node-compat AND
    # bun's `bun install --global` + `bun x` work as npm/npx replacements.
    # bun installs to /home/zeta/.bun/bin/ (per-user writable; NixOS
    # /nix/store is RO). zeta-install.sh Step 6.95 does the bun install
    # + interactive `claude login` + credential persistence + repo pre-clone.
    bun

    # iter-5.5 NetBIOS client tools — `samba` package brings
    # nmblookup/smbclient binaries so operator can query NetBIOS name
    # service from any node. The CORRESPONDING SERVER-SIDE config
    # (services.samba with nmbd-only) lands in PR #5387 (multi-protocol
    # name resolution); the two PRs compose at merge time. Until #5387
    # merges this package provides client-side tooling only — useful
    # for diagnosing OTHER nodes (or the operator's own Mac if it runs
    # nmbd) by NetBIOS name when mDNS multicast is filtered.
    # P2 fix (PR #5388 Copilot review): comment now correctly notes
    # services.samba is NOT configured in this PR; lives in #5387.
    samba
  ];

  # iter-5.5.0 (B-0848 Phase 2, Aaron 2026-05-27): user-local bun prefix
  # on PATH for all login shells so `claude` (installed via
  # `bun install --global` to /home/zeta/.bun/bin in zeta-install.sh
  # Step 6.95) is reachable without manual PATH munging on first login.
  # Per .claude/rules/rule-0-no-sh-files.md: bun is canonical TS/JS
  # runtime in Zeta (NOT nodejs).
  environment.sessionVariables = {
    BUN_INSTALL = "$HOME/.bun";
  };

  # /etc/profile.d/ snippet so $HOME-relative PATH extension happens
  # at shell-init time (NixOS sessionVariables stores literal `$HOME`
  # which wouldn't expand correctly without per-shell init).
  environment.etc."profile.d/zeta-user-paths.sh".text = ''
    # iter-5.5.0 (B-0848): include user's bun-global bin on PATH so
    # claude-code (and any other `bun install --global` user-scope
    # binaries) are reachable without manual setup.
    if [ -d "$HOME/.bun/bin" ]; then
      export PATH="$HOME/.bun/bin:$PATH"
    fi
  '';

  boot.loader = {
    systemd-boot.enable = lib.mkDefault true;
    efi.canTouchEfiVariables = lib.mkDefault true;
  };

  powerManagement.cpuFreqGovernor = lib.mkDefault "performance";

  system.stateVersion = lib.mkDefault stateVersion;
}
