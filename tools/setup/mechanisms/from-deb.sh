#!/usr/bin/env bash
#
# Mechanism: from-deb — install a .deb from URL (when= gated).
# Manifest: tools/setup/manifests/from-deb
#
# Format:
#   <name>  <deb-url>  [deps=pkg1,pkg2]  [when=ubuntu-22.04,amd64]

set -euo pipefail

# shellcheck source=_when.sh
# shellcheck disable=SC1091
source "$(dirname "$0")/_when.sh"
# shellcheck source=../common/curl-fetch.sh
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")/.." && pwd)/common/curl-fetch.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-deb"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ from-deb: no manifest; skipping"
  exit 0
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
_DPKG_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [ -z "$line" ] && continue

  # shellcheck disable=SC2086
  set -- $line
  name="${1:-}"
  deb_url="${2:-}"
  shift 2 || true
  [ -z "$name" ] || [ -z "$deb_url" ] && continue

  when_spec=""
  deps=""
  for tok in "$@"; do
    case "$tok" in
      when=*) when_spec="${tok#when=}" ;;
      deps=*) deps="${tok#deps=}" ;;
    esac
  done

  if ! when_matches "$when_spec"; then
    echo "✓ from-deb $name: skipping (when=$when_spec)"
    continue
  fi

  if command -v "$name" >/dev/null 2>&1 || [ -x "/usr/bin/$name" ]; then
    echo "✓ from-deb $name: already installed"
    continue
  fi

  if [ -n "$deps" ]; then
    IFS=',' read -r -a _deps <<< "$deps"
    for dep in "${_deps[@]}"; do
      dep="$(printf '%s' "$dep" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      [ -z "$dep" ] && continue
      if ! dpkg -s "$dep" >/dev/null 2>&1; then
        echo "↓ from-deb $name: installing dep $dep"
        $SUDO apt-get install -y --no-install-recommends "$dep"
      fi
    done
  fi

  case "$deb_url" in
    http://*|https://*) ;;
    *)
      echo "error: from-deb $name: URL must be http(s): $deb_url" >&2
      exit 1
      ;;
  esac

  tmp_deb="$(mktemp)"
  echo "↓ from-deb: $name ← $deb_url"
  curl_fetch -o "$tmp_deb" "$deb_url"
  $SUDO env PATH="$_DPKG_PATH" dpkg -i "$tmp_deb" \
    || $SUDO env PATH="$_DPKG_PATH" apt-get install -fy
  rm -f "$tmp_deb"

  if command -v "$name" >/dev/null 2>&1 || [ -x "/usr/bin/$name" ]; then
    echo "✓ from-deb $name: installed"
  else
    echo "error: from-deb $name: install finished but binary missing" >&2
    exit 1
  fi
done < "$MANIFEST"

echo "✓ from-deb complete"
