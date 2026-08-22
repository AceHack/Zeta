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
  c) HOST=control-plane; ZETA_ROLE=first-control-plane; ZETA_ROLE_SOURCE="keystroke:c" ;;
  w) HOST=worker-gpu; ZETA_ROLE=joiner; ZETA_ROLE_SOURCE="keystroke:w" ;;
  *) ;;  # keep default
esac
export ZETA_ROLE
echo "Role selected: ${HOST} (role=${ZETA_ROLE})"
echo

# ── DECLARED vs DEFAULTED (081KSE6WT0008QG0R000CV98PV) ────────────────
#
# The distinction the discovery block further down turns on, and the reason
# the split-brain bug exists at all.
#
# `HOST` and `ZETA_ROLE` are ALWAYS set by the time we get here, because the
# ISO's own /etc/zeta-firstboot.conf ships `HOST=control-plane`. So "is a role
# set?" is useless as a question -- the answer is always yes, and reading that
# yes as an operator decision is exactly how every stick cut from one ISO
# founds its own cluster.
#
# What separates the two is PROVENANCE, and ZETA_ROLE_SOURCE already carries
# it:
#   esp:<part>        a zflash --role flash wrote it. A human chose it.  DECLARED
#   keystroke:c|w     a human pressed a key at the prompt above.         DECLARED
#   iso:/etc/...      nobody chose anything; it is the build-time
#                     fallback baked into every copy of the image.       DEFAULTED
#
# Discovery is consulted ONLY in the DEFAULTED case. A declaration always
# wins -- a node the operator called a control plane must not become an agent
# because something answered on the segment.
case "${ZETA_ROLE_SOURCE}" in
  esp:*|keystroke:*) ZETA_ROLE_DECLARED=yes ;;
  *)                 ZETA_ROLE_DECLARED=no  ;;
esac
echo "[081KSE6WT0008QG0R000CV98PV-role] declared=${ZETA_ROLE_DECLARED} source=${ZETA_ROLE_SOURCE}"
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

# ── Cluster discovery: bootstrap or join (081KSE6WT0008QG0R000CV98PV) ────
#
# Runs `zeta-cluster-discover`, which browses the segment for the Zeta cluster
# service type over the dwell and prints ONE JSON line. Contract:
#   exit 0  .action is "bootstrap" or "join"
#   exit 3  .action is "refuse", with .reason / .detail / .operatorAction
#   exit 2  bad arguments
#
# WHY HERE AND NOT AT THE ROLE PROMPT. The role prompt fires before the
# network wait above, so at that point the NIC routinely has no carrier and
# every probe would fail for a reason that has nothing whatever to do with
# whether a cluster exists. Discovery needs a link, so it runs after the
# network is up and before zeta-install is exec'd. Nothing before this point
# has touched a disk, so refusing here still costs nothing.
#
# DISCOVERY FINDS AN ADDRESS. IT NEVER CARRIES A CREDENTIAL. `--token-present`
# below is a BOOLEAN computed from `test -s` on the ESP token path -- this
# script never reads the file, and the k3s token still comes from the ESP or
# from an operator, exactly as it does today. Publishing a token over mDNS is
# refused by design and by a test in nix-contract.test.ts.
#
# A CHECK THAT DID NOT RUN MUST NEVER LOOK LIKE A CHECK THAT PASSED.
# The decider deliberately distinguishes "nothing answered" from "I could not
# look", and this call site keeps them apart rather than collapsing them:
#
#   bootstrap                 the silence passed the admissibility check
#                             (dwell, elapsed, query-burst count). Keep the
#                             default. This is today's behaviour, now earned.
#   join                      one cluster answered AND a token for it exists.
#   refuse, cluster HEARD     join-token-unavailable, multiple-clusters-answered,
#                             malformed-advertisement, trust-domain-*,
#                             cluster-id-does-not-match-token.
#                             -> HALT. Something is out there; continuing would
#                             found the second cluster, which is the expensive
#                             error this whole module exists to prevent.
#   refuse, probe DID NOT RUN probe-failed, dwell-too-short.
#                             -> say so LOUDLY, name the reason on screen, and
#                             fall back to the declared ISO default. That is
#                             byte-for-byte today's behaviour; what changes is
#                             that the non-result is NAMED instead of silently
#                             reading as "no cluster". ZETA_DISCOVERY_REQUIRED=1
#                             turns the fallback into a halt for operators who
#                             would rather stop than proceed unchecked.
#
# Knobs, all env-overridable in the systemd unit or from a shell:
#   ZETA_DISCOVERY=off             skip the probe entirely (reported as a
#                                  check that did not run, not one that passed)
#   ZETA_DISCOVERY_DWELL_MS        default 30000, the decider's honest floor
#   ZETA_DISCOVERY_ACK_SHORT_DWELL=1  acknowledge a dwell below that floor;
#                                  WITHOUT it a short dwell refuses rather than
#                                  letting a two-second silence read as absence
#   ZETA_DISCOVERY_REQUIRED=1      a probe that could not run halts the install
ZETA_DISCOVERY="${ZETA_DISCOVERY:-auto}"
ZETA_DISCOVERY_DWELL_MS="${ZETA_DISCOVERY_DWELL_MS:-30000}"
ZETA_DISCOVERY_ACK_SHORT_DWELL="${ZETA_DISCOVERY_ACK_SHORT_DWELL:-0}"
ZETA_DISCOVERY_REQUIRED="${ZETA_DISCOVERY_REQUIRED:-0}"

# Halt path: a cluster was heard and this node may not join it. Refusing to
# act is the whole point, so this does NOT time out into a default.
zeta_discovery_halt() {
  echo
  echo "  ╭─ CLUSTER DISCOVERY REFUSED ─────────────────────────────╮"
  echo "  │ reason:   ${1}"
  echo "  │ detail:   ${2}"
  echo "  │ operator: ${3}"
  echo "  ╰─────────────────────────────────────────────────────────╯"
  echo
  echo "[zeta-discovery] NOT installing, and NOT founding a cluster."
  echo "[zeta-discovery] Something already answers on this segment. This stick"
  echo "[zeta-discovery] carries only the ISO build-time default (control-plane),"
  echo "[zeta-discovery] which nobody chose for THIS node, so proceeding would"
  echo "[zeta-discovery] create a second cluster that is undone by hand."
  echo "[zeta-discovery]"
  echo "[zeta-discovery] Declare the role explicitly and re-flash, e.g.:"
  echo "[zeta-discovery]   zflash --role first-control-plane"
  echo "[zeta-discovery]   zflash --role joiner --join-server-url <url> --join-token <file>"
  echo "[zeta-discovery] Or press on manually from the shell below."
  drop_to_shell
}

# Loud fallback: the probe could not run. Names the non-result rather than
# letting it read as silence.
zeta_discovery_could_not_run() {
  echo "[zeta-discovery] DISCOVERY DID NOT RUN: ${1}"
  echo "[zeta-discovery] This is a check that did not run, NOT a check that passed."
  echo "[zeta-discovery] The segment was never observed, so nothing here says the"
  echo "[zeta-discovery] network is empty."
  if [[ "${ZETA_DISCOVERY_REQUIRED}" == "1" ]]; then
    echo "[zeta-discovery] ZETA_DISCOVERY_REQUIRED=1 -> halting rather than guessing."
    drop_to_shell
  fi
  echo "[zeta-discovery] Falling back to the ISO default role: ${HOST} (role=${ZETA_ROLE})."
}

echo
echo "[zeta-discovery] bootstrap-or-join check"
if [[ "${ZETA_ROLE_DECLARED}" == "yes" ]]; then
  echo "[zeta-discovery] SKIPPED — the role was DECLARED (${ZETA_ROLE_SOURCE})."
  echo "[zeta-discovery] An explicit declaration always wins over discovery."
elif [[ "${ZETA_DISCOVERY}" == "off" ]]; then
  zeta_discovery_could_not_run "disabled by ZETA_DISCOVERY=off"
elif ! command -v zeta-cluster-discover >/dev/null 2>&1; then
  # An older ISO without the discover package. Absence of the tool is a
  # non-result, never an empty network.
  zeta_discovery_could_not_run "zeta-cluster-discover is not on PATH"
else
  # Whether a join token EXISTS. `-s` is a size test; the file is never read,
  # so no secret can reach a flag, a log line or a crash trace.
  ZETA_DISCOVERY_TOKEN_PRESENT=false
  if [[ -n "${ZETA_JOIN_TOKEN_ESP_PATH:-}" ]] && [[ -s "${ZETA_JOIN_TOKEN_ESP_PATH}" ]]; then
    ZETA_DISCOVERY_TOKEN_PRESENT=true
  fi

  DISCOVER_ARGS=(
    "--dwell-ms=${ZETA_DISCOVERY_DWELL_MS}"
    "--token-present=${ZETA_DISCOVERY_TOKEN_PRESENT}"
  )
  if [[ "${ZETA_DISCOVERY_ACK_SHORT_DWELL}" == "1" ]]; then
    DISCOVER_ARGS+=("--acknowledge-short-dwell=true")
  fi

  echo "[zeta-discovery] probing for ${ZETA_DISCOVERY_DWELL_MS}ms (token-present=${ZETA_DISCOVERY_TOKEN_PRESENT}) ..."
  # stdout is the JSON decision; stderr is the decider's notes, which pass
  # straight through to tty1 and the serial mirror on purpose.
  DISCOVER_JSON=""
  DISCOVER_RC=0
  DISCOVER_JSON=$(zeta-cluster-discover "${DISCOVER_ARGS[@]}") || DISCOVER_RC=$?

  DISCOVER_ACTION=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.action // "unparseable"' 2>/dev/null || printf 'unparseable')
  DISCOVER_REASON=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.reason // "unknown"' 2>/dev/null || printf 'unknown')

  case "${DISCOVER_RC}:${DISCOVER_ACTION}" in
    0:bootstrap)
      echo "[zeta-discovery] BOOTSTRAP — nothing answered, and the silence passed"
      echo "[zeta-discovery] the admissibility check. Keeping role ${HOST} (${ZETA_ROLE})."
      ;;
    0:join)
      # Reachable only when a token exists. Today an ESP conf is what carries a
      # token path, and an ESP conf also sets ZETA_ROLE_SOURCE=esp:* which makes
      # the role DECLARED and skips this whole block -- so this branch does not
      # fire on any medium zflash currently writes. It is implemented rather
      # than stubbed because the decider can return it and a call site that
      # cannot handle a documented outcome is a latent silent failure.
      DISCOVER_URL=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.serverUrl // ""' 2>/dev/null || printf '')
      if [[ -z "${DISCOVER_URL}" ]]; then
        zeta_discovery_halt "join-without-endpoint" \
          "the decider returned action=join with no serverUrl" \
          "treat the decider output as broken; do not read this as an empty network"
      fi
      HOST=worker-gpu
      ZETA_ROLE=joiner
      export ZETA_ROLE
      export ZETA_JOIN_SERVER_URL="${DISCOVER_URL}"
      echo "[zeta-discovery] JOIN — one cluster answered and a token for it exists."
      echo "[zeta-discovery] role=${ZETA_ROLE} host=${HOST} server=${ZETA_JOIN_SERVER_URL}"
      ;;
    3:refuse)
      DISCOVER_DETAIL=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.detail // ""' 2>/dev/null || printf '')
      DISCOVER_ACTION_HINT=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.operatorAction // ""' 2>/dev/null || printf '')
      case "${DISCOVER_REASON}" in
        # The probe could not produce an observation. NOT an empty network.
        probe-failed|dwell-too-short)
          zeta_discovery_could_not_run "${DISCOVER_REASON}: ${DISCOVER_DETAIL}"
          ;;
        # Something ANSWERED and this node may not join it. Opposite of above.
        *)
          zeta_discovery_halt "${DISCOVER_REASON}" "${DISCOVER_DETAIL}" "${DISCOVER_ACTION_HINT}"
          ;;
      esac
      ;;
    *)
      # Exit 2 (bad arguments), an unparseable line, or an exit code the
      # contract does not define. Never folded into silence.
      zeta_discovery_could_not_run "unexpected exit ${DISCOVER_RC} action=${DISCOVER_ACTION}"
      ;;
  esac
fi
echo

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
# Three outcomes, not two. zeta-install exits 10 when the OPERATOR cancelled at
# the R7 window -- distinct from both success and failure. It used to exit 0
# there, which this `if` reported as "Install complete. Rebooting in 10s": a
# deliberate abort announced as a finished install, then a reboot. Collapsing a
# cancel into "failed" would be the milder version of the same lie, so it gets
# its own branch and does NOT reboot.
set +e
/run/current-system/sw/bin/zeta-install "$HOST"
ZETA_INSTALL_RC=$?
set -e
if [ "$ZETA_INSTALL_RC" = "0" ]; then
  echo
  echo "[zeta-first-boot] Install complete. Rebooting in 10s (Ctrl-C to cancel) ..."
  sleep 10
  systemctl reboot
elif [ "$ZETA_INSTALL_RC" = "10" ]; then
  echo
  echo "[zeta-first-boot] CANCELLED at the pre-wipe window. Nothing was wiped."
  echo "                  This node is unchanged. Re-run when ready: zeta-install $HOST"
  drop_to_shell
else
  echo
  echo "[zeta-first-boot] Install failed (rc=$ZETA_INSTALL_RC). See output above."
  drop_to_shell
fi
