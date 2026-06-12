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
# Why this exists: per B-0754, node-side typing was the second half of
# the cluster-install bandwidth wall (zflash one-touch on Mac, then ~8
# commands of bandwidth-bad console typing on the node). This script
# reduces node-side typing to:
#   - 0 commands if ethernet has DHCP + internet
#   - 1 TUI session (nmtui) if wifi only
#
# Exit policy: never `exit 1` from this script — on any failure, drop the
# operator to a shell so they can recover with the existing manual flow.

set -uo pipefail

# B-0891: mirror first-boot + zeta-install progress to the kernel console.
# zeta-first-boot.service binds stdout to tty1 for the operator; QEMU and
# CI harnesses capture serial (console=ttyS0 → /dev/console). Without this
# tee, [iter-5.1] and retention markers never appear in serial logs even
# when install succeeds on tty1.
if [[ -w /dev/console ]]; then
  exec 3>&1
  exec > >(/run/current-system/sw/bin/tee -a /dev/console >&3) 2>&1
fi

CONF=/etc/zeta-firstboot.conf
[[ -f "$CONF" ]] && . "$CONF"
HOST="${HOST:-control-plane}"
REPO_URL="${REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
ETHERNET_WAIT_SECS="${ETHERNET_WAIT_SECS:-30}"
ROLE_PROMPT_SECS="${ROLE_PROMPT_SECS:-10}"
# B-0832 nmtui retry-prompt timeout — operator window to press 's' for
# shell-drop OR any other key (or wait) for nmtui re-launch. Mirrors
# the ROLE_PROMPT_SECS env-override pattern so the timeout is tunable
# without source edits.
NMTUI_RETRY_PROMPT_SECS="${NMTUI_RETRY_PROMPT_SECS:-10}"

# ── Role pick: 10-sec single-keystroke prompt ─────────────────────────
# Defaults to whatever the ISO's /etc/zeta-firstboot.conf shipped with
# (typically control-plane). Press 'c' or 'w' within ${ROLE_PROMPT_SECS}s
# to choose; any other key (or timeout) keeps the default.
# ANSI 'reset terminal' escape — no external `clear` dependency,
# works on bare tty without requiring `ncurses` + a TERM that
# tput recognises. Fixes B-0754 iteration-1 'clear: command not
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
  c) HOST=control-plane ;;
  w) HOST=worker-gpu ;;
  *) ;;  # keep default
esac
echo "Role selected: ${HOST}"
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
  # Use 2-second timeout per ping; rely on DNS to also be working since
  # nixos-install needs it later anyway.
  ping -c 1 -W 2 -q github.com >/dev/null 2>&1
}

# ANSI 'reset terminal' escape — no external `clear` dependency,
# works on bare tty without requiring `ncurses` + a TERM that
# tput recognises. Fixes B-0754 iteration-1 'clear: command not
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
  echo
  echo "[2/3] No ethernet internet detected. Launching wifi setup (nmtui)."
  echo "      After connecting, quit nmtui to continue install."
  echo "      Esc out without connecting → nmtui re-launches to refresh scan."
  echo
  read -n 1 -s -t 5 -p "  Press any key to launch nmtui (or wait 5s) ..." || true
  echo
  echo
  # B-0832 nmtui auto-relaunch-on-no-internet loop (operator 2026-05-26):
  #
  # Old behavior: launch nmtui once; if no internet on exit → drop_to_shell.
  # That broke the install flow when operator hit Esc to refresh the wifi
  # scan (empirical 2026-05-26 1st USB physical-test session — see B-0832).
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
  # Both defenses together fix B-0754 iteration-1 'nmtui: command not
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

echo
echo "[3/3] Running zeta-install $HOST (non-interactive) ..."
echo
# Non-interactive env-var trio: bypass every interactive prompt
# zeta-install would otherwise hit.
#   BOOT_DISK=auto      → resolves to fastest internal disk (NVMe>SSD>HDD)
#   ZETA_AUTO_CONFIRM=WIPE → skip the typed-WIPE confirmation
#   HOST passed as positional arg → skip the host prompt
# Operator's destructive-install consent is the 10-second role
# keystroke window above + the device-list display zeta-install
# prints before wiping (Ctrl-C window). NOT delegated from
# flash-time; the consent is at boot-time, on-screen, with
# device-list visible.
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
