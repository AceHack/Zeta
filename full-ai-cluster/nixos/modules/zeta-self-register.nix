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
# Enabled cluster-wide in common.nix. Per-host opt-out: zeta.selfRegister.enable = false;

{ config, lib, ... }:

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
      unitConfig = {
        ConditionPathExists = [
          "!${cfg.markerPath}"
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
  };
}
