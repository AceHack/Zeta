# full-ai-cluster/nixos/modules/zeta-otto.nix
#
# B-0850 Phase 1 — Otto as systemd service OUTSIDE k8s for out-of-band
# cluster repair. Composes with iter-5.5.0 substrate (PR #5388 + #5389)
# which persists claude credentials at /home/zeta/.config/claude/ +
# pre-clones Zeta repo to /home/zeta/Zeta + installs claude-code via
# mise-managed bun at /home/zeta/.bun/bin/claude.
#
# Operator framing (Aaron 2026-05-27):
#   "so our usb after gh and claude device code login it should reboot
#   with a claude service using my gh login"
#
# Architectural pattern: "control plane outside the control plane" —
# Otto runs as systemd service NOT as a k8s pod. When k3s / Cilium /
# cert-manager / Vault / ArgoCD has issues, Otto is still alive on the
# node + can ssh into other nodes, restart k8s services, inspect failed
# pods, repair flake.nix, post PR comments + escalate via bus/Twilio.
#
# Service deliberately NOT After=k3s.service — Otto must run regardless
# of k3s state (otherwise Otto can't repair k3s when broken).

{ config, pkgs, lib, ... }:

let
  cfg = config.zeta.otto;
in
{
  options.zeta.otto = {
    enable = lib.mkEnableOption "Zeta Otto AI agent systemd service (B-0850)";

    user = lib.mkOption {
      type = lib.types.str;
      default = "zeta";
      description = "User the Otto service runs as. Must match the user with claude credentials at ~/.config/claude/ + Zeta repo at ~/Zeta/ + bun at ~/.bun/bin/.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "users";
      description = "Primary group for the Otto service user.";
    };

    home = lib.mkOption {
      type = lib.types.str;
      default = "/home/zeta";
      description = "Home directory of the service user. Used to compose PATH + claude config dir + Zeta repo dir.";
    };

    tickIntervalSec = lib.mkOption {
      type = lib.types.int;
      default = 60;
      description = "Seconds between autonomous-loop tick invocations. The systemd unit loops: claude --print '<<autonomous-loop>>' then sleeps this many seconds.";
    };

    memoryMax = lib.mkOption {
      type = lib.types.str;
      default = "4G";
      description = "Maximum resident memory for the Otto service. Tune per node hardware.";
    };

    cpuQuota = lib.mkOption {
      type = lib.types.str;
      default = "200%";
      description = "CPU quota for the Otto service. '200%' = up to 2 cores. Tune per node hardware.";
    };

    restartSec = lib.mkOption {
      type = lib.types.int;
      default = 30;
      description = "Seconds systemd waits before restarting the service after failure.";
    };
  };

  config = lib.mkIf cfg.enable {
    # systemd service unit. Composes with the iter-5.5.0 install-time
    # credential persistence + repo pre-clone substrate (PR #5388 +
    # #5389) which guarantees these paths exist post-install:
    #   ${cfg.home}/.config/claude/  (claude device-code creds)
    #   ${cfg.home}/.config/gh/      (gh device-code creds)
    #   ${cfg.home}/Zeta/            (pre-cloned repo)
    #   ${cfg.home}/.bun/bin/claude  (bun-installed claude binary)
    #   ${cfg.home}/.local/share/mise/shims/ (mise shims)
    systemd.services.zeta-otto = {
      description = "Zeta Otto AI agent (out-of-band cluster repair; B-0850 Phase 1)";

      # CRITICAL: deliberately NOT After=k3s.service — Otto must run
      # regardless of k3s state (otherwise Otto can't repair k3s when
      # broken). This is the "control plane outside the control plane"
      # property the row B-0850 names. Only depends on network.
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = "${cfg.home}/Zeta";

        # Environment for claude to find creds + tools:
        #   HOME points at the service user's home
        #   PATH includes bun's --global bin (where claude lives) +
        #     mise shims (where mise-managed runtimes live) + NixOS
        #     system PATH (where gh + kubectl + helm + etc. live)
        Environment = [
          "HOME=${cfg.home}"
          "PATH=${cfg.home}/.bun/bin:${cfg.home}/.local/share/mise/shims:/run/current-system/sw/bin:/usr/bin:/bin"
          "BUN_INSTALL=${cfg.home}/.bun"
        ];

        # Wrapper script loops: tick → sleep → tick → ... per the
        # autonomous-loop discipline. Each tick is a fresh claude
        # invocation (cold-boot per session); inter-tick context
        # accumulates in substrate (memory files + git + bus envelopes)
        # NOT in the process. Restart=always handles crashes.
        #
        # The startup wait of 10s lets network-online stabilize +
        # the mise shims warm + the operator's first-login cron not
        # collide with this tick.
        ExecStart = pkgs.writeShellScript "zeta-otto-loop" ''
          #!${pkgs.bash}/bin/bash
          set -uo pipefail
          # Initial settle window
          sleep 10
          # Autonomous-loop ticks — fresh claude invocation per tick;
          # substrate continuity via repo memory + git + bus envelopes.
          while true; do
            ${cfg.home}/.bun/bin/claude --print "<<autonomous-loop>>" 2>&1 || true
            sleep ${toString cfg.tickIntervalSec}
          done
        '';

        Restart = "always";
        RestartSec = toString cfg.restartSec;

        # Resource bounds — operator-tunable per node hardware via
        # zeta.otto.memoryMax + zeta.otto.cpuQuota options above.
        MemoryMax = cfg.memoryMax;
        CPUQuota = cfg.cpuQuota;

        # Logging: journalctl -u zeta-otto for full visibility per
        # glass-halo-bidirectional discipline.
        StandardOutput = "journal";
        StandardError = "journal";
      };
    };

    # Operator-visible status hint in login banner: composes with
    # login-banner.nix (B-0792) which shows hostname + ssh hint at
    # console pre-login.
    environment.etc."zeta-otto-status.txt".text = ''
      Zeta Otto AI agent (B-0850 Phase 1) installed as systemd service:
        systemctl status zeta-otto      # current state
        journalctl -u zeta-otto -f      # live logs
        systemctl restart zeta-otto     # restart
        systemctl disable zeta-otto     # stop auto-start at boot (operator override)

      Composes with iter-5.5.0 substrate:
        ~/.config/claude/  device-code login creds (persisted at install time)
        ~/.config/gh/      gh device-code login creds (persisted at install time)
        ~/Zeta/            pre-cloned repo
        ~/.bun/bin/claude  bun-installed claude binary
    '';
  };
}
