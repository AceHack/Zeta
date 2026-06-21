#!/usr/bin/env bash
#
# Mechanism: from-autotools-tarball — pinned upstream tarball → configure/make install.
# Manifest: tools/setup/manifests/from-autotools-tarball
#
# Format:
#   <binary-name>  <tarball-url>  sha256=<hex>  [prefix=~/.local]  [when=linux]

set -euo pipefail

# shellcheck source=_when.sh
# shellcheck disable=SC1091
source "$(dirname "$0")/_when.sh"
# shellcheck source=../common/curl-fetch.sh
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")/.." && pwd)/common/curl-fetch.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-autotools-tarball"
CACHE_ROOT="${ZETA_AUTOMAKE_CACHE:-$HOME/.cache/zeta/from-autotools-tarball}"
INSTALL_PREFIX="${ZETA_AUTOMAKE_PREFIX:-$HOME/.local}"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ from-autotools-tarball: no manifest; skipping"
  exit 0
fi

expand_path () {
  case "$1" in
    ~/*) printf '%s\n' "${1/#\~/$HOME}" ;;
    *)   printf '%s\n' "$1" ;;
  esac
}

verify_sha256 () {
  local file="$1"
  local expected="$2"
  if command -v sha256sum >/dev/null 2>&1; then
    echo "${expected}  ${file}" | sha256sum -c -
  else
    echo "${expected}  ${file}" | shasum -a 256 -c -
  fi
}

EPROVER_SMOKE_QUERY='fof(smoke, conjecture, (![X]: X = X)).'

fol_smoke_ok () {
  local name="$1"
  local bin="$2"
  [ -x "$bin" ] || return 1
  case "$name" in
    eprover)
      printf '%s\n' "$EPROVER_SMOKE_QUERY" \
        | "$bin" --auto --tstp-format >/dev/null 2>&1
      ;;
    *)
      "$bin" --version >/dev/null 2>&1
      ;;
  esac
}

resolve_binary () {
  local name="$1"
  local prefix="$2"
  if [ -x "$prefix/bin/$name" ]; then
    printf '%s\n' "$prefix/bin/$name"
    return 0
  fi
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  return 1
}

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [ -z "$line" ] && continue

  # shellcheck disable=SC2086
  set -- $line
  bin_name="${1:-}"
  tarball_url="${2:-}"
  shift 2 || true
  [ -z "$bin_name" ] || [ -z "$tarball_url" ] && continue

  when_spec=""
  sha256=""
  prefix_rel="$INSTALL_PREFIX"
  for tok in "$@"; do
    case "$tok" in
      when=*) when_spec="${tok#when=}" ;;
      sha256=*) sha256="${tok#sha256=}" ;;
      prefix=*) prefix_rel="$(expand_path "${tok#prefix=}")" ;;
    esac
  done

  if ! when_matches "$when_spec"; then
    echo "✓ from-autotools-tarball $bin_name: skipping (when=$when_spec)"
    continue
  fi

  prefix="$(expand_path "$prefix_rel")"
  mkdir -p "$prefix/bin" "$CACHE_ROOT"

  existing="$(resolve_binary "$bin_name" "$prefix" || true)"
  if [ -n "$existing" ] && fol_smoke_ok "$bin_name" "$existing"; then
    echo "✓ from-autotools-tarball $bin_name: functional at $existing"
    continue
  fi

  if [ -z "$sha256" ]; then
    echo "error: from-autotools-tarball $bin_name: sha256= pin required" >&2
    exit 1
  fi

  case "$tarball_url" in
    http://*|https://*) ;;
    *)
      echo "error: from-autotools-tarball $bin_name: URL must be http(s): $tarball_url" >&2
      exit 1
      ;;
  esac

  for tool in make gcc cc; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "error: from-autotools-tarball $bin_name: requires $tool on PATH (build-essential)" >&2
      exit 1
    fi
  done

  cache_key="$(printf '%s' "$tarball_url" | sha256sum 2>/dev/null | awk '{print $1}' || shasum -a 256 | awk '{print $1}')"
  tarball="$CACHE_ROOT/${cache_key}.tgz"
  build_dir="$CACHE_ROOT/${cache_key}-build"

  if [ ! -f "$tarball" ]; then
    echo "↓ from-autotools-tarball: $bin_name ← $tarball_url"
    curl_fetch -o "$tarball.part" "$tarball_url"
    verify_sha256 "$tarball.part" "$sha256"
    mv "$tarball.part" "$tarball"
  else
    echo "✓ from-autotools-tarball $bin_name: cached tarball present"
  fi

  rm -rf "$build_dir"
  mkdir -p "$build_dir"
  tar -C "$build_dir" -xzf "$tarball"

  src_dir="$build_dir"
  if [ ! -f "$src_dir/configure" ]; then
    # Some tarballs nest one directory deep.
    nested="$(find "$build_dir" -mindepth 1 -maxdepth 1 -type d | head -1 || true)"
    if [ -n "$nested" ] && [ -f "$nested/configure" ]; then
      src_dir="$nested"
    fi
  fi

  if [ ! -f "$src_dir/configure" ]; then
    echo "error: from-autotools-tarball $bin_name: no configure script in tarball" >&2
    exit 1
  fi

  echo "↓ from-autotools-tarball $bin_name: building into $prefix"
  (
    cd "$src_dir"
    ./configure --prefix="$prefix"
    make -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)"
    make install
  )

  installed="$(resolve_binary "$bin_name" "$prefix" || true)"
  if [ -z "$installed" ] || ! fol_smoke_ok "$bin_name" "$installed"; then
    echo "error: from-autotools-tarball $bin_name: build finished but smoke test failed" >&2
    exit 1
  fi
  echo "✓ from-autotools-tarball $bin_name: installed at $installed"
done < "$MANIFEST"

echo "✓ from-autotools-tarball complete"
