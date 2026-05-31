#!/usr/bin/env bash
#
# tools/setup/common/one-liner-tools.sh — installs non-package-manager CLIs from
# tools/setup/manifests/one-liner-tools. Sibling to common/agent-clis.sh (bun-global CLIs).
#
# B-0063 DOWNLOAD-THEN-EXEC (NOT pipe-to-shell): for each registry entry the runner downloads the
# install script to a temp file via curl_fetch (retry-equipped), verifies it is non-empty, then
# executes it with the named interpreter. NEVER `curl … | bash`: a truncated/interrupted download
# is caught by the non-empty check before any code runs, and a failed download surfaces as a
# non-zero curl_fetch exit — unlike `curl … | bash`, where bash exits 0 on an empty pipe even when
# the download failed. Same shape as the Homebrew bootstrap in macos.sh. Trust anchor: HTTPS + the
# vendor's domain (these installers track HEAD with no published per-release checksum, same as
# Homebrew's install.sh) — and the runner ENFORCES https:// before fetching (see below).
#
# NONINTERACTIVE: the downloaded installer is exec'd with stdin redirected from /dev/null, so it
# matches the vendor's documented `curl … | bash` behavior (where bash's stdin is the pipe, not a
# TTY). Note some installers (e.g. Hermes) open /dev/tty DIRECTLY rather than reading stdin, so the
# /dev/null redirect alone does not suppress their setup wizard on an interactive dev install — those
# need an explicit noninteractive flag via the args= qualifier (Hermes: args=--skip-setup). Without
# this, running install.sh from an interactive shell could let a setup/auth wizard stall the Zeta
# bootstrap before local-llm.sh + shellenv.sh run.
#
# DETECT-FIRST + UPDATE: by default, skip if the tool's <detect-binary> is already on PATH. This is
# the efficient path (no re-download of multi-step vendor installers on every install.sh run) AND it
# is correct for these CLIs because they SELF-UPDATE (cursor-agent + kiro auto-update in the
# background per their docs; the others are HEAD-tracking installers that the operator re-runs at
# will). install.sh's job here is to ensure PRESENCE; the tools keep themselves current. To FORCE a
# re-run of every installer (the explicit update path, vs the old "manually remove the binary
# first"), set ZETA_FORCE_UPDATE_TOOLS=1. BEST-EFFORT throughout: a failed installer WARNS and
# continues — these are auth-gated peer/dev CLIs, not hard deps; LOGIN/auth is the operator's to do
# after install; it must NEVER brick install (mirrors common/local-llm.sh exceptions-as-signals).
#
# NON-INTERACTIVE DEFAULT-SKIP: these heavy external vendor installers (best-effort, not asserted)
# would otherwise run in EVERY CI install.sh — every gate lint job (needlessly downloading
# grok/cursor/hermes/forge per job and tipping the short-timeout jobs over: install.sh ~90s ->
# >2min) AND every Docker/macOS install shield. The discriminator is the controlling terminal:
# install.sh run interactively from a dev shell (stdin is a TTY) installs them; any non-interactive
# run (CI gate jobs, Docker build steps, macOS shield steps — none have a TTY) skips them. This is
# consistent across ALL CI contexts (unlike $CI, which Docker builds do not inherit). To exercise
# the installers in a non-interactive context anyway (e.g. a dedicated install-shield that should
# download-exec them), set ZETA_INSTALL_FULL=1.
#
# Registry line:  <detect-binary>  <installer-url>  [interp=bash|sh]  [os=mac,linux]  [args=<arg> ...]
# (defaults: interp=bash, os=all, no args). `#` comments + blank lines ignored. args= is repeatable.
# Installer URLs MUST be https:// (enforced). See manifests/one-liner-tools.

set -euo pipefail

# curl_fetch (file-output download with retries) — the B-0063 helper that replaced the old
# pipe-to-shell pattern. Sourced from the sibling common/curl-fetch.sh.
# shellcheck source=tools/setup/common/curl-fetch.sh
# shellcheck disable=SC1091  # path is constructed from BASH_SOURCE at runtime; the source= above
# tells shellcheck where the file lives so it follows the include for static analysis.
source "$(dirname "${BASH_SOURCE[0]}")/curl-fetch.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/one-liner-tools"
# Force a re-run of every installer even when the binary is already present (explicit update path).
FORCE_UPDATE="${ZETA_FORCE_UPDATE_TOOLS:-0}"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ no one-liner-tools manifest; skipping"
  exit 0
fi

# Non-interactive default-skip (see header): if there is no controlling TTY on stdin this is a CI /
# scripted run (gate lint job, Docker build step, macOS shield step — none have a TTY), so skip the
# heavy best-effort dev-CLI installers unless ZETA_INSTALL_FULL=1 opts in. Interactive dev shells
# (stdin is a TTY) install them by default. Using the TTY check rather than $CI keeps the behavior
# consistent across ALL CI contexts (Docker builds do not inherit $CI).
if [ ! -t 0 ] && [ "${ZETA_INSTALL_FULL:-0}" != "1" ]; then
  echo "✓ one-liner-tools: skipping dev-CLI installers (non-interactive run; best-effort; set ZETA_INSTALL_FULL=1 to exercise; interactive dev shells run them by default)"
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

  # Download-then-exec (B-0063): fetch installer to temp, verify non-empty, exec with interpreter.
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

echo "✓ one-liner-tools step complete (login to each CLI separately — install is account-free)"
