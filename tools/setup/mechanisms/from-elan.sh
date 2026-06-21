#!/usr/bin/env bash
#
# Mechanism: from-elan — pinned elan-init.sh (Lean 4 toolchain manager).
# Manifest: tools/setup/manifests/from-elan
#
# Lean stays outside mise for now — no mise plugin yet. The pinned toolchain
# lives at tools/lean4/lean-toolchain; elan reads it when lake build runs.

set -euo pipefail

# shellcheck source=../common/curl-fetch.sh
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")/.." && pwd)/common/curl-fetch.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-elan"

run_elan_init_with_retry() {
  local installer="$1"
  local max_attempts=4
  local attempt=1
  local sleep_s=5

  while true; do
    if sh "$installer" -y --default-toolchain none; then
      return 0
    fi
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "error: from-elan: elan installer failed after ${max_attempts} attempts" >&2
      return 1
    fi
    echo "  from-elan: installer attempt ${attempt}/${max_attempts} failed; retrying in ${sleep_s}s" >&2
    sleep "$sleep_s"
    attempt=$((attempt + 1))
    sleep_s=$((sleep_s * 2))
  done
}

if [ ! -f "$MANIFEST" ]; then
  echo "✓ from-elan: no manifest; skipping"
  exit 0
fi

if command -v elan >/dev/null 2>&1; then
  :
else
  line="$(awk '
    { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
    NF > 0 { print; exit }
  ' "$MANIFEST")"
  if [ -z "$line" ]; then
    echo "✓ from-elan: manifest empty; skipping"
    exit 0
  fi
  # shellcheck disable=SC2086
  set -- $line
  name="${1:-}"
  elan_init_url="${2:-}"
  shift 2 || true
  elan_init_sha256=""
  for tok in "$@"; do
    case "$tok" in
      sha256=*) elan_init_sha256="${tok#sha256=}" ;;
    esac
  done
  if [ -z "$elan_init_url" ] || [ -z "$elan_init_sha256" ]; then
    echo "error: from-elan: manifest row must include URL and sha256=" >&2
    exit 1
  fi
  echo "↓ from-elan: installing $name (Lean 4 toolchain manager)..."
  elan_init_tmp="$(mktemp)"
  trap 'rm -f "${elan_init_tmp}"' EXIT
  curl_fetch --output "${elan_init_tmp}" "${elan_init_url}"
  if command -v sha256sum >/dev/null 2>&1; then
    echo "${elan_init_sha256}  ${elan_init_tmp}" | sha256sum -c -
  else
    echo "${elan_init_sha256}  ${elan_init_tmp}" | shasum -a 256 -c -
  fi
  run_elan_init_with_retry "${elan_init_tmp}"
fi

if [ -f "$HOME/.elan/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.elan/env"
fi

if command -v elan >/dev/null 2>&1; then
  echo "✓ from-elan: $(elan --version 2>&1 | head -n1)"
  elan self update >/dev/null 2>&1 || true
else
  echo "warning: from-elan: install attempted but 'elan' is still not on PATH."
  echo "  Add \$HOME/.elan/bin to PATH and re-run."
fi
