#!/usr/bin/env bash
# zeta-first-boot — auto-invoked on first boot of the installer ISO.
#
# Lives on the USB at /run/current-system/sw/bin/zeta-first-boot (installed
# by the installer's configuration.nix). The systemd unit
# `zeta-first-boot.service` runs this on tty1 right after boot when the
# marker file `/etc/zeta-firstboot-enabled` is present (which it always
# is on a fresh installer ISO).
#
# Flow:
#   1. Wait up to 30s for ethernet DHCP + internet
#   2. If no internet, auto-launch `nmtui` for wifi setup (one TUI form)
#   3. Once internet is up, exec `zeta-install $HOST` non-interactively
#      (HOST read from /etc/zeta-firstboot.conf; defaults to control-plane)
#
# Why this exists: per 081KSGS9H0008QG0R002T3BJ2R, node-side typing was the second half of
# the cluster-install bandwidth wall (zflash one-touch on Mac, then ~8
# commands of bandwidth-bad console typing on the node). This script
# reduces node-side typing to:
#   - 0 commands if ethernet has DHCP + internet
#   - 1 TUI session (nmtui) if wifi only
#
# Exit policy: never `exit 1` from this script — on any failure, drop the
# operator to a shell so they can recover with the existing manual flow.

set -uo pipefail

# 081KSNY2Z0008QG0R0008PN7RQ: mirror first-boot + zeta-install progress to the serial UART.
# zeta-first-boot.service binds stdout to tty1 for the operator; QEMU/CI
# harnesses poll ttyS0 (x86) or ttyAMA0 (aarch64). Kernel cmdline lists
# console=tty1 last, so /dev/console is tty1 — tee there is a no-op for
# serial. Mirror to the hardware UART instead.
_b0891_serial_dev=""
for _dev in /dev/ttyS0 /dev/ttyAMA0; do
  if [[ -w "$_dev" ]]; then
    _b0891_serial_dev="$_dev"
    break
  fi
done
if [[ -n "$_b0891_serial_dev" ]]; then
  exec 3>&1
  exec > >(/run/current-system/sw/bin/tee -a "$_b0891_serial_dev" >&3) 2>&1
fi

CONF=/etc/zeta-firstboot.conf
[[ -f "$CONF" ]] && . "$CONF"

# ── 081KSNY2Z0008QG0R0008PN7RQ scenario 5: ESP-provided role overrides the ISO's ──
#
# The line above sources a file baked into the ISO's read-only Nix store, which
# ships HOST=control-plane. That made the role an ISO-BUILD-time decision, so
# every medium cut from one ISO installed a control plane and a second node
# could never be provisioned as a joiner (the installer's own comment deferred a
# per-flash --role to "v2").
#
# zflash now writes /zeta-firstboot.conf to the boot ESP
# (src/Core.TypeScript/zflash/firstboot-role.ts). Source it AFTER the ISO's copy
# so the flash wins, which is the whole point: the role travels with the flash.
#
# Strictly additive and fail-safe — if no ESP conf is found, everything below is
# byte-identical to the previous behaviour. The ESP is mounted read-only; every
# value in that file passed a conservative allowlist at flash time (no $, no
# backtick, no ;, no quotes, no newline) and is emitted single-quoted, because
# this line SOURCES it as bash.
ZETA_ROLE_SOURCE="iso:/etc/zeta-firstboot.conf"
ESP_CONF_MOUNT=/run/zeta-boot-esp
zeta_source_esp_firstboot_conf() {
  local part conf
  mkdir -p "$ESP_CONF_MOUNT" 2>/dev/null || return 1
  for part in /dev/disk/by-label/* /dev/sd?[0-9] /dev/nvme?n?p[0-9] /dev/vd?[0-9] /dev/mmcblk?p[0-9]; do
    [[ -b "$part" ]] || continue
    mount -t vfat -o ro "$part" "$ESP_CONF_MOUNT" 2>/dev/null || continue
    conf="$ESP_CONF_MOUNT/zeta-firstboot.conf"
    if [[ -f "$conf" ]]; then
      # shellcheck disable=SC1090
      . "$conf"
      ZETA_ROLE_SOURCE="esp:$part"
      umount "$ESP_CONF_MOUNT" 2>/dev/null || true
      return 0
    fi
    umount "$ESP_CONF_MOUNT" 2>/dev/null || true
  done
  return 1
}
zeta_source_esp_firstboot_conf || true

HOST="${HOST:-control-plane}"
ZETA_ROLE="${ZETA_ROLE:-first-control-plane}"
echo "[081KSNY2Z0008QG0R0008PN7RQ-role] role=${ZETA_ROLE} host=${HOST} source=${ZETA_ROLE_SOURCE}"
if [[ "${ZETA_ROLE}" == "joiner" ]]; then
  echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   join server: ${ZETA_JOIN_SERVER_URL:-<unset>}"
  echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   token on ESP: ${ZETA_JOIN_TOKEN_ESP_PATH:-<unset>}"
  export ZETA_JOIN_SERVER_URL="${ZETA_JOIN_SERVER_URL:-}"
  export ZETA_JOIN_TOKEN_ESP_PATH="${ZETA_JOIN_TOKEN_ESP_PATH:-}"
fi
export ZETA_ROLE
REPO_URL="${REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
ETHERNET_WAIT_SECS="${ETHERNET_WAIT_SECS:-30}"
ROLE_PROMPT_SECS="${ROLE_PROMPT_SECS:-10}"
# 081KSGS9H0008QG0R001Q2DH2H nmtui retry-prompt timeout — operator window to press 's' for
# shell-drop OR any other key (or wait) for nmtui re-launch. Mirrors
# the ROLE_PROMPT_SECS env-override pattern so the timeout is tunable
# without source edits.
NMTUI_RETRY_PROMPT_SECS="${NMTUI_RETRY_PROMPT_SECS:-10}"
# 081KSNY2Z0008QG0R0008PN7RQ: QEMU/ethernet-only hosts have no wl* iface — nmtui cannot help on serial.
NO_WIFI_EXTRA_WAIT_SECS="${NO_WIFI_EXTRA_WAIT_SECS:-90}"

# ── Role pick: 10-sec single-keystroke prompt ─────────────────────────
# Defaults to whatever the ISO's /etc/zeta-firstboot.conf shipped with
# (typically control-plane). Press 'c' or 'w' within ${ROLE_PROMPT_SECS}s
# to choose; any other key (or timeout) keeps the default.
# ANSI 'reset terminal' escape — no external `clear` dependency,
# works on bare tty without requiring `ncurses` + a TERM that
# tput recognises. Fixes 081KSGS9H0008QG0R002T3BJ2R iteration-1 'clear: command not
# found' from the systemd unit's minimal PATH.
printf '\033c' || true
cat <<EOF

  Zeta cluster installer — first boot

  Default role: ${HOST}

  Press 'c' for control-plane
  Press 'w' for worker-gpu
  Or wait ${ROLE_PROMPT_SECS}s to accept default (${HOST}) ...

EOF
ROLE_KEY=""
read -n 1 -s -t "${ROLE_PROMPT_SECS}" ROLE_KEY || true
case "${ROLE_KEY,,}" in
  # 081KSNY2Z0008QG0R0008PN7RQ: an operator keypress moves ZETA_ROLE too. Without
  # this the two could disagree — HOST=control-plane with ZETA_ROLE=joiner —
  # and the install would found a cluster while every later step believed it
  # was joining one.
  c) HOST=control-plane; ZETA_ROLE=first-control-plane ;;
  w) HOST=worker-gpu; ZETA_ROLE=joiner ;;
  *) ;;  # keep default
esac
export ZETA_ROLE
echo "Role selected: ${HOST} (role=${ZETA_ROLE})"
echo

drop_to_shell() {
  echo
  echo "[zeta-first-boot] Dropping to interactive shell."
  echo "  - Manual install: \`zeta-install $HOST\`"
  echo "  - Reboot: \`reboot\`"
  echo
  exec /run/current-system/sw/bin/bash
}

has_internet() {
  # IP first (QEMU NAT often has DNS lag); github.com proves DNS for nixos-install.
  ping -c 1 -W 2 -q 1.1.1.1 >/dev/null 2>&1 && return 0
  ping -c 1 -W 2 -q github.com >/dev/null 2>&1
}

has_wifi_hardware() {
  local _iface _name
  for _iface in /sys/class/net/*; do
    _name=$(basename "$_iface")
    [[ "$_name" == lo ]] && continue
    if [[ -d "$_iface/wireless" ]] || [[ "$_name" == wl* ]]; then
      return 0
    fi
  done
  return 1
}

# ANSI 'reset terminal' escape — no external `clear` dependency,
# works on bare tty without requiring `ncurses` + a TERM that
# tput recognises. Fixes 081KSGS9H0008QG0R002T3BJ2R iteration-1 'clear: command not
# found' from the systemd unit's minimal PATH.
printf '\033c' || true
cat <<EOF

  ╭──────────────────────────────────────────────────────╮
  │  Zeta cluster installer — first-boot auto-install    │
  │  Target role: ${HOST}
  │  Repo:        ${REPO_URL}
  ╰──────────────────────────────────────────────────────╯

EOF

echo "[1/3] Waiting up to ${ETHERNET_WAIT_SECS}s for ethernet DHCP + internet ..."
WAITED=0
while ! has_internet; do
  if [[ "$WAITED" -ge "$ETHERNET_WAIT_SECS" ]]; then
    break
  fi
  sleep 5
  WAITED=$((WAITED + 5))
  echo "  ... ${WAITED}s"
done

if has_internet; then
  echo "  ethernet ok (DHCP)"
else
  if ! has_wifi_hardware; then
    echo
    echo "[2/3] No wifi hardware — waiting up to ${NO_WIFI_EXTRA_WAIT_SECS}s for ethernet (081KSNY2Z0008QG0R0008PN7RQ headless/QEMU)."
    WAITED=0
    while ! has_internet; do
      if [[ "$WAITED" -ge "$NO_WIFI_EXTRA_WAIT_SECS" ]]; then
        break
      fi
      sleep 5
      WAITED=$((WAITED + 5))
      echo "  ... ${WAITED}s"
    done
    if has_internet; then
      echo "  ethernet ok (after extra wait)"
    else
      echo "[zeta-first-boot] Still offline; proceeding to zeta-install (will fail loudly if unreachable)."
    fi
  else
  echo
  echo "[2/3] No ethernet internet detected. Launching wifi setup (nmtui)."
  echo "      After connecting, quit nmtui to continue install."
  echo "      Esc out without connecting → nmtui re-launches to refresh scan."
  echo
  read -n 1 -s -t 5 -p "  Press any key to launch nmtui (or wait 5s) ..." || true
  echo
  echo
  # 081KSGS9H0008QG0R001Q2DH2H nmtui auto-relaunch-on-no-internet loop (operator 2026-05-26):
  #
  # Old behavior: launch nmtui once; if no internet on exit → drop_to_shell.
  # That broke the install flow when operator hit Esc to refresh the wifi
  # scan (empirical 2026-05-26 1st USB physical-test session — see 081KSGS9H0008QG0R001Q2DH2H).
  #
  # New behavior: loop nmtui until either (a) has_internet succeeds OR
  # (b) operator explicitly requests shell-drop via 's' keystroke. Esc
  # out of nmtui without connecting just re-launches nmtui (refresh-
  # friendly UX — operator can Esc + re-scan as needed).
  #
  # Per operator 2026-05-26: "i want to be able to refresh the network
  # withing breaking the script". This loop is the substrate-honest fix.
  #
  # nmtui returns 0 on quit regardless of whether connection succeeded.
  # Absolute path: defense-in-depth alongside the systemd unit's
  # environment.PATH override (set in configuration.nix on
  # systemd.services.zeta-first-boot.environment.PATH via lib.mkForce).
  # Both defenses together fix 081KSGS9H0008QG0R002T3BJ2R iteration-1 'nmtui: command not
  # found' (nmtui IS installed in the ISO via networkmanager in
  # systemPackages; the issue was PATH inheritance into the unit).
  NMTUI_ATTEMPTS=0
  while true; do
    NMTUI_ATTEMPTS=$((NMTUI_ATTEMPTS + 1))
    if ! /run/current-system/sw/bin/nmtui; then
      echo "[zeta-first-boot] nmtui failed to launch (attempt ${NMTUI_ATTEMPTS})."
      drop_to_shell
    fi
    # Give NetworkManager a moment to actually establish + DHCP
    sleep 3
    if has_internet; then
      echo "  wifi ok (after ${NMTUI_ATTEMPTS} nmtui session(s))"
      break
    fi
    # No internet yet — give operator the choice to retry or escape
    echo
    echo "[zeta-first-boot] No internet after nmtui session ${NMTUI_ATTEMPTS}."
    echo "                  Press 's' within ${NMTUI_RETRY_PROMPT_SECS}s to drop to shell, OR"
    echo "                  press any other key (or wait) to re-launch nmtui"
    echo "                  to refresh the wifi scan."
    echo
    CHOICE=""
    read -r -n 1 -s -t "${NMTUI_RETRY_PROMPT_SECS}" -p "  > " CHOICE || true
    echo
    case "$CHOICE" in
      s|S)
        echo "[zeta-first-boot] Dropping to shell at operator request."
        drop_to_shell
        ;;
      *)
        echo "[zeta-first-boot] Re-launching nmtui for refresh ..."
        echo
        ;;
    esac
  done
  fi
fi

echo
echo "[3/3] Running zeta-install $HOST (non-interactive) ..."
echo
# Non-interactive env-var trio: bypass every interactive prompt
# zeta-install would otherwise hit.
#   BOOT_DISK=auto      -> resolves to fastest internal disk (NVMe>SSD>HDD)
#   ZETA_AUTO_CONFIRM=WIPE -> skip the typed-WIPE confirmation
#   HOST passed as positional arg -> skip the host prompt
#
# CORRECTED 2026-08-21. This comment used to read: "Operator destructive-
# install consent is the 10-second role keystroke window above + the device-
# list display zeta-install prints before wiping (Ctrl-C window)."
#
# That described a window that did not exist. There was no sleep between the
# device list and wipefs, so the Ctrl-C window was zero-width, and the role
# keystroke window is a ROLE prompt, not a wipe prompt. A comment asserting a
# guarantee the code does not provide is the failure class this repo is built
# around, so it is named here rather than quietly replaced.
#
# What the consent actually is NOW: zeta-install Step 2.5 probes each in-scope
# disk read-only and prints what is on it, then Step 2.9 runs a real countdown
# (default 60s, 10s when every in-scope disk probes blank) whose default is
# PROCEED and where any keypress aborts to a shell. That countdown runs on
# THIS path too, which is why the zero-typing install still costs the window.
# ZETA_AUTO_CONFIRM=WIPE skips the TYPED prompt; it does not skip the window.
#
# Flash-time consent is still NOT delegated to boot time. The gate is at boot,
# on screen, with the device findings visible.
export ZETA_AUTO_CONFIRM=WIPE
export BOOT_DISK=auto
export HOST
export REPO_URL
# zeta-install handles the rest: disk enum → wipe → partition →
# format → mount → clone → nixos-install. Exits with the OS still
# booted in the USB live environment; this script then reboots so
# the freshly installed node comes up on its own disk.
if /run/current-system/sw/bin/zeta-install "$HOST"; then
  echo
  echo "[zeta-first-boot] Install complete. Rebooting in 10s (Ctrl-C to cancel) ..."
  sleep 10
  systemctl reboot
else
  echo
  echo "[zeta-first-boot] Install failed. See output above."
  drop_to_shell
fi
