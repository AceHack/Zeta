#!/usr/bin/env bash
# zeta-dev-toolchain.sh -- the operator's DEV toolchain, provisioned AFTER first
# boot, in the background, by zeta-dev-toolchain.service
# (full-ai-cluster/nixos/modules/zeta-dev-toolchain.nix). 081M3K23YCP087G0R003BVDS1P.
#
# WHY IT IS NOT IN THE INSTALLER ANY MORE. `tools/setup/install.sh` at tier
# `full` is ~18 mise toolchains (dotnet, go, rust, zig, python, java, node,
# bun, ...) and several GB. zeta-install.sh used to run it BEFORE the reboot,
# up to three unbounded attempts, with its output behind `| tee | tail -40`. On
# the 2026-09-27 bare-metal reinstall (node-5b2dfa) that was ~30 minutes of a
# silent console -- and none of it is needed for k3s, ArgoCD or the roster. The
# node is a cluster member the moment it boots; the dev toolchain is for the
# human (and the agent CLIs) that log into it later.
#
# Runs as ROOT only so it can write the serial console the QEMU lanes read; the
# install itself runs as the operator via `runuser`. The unit carries Nice=19 +
# IOSchedulingClass=idle so it cannot compete with k3s's own first boot.
#
# CONTRACT (serial + journal), THREE states the QEMU lanes read:
#   "zeta-dev-toolchain: START"      -- it ran at all (absent => did-not-run)
#   "zeta-dev-toolchain: SUCCEEDED"  -- install.sh rc=0 on some attempt
#   "zeta-dev-toolchain: FAILED"     -- every attempt failed, or the unit was
#                                       stopped/timed out (ExecStopPost path)
# Plus, unchanged from the installer: the durable log
# ~/.zeta/install-sh-firstboot.log, the ~/.zeta/PARTIAL-PROVISION marker, and
# the ZETA-INSTALL-FAILURE-CAUSE classifier (moved here verbatim).
#
# Env: ZETA_USER (default zeta), ZETA_HOME (default /home/$ZETA_USER),
#      ZETA_SERIAL_DEVICE (optional), ZETA_ATTEMPT_TIMEOUT_SECS (default 3600),
#      ZETA_MAX_ATTEMPTS (default 3), ZETA_RETRY_BACKOFF_SECS (default 12, linear).
#      Mode: `run` (default) | `stop-post`.

set -uo pipefail

ZETA_USER="${ZETA_USER:-zeta}"
ZETA_HOME="${ZETA_HOME:-/home/$ZETA_USER}"
ZETA_ATTEMPT_TIMEOUT_SECS="${ZETA_ATTEMPT_TIMEOUT_SECS:-3600}"
ZETA_MAX_ATTEMPTS="${ZETA_MAX_ATTEMPTS:-3}"
ZETA_RETRY_BACKOFF_SECS="${ZETA_RETRY_BACKOFF_SECS:-12}"
DEV_LOG="$ZETA_HOME/.zeta/install-sh-firstboot.log"
DEV_PARTIAL="$ZETA_HOME/.zeta/PARTIAL-PROVISION"
DEV_OK="$ZETA_HOME/.zeta/dev-toolchain.ok"

say() {
  echo "$1"
  if [ -n "${ZETA_SERIAL_DEVICE:-}" ] && [ -w "${ZETA_SERIAL_DEVICE}" ]; then
    echo "$1" >> "$ZETA_SERIAL_DEVICE" 2>/dev/null || true
  fi
}

# Files under the operator's home are the operator's, never root's
# (081M3K16QKA087G0R002GT2F8X: a root-owned path in ~ is a Permission denied
# nobody can trace).
own() { chown "$ZETA_USER:$(id -gn "$ZETA_USER" 2>/dev/null || echo users)" "$@" 2>/dev/null || true; }

write_partial() {
  # $1 = rc, $2 = attempts, $3 = why
  mkdir -p "$ZETA_HOME/.zeta"; own "$ZETA_HOME/.zeta"
  printf 'install.sh rc=%s after %s attempts at %s (%s)\nPARTIAL PROVISION: agent CLIs and/or the full mise tier (k3d/kubectl/helm) may be absent.\nretry: sudo systemctl start zeta-dev-toolchain.service   (or: cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh)\n' \
    "$1" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$3" > "$DEV_PARTIAL"
  own "$DEV_PARTIAL"
}

# ZETA-INSTALL-FAILURE-CAUSE-BEGIN -- pure text processing over the install
# log: no network, no globals, no side effects. Shell-parity tested against
# a real bash in
# src/Core.TypeScript/installer/install-failure-cause-shell-parity.test.ts,
# same discipline as longhorn-capacity-preflight-shell-parity.test.ts.
#
# 081M3BVERK0087G0R001GVH1QP. MEASURED, run 36110246885: the first-boot
# install failed after all three attempts, and everything the operator was
# given was
#
#     WARN: install.sh FAILED rc=1 after 3 attempts
#     Location: src/toolset/toolset_install.rs:244
#
# -- a Rust source location in a tool they did not know they were running.
# The actual cause was GitHub's UNAUTHENTICATED API rate limit (60/hour PER
# SOURCE IP) refusing the artifact-attestation verification that
# `.mise.toml`'s trust policy requires. Nothing about the machine was wrong
# and nothing the operator could read said so.
#
# A cause they cannot act on is the same as no cause at all, so this turns
# the known signatures into a sentence that names the dependency and what
# to do about it. Anything unrecognised prints NOTHING and falls through to
# the existing generic error-line diag below -- this narrows the message
# when it CAN, and never replaces evidence with a guess.
zeta_install_failure_cause() {
  # $1 = the install log. stdout: a named, actionable diagnosis, or nothing.
  [ -f "$1" ] || return 0
  if grep -qiE 'API rate limit exceeded|rate limit exceeded for' "$1" 2>/dev/null; then
    # Which tools, by name, so the operator can see it is one dependency
    # and not their hardware.
    # The same tool appears on two lines in mise's output -- once as
    # `mise ERROR Failed to install X` and once as `0: Failed to install X:`
    # -- and the trailing colon on the second makes `sort -u` keep BOTH,
    # so the operator was told two tools were blocked when one was. Strip
    # trailing punctuation before deduping. (Found by this block's own
    # parity test, not in the field.)
    _blocked=$(grep -oE 'Failed to install [A-Za-z0-9:@./_-]+' "$1" 2>/dev/null \
      | sed -e 's/^Failed to install //' -e 's/[:.,]*$//' | sort -u | tr '\n' ' ')
    _reset=$(grep -oE '"?x-ratelimit-reset"?[": ]+[0-9]+' "$1" 2>/dev/null | grep -oE '[0-9]+$' | head -1)
    echo "CAUSE: GitHub's UNAUTHENTICATED API rate limit (60 requests/hour PER SOURCE IP) refused the artifact-attestation verification that this repo's mise trust policy requires before installing a pinned tool."
    echo "CAUSE: NOTHING IS WRONG WITH THIS MACHINE. The limit is shared by every device on your public IP -- an office NAT, a CGNAT ISP or a campus network may have spent it before you started."
    [ -n "$_blocked" ] && echo "CAUSE: blocked tool(s): ${_blocked}"
    if [ -n "$_reset" ]; then
      echo "CAUSE: the limit resets at $(date -u -d "@$_reset" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "epoch $_reset")."
    else
      echo "CAUSE: the reset time was not in the response; GitHub's window is one hour from your first request."
    fi
    echo "REMEDY: wait for the reset and re-run 'cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh', or re-run from a network with a different public IP, or export GITHUB_TOKEN=<a token> first (raises the limit to 5000/hour)."
    echo "REMEDY: do NOT disable attestation verification to get past this. The policy catches real supply-chain regressions; the fix is to verify EARLIER (pre-staged at image-build time), not to verify LESS."
    return 0
  fi
  if grep -qiE 'could not resolve host|temporary failure in name resolution|name or service not known' "$1" 2>/dev/null; then
    echo "CAUSE: DNS resolution failed during the install -- this node could not look up a hostname it needed."
    echo "REMEDY: check connectivity (the role prompt offers nmtui), then re-run 'cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh'."
    return 0
  fi
  if grep -qiE 'connection refused|connection timed out|network is unreachable|failed to connect' "$1" 2>/dev/null; then
    echo "CAUSE: a network connection failed during the install -- a host this node needed was unreachable."
    echo "REMEDY: check connectivity (the role prompt offers nmtui), then re-run 'cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh'."
    return 0
  fi
  if grep -qiE 'no space left on device|disk quota exceeded' "$1" 2>/dev/null; then
    echo "CAUSE: the disk filled during the install."
    echo "REMEDY: free space under \$HOME and /nix, then re-run 'cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh'."
    return 0
  fi
  return 0
}
# ZETA-INSTALL-FAILURE-CAUSE-END

# ExecStopPost: the unit stopped for a reason the run loop never reported --
# systemd's TimeoutStartSec fired, someone stopped it, the OOM killer. A hang
# must end as a NAMED failure, never as a unit that simply is not there.
if [ "${1:-run}" = "stop-post" ]; then
  case "${SERVICE_RESULT:-success}" in
    # exit-code: the run loop already said FAILED, with its named cause.
    success|exit-code) exit 0 ;;
  esac
  if [ ! -f "$DEV_OK" ]; then
    say "zeta-dev-toolchain: FAILED result=${SERVICE_RESULT:-unknown} exit=${EXIT_STATUS:-?} (stopped before install.sh concluded; TimeoutStartSec is the bound)"
    write_partial "${EXIT_STATUS:-?}" "?" "unit ${SERVICE_RESULT:-stopped}"
  fi
  exit 0
fi

if [ ! -d "$ZETA_HOME/Zeta" ]; then
  say "zeta-dev-toolchain: START"
  say "zeta-dev-toolchain: FAILED no checkout at $ZETA_HOME/Zeta (the installer clones it; re-clone, then: sudo systemctl start zeta-dev-toolchain.service)"
  write_partial 1 0 "no ~/Zeta checkout"
  exit 1
fi

mkdir -p "$ZETA_HOME/.zeta"; own "$ZETA_HOME/.zeta"
touch "$DEV_LOG"; own "$DEV_LOG"
say "zeta-dev-toolchain: START (tools/setup/install.sh, tier full, as $ZETA_USER; log $DEV_LOG; follow: journalctl -u zeta-dev-toolchain -f)"

ZETA_TARGET_PATH="/run/wrappers/bin:/run/current-system/sw/bin:/run/current-system/sw/sbin:${ZETA_HOME}/.local/bin:/usr/bin:/bin"
install_rc=1
install_attempt=1
while [ "$install_attempt" -le "$ZETA_MAX_ATTEMPTS" ]; do
  echo "=== install.sh attempt ${install_attempt}/${ZETA_MAX_ATTEMPTS} @ $(date -u +%Y-%m-%dT%H:%M:%SZ) (bound ${ZETA_ATTEMPT_TIMEOUT_SECS}s) ===" >> "$DEV_LOG"
  # Per-attempt bound: a stalled download is a named timeout (rc 124), not a
  # unit that runs until the systemd backstop. install.sh is idempotent (mise
  # installs and bun globals are upserts), so a retry after a transient blip is
  # safe -- the same reasoning the installer's loop carried (081KZETP6AT).
  timeout --kill-after=30 "$ZETA_ATTEMPT_TIMEOUT_SECS" \
    runuser -u "$ZETA_USER" -- env \
      HOME="$ZETA_HOME" \
      BUN_INSTALL="$ZETA_HOME/.bun" \
      PATH="$ZETA_TARGET_PATH" \
      ZETA_INSTALL_NIXOS_MODE=installed \
      ZETA_INSTALL_FULL=1 \
      ZETA_HOST_TIER=full \
      MISE_VERBOSE=1 \
      bash -c 'cd "$HOME/Zeta" && tools/setup/install.sh' >> "$DEV_LOG" 2>&1
  install_rc=$?
  [ "$install_rc" -eq 0 ] && break
  if [ "$install_rc" -eq 124 ]; then
    say "zeta-dev-toolchain: attempt ${install_attempt}/${ZETA_MAX_ATTEMPTS} TIMED OUT after ${ZETA_ATTEMPT_TIMEOUT_SECS}s"
  else
    say "zeta-dev-toolchain: attempt ${install_attempt}/${ZETA_MAX_ATTEMPTS} FAILED rc=$install_rc"
  fi
  if [ "$install_attempt" -lt "$ZETA_MAX_ATTEMPTS" ]; then
    sleep $((install_attempt * ZETA_RETRY_BACKOFF_SECS))
  fi
  install_attempt=$((install_attempt + 1))
done
own "$DEV_LOG"

if [ "$install_rc" -eq 0 ]; then
  rm -f "$DEV_PARTIAL"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$DEV_OK"; own "$DEV_OK"
  say "zeta-dev-toolchain: SUCCEEDED on attempt ${install_attempt}/${ZETA_MAX_ATTEMPTS}"
  exit 0
fi

attempts_made=$((install_attempt - 1))
say "zeta-dev-toolchain: FAILED rc=$install_rc after ${attempts_made} attempts -- runtimes/agent CLIs may be partial; log $DEV_LOG"
# The NAMED cause first, when there is one; the generic error lines are the floor.
zeta_install_failure_cause "$DEV_LOG" | while IFS= read -r _cause_line; do
  [ -n "$_cause_line" ] && say "zeta-dev-toolchain:   ${_cause_line}"
done
say "zeta-dev-toolchain:   --- install.sh error lines ---"
grep -iE 'error|fatal|fail|cannot|not found|no such|denied|refused|traceback|exit code|command not' "$DEV_LOG" 2>/dev/null | tail -40 | while IFS= read -r _l; do
  say "zeta-dev-toolchain:   $_l"
done
write_partial "$install_rc" "$attempts_made" "after retries"
exit 1
