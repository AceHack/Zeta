# zeta-dev-toolchain.nix -- provision the operator's DEV toolchain AFTER first
# boot, in the background. 081M3K23YCP087G0R003BVDS1P.
#
# `tools/setup/install.sh` at tier `full` (~18 mise toolchains, several GB) used
# to run inside zeta-install.sh BEFORE the reboot: unbounded, output hidden
# behind `| tail -40`, three attempts. On the 2026-09-27 bare-metal reinstall
# that was ~30 minutes of silent console, and none of it is needed for k3s,
# ArgoCD or the roster. It now runs here:
#
#   - started by a TIMER (OnBootSec), not `wantedBy = multi-user.target`: a
#     oneshot that multi-user.target wants is ordered before the target is
#     reached, so an hour of toolchain download would hold the boot "not up".
#   - after network-online.target, as the operator (runuser, inside the script).
#   - Nice=19 + CPUSchedulingPolicy=idle + IOSchedulingClass=idle: it cannot
#     compete with k3s's own first boot, which is the thing the node is FOR.
#     Those rank tasks only inside the unit's cgroup, so the unit also runs in
#     its own cgroup-idle, memory-capped `zeta-background.slice` (not the
#     k3s-protected system.slice) -- see the Slice comment below.
#   - bounded twice: per attempt inside the script (`timeout`, named rc 124),
#     and TimeoutStartSec for the whole unit, whose expiry ExecStopPost turns
#     into a named FAILED line + PARTIAL-PROVISION marker.
#   - once: ConditionPathExists=! on the success stamp. A failed run leaves no
#     stamp, so the next boot retries; `systemctl start` retries now.
#
# The logic is the standalone `zeta-dev-toolchain.sh` so a test can EXECUTE it
# (no workflow runs `nix flake check` on this flake) -- same reasoning as
# k3s-datastore-preflight.nix.
{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.devToolchain;
  runner = ./zeta-dev-toolchain.sh;
in
{
  options.zeta.devToolchain = {
    enable = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = "Provision the operator's dev toolchain (tools/setup/install.sh, tier full) in the background after first boot.";
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "zeta";
      description = "The operator account the toolchain is installed for.";
    };

    home = lib.mkOption {
      type = lib.types.str;
      default = "/home/zeta";
      description = "That account's home; the installer clones the repo to <home>/Zeta.";
    };

    attemptTimeoutSeconds = lib.mkOption {
      type = lib.types.int;
      default = 3600;
      description = "Bound on ONE install.sh attempt. Expiry is a named timeout (rc 124), then a retry.";
    };

    maxAttempts = lib.mkOption {
      type = lib.types.int;
      default = 3;
      description = "install.sh is idempotent, so a transient network blip is retried this many times.";
    };

    startDelay = lib.mkOption {
      type = lib.types.str;
      default = "2min";
      description = "OnBootSec for the timer: let k3s start first.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-dev-toolchain = {
      description = "Provision the operator dev toolchain in the background (tools/setup/install.sh, tier full)";
      wants = [ "network-online.target" ];
      after = [ "network-online.target" ];
      unitConfig.ConditionPathExists = "!${cfg.home}/.zeta/dev-toolchain.ok";
      path = [ pkgs.bash pkgs.coreutils pkgs.util-linux pkgs.gnugrep pkgs.gnused pkgs.gawk ];
      environment = {
        ZETA_USER = cfg.user;
        ZETA_HOME = cfg.home;
        ZETA_SERIAL_DEVICE = "/dev/ttyS0";
        ZETA_ATTEMPT_TIMEOUT_SECS = toString cfg.attemptTimeoutSeconds;
        ZETA_MAX_ATTEMPTS = toString cfg.maxAttempts;
      };
      serviceConfig = {
        Type = "oneshot";
        # Root only to write the serial console the QEMU lanes read; the
        # install itself drops to the operator via runuser in the script.
        User = "root";
        ExecStart = "${pkgs.bash}/bin/bash ${runner} run";
        ExecStopPost = "${pkgs.bash}/bin/bash ${runner} stop-post";
        # The whole-unit backstop: every attempt at its bound, plus backoff and
        # margin. Past this, systemd kills it and ExecStopPost names it.
        TimeoutStartSec = (cfg.attemptTimeoutSeconds + 120) * cfg.maxAttempts;
        Nice = 19;
        CPUSchedulingPolicy = "idle";
        IOSchedulingClass = "idle";
        # Out of system.slice (081M3NB0PAG087G0R000JQQCF4). Nice and SCHED_IDLE
        # only rank tasks WITHIN this unit's cgroup; between cgroups the kernel
        # weighs the cgroup. system.slice is where k3s-process-protection.nix
        # puts CPUWeight=1000 and MemoryLow=<kube-reserved> for k3s, so inside
        # it this unit was weighted ABOVE every pod and its page cache counted
        # against the protection meant for k3s. Its own root-level slice below
        # is cgroup-idle and memory-capped instead.
        Slice = "zeta-background.slice";
        StandardOutput = "journal";
        StandardError = "journal";
      };
    };

    # A root-level slice for work that must never compete with the node's
    # purpose. CPUWeight=idle is cgroup v2 `cpu.idle=1`: CPU only when nothing
    # else wants it. MemoryHigh throttles and reclaims this slice first once it
    # passes a quarter of the node; MemoryMax is the hard stop (the kernel
    # OOM-kills inside THIS slice, never a pod or k3s, and the unit's retry /
    # ExecStopPost names the failure).
    systemd.slices.zeta-background = {
      description = "Background provisioning that yields to k3s and its pods";
      sliceConfig = {
        CPUWeight = "idle";
        MemoryHigh = "25%";
        MemoryMax = "40%";
      };
    };

    systemd.timers.zeta-dev-toolchain = {
      description = "Start the background dev-toolchain provisioning after boot";
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnBootSec = cfg.startDelay;
        Unit = "zeta-dev-toolchain.service";
      };
    };
  };
}
