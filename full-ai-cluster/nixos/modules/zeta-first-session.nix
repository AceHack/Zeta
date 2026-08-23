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
  bunNixPath = lib.getExe pkgs.bun;
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
                # Codex P2 (#8738): this hook is sourced BEFORE zeta-user-paths.sh
                # (lexical profile.d order), where the lazy `mise install` recovery
                # lives. Since the bun fallback below now lets the conductor launch
                # with no agent CLIs yet, completing/skipping the adventure would
                # write the marker and never rerun after the CLIs finally install.
                # Run the same recovery HERE first so the agent CLIs exist (or were
                # attempted) before the marker can be written. Idempotent: only runs
                # when the mise bun shim is still absent.
                export MISE_PYTHON_GITHUB_ATTESTATIONS="''${MISE_PYTHON_GITHUB_ATTESTATIONS:-0}"
                export MISE_TRUSTED_CONFIG_PATHS="${cfg.repoRoot}"
                if command -v mise >/dev/null 2>&1 && [ ! -x "${bunShimPath}" ]; then
                  _zeta_repo=""
                  if [ -f "${cfg.repoRoot}/.mise.toml" ]; then
                    _zeta_repo="${cfg.repoRoot}"
                  elif [ -f "${cfg.home}/Zeta/.mise.toml" ]; then
                    _zeta_repo="${cfg.home}/Zeta"
                  fi
                  if [ -n "$_zeta_repo" ]; then
                    export MISE_TRUSTED_CONFIG_PATHS="$_zeta_repo"
                    echo "zeta-first-session: installing runtimes before adventure (mise recovery)..."
                    (cd "$_zeta_repo" && mise trust --all --yes >/dev/null 2>&1; MISE_ENV=full mise install --yes) >/dev/null 2>&1 || true
                  fi
                fi
                _bun=""
                for _c in "${bunShimPath}" "${cfg.home}/.bun/bin/bun" "${bunNixPath}"; do
                  if [ -x "$_c" ]; then
                    _bun="$_c"
                    break
                  fi
                done
                if [ -f "${scriptPath}" ] && [ -n "$_bun" ]; then
                  export ZETA_FIRST_SESSION_RUNNING=1
                  export ZETA_FIRST_SESSION_MARKER="${cfg.markerPath}"
                  export HOME="${cfg.home}"
                  export PATH="${cfg.home}/.local/share/mise/shims:${cfg.home}/.bun/bin:/run/current-system/sw/bin:/usr/bin:/bin"
                  LLM_FLAG=""
                  ${lib.optionalString cfg.useLlm "LLM_FLAG=\"--llm\""}
                  echo "zeta-first-session: launching post-login credential adventure..."
                  cd "${cfg.repoRoot}" && "$_bun" "${scriptPath}" $LLM_FLAG || true
                  unset ZETA_FIRST_SESSION_RUNNING
                else
                  echo "zeta-first-session: script or bun missing — skipping (install substrate incomplete?)"
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
    # Uses nixpkgs bun (not mise shim): install.sh may fail to lay down shims in
    # non-interactive QEMU CI while the service must still run at first boot.
    systemd.services.zeta-first-session-ci = {
      description = "QEMU CI first-session demo (B-0891 phase-3)";
      wantedBy = [ "multi-user.target" ];
      after = [ "local-fs.target" ];
      unitConfig = {
        ConditionPathExists = [
          "/etc/zeta/qemu-first-session-ci"
          "!${cfg.markerPath}"
          scriptPath
        ];
      };
      serviceConfig = {
        Type = "oneshot";
        WorkingDirectory = cfg.repoRoot;
        ExecStart = pkgs.writeShellScript "zeta-first-session-ci-start" ''
          set -euo pipefail
          _serial=""
          for _dev in /dev/ttyS0 /dev/ttyAMA0; do
            if [ -e "$_dev" ]; then
              _serial="$_dev"
              break
            fi
          done
          run_demo() {
            cd "${cfg.repoRoot}"
            _demo_script="''${ZETA_FIRST_SESSION_DEMO_SCRIPT:-}"
            if [ -z "$_demo_script" ] && [ -s /etc/zeta/qemu-first-session-ci ]; then
              _demo_script="$(${pkgs.coreutils}/bin/head -n 1 /etc/zeta/qemu-first-session-ci | ${pkgs.coreutils}/bin/tr -d '[:space:]')"
            fi
            if [ -z "$_demo_script" ] || [ "$_demo_script" = "qemu-ci-first-session" ]; then
              _demo_script="setup-gh,local-only"
            fi
            # ZETA_IDENTITY_AUTH_MODE=mock: exercise device-code UX against the
            # in-memory stub (ADR 2026-07-08). Temporary gh-shaped foothold;
            # successor is Zeta IdP + ZetaDB (not baked GitHub secrets).
            # --dry-run still skips live CLIs; mock/skip auth paths still run.
            ${pkgs.util-linux}/bin/runuser -u ${cfg.user} -- \
              env HOME=${cfg.home} \
              ZETA_FIRST_SESSION_MARKER=${cfg.markerPath} \
              ZETA_FIRST_SESSION_TEE_CONSOLE=1 \
              ZETA_FIRST_SESSION_DEMO_SCRIPT="$_demo_script" \
              ZETA_IDENTITY_AUTH_MODE=mock \
              PATH=${cfg.home}/.local/share/mise/shims:${cfg.home}/.bun/bin:/run/current-system/sw/bin:/usr/bin:/bin \
              ${lib.getExe pkgs.bun} ${scriptPath} \
                --demo --script "$_demo_script" --dry-run
          }
          if [ -n "$_serial" ]; then
            exec 3>&1
            run_demo 2>&1 | ${pkgs.coreutils}/bin/tee -a "$_serial" >&3
          else
            run_demo
          fi
        '';
      };
    };
  };
}
