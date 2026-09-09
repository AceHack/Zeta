# full-ai-cluster/nixos/modules/zeta-creds-to-k8s.nix
#
# 081M1PWSF56087G0R000FDS3NY: project USB-restored host credentials into
# Kubernetes Secrets after zeta-creds-restore has written the files and k3s
# is up. Agent pods mount those Secrets; they do not re-enter GitHub / AI
# logins.
#
# Not a Helm chart. External Secrets / Vault stay the later hop (ESO's
# ClusterSecretStore is still commented in applications/external-secrets).
# Vault may be sealed at first boot; the host files already exist. This
# oneshot is the first hop: allowlisted files → Opaque Secrets in
# namespace zeta-host-creds.
#
# Allowlist lives in src/Core.TypeScript/installer/zeta-creds-to-k8s.ts
# (gh-cli / claude / gemini / codex). WiFi, SSH host keys, operator pubkey,
# and install-answers stay on the host.
#
# Control-plane only. Agents restore host files for systemd vendor agents
# but do not have the admin kubeconfig this unit needs.
#
# Failure does not take k3s down (no requiredBy). Missing blob / missing
# bun / empty disk is a named skip, exit 0 — same skip discipline as
# zeta-creds-restore. Missing kubeconfig exits 1 so Restart=on-failure
# retries until k3s has written the admin file. API-not-ready from the
# projector also exits 1.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.credsToK8s;
  bunShimPath = "${cfg.home}/.local/share/mise/shims/bun";
in
{
  options.zeta.credsToK8s = {
    enable = lib.mkEnableOption "Project restored host credentials into Kubernetes Secrets";

    user = lib.mkOption {
      type = lib.types.str;
      default = "zeta";
      description = "User whose home holds the restored credential files.";
    };

    home = lib.mkOption {
      type = lib.types.str;
      default = "/home/zeta";
      description = "Home directory scanned for restored credential files.";
    };

    repoRoot = lib.mkOption {
      type = lib.types.str;
      default = "${cfg.home}/Zeta";
      description = "Path to the checked-out Zeta repository on the installed node.";
    };

    scriptPath = lib.mkOption {
      type = lib.types.str;
      default = "${cfg.repoRoot}/src/Core.TypeScript/installer/zeta-creds-to-k8s.ts";
      description = "Bun TypeScript entrypoint for the host→Secret projector.";
    };

    namespace = lib.mkOption {
      type = lib.types.str;
      default = "zeta-host-creds";
      description = "Kubernetes namespace that receives the projected Secrets.";
    };

    kubeconfig = lib.mkOption {
      type = lib.types.str;
      default = "/etc/rancher/k3s/k3s.yaml";
      description = "kubeconfig the projector uses (k3s control-plane admin file).";
    };

    persona = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = config.zeta.credsRestore.persona or null;
      defaultText = lib.literalExpression "config.zeta.credsRestore.persona or null";
      description = "Optional persona label on projected Secrets (matches restore).";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-creds-to-k8s = {
      description = "Project USB-restored host credentials into Kubernetes Secrets (081M1PWSF56087G0R000FDS3NY)";
      wantedBy = [ "multi-user.target" ];
      wants = [ "k3s.service" ];
      after = [
        "k3s.service"
        "zeta-creds-restore.service"
      ];
      # Deliberately NOT requiredBy k3s. A projector miss must not take the
      # API down; agent pods simply see missing Secrets until the next retry.

      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        User = "root";
        WorkingDirectory = "/";
        Environment = [
          "HOME=${cfg.home}"
          "PATH=${cfg.home}/.local/share/mise/shims:${cfg.home}/.bun/bin:/run/current-system/sw/bin:/usr/bin:/bin"
          "MISE_TRUSTED_CONFIG_PATHS=${cfg.repoRoot}"
        ];
        ExecStart = pkgs.writeShellScript "zeta-creds-to-k8s-start" ''
          set -euo pipefail

          _serial=""
          for _dev in /dev/ttyS0 /dev/ttyAMA0; do
            if [ -e "$_dev" ]; then
              _serial="$_dev"
              break
            fi
          done
          log_proj() {
            echo "$1"
            if [ -n "$_serial" ]; then
              echo "$1" >> "$_serial" || true
            fi
          }

          log_proj "zeta-creds-to-k8s: ExecStart entered"

          _missing=""
          for _req in ${cfg.scriptPath} ${bunShimPath}; do
            if [ ! -e "$_req" ]; then
              _missing="$_missing $_req"
              log_proj "zeta-creds-to-k8s: MISSING precondition $_req; skipping projection"
            fi
          done
          if [ -n "$_missing" ]; then
            exit 0
          fi

          if [ ! -e "${cfg.kubeconfig}" ]; then
            log_proj "zeta-creds-to-k8s: kubeconfig missing (${cfg.kubeconfig}); retrying"
            exit 1
          fi

          cd "${cfg.repoRoot}"
          BUN_BIN="$(ls -1 ${cfg.home}/.local/share/mise/installs/bun/*/bin/bun 2>/dev/null | sort -V | tail -1 || true)"
          if [ -z "$BUN_BIN" ] || [ ! -x "$BUN_BIN" ]; then
            BUN_BIN="${bunShimPath}"
          fi
          log_proj "zeta-creds-to-k8s: bun binary $BUN_BIN"

          PERSONA_ARGS=""
          ${lib.optionalString (cfg.persona != null) ''
            PERSONA_ARGS="--persona ${cfg.persona}"
          ''}

          if [ -n "$_serial" ]; then
            "$BUN_BIN" ${cfg.scriptPath} \
              --home ${cfg.home} \
              --namespace ${cfg.namespace} \
              --k3s-bin ${config.services.k3s.package}/bin/k3s \
              --kubeconfig ${cfg.kubeconfig} \
              $PERSONA_ARGS 2>&1 | ${pkgs.coreutils}/bin/tee -a "$_serial"
          else
            "$BUN_BIN" ${cfg.scriptPath} \
              --home ${cfg.home} \
              --namespace ${cfg.namespace} \
              --k3s-bin ${config.services.k3s.package}/bin/k3s \
              --kubeconfig ${cfg.kubeconfig} \
              $PERSONA_ARGS
          fi
        '';
        Restart = "on-failure";
        RestartSec = "30s";
      };
    };
  };
}
