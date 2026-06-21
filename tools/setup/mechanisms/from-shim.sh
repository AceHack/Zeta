#!/usr/bin/env bash
#
# Mechanism: from-shim — symlink a name on PATH to an existing binary (when= gated).
# Manifest: tools/setup/manifests/from-shim
#
# Format:
#   <name-on-path>  <source-binary>  [when=ubuntu-22.04]

set -euo pipefail

# shellcheck source=_when.sh
# shellcheck disable=SC1091
source "$(dirname "$0")/_when.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-shim"
SHIM_DIR="${ZETA_SHIM_DIR:-$HOME/.local/bin}"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ from-shim: no manifest; skipping"
  exit 0
fi

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [ -z "$line" ] && continue

  # shellcheck disable=SC2086
  set -- $line
  shim_name="${1:-}"
  source_bin="${2:-}"
  shift 2 || true
  [ -z "$shim_name" ] || [ -z "$source_bin" ] && continue

  when_spec=""
  for tok in "$@"; do
    case "$tok" in
      when=*) when_spec="${tok#when=}" ;;
    esac
  done

  if ! when_matches "$when_spec"; then
    echo "✓ from-shim $shim_name: skipping (when=$when_spec)"
    continue
  fi

  if command -v "$shim_name" >/dev/null 2>&1; then
    echo "✓ from-shim $shim_name: already on PATH"
    continue
  fi

  if ! command -v "$source_bin" >/dev/null 2>&1; then
    echo "✓ from-shim $shim_name: source $source_bin not present; skipping"
    continue
  fi

  mkdir -p "$SHIM_DIR"
  ln -sf "$(command -v "$source_bin")" "$SHIM_DIR/$shim_name"
  echo "↻ from-shim: $shim_name → $source_bin ($SHIM_DIR)"
done < "$MANIFEST"

echo "✓ from-shim complete"
