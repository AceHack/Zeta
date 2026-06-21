#!/usr/bin/env bash
#
# Mechanism: from-installer — download vendor install script (HTTPS), verify, exec.
# Manifest: tools/setup/manifests/from-installer
#
# 081KQ8P5D0008QG0R001DMK8JD download-then-exec discipline. Best-effort; non-interactive skip unless
# ZETA_INSTALL_FULL=1. See manifest header for format.

set -euo pipefail

# shellcheck source=../common/curl-fetch.sh
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")/.." && pwd)/common/curl-fetch.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-installer"
# Force a re-run of every installer even when the binary is already present (explicit update path).
FORCE_UPDATE="${ZETA_FORCE_UPDATE_TOOLS:-0}"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ from-installer: no manifest; skipping"
  exit 0
fi

# Non-interactive default-skip (see header): if there is no controlling TTY on stdin this is a CI /
# scripted run (gate lint job, Docker build step, macOS shield step — none have a TTY), so skip the
# heavy best-effort dev-CLI installers unless ZETA_INSTALL_FULL=1 opts in. Interactive dev shells
# (stdin is a TTY) install them by default. Using the TTY check rather than $CI keeps the behavior
# consistent across ALL CI contexts (Docker builds do not inherit $CI).
if [ ! -t 0 ] && [ "${ZETA_INSTALL_FULL:-0}" != "1" ]; then
  echo "✓ from-installer: skipping dev-CLI installers (non-interactive; set ZETA_INSTALL_FULL=1 to exercise)"
  exit 0
fi

# Current OS token for the os= qualifier (uname -s: Darwin -> mac, Linux -> linux).
case "$(uname -s)" in
  Darwin) CURRENT_OS="mac" ;;
  Linux)  CURRENT_OS="linux" ;;
  *)      CURRENT_OS="other" ;;
esac

# Read the registry directly (NOT via a pipe) so an all-comments file doesn't trip pipefail;
# `|| [ -n "$line" ]` catches a final no-newline line.
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"                                                       # strip inline comment
  line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" # trim
  [ -z "$line" ] && continue

  # Split the whitespace-separated registry line into fields.
  # shellcheck disable=SC2086  # intentional word-split of the trusted, space-delimited registry line
  set -- $line
  bin="${1:-}"
  url="${2:-}"
  [ -z "$bin" ] && continue
  if [ -z "$url" ]; then
    echo "warn: registry entry '$bin' has no installer URL; skipping" >&2
    continue
  fi
  shift 2

  # Parse optional key=value qualifiers (order-independent). args= is repeatable -> installer_args[].
  interp="bash"
  os_filter="all"
  installer_args=()
  for tok in "$@"; do
    case "$tok" in
      interp=*) interp="${tok#interp=}" ;;
      os=*)     os_filter="${tok#os=}" ;;
      args=*)   installer_args+=("${tok#args=}") ;;
      *)        echo "warn: unknown qualifier '$tok' for '$bin'; ignoring" >&2 ;;
    esac
  done

  # OS filter: skip if the registry restricts to OSes that don't include the current one.
  if [ "$os_filter" != "all" ]; then
    case ",$os_filter," in
      *",$CURRENT_OS,"*) : ;;  # current OS is in the allowed list — proceed
      *) echo "✓ $bin: skipping on $CURRENT_OS (registry restricts to os=$os_filter)"; continue ;;
    esac
  fi

  # Detect-first: skip if already installed, UNLESS ZETA_FORCE_UPDATE_TOOLS=1 forces a re-run.
  # The default skip is the efficient path; these CLIs self-update (see header), so re-running their
  # multi-step installers on every install.sh run is unnecessary. The force path is the explicit
  # update mechanism (no longer "manually remove the binary first").
  if [ "$FORCE_UPDATE" != "1" ] && command -v "$bin" >/dev/null 2>&1; then
    echo "✓ $bin already installed; skipping (self-updating; set ZETA_FORCE_UPDATE_TOOLS=1 to force re-run)"
    continue
  fi

  # Enforce HTTPS (the documented trust anchor) before fetching, so a manifest typo/edit cannot
  # silently fetch+exec an installer over cleartext or another curl-supported scheme (http://,
  # file://, ftp://, …). Best-effort: warn + skip this entry, never brick install.
  case "$url" in
    https://*) : ;;  # ok
    *) echo "warn: refusing non-https installer URL for '$bin' ($url); skipping (HTTPS is the trust anchor)" >&2; continue ;;
  esac

  # Download-then-exec (081KQ8P5D0008QG0R001DMK8JD): fetch installer to temp, verify non-empty, exec with interpreter.
  if command -v "$bin" >/dev/null 2>&1; then
    echo "↻ updating $bin via $url (ZETA_FORCE_UPDATE_TOOLS=1; download-then-exec, best-effort)..."
  else
    echo "↓ installing $bin via $url (download-then-exec, best-effort)..."
  fi
  tmp="$(mktemp)" || { echo "warn: mktemp failed for '$bin'; skipping" >&2; continue; }
  if ! curl_fetch --output "$tmp" "$url"; then
    echo "warn: download failed for '$bin' ($url); continuing (best-effort)" >&2
    rm -f "$tmp"
    continue
  fi
  if [ ! -s "$tmp" ]; then
    echo "warn: installer for '$bin' downloaded empty; refusing to exec; continuing (best-effort)" >&2
    rm -f "$tmp"
    continue
  fi
  # Exec with stdin from /dev/null so the installer runs noninteractively (matches the vendor's
  # documented `curl … | bash`, where bash's stdin is the pipe rather than the user's TTY). args=
  # qualifiers (e.g. Hermes --skip-setup, for installers that open /dev/tty directly) are appended.
  # The ${arr[@]+...} guard keeps an empty array safe under `set -u` on bash 3.2 (macOS).
  if ! "$interp" "$tmp" ${installer_args[@]+"${installer_args[@]}"} </dev/null; then
    echo "warn: installer for '$bin' failed; continuing (best-effort — auth/login is the operator's)" >&2
  fi
  rm -f "$tmp"
done <"$MANIFEST"

echo "✓ from-installer complete (login to each CLI separately — install is account-free)"
