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
    # 081KSNY2Z0008QG0R0008PN7RQ scenario 5: the same injection shape for the
    # k3s join endpoint, so a flashed joiner dials the founder it was actually
    # pointed at instead of k3s-agent.nix's build-time default. No-op on hosts
    # with no /etc/zeta/cluster-join-server-url and on every k3s server.
    ./injected-join-server.nix
    # 081KSNY2Z0008QG0R0008PN7RQ `joining-node-address-assignment`: the join
    # endpoint above is a NAME, and the cluster segment has no DHCP and no DNS
    # to turn it into an address. This module applies the static addressing
    # zflash derived from the role and injects the `control-plane -> <ip>`
    # /etc/hosts entry that `k3s-server.nix` calls "the robust path". No-op on
    # hosts with no /etc/zeta/cluster-segment-* files — they keep DHCP.
    ./injected-cluster-address.nix
    # ONE NODE FOUNDS; EVERY OTHER ONE JOINS. `injected-join-server.nix` above
    # covers AGENTS only (it guards itself to `role == "agent"`), so a machine
    # flashed from the `control-plane` config founded its OWN cluster no matter
    # what the medium said -- the defect whose signature is two k3s CAs on one
    # LAN with founding epochs twelve days apart. This module is the server
    # half: endpoint + token present => join; either absent => refuse at eval;
    # both absent => byte-identical to today's sovereign-by-default founding.
    ./injected-server-join.nix
    # The runtime half of the same story. k3s IGNORES --cluster-init/--server/
    # --token-file when a datastore already exists on disk, so a declarative
    # join is a SILENT no-op on a re-flash that did not wipe. This unit refuses
    # to let k3s start in that state, prints why on console and serial, and
    # deletes nothing. No-op on a from-scratch flash, which is the normal case.
    ./k3s-datastore-preflight.nix
    # The cluster's pod/service CIDRs, DERIVED from `cluster-identity.json`
    # instead of hardcoded 10.42/10.43 on every node ever flashed. Contributes
    # options plus three assertions (name shape; the two Cilium manifests agree
    # with the derived pod CIDR) -- no service, no unit, no boot-path change.
    ./cluster-network.nix
    # 081KSE6WT0008QG0R000CV98PV (R3 of the USB design document): the PUBLISHER
    # half of bootstrap-or-join. A control plane advertises `_zeta-k3s._tcp`
    # so a booting node can tell "there is already a cluster here" from "there
    # is not" -- the distinction that today only a 10-second keystroke makes.
    #
    # No-op on agents: the module guards its config to `services.k3s.role ==
    # "server"`, so a worker imports the options and contributes nothing.
    ./cluster-discovery-advertise.nix
    ./login-banner.nix
    # 081M00KTH58087G0R00120WT6F: the option surface for Secure Boot desired
    # state. At its default phase ("off") it sets NO boot option and contributes
    # one always-true assertion, so this import leaves the boot path byte-for-byte
    # unchanged. What it buys is that every host EVALUATES the option on
    # `nix flake check`, and that any future non-"off" phase fails closed on the
    # missing key-custody decision rather than quietly enabling an unbuilt path.
    ./secure-boot.nix
    # 2026-08-21 hands-off-metal scoping: the option surface for TPM-2.0-backed
    # seal provisioning. At its default mode ("off") it sets NO option and
    # contributes one always-true assertion, so this import leaves every host
    # byte-for-byte unchanged. What it buys is that every host EVALUATES the
    # option on `nix flake check`, and that mode = "provision" fails closed on
    # the undecided seal-key custody fork rather than quietly minting a key
    # whose loss would be unrecoverable. Mode "prereqs" is the safe rung and is
    # the whole of what the installer can pre-stage.
    ./tpm2-seal-prereqs.nix
    # 081KZETP6AT: FHS loader (nix-ld) for foreign dynamically-linked ELFs — mise's
    # prebuilt toolchains and the vendor agent CLIs. Needed on INSTALLED nodes too,
    # not only on the ISO: the lazy first-login `mise install` recovery in this file
    # fails identically post-reboot without a loader.
    # Lives under usb-nixos-installer/ so BOTH flake roots can reach it:
    # usb-nixos-installer/flake.nix has its own root + installer-iso output, and a
    # path escaping that root fails to evaluate there (Kira + Mateo, PR #10196).
    # This path stays inside full-ai-cluster/ (the parent flake root), so both work
    # off ONE definition — no duplicated library list to drift.
    ../../usb-nixos-installer/nixos/modules/foreign-binaries.nix
    # Longhorn node prerequisites (open-iscsi + nfs). Without these every
    # `longhorn` PVC stays Pending and the whole stateful layer is dead.
    # Imported here so control-plane AND workers get them uniformly.
    ./longhorn-prereqs.nix
    # Longhorn per-node DISK SET. Imported here, not only by the multi-disk
    # hosts, because the chart runs with createDefaultDiskLabeledNodes=true:
    # Longhorn then creates a default disk ONLY on nodes carrying
    # `node.longhorn.io/create-default-disk`. An unlabelled node gets NO disk
    # at all -- which would silently reproduce the 62-day outage on
    # control-plane, the host the USB actually installs. Caught before merge
    # on PR #12175: the multi-disk VM test passed precisely because it imports
    # this module, while control-plane did not.
    #
    # zeta.longhorn.dataDisks derives from the host's declared Longhorn
    # mounts and falls back to [ "/var/lib/longhorn" ] when none exist
    # (the committed control-plane placeholder). A host that only imports
    # this file therefore still gets labelled and the annotator oneshot
    # still fires. Multi-disk hosts extend the list via fileSystems or
    # the disko shape.
    ./longhorn-disks.nix
    # Cilium WireGuard node prerequisites (the wireguard kernel module + wg for
    # diagnosis) plus the boot-time preflight that says whether they took.
    # k8s/bootstrap/cilium-install.yaml installs Cilium with
    # encryption.type=wireguard at FIRST BOOT, and the ArgoCD Application
    # re-asserts it at sync-wave -80; on a kernel that cannot create a WireGuard
    # device cilium-agent refuses to initialise and this node has no CNI at all.
    # Imported here so control-plane AND workers get it uniformly -- node-to-node
    # encryption is a property of the PAIR, so one node missing the prerequisite
    # is a cluster-wide fact.
    ./cilium-wireguard-prereqs.nix
    # iter-5.4.0 (B-0794 homelab-mode): operator SSH pubkeys captured
    # via `gh ssh-key list` during zeta-install.sh Step 6.8. Composes
    # additively with iter-4.2 static maintainer keys.
    ./operator-authorized-keys.nix
    # B-0850 Phase 3 refactor: parameterized multi-vendor AI agent
    # systemd module. Replaces the Phase 1 zeta-otto.nix module with
    # a generalization that supports ≥3 vendor-diverse AI personas
    # (otto/alexa/riven/vera/lior) as independent systemd services.
    # Operator opt-in per-persona via
    # `zeta.aiAgents.personas.<persona>.enable = true;`. Disabled by
    # default at module level. Composes with iter-5.5.0 install-time
    # substrate (PR #5388 + #5389) which persists credentials + pre-
    # clones repo + installs CLI binaries via mise-managed bun.
    # Per-vendor implementation lands via B-0850 Phase 3 sub-rows
    # (3a-3h) that add install + login flows for each vendor's CLI.
    ./zeta-ai-agent.nix
    # B-0855.1: post-install first-boot self-registration service.
    # Disabled by default until host configs opt in after B-0855.2
    # ships the TS implementation; imported here so every node type
    # has the same module surface.
    ./zeta-self-register.nix
    # B-0891 slice 3: post-login first-session credential adventure (profile.d).
    # Runs once on interactive zeta login; gh auth load-bearing for self-register.
    ./zeta-first-session.nix
    # B-0852.4a/d: boot-time credential restore from ESP.
    #
    # 2026-05-27 (B-0852.4 default-on flip): now enabled by default
    # across all hosts with passphraseMode = "interactive". The unit's
    # ConditionPathExists guard (blob + uuid + script + bun shim) means
    # first boot before any cred-blob exists is a clean no-op; on
    # subsequent boots the unit fires + systemd-ask-password prompts
    # the operator ONCE for the passphrase + the restore CLI populates
    # /home/zeta/.config/{gh,claude,gemini,codex} from the encrypted
    # blob on the USB ESP. This closes the operator pain point named
    # 2026-05-27: "i'm witing on the tool to be resable so i don't
    # have to enter credentals over and over everytime."
    #
    # Composes with the install-side substrate cascade (PRs #5637 +
    # #5638 + #5639) that wires Step 6.56 passphrase prompt +
    # iter-4.2 USB-UUID capture + default-on picker. Once all those
    # install-side preconditions are met + first install completes
    # with cred-blob written to /esp/zeta-creds.enc, every subsequent
    # boot of the installed system fires the restore service.
    #
    # Composes with B-0855.1 zeta-self-register (which already
    # declares `after = "zeta-creds-restore.service"`) so cred-restore
    # fires BEFORE self-register on each boot.
    #
    # Per-host opt-out: set `zeta.credsRestore.enable = false;` in
    # that host's configuration.nix. Per-host passphraseMode override:
    # `zeta.credsRestore.passphraseMode = "file";` for nodes where
    # tty1 interactive prompt is inappropriate (e.g., headless +
    # pre-staged `/run/zeta-creds-passphrase`).
    ./zeta-creds-restore.nix
  ];

  # B-0852.4 default-on flip (operator pain point closure 2026-05-27).
  # Both options use lib.mkDefault so per-host configs may override
  # without conflict warnings.
  zeta.credsRestore = {
    enable = lib.mkDefault true;
    passphraseMode = lib.mkDefault "interactive";
  };

  # B-0855.2: every node self-registers on first boot (opens a
  # maintainers/<gh-user>/cluster-nodes/<host> PR) once cred-restore has put gh
  # auth back. Idempotent; per-host opt-out: zeta.selfRegister.enable = false;
  zeta.selfRegister.enable = lib.mkDefault true;

  # B-0891 slice 3: numbered menu by default; set useLlm = true for Ollama chooser.
  zeta.firstSession.enable = lib.mkDefault true;

  # B-0831 slice 1 phase-2 / B-0891 scenario 2: qemu-full-install-test boots
  # the installed disk with -serial file: and polls for "<hostname> login:".
  # Installer ISO has these params (PR #5324); installed nodes must mirror them
  # or phase-2 serial capture is empty and the harness times out. systemd
  # getty-generator spawns serial-getty@ from console= kernel params.
  boot.kernelParams = [
    "console=ttyS0,115200n8"
    "console=ttyAMA0,115200n8"
    "console=tty1"
    # Headless QEMU phase-2 (B-0891): avoid fbcon/GPU stall with -display none.
    "nomodeset"
    # Early printk to the same 8250 UART as -serial file: (q35 COM1 / ttyS0).
    "earlycon=uart8250,io,0x3f8,115200n8"
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
    # File-backed zflash image substrate: mcopy writes ESP payloads
    # into raw QEMU boot images without touching physical /dev disks.
    mtools
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

    # iter-5.5.0 (B-0848 Phase 2, operator 2026-05-27 ALIGNMENT catch):
    # `mise` is Zeta's canonical runtime version manager — the .mise.toml
    # at repo root pins bun = "1.3" + dotnet + python = "3.14" + java +
    # uv + actionlint + shellcheck + node + markdownlint-cli2 for ALL
    # contexts (dev laptops + CI runners + devcontainers per GOVERNANCE
    # §24 three-way parity). Cluster nodes inherit the SAME runtime
    # pins via mise reading the same .mise.toml — single source of truth.
    #
    # Earlier draft of this PR added `bun` directly via nixpkgs which
    # DRIFTED from the .mise.toml-pinned bun = "1.3" (would have run
    # whatever bun version nixpkgs ships — could mismatch dev). Operator
    # caught: "we already do this we've drifted for nixos for some
    # reason for bun".
    #
    # zeta-install.sh Step 6.95a now invokes the canonical entry
    # `tools/setup/install.sh` from the pre-cloned Zeta repo (which
    # detects Linux, dispatches to linux.sh, which detects NixOS via
    # /etc/NIXOS marker file and routes directly to common/mise.sh).
    # Mise then installs bun + all other .mise.toml runtimes for the
    # zeta user. Agent/peer CLIs are then installed by
    # mechanisms/from-bun-global.sh from tools/setup/manifests/from-bun-global,
    # using the mise-managed bun. NixOS stays declarative for system
    # packages; install.sh stays canonical for repo/toolchain runtime
    # and agent CLI drift.
    mise

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

  # iter-5.5.0 (B-0848 Phase 2, operator 2026-05-27 ALIGNMENT catch):
  # PATH setup for both mise-managed runtimes AND bun's --global prefix.
  # mise puts shims at ~/.local/share/mise/shims/ (which activation does
  # NOT auto-prepend without `--shims` — corrected 2026-08-23, see the
  # profile.d note below), AND bun's `bun install --global` lands binaries
  # at ~/.bun/bin/ (where claude-code ends up). Both need to be on PATH.
  environment.sessionVariables = {
    BUN_INSTALL = "$HOME/.bun";
  };

  # /etc/profile.d/ snippet: mise activation + bun global bin.
  # bun --global writes binaries to ~/.bun/bin/ which we add explicitly.
  # $HOME expansion happens at shell-init time when this file sources.
  #
  # CORRECTION 2026-08-23 (measured, Aaron's `op` report). The comment here
  # and above used to claim "mise activate writes shims to
  # ~/.local/share/mise/shims/ and adds them to PATH automatically". That is
  # FALSE for `mise activate` WITHOUT `--shims`: it rewrites PATH per
  # directory from the nearest .mise.toml and never puts the shims dir on
  # PATH. Measured in a login shell: the shims dir appeared 0 times in PATH.
  #
  # The consequence was Aaron's live report — from `~` on a host, `op` was
  # "command not found", while inside the checkout it resolved to the pinned
  # 2.34.1. On a DEVELOPER WORKSTATION that is correct and deliberate (the
  # pin travels with the project, exactly like a local `dotnet tool` manifest
  # or node_modules/.bin — Aaron: "it's like local scoped dotnet or npm …
  # that works great we don't need to global"). tools/setup/common/shellenv.sh
  # is therefore UNCHANGED.
  #
  # A CLUSTER NODE IS THE OTHER HOST CLASS, and here it is a real gap. A node
  # bootstrapping shared secrets is not sitting in the checkout — it is a
  # login shell in $HOME or a systemd unit — so project-scoped resolution has
  # nothing to scope to. Aaron 2026-08-22: "for the linux real hardware we
  # might need it global for op". The rest of this module already works around
  # it by hardcoding the shims dir into unit PATHs (zeta-ai-agent.nix,
  # zeta-creds-restore.nix, zeta-first-session.nix, zeta-install.sh — 11 call
  # sites); this snippet was the one place still relying on the false belief.
  #
  # BOTH lines below are required, and shims alone is NOT enough — measured:
  #   shims on PATH only          -> `op` runs and FAILS:
  #                                  "mise ERROR No version is set for shim: op"
  #   shims + MISE_GLOBAL_CONFIG_FILE -> `op --version` => 2.34.1
  # The shim dispatches back to mise, and outside a project mise has no config
  # declaring the tool. Pointing mise's GLOBAL config at the node's own Zeta
  # checkout supplies one WITHOUT duplicating the pin: the version still comes
  # from .mise.toml:114 ("1password-cli" = "2.34.1"), the single source of
  # truth. The rejected alternative is `mise use -g` (or a nixpkgs
  # `_1password-cli`), either of which forks the version and drifts — the
  # exact mistake Aaron already caught on this file for bun ("we already do
  # this we've drifted for nixos for some reason for bun", see the `mise`
  # entry in systemPackages above).
  #
  # Shims are APPENDED, not prepended, so inside the checkout `mise activate`'s
  # direct install paths still win and keep the fast path (measured 100 x
  # `op --version`: direct 1.47s vs shim 5.98s, ~4x).
  #
  # INTERIM, AND DELIBERATELY LABELLED AS SUCH. This exists because 1Password
  # is currently how shared secrets reach a node — Aaron: "not sure if that's
  # how we are going to share shared secrets until we have a decentralized way
  # of doing it". A node that must route through one vendor to boot has no
  # exit, which is an APPOINTED HUB under manifesto §1 and
  # .claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md. The
  # decentralized replacement is `proposed` only and is NOT designed here; it
  # belongs to the decentralized-identity-server lane. Tracked:
  # workitems/081M0QS0ET7087G0R000YBRKNT-*.md (081M0QS0ET7087G0R000YBRKNT)
  environment.etc."profile.d/zeta-user-paths.sh".text = ''
    # iter-5.5.0 (B-0848): mise + bun PATH setup for the zeta user.
    # mise activate sets up shims for all .mise.toml runtimes (bun,
    # node, dotnet, python, java, uv, actionlint, shellcheck, etc.)
    if command -v mise >/dev/null 2>&1; then
      export MISE_PYTHON_GITHUB_ATTESTATIONS="''${MISE_PYTHON_GITHUB_ATTESTATIONS:-0}"
      _zeta_repo=""
      if [ -f /etc/zeta/.mise.toml ]; then
        _zeta_repo="/etc/zeta"
      elif [ -f "$HOME/Zeta/.mise.toml" ]; then
        _zeta_repo="$HOME/Zeta"
      fi
      # Trust before `mise activate`. `mise trust --all` in the recovery
      # arm below writes a HOME-local store that does not survive
      # install-time /mnt/home/zeta → post-reboot $HOME, and it only runs
      # when the bun shim is absent. MISE_TRUSTED_CONFIG_PATHS is the
      # durable default (same contract as tools/setup/install.sh).
      if [ -n "$_zeta_repo" ]; then
        export MISE_TRUSTED_CONFIG_PATHS="$_zeta_repo"
      fi
      # Recovery: non-interactive install may have skipped mise install (tarball
      # mise is not FHS-compatible on NixOS). Lazy-install runtimes on first login.
      if [ -n "$_zeta_repo" ] && [ ! -x "$HOME/.local/share/mise/shims/bun" ]; then
        (cd "$_zeta_repo" && mise trust --all --yes >/dev/null 2>&1; MISE_ENV=full mise install --yes) >/dev/null 2>&1 || true
      fi
      eval "$(mise activate bash)"
      # Node-only global resolution (see the CORRECTION note above). Both
      # lines are load-bearing; neither works alone.
      if [ -n "$_zeta_repo" ]; then
        export MISE_GLOBAL_CONFIG_FILE="$_zeta_repo/.mise.toml"
      fi
      if [ -d "$HOME/.local/share/mise/shims" ]; then
        case ":$PATH:" in
          *":$HOME/.local/share/mise/shims:"*) ;;
          *) export PATH="$PATH:$HOME/.local/share/mise/shims" ;;
        esac
      fi
    fi
    # bun's `bun install --global` writes manifest-driven agent CLI
    # binaries here (claude/codex/gemini today).
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
