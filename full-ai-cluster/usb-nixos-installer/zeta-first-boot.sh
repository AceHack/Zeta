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

CONF=/etc/zeta-firstboot.conf
[[ -f "$CONF" ]] && . "$CONF"
HOST="${HOST:-control-plane}"
REPO_URL="${REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
ETHERNET_WAIT_SECS="${ETHERNET_WAIT_SECS:-30}"
ROLE_PROMPT_SECS="${ROLE_PROMPT_SECS:-10}"

# ── Role pick: 10-sec single-keystroke prompt ─────────────────────────
# Defaults to whatever the ISO's /etc/zeta-firstboot.conf shipped with
# (typically control-plane). Press 'c' or 'w' within ${ROLE_PROMPT_SECS}s
# to choose; any other key (or timeout) keeps the default.
clear || true
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

clear || true
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
  echo
  read -n 1 -s -t 5 -p "  Press any key to launch nmtui (or wait 5s) ..." || true
  echo
  echo
  # nmtui returns 0 on quit regardless of whether connection succeeded
  if ! nmtui; then
    echo "[zeta-first-boot] nmtui failed."
    drop_to_shell
  fi
  # Give NetworkManager a moment to actually establish + DHCP
  sleep 3
  if ! has_internet; then
    echo "[zeta-first-boot] No internet after nmtui. Check connection and"
    echo "                  re-run zeta-install $HOST when network is up."
    drop_to_shell
  fi
  echo "  wifi ok"
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
