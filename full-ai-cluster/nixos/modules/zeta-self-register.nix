# full-ai-cluster/nixos/modules/zeta-self-register.nix
#
# B-0855.1 surface + B-0855.2 wiring: post-install node self-registration.
# Fires once the installed OS reaches network-online AND zeta-creds-restore has
# put gh auth back (the cred-blob restores creds on first boot — AFTER the
# installer ran, which is exactly why the install-time Step 6.9 registration was
# always gated off). The ExecStart script opens a
# maintainers/<gh-user>/cluster-nodes/<host>/node.yaml PR.
#
# ── 081M0BTFK85087G0R000A705AK: LEVEL-TRIGGERED, not marker-gated ─────────────
#
# This unit used to carry `ConditionPathExists = "!${cfg.markerPath}"`, so once
# the marker existed the unit no-opped FOREVER. There is no timer, healthcheck
# or reconciler anywhere in full-ai-cluster/nixos that could undo that, so a node
# whose registration was later wiped, rolled back, or written against a stale
# identity had no path back short of an operator deleting the marker by hand — on
# a node that, by hypothesis, is the one nobody can reach.
#
#   A marker-gated oneshot cannot re-converge, and repair IS re-convergence.
#
# So the marker stops being a GATE and becomes a RECEIPT: the script observes the
# desired state (is node.yaml on main?) and acts only on divergence. The unit
# still runs at boot exactly as before, and a `zeta-self-register.timer` now
# re-runs it on a bounded, jittered cadence. Level-triggered ("is the desired
# state present?"), never edge-triggered ("did the event happen?") — the same
# discipline src/Core.TypeScript/agent-heartbeats/heartbeat-liveness.ts already
# pays for, and it buys manifesto §12 idempotency for free.
#
# THE FAILURE MODE THIS INTRODUCES, AND ITS THREE BOUNDS. A unit that re-runs on
# a timer against a registration service is a self-inflicted load source, and a
# fleet retrying hard through a GitHub outage is a thundering herd. Bounded at
# three layers, each of which is a *bound* and not a give-up:
#
#   1. READ CADENCE — `reconcileInterval` (6h) with `reconcileJitter` (30min) of
#      RandomizedDelaySec, so N nodes never align. Per node that is ~4 read-only
#      API calls/day; a 100-node fleet is ~400/day against a 5000/hr limit.
#   2. IN-BOOT RETRY — `Restart=on-failure` is kept for the "gh auth arrives a
#      beat late" case but is now capped by StartLimitBurst/StartLimitIntervalSec
#      (5 attempts per 10min). The cap is safe precisely because the timer
#      outlives it: the start-limit counter clears long before the next tick.
#   3. WRITE SIDE — the sharp one, enforced in the script: at most ONE open
#      registration PR per host at a time, and at most one PR-creation ATTEMPT
#      per `ZETA_SELF_REGISTER_MIN_PR_INTERVAL` (24h). So even a pathological
#      once-a-minute run cannot open a second PR.
#
# `Persistent` is deliberately NOT set on the timer. Persistent replays a missed
# window, which is edge-triggered thinking: a level-triggered converger has no
# missed events to catch up on, and replaying them is how a fleet that was off
# during an outage herds the moment it returns.
#
# QEMU CI: when /etc/zeta/qemu-self-register-ci exists (written by zeta-install
# WIPE path), a sibling oneshot runs ZETA_SELF_REGISTER_MODE=ci-dry-run and tees
# zeta-self-register:* markers to ttyS0 — hermetic compose proof without live gh.
#
# Enabled cluster-wide in common.nix. Per-host opt-out: zeta.selfRegister.enable = false;

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.selfRegister;
in
{
  options.zeta.selfRegister = {
    enable = lib.mkEnableOption "Zeta post-install first-boot self-registration service";

    user = lib.mkOption {
      type = lib.types.str;
      default = "zeta";
      description = "User that runs zeta-self-register.service (must hold the restored gh auth).";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "users";
      description = "Primary group for the self-registration service user.";
    };

    home = lib.mkOption {
      type = lib.types.str;
      default = "/home/zeta";
      description = "Home directory (carries the restored ~/.config/gh credentials).";
    };

    repoRoot = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta";
      description = "Checked-out Zeta repo on the installed node (the flake source used by nixos-install).";
    };

    scriptPath = lib.mkOption {
      type = lib.types.str;
      default = "${cfg.repoRoot}/tools/installer/zeta-self-register.sh";
      description = "Registration entrypoint (bash; self-contained, clones fresh, needs only gh+git).";
    };

    markerPath = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/zeta-self-register/self-registered.marker";
      description = ''
        Observation RECEIPT (081M0BTFK85087G0R000A705AK). Records the last observed
        registration state and the last PR-creation attempt; it does NOT gate the live
        unit — gating it is what made this service unable to re-converge. The QEMU
        ci-dry-run sibling still treats it as a one-shot marker, which is correct there:
        that path proves compose once and must never open a PR.
      '';
    };

    reconcileInterval = lib.mkOption {
      type = lib.types.str;
      default = "6h";
      description = ''
        How often the level-triggered convergence check re-runs (systemd time span).
        Read-only unless the node has actually diverged; the write side is bounded
        separately by minPrIntervalSec.
      '';
    };

    reconcileJitter = lib.mkOption {
      type = lib.types.str;
      default = "30min";
      description = ''
        RandomizedDelaySec on the reconcile timer. This is the anti-thundering-herd
        bound: without it every node in the fleet checks in lockstep, which is exactly
        the load spike an auto-heal layer is supposed to avoid causing.
      '';
    };

    minPrIntervalSec = lib.mkOption {
      type = lib.types.ints.unsigned;
      default = 86400;
      description = ''
        Minimum seconds between registration-PR creation ATTEMPTS for this host
        (attempts, not successes — a failing create must back off too). Bounds the
        write side without ever becoming a permanent give-up, which is the defect
        being fixed.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-self-register = {
      description = "Zeta node self-registration (B-0855.2): first-boot maintainers/<user>/cluster-nodes/<host> PR";
      wantedBy = [ "multi-user.target" ];
      wants = [ "network-online.target" ];
      after = [
        "network-online.target"
        "zeta-creds-restore.service"
      ];

      # Never fire without the script present, and skip when the QEMU CI dry-run marker
      # is present — that path uses the sibling service.
      #
      # NOTE what is deliberately ABSENT: `"!${cfg.markerPath}"`. That condition is the
      # 081M0BTFK85087G0R000A705AK defect. Convergence is decided by the script against
      # the ACTUAL registration state, not by a local file asserting the past.
      unitConfig = {
        ConditionPathExists = [
          "!/etc/zeta/qemu-self-register-ci"
          cfg.scriptPath
        ];
      };

      # Bound 2: the in-boot fast retry may not become an unbounded 30s loop through a
      # GitHub outage. Five attempts per ten minutes, then systemd stands down and the
      # reconcile timer (6h ≫ 10min, so the counter has long cleared) picks it back up.
      startLimitIntervalSec = 600;
      startLimitBurst = 5;

      serviceConfig = {
        Type = "oneshot";
        User = cfg.user;
        Group = cfg.group;
        # systemd creates /var/lib/zeta-self-register owned by the service user, so
        # the marker write succeeds even though ~/.config may be root-owned (creds).
        StateDirectory = "zeta-self-register";
        WorkingDirectory = cfg.home;
        Environment = [
          "HOME=${cfg.home}"
          "PATH=/run/current-system/sw/bin:${cfg.home}/.nix-profile/bin"
          "ZETA_SELF_REGISTER_MARKER=${cfg.markerPath}"
          "ZETA_SELF_REGISTER_MIN_PR_INTERVAL=${toString cfg.minPrIntervalSec}"
        ];
        ExecStart = "/run/current-system/sw/bin/bash ${cfg.scriptPath}";
        # gh auth may arrive a beat after boot; retry a few times rather than fail hard.
        # Capped by startLimitIntervalSec/startLimitBurst above.
        Restart = "on-failure";
        RestartSec = "30s";
      };
    };

    # 081M0BTFK85087G0R000A705AK — the re-convergence tick. The service keeps its
    # boot-time activation (wantedBy multi-user.target, above) so first-boot enrolment
    # timing is unchanged; this timer only adds the LATER checks that make repair
    # possible. RandomizedDelaySec therefore never delays first enrolment — it only
    # de-phases the recurring fleet-wide checks.
    #
    # OnBootSec is present alongside OnUnitActiveSec so the timer still elapses on a
    # node where the boot activation was Condition-skipped; systemd takes the earlier
    # of the two. `Persistent` is intentionally omitted (see the header).
    systemd.timers.zeta-self-register = {
      description = "Zeta node registration re-convergence tick (081M0BTFK85087G0R000A705AK)";
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnBootSec = cfg.reconcileInterval;
        OnUnitActiveSec = cfg.reconcileInterval;
        RandomizedDelaySec = cfg.reconcileJitter;
        AccuracySec = "1min";
        Unit = "zeta-self-register.service";
      };
    };

    # QEMU CI dry-run: compose ClusterNode preview + serial markers; no live gh/git push.
    # Mirrors zeta-first-session-ci tee-to-ttyS0 pattern.
    #
    # This sibling KEEPS its `"!${cfg.markerPath}"` gate, and that is not an oversight.
    # It is not a repair unit — it is a hermetic one-shot proof that compose works, run
    # inside a VM that is discarded afterwards. There is no state for it to re-converge
    # to, and no timer drives it. The defect is a oneshot that gates the REPAIR path;
    # a genuinely-once proof is allowed to be once.
    systemd.services.zeta-self-register-ci = {
      description = "QEMU CI post-boot self-register dry-run (cascade #6)";
      wantedBy = [ "multi-user.target" ];
      after = [
        "local-fs.target"
        "zeta-first-session-ci.service"
      ];
      unitConfig = {
        ConditionPathExists = [
          "/etc/zeta/qemu-self-register-ci"
          "!${cfg.markerPath}"
          cfg.scriptPath
        ];
      };
      serviceConfig = {
        Type = "oneshot";
        StateDirectory = "zeta-self-register";
        WorkingDirectory = cfg.home;
        ExecStart = pkgs.writeShellScript "zeta-self-register-ci-start" ''
          set -euo pipefail
          _serial=""
          for _dev in /dev/ttyS0 /dev/ttyAMA0; do
            if [ -e "$_dev" ]; then
              _serial="$_dev"
              break
            fi
          done
          run_dry() {
            # StateDirectory is root-owned on this oneshot (tee needs root for ttyS0);
            # ensure the zeta user can write the marker + preview under it.
            ${pkgs.coreutils}/bin/mkdir -p /var/lib/zeta-self-register
            ${pkgs.coreutils}/bin/chown ${cfg.user}:${cfg.group} /var/lib/zeta-self-register
            ${pkgs.util-linux}/bin/runuser -u ${cfg.user} -- \
              env HOME=${cfg.home} \
              ZETA_SELF_REGISTER_MARKER=${cfg.markerPath} \
              ZETA_SELF_REGISTER_MODE=ci-dry-run \
              ZETA_SELF_REGISTER_CI_MAINTAINER=qemu-ci \
              PATH=/run/current-system/sw/bin:${cfg.home}/.nix-profile/bin \
              /run/current-system/sw/bin/bash ${cfg.scriptPath}
          }
          if [ -n "$_serial" ]; then
            exec 3>&1
            run_dry 2>&1 | ${pkgs.coreutils}/bin/tee -a "$_serial" >&3
          else
            run_dry
          fi
        '';
      };
    };
  };
}
