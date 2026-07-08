# full-ai-cluster/nixos/modules/zeta-self-register.nix
#
# B-0855.1 surface + B-0855.2 wiring: post-install first-boot self-registration.
# Fires once the installed OS reaches network-online AND zeta-creds-restore has
# put gh auth back (the cred-blob restores creds on first boot — AFTER the
# installer ran, which is exactly why the install-time Step 6.9 registration was
# always gated off). The ExecStart script opens a
# maintainers/<gh-user>/cluster-nodes/<host>/node.yaml PR, then writes a marker so
# subsequent boots no-op (idempotent; also no-ops if already on main).
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
      description = "Marker written after a successful (or already-registered) run; gates re-runs.";
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

      # Skip cleanly once the marker exists, and never fire without the script present.
      # Also skip when QEMU CI dry-run marker is present — that path uses the sibling service.
      unitConfig = {
        ConditionPathExists = [
          "!${cfg.markerPath}"
          "!/etc/zeta/qemu-self-register-ci"
          cfg.scriptPath
        ];
      };

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
        ];
        ExecStart = "/run/current-system/sw/bin/bash ${cfg.scriptPath}";
        # gh auth may arrive a beat after boot; retry a few times rather than fail hard.
        Restart = "on-failure";
        RestartSec = "30s";
      };
    };

    # QEMU CI dry-run: compose ClusterNode preview + serial markers; no live gh/git push.
    # Mirrors zeta-first-session-ci tee-to-ttyS0 pattern.
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
