# full-ai-cluster/nixos/modules/zeta-first-session.nix
#
# B-0891 slice 3: post-login choose-your-own-adventure for credential setup.
# Runs once on first interactive login as the zeta user (profile.d hook).
# Load-bearing: gh auth login for zeta-self-register; optional claude/codex/gemini.
#
# Serial markers: zeta-first-session: begin|complete|gh-auth-* (QEMU phase-3).
#
# Per-host opt-out: zeta.firstSession.enable = false;

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.firstSession;
  bunShimPath = "${cfg.home}/.local/share/mise/shims/bun";
  scriptPath = "${cfg.repoRoot}/src/Core.TypeScript/observe/first-session-run.ts";
in
{
  options.zeta.firstSession = {
    enable = lib.mkEnableOption "Zeta post-login first-session credential adventure";

    user = lib.mkOption {
      type = lib.types.str;
      default = "zeta";
      description = "User that runs the first-session conductor on interactive login.";
    };

    home = lib.mkOption {
      type = lib.types.str;
      default = "/home/zeta";
      description = "Home directory for credential probes and CLI auth flows.";
    };

    repoRoot = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta";
      description = "Checked-out Zeta repo on the installed node (install-time clone target).";
    };

    markerPath = lib.mkOption {
      type = lib.types.str;
      default = "/var/lib/zeta-first-session/complete.marker";
      description = "Marker written when the operator finishes the first-session adventure.";
    };

    useLlm = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        When true, the local Ollama chooser picks menu items instead of numbered prompts.
        Default false: operator picks by number (works without Ollama on the node).
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    # State directory owned by root; marker write uses sudo in profile hook.
    systemd.tmpfiles.rules = [
      "d /var/lib/zeta-first-session 0755 root root -"
    ];

    environment.etc."profile.d/zeta-first-session.sh" = {
      text = ''
        # B-0891 slice 3: first interactive login runs credential adventure once.
        # Skips non-interactive shells (scp, cron) and re-runs when marker exists.
        if [ "$(id -un)" = "${cfg.user}" ]; then
          case "$-" in
            *i*)
              if [ -z "''${ZETA_FIRST_SESSION_RUNNING:-}" ] && [ ! -f "${cfg.markerPath}" ]; then
                if [ -f "${scriptPath}" ] && [ -x "${bunShimPath}" ]; then
                  export ZETA_FIRST_SESSION_RUNNING=1
                  export ZETA_FIRST_SESSION_MARKER="${cfg.markerPath}"
                  export HOME="${cfg.home}"
                  export PATH="${cfg.home}/.local/share/mise/shims:${cfg.home}/.bun/bin:/run/current-system/sw/bin:/usr/bin:/bin"
                  LLM_FLAG=""
                  ${lib.optionalString cfg.useLlm "LLM_FLAG=\"--llm\""}
                  echo "zeta-first-session: launching post-login credential adventure..."
                  cd "${cfg.repoRoot}" && "${bunShimPath}" "${scriptPath}" $LLM_FLAG || true
                  unset ZETA_FIRST_SESSION_RUNNING
                else
                  echo "zeta-first-session: script or bun shim missing — skipping (install substrate incomplete?)"
                fi
              fi
              ;;
          esac
        fi
      '';
    };

    # B-0891 phase-3: QEMU CI boot demo — runs once at multi-user when
    # /etc/zeta/qemu-first-session-ci exists (written by zeta-install WIPE path).
    # Tees stdout to ttyS0 so phase-2 serial capture sees first-session markers.
    systemd.services.zeta-first-session-ci = {
      description = "QEMU CI first-session demo (B-0891 phase-3)";
      wantedBy = [ "multi-user.target" ];
      after = [ "local-fs.target" ];
      unitConfig = {
        ConditionPathExists = [
          "/etc/zeta/qemu-first-session-ci"
          "!${cfg.markerPath}"
          scriptPath
          bunShimPath
        ];
      };
      serviceConfig = {
        Type = "oneshot";
        User = cfg.user;
        Group = "users";
        WorkingDirectory = cfg.repoRoot;
        Environment = [
          "HOME=${cfg.home}"
          "ZETA_FIRST_SESSION_MARKER=${cfg.markerPath}"
          "ZETA_FIRST_SESSION_TEE_CONSOLE=1"
          "PATH=${cfg.home}/.local/share/mise/shims:${cfg.home}/.bun/bin:/run/current-system/sw/bin:/usr/bin:/bin"
        ];
        ExecStart = pkgs.writeShellScript "zeta-first-session-ci-start" ''
          set -euo pipefail
          cd "${cfg.repoRoot}"
          "${bunShimPath}" "${scriptPath}" \
            --demo --script skip-optional,complete --dry-run
        '';
      };
    };
  };
}
