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
#       passphrase-source.ts calls systemd-ask-password on tty1.
#       Hexagonal port (planPassphraseSource + PassphraseSourceEffects);
#       metal path is unit-tested via a mock ask-password adapter.
#       Still writes a temporary file; B-0852.4b may switch to a stdin
#       pipe to the restore CLI.
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

      # 081M0WTB5MN: the four preconditions used to live in
      # unitConfig.ConditionPathExists, which makes systemd SKIP the unit with
      # ZERO serial output — a skip and a real failure were indistinguishable in
      # CI (run 32816110015 booted to a login prompt with not one
      # zeta-creds-restore line). They are now checked inside ExecStart (below),
      # which NAMES any missing path on serial and then exits 0, preserving the
      # original non-fatal skip. The mechanism is unchanged; the skip is legible.

      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        User = "root";  # needs root to read /run passphrase + drop to zeta user via sudo
        # 081M0WTB5MN: WorkingDirectory was cfg.repoRoot (the cloned repo). If that
        # directory is not present when the unit fires (After=local-fs.target is
        # early), systemd fails the unit at chdir — BEFORE ExecStart — so none of
        # the ExecStart logging below runs and the unit is SILENT. That is exactly
        # what run 32873212247 showed: zero zeta-creds-restore lines in phase-2
        # even with the in-ExecStart precondition gate. ExecStart uses absolute
        # paths only, so cwd is irrelevant; "/" always exists and never fails the
        # chdir. Repo/script presence is still checked (and NAMED) by the
        # precondition gate inside ExecStart.
        WorkingDirectory = "/";
        Environment = [
          "HOME=${cfg.home}"
          "PATH=${cfg.home}/.local/share/mise/shims:${cfg.home}/.bun/bin:/run/current-system/sw/bin:/usr/bin:/bin"
          # 081M0WTB5MN: trust the repo's .mise.toml so the `bun` shim can resolve
          # its pinned version. The shim reads the version from the nearest
          # trusted .mise.toml; without a trusted config it errors
          # "No version is set for shim: bun" and restore never runs.
          "MISE_TRUSTED_CONFIG_PATHS=${cfg.repoRoot}"
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

          # 081M0WTB5MN: unconditional FIRST line, before any gate. Its presence
          # proves ExecStart ran at all; its ABSENCE means the unit failed before
          # ExecStart (WorkingDirectory chdir, User, Environment) — a distinction
          # the precondition gate below cannot make, because a pre-ExecStart
          # failure never reaches it.
          log_restore "zeta-creds-restore: ExecStart entered"

          # 081M0WTB5MN: precondition gate, moved here from
          # unitConfig.ConditionPathExists so a missing path is NAMED on serial
          # rather than skipping the unit silently. The four paths: the ESP blob,
          # the recorded USB UUID, the restore CLI in the cloned repo, and the
          # zeta user's mise bun shim. Exit 0 on a miss keeps the original skip
          # semantics (non-fatal boot, no Restart="on-failure" retry storm).
          _missing=""
          for _req in ${cfg.blobPath} ${cfg.usbUuidPath} ${cfg.scriptPath} ${bunShimPath}; do
            if [ ! -e "$_req" ]; then
              _missing="$_missing $_req"
              log_restore "zeta-creds-restore: MISSING precondition $_req; skipping restore"
            fi
          done
          if [ -n "$_missing" ]; then
            # 081M0WTB5MN Layer-3: when a precondition is missing (typically the
            # ESP blob), NAME what /boot actually is and what it holds — so CI can
            # tell "blob never delivered" from "phase-2 mounts a different /boot
            # than the installer wrote to".
            log_restore "zeta-creds-restore: /boot mount: $(grep ' /boot ' /proc/mounts 2>/dev/null | head -1 || echo none)"
            log_restore "zeta-creds-restore: /boot listing: $(ls -1 /boot 2>/dev/null | tr '\n' ' ' || echo none)"
            exit 0
          fi

          # Passphrase door is passphrase-source.ts (hexagonal port). The three
          # transports and their serial strings live there so the metal tty1
          # path is unit-testable via mock effects. This unit MUST call that
          # script — a second shell implementation would desync the serial
          # contract. bun is resolved here (before restore CLI) because the
          # stager is also TypeScript.
          cd "${cfg.repoRoot}"
          BUN_BIN="$(ls -1 ${cfg.home}/.local/share/mise/installs/bun/*/bin/bun 2>/dev/null | sort -V | tail -1 || true)"
          if [ -z "$BUN_BIN" ] || [ ! -x "$BUN_BIN" ]; then
            BUN_BIN="${bunShimPath}"
          fi
          log_restore "zeta-creds-restore: bun binary $BUN_BIN (cwd $(pwd))"

          PASSPHRASE_SOURCE="${cfg.repoRoot}/src/Core.TypeScript/installer/passphrase-source.ts"
          if [ ! -e "$PASSPHRASE_SOURCE" ]; then
            log_restore "zeta-creds-restore: MISSING passphrase-source $PASSPHRASE_SOURCE"
            exit 1
          fi

          PASSPHRASE_TRANSPORT="none"
          PASSPHRASE_PATH=""
          STAGE_RC=0
          STAGE_OUT="$("$BUN_BIN" "$PASSPHRASE_SOURCE" \
            --stage \
            --passphrase-file ${cfg.passphraseFile} \
            --mode ${cfg.passphraseMode} \
            --fwcfg-raw /sys/firmware/qemu_fw_cfg/by_name/opt/org.zeta/creds-passphrase/raw \
            --ask-password-bin ${pkgs.systemd}/bin/systemd-ask-password \
            --temp-file /run/zeta-creds-passphrase-temp 2>&1)" || STAGE_RC=$?
          while IFS= read -r _line || [ -n "$_line" ]; do
            case "$_line" in
              PASSPHRASE_TRANSPORT=*) PASSPHRASE_TRANSPORT="''${_line#PASSPHRASE_TRANSPORT=}" ;;
              PASSPHRASE_PATH=*) PASSPHRASE_PATH="''${_line#PASSPHRASE_PATH=}" ;;
              "") ;;
              *) log_restore "$_line" ;;
            esac
          done <<EOF
$STAGE_OUT
EOF
          if [ "$STAGE_RC" -ne 0 ]; then
            exit 1
          fi
          if [ -z "$PASSPHRASE_PATH" ]; then
            log_restore "zeta-creds-restore: passphrase-source produced no PASSPHRASE_PATH"
            exit 1
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
          #
          # 081M0WTB5MN: run from the repo so the mise `bun` shim resolves its
          # version from the repo's .mise.toml. WorkingDirectory stays "/" (so the
          # unit never fails its chdir before ExecStart); the repo is guaranteed
          # present here because the precondition gate above already verified
          # ${cfg.scriptPath} exists. Without this cd the shim errors
          # "No version is set for shim: bun" and restore never runs (run
          # 32952620895: blob delivered + read, then died on the bun shim).
          # bun was resolved above (passphrase-source.ts). Stay in the repo so
          # the restore CLI matches the same binary. WorkingDirectory stays "/".
          cd "${cfg.repoRoot}"
          # The restore's exit status is HELD, not acted on, until the ownership
          # pass below has run. This script runs under `set -e` and the CLI runs as
          # ROOT with HOME=${cfg.home}: every file it (or the mise `bun` shim it
          # launches) created before dying is root-owned inside the operator's
          # home, and an early exit used to skip the only step that repairs that.
          # A restore that fails half-way must not ALSO leave ~ unreadable to the
          # user it was restoring for.
          RESTORE_RC=0
          if [ -n "$_serial" ]; then
            "$BUN_BIN" ${cfg.scriptPath} \
              "$BIND_FLAG" "$BIND_VALUE" \
              --input ${cfg.blobPath} \
              --passphrase-file "$PASSPHRASE_PATH" \
              --target-root / \
              $PERSONA_ARGS 2>&1 | ${pkgs.coreutils}/bin/tee -a "$_serial" || RESTORE_RC=$?
          else
            "$BUN_BIN" ${cfg.scriptPath} \
              "$BIND_FLAG" "$BIND_VALUE" \
              --input ${cfg.blobPath} \
              --passphrase-file "$PASSPHRASE_PATH" \
              --target-root / \
              $PERSONA_ARGS || RESTORE_RC=$?
          fi

          # Post-restore ownership fix: chown ${cfg.home} entries that
          # the manifest writes into (~/.config/gh, ~/.config/claude,
          # ~/.gemini, ~/.codex, etc.) so the zeta user can read them.
          # Only chown files OWNED BY ROOT (operator's pre-existing
          # configs stay untouched).
          #
          # NO depth cap. This was `-maxdepth 4`, which repaired the manifest's
          # own paths (depth <= 3) but not what the root-run `bun`/mise shim
          # leaves BELOW them (~/.cache/mise/..., ~/.local/state/mise/...,
          # ~/.bun/install/cache/...) -- the same root-owned-path-in-~ class as
          # the ~/.kube defect (081M3K16QKA087G0R002GT2F8X). `-h` so a root-owned
          # symlink is re-owned itself, never its target; `-xdev` so a mount
          # inside the home is not walked.
          if [ -d "${cfg.home}" ]; then
            ${pkgs.findutils}/bin/find "${cfg.home}" -xdev -user root -exec ${pkgs.coreutils}/bin/chown -h ${cfg.user}:${cfg.group} {} + 2>/dev/null || true
          fi
          exit "$RESTORE_RC"
        '';
        Restart = "on-failure";
        RestartSec = "30s";
      };
    };
  };
}
