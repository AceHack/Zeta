# full-ai-cluster/nixos/modules/zeta-creds-restore.nix
#
# B-0852.4a: NixOS service surface for boot-time credential restore from
# ESP. Consumes the encrypted blob written at install-time by the
# B-0852.3a picker (PR #5450); decrypts via the B-0852.2b restore CLI
# (PR #5425) using the USB UUID and operator passphrase; populates
# per-cred paths on the installed system before user-facing services
# (e.g., zeta-self-register.service) start.
#
# The service is intentionally disabled by default until a host config
# enables it AND a passphrase source is provided. Ordering: fires
# AFTER local-fs.target (ESP mounted), BEFORE zeta-self-register.service
# (which already declares `After = "zeta-creds-restore.service"` per
# B-0855.1 module).
#
# Two passphrase modes:
#   - file (default; simpler; suitable for automated installs):
#       Reads /run/zeta-creds-passphrase (operator pre-stages this).
#       File is deleted on service stop.
#   - interactive (operator-driven first boot; nicer UX):
#       Uses systemd-ask-password on tty1 at boot. Operator types
#       passphrase. (Implementation note: this mode currently writes
#       a temporary file with the entered passphrase; B-0852.4b
#       follow-on row may switch to stdin pipe to restore CLI for
#       tighter handling.)
#
# Per .claude/rules/non-coercion-invariant.md HC-8: operator authority
# over own creds; passphrase NEVER logged; required-cred restore
# failure surfaces (RestartSec retry) rather than silently degrading.
# Optional creds: the restore CLI itself reports skipped/error per
# cred; this module doesn't second-guess that policy.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.credsRestore;
  bunShimPath = "${cfg.home}/.local/share/mise/shims/bun";
in
{
  options.zeta.credsRestore = {
    enable = lib.mkEnableOption "Zeta boot-time credential restore from ESP";

    user = lib.mkOption {
      type = lib.types.str;
      default = "zeta";
      description = "User that owns restored credential files.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "users";
      description = "Primary group for restored credential files.";
    };

    home = lib.mkOption {
      type = lib.types.str;
      default = "/home/zeta";
      description = "Home directory of the zeta user.";
    };

    repoRoot = lib.mkOption {
      type = lib.types.str;
      default = "${cfg.home}/Zeta";
      description = "Path to the checked-out Zeta repository on the installed node.";
    };

    scriptPath = lib.mkOption {
      type = lib.types.str;
      default = "${cfg.repoRoot}/src/Core.TypeScript/installer/zeta-creds-restore.ts";
      description = "Bun TypeScript entrypoint for restore CLI (B-0852.2b).";
    };

    blobPath = lib.mkOption {
      type = lib.types.str;
      default = "/boot/zeta-creds.enc";
      description = ''
        Path to encrypted cred-blob on the installed system.

        Contract: the file is the encrypted cred-blob produced by
        the installer's Step 6.95-picker and consumed by this
        service at boot. Default reflects the installed-system ESP
        mount path established by `disko-shapes/longhorn-node.nix`
        (`mountpoint = "/boot"`). If a host config uses a
        non-default ESP mount, override `blobPath` to match.

        Mount-path note (for operators copying this option to
        non-default ESP layouts): the installer writes the same
        physical file to `/mnt/boot/zeta-creds.enc` during install
        because the target ESP is mounted at `/mnt/boot` by
        Step 5. After reboot, disko mounts the same partition at
        `/boot`, so the producer and consumer share one physical
        ESP file at two mount paths — install-time vs
        installed-time. Override both sides if the ESP mount
        deviates from this convention.
      '';
    };

    usbUuidPath = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta/usb-uuid";
      description = "Path to file containing the USB UUID used as KDF binding (iter-4.2 ESP write).";
    };

    usbISerialPath = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta/usb-iserial";
      description = ''
        Recorded USB iSerial when persist bound that factor
        (ZETA_BIND_USB_ISERIAL=1). Kind is in factorPath; this file
        is the material. Not a live sysfs probe at boot.
      '';
    };

    uefiKeyfilePath = lib.mkOption {
      type = lib.types.str;
      default = "/boot/EFI/ZETA/keyfile";
      description = ''
        ESP keyfile when persist bound uefiKeyfile (ZETA_BIND_UEFI_KEYFILE=1).
        The binding IS this file — not copied to /etc. Install writes it
        at /mnt/boot/EFI/ZETA/keyfile; after reboot the same ESP is /boot.
        Missing file = fail closed (no UUID fallback).
      '';
    };

    factorPath = lib.mkOption {
      type = lib.types.str;
      default = "/boot/zeta-creds.factor";
      description = ''
        Sidecar next to the cred blob naming the binding factor kind
        (usbUuid / usbISerial / uefiKeyfile). Persist writes it. Missing
        file = usbUuid (backward compatible). Does not contain KDF material.
      '';
    };

    passphraseMode = lib.mkOption {
      type = lib.types.enum [ "file" "interactive" ];
      default = "file";
      description = "How to obtain the passphrase: file (pre-staged at /run) or interactive (systemd-ask-password).";
    };

    passphraseFile = lib.mkOption {
      type = lib.types.str;
      default = "/run/zeta-creds-passphrase";
      description = "When passphraseMode=file: read passphrase from this path (deleted on stop).";
    };

    persona = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Optional persona name; when set, restores persona-scoped credentials for that persona.";
    };
  };

  config = lib.mkIf cfg.enable {
    # QEMU guests expose fw_cfg via this module. Metal probe is a no-op.
    # Needed so phase-2 restore can stage /run/zeta-creds-passphrase from
    # `-fw_cfg file=` without persisting the QEMU test secret on the ESP.
    boot.kernelModules = [ "qemu_fw_cfg" ];

    systemd.services.zeta-creds-restore = {
      description = "Zeta credential restore from ESP at boot (B-0852.4a)";
      wantedBy = [ "multi-user.target" ];
      wants = [ "local-fs.target" ];
      after = [
        "local-fs.target"
      ];
      # B-0855.1 zeta-self-register.service declares
      # `after = "zeta-creds-restore.service"`; ordering enforced there.

      unitConfig = {
        ConditionPathExists = [
          cfg.blobPath
          cfg.usbUuidPath
          cfg.scriptPath
          bunShimPath
        ];
      };

      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        User = "root";  # needs root to read /run passphrase + drop to zeta user via sudo
        WorkingDirectory = cfg.repoRoot;
        Environment = [
          "HOME=${cfg.home}"
          "PATH=${cfg.home}/.local/share/mise/shims:${cfg.home}/.bun/bin:/run/current-system/sw/bin:/usr/bin:/bin"
        ];
        ExecStart = pkgs.writeShellScript "zeta-creds-restore-start" ''
          set -euo pipefail

          # Cleanup in EXIT trap (not ExecStopPost): Type=oneshot +
          # RemainAfterExit=true keeps the unit in active state after
          # ExecStart returns, so ExecStopPost doesn't fire on normal
          # successful boot (Copilot P0 finding on PR #5476). Trap
          # fires on ANY exit path — success or failure.
          cleanup() {
            rm -f /run/zeta-creds-passphrase-temp
            rm -f ${cfg.passphraseFile}
          }
          trap cleanup EXIT

          # QEMU scenario 3/4: mirror restore markers to serial so the
          # zflash harness can assert already-present / wrote without
          # physical USB (081KSNY2Z0008QG0R0008PN7RQ).
          _serial=""
          for _dev in /dev/ttyS0 /dev/ttyAMA0; do
            if [ -e "$_dev" ]; then
              _serial="$_dev"
              break
            fi
          done
          log_restore() {
            echo "$1"
            if [ -n "$_serial" ]; then
              echo "$1" >> "$_serial" || true
            fi
          }

          # QEMU-only staging: hypervisor `-fw_cfg name=opt/org.zeta/creds-passphrase,file=`
          # copies into ${cfg.passphraseFile}. Never log the contents. Metal has
          # no such sysfs node, so interactive ask-password is unchanged.
          ${pkgs.kmod}/bin/modprobe qemu_fw_cfg >/dev/null 2>&1 || true
          FWCFG_RAW="/sys/firmware/qemu_fw_cfg/by_name/opt/org.zeta/creds-passphrase/raw"
          if [ -r "$FWCFG_RAW" ]; then
            umask 0177
            head -c 4096 "$FWCFG_RAW" > ${cfg.passphraseFile}
            chmod 0400 ${cfg.passphraseFile}
            log_restore "zeta-creds-restore: passphrase staged from qemu fw_cfg"
          fi

          log_restore "zeta-creds-restore: reading preserved ESP blob"

          FACTOR="usbUuid"
          if [ -f ${cfg.factorPath} ]; then
            FACTOR="$(tr -d '[:space:]' < ${cfg.factorPath})"
          fi
          BIND_FLAG="--usb-uuid"
          BIND_VALUE=""
          if [ "$FACTOR" = "usbISerial" ]; then
            if [ ! -s ${cfg.usbISerialPath} ]; then
              log_restore "zeta-creds-restore: usb iSerial recorded but serial file missing; aborting (refusing UUID fallback)"
              exit 1
            fi
            BIND_VALUE="$(tr -d '\r\n' < ${cfg.usbISerialPath})"
            if [ -z "$BIND_VALUE" ]; then
              log_restore "zeta-creds-restore: usb iSerial recorded but serial file missing; aborting (refusing UUID fallback)"
              exit 1
            fi
            BIND_FLAG="--usb-iserial"
            log_restore "zeta-creds-restore: binding-factor usbISerial (recorded; not a live probe)"
          elif [ "$FACTOR" = "uefiKeyfile" ]; then
            if [ ! -s ${cfg.uefiKeyfilePath} ]; then
              log_restore "zeta-creds-restore: uefiKeyfile recorded but ESP keyfile missing; aborting (refusing UUID fallback)"
              exit 1
            fi
            BIND_FLAG="--uefi-keyfile"
            BIND_VALUE="${cfg.uefiKeyfilePath}"
            log_restore "zeta-creds-restore: binding-factor uefiKeyfile (ESP file; not copied to /etc)"
          elif [ -n "$FACTOR" ] && [ "$FACTOR" != "usbUuid" ]; then
            log_restore "zeta-creds-restore: unknown binding-factor; aborting"
            exit 1
          else
            # Strip whitespace from UUID (Copilot P1 finding): `cat`
            # includes trailing newline if file ends with one.
            BIND_VALUE="$(tr -d '[:space:]' < ${cfg.usbUuidPath})"
            if [ -z "$BIND_VALUE" ]; then
              log_restore "zeta-creds-restore: empty USB UUID at ${cfg.usbUuidPath}; aborting"
              exit 1
            fi
            log_restore "zeta-creds-restore: binding-factor usbUuid (default)"
          fi

          if [ -s ${cfg.passphraseFile} ]; then
            PASSPHRASE_PATH="${cfg.passphraseFile}"
          else
            ${
              if cfg.passphraseMode == "file" then ''
                log_restore "zeta-creds-restore: passphrase file ${cfg.passphraseFile} missing (passphraseMode=file)"
                exit 1
              '' else ''
                # interactive mode: prompt operator via systemd-ask-password
                # unless QEMU (or an operator) already staged passphraseFile.
                PASSPHRASE_PATH="/run/zeta-creds-passphrase-temp"
                PASSPHRASE="$(${pkgs.systemd}/bin/systemd-ask-password \
                  --timeout=300 \
                  "Zeta cred-blob passphrase: ")"
                if [ -z "$PASSPHRASE" ]; then
                  log_restore "zeta-creds-restore: empty passphrase from systemd-ask-password"
                  exit 1
                fi
                umask 0177
                echo -n "$PASSPHRASE" > "$PASSPHRASE_PATH"
                chmod 0400 "$PASSPHRASE_PATH"
                unset PASSPHRASE
              ''
            }
          fi

          PERSONA_ARGS=""
          ${lib.optionalString (cfg.persona != null) ''
            PERSONA_ARGS="--persona ${cfg.persona}"
          ''}

          # Run as ROOT (Copilot P0 finding): the default cred manifest
          # includes /etc/* paths (operator-authorized-keys, ssh_host_*)
          # that only root can write. Post-restore chown step fixes
          # ownership for ${cfg.home} paths so user-facing creds end
          # up zeta-owned not root-owned.
          # Tee CLI stdout/stderr so "already-present" / "wrote N" hit serial.
          if [ -n "$_serial" ]; then
            ${bunShimPath} ${cfg.scriptPath} \
              "$BIND_FLAG" "$BIND_VALUE" \
              --input ${cfg.blobPath} \
              --passphrase-file "$PASSPHRASE_PATH" \
              --target-root / \
              $PERSONA_ARGS 2>&1 | ${pkgs.coreutils}/bin/tee -a "$_serial"
          else
            ${bunShimPath} ${cfg.scriptPath} \
              "$BIND_FLAG" "$BIND_VALUE" \
              --input ${cfg.blobPath} \
              --passphrase-file "$PASSPHRASE_PATH" \
              --target-root / \
              $PERSONA_ARGS
          fi

          # Post-restore ownership fix: chown ${cfg.home} entries that
          # the manifest writes into (~/.config/gh, ~/.config/claude,
          # ~/.gemini, ~/.codex, etc.) so the zeta user can read them.
          # Only chown files OWNED BY ROOT (operator's pre-existing
          # configs stay untouched).
          if [ -d "${cfg.home}" ]; then
            find "${cfg.home}" -maxdepth 4 -user root -exec chown ${cfg.user}:${cfg.group} {} + 2>/dev/null || true
          fi
        '';
        Restart = "on-failure";
        RestartSec = "30s";
      };
    };
  };
}
