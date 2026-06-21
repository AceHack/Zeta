#!/usr/bin/env bash
#
# Mechanism: from-opam-git — opam source-build from a pinned git commit.
# Manifest: tools/setup/manifests/from-opam-git
#
# Heavy OCaml build — gated behind ZETA_INSTALL_FULL=1 (same gate as
# from-installer heavy paths). Best-effort: warns + continues.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-opam-git"

if [ "${ZETA_INSTALL_FULL:-0}" != "1" ]; then
  echo "✓ from-opam-git: skipping (set ZETA_INSTALL_FULL=1 to build opam git deps)"
  exit 0
fi

if [ ! -f "$MANIFEST" ]; then
  echo "✓ from-opam-git: no manifest; skipping"
  exit 0
fi

if ! command -v opam >/dev/null 2>&1; then
  echo "warning: from-opam-git: opam not on PATH — build skipped."
  echo "  opam is declared in manifests/{brew,apt}; ensure the system-package step ran first."
  exit 0
fi

while IFS= read -r raw_line || [ -n "$raw_line" ]; do
  line="${raw_line%%#*}"
  line="$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [ -z "$line" ] && continue

  # shellcheck disable=SC2086
  set -- $line
  pkg_name="${1:-}"
  git_repo="${2:-}"
  shift 2 || true
  commit="" switch="" ocaml=""
  for tok in "$@"; do
    case "$tok" in
      commit=*) commit="${tok#commit=}" ;;
      switch=*) switch="${tok#switch=}" ;;
      ocaml=*) ocaml="${tok#ocaml=}" ;;
    esac
  done
  [ -z "$pkg_name" ] || [ -z "$git_repo" ] || [ -z "$commit" ] && continue
  : "${switch:=${pkg_name}-build}"
  : "${ocaml:=5.1.0}"

  if [ ! -d "${OPAMROOT:-$HOME/.opam}" ]; then
    echo "↓ from-opam-git: initializing opam (bare, no shell setup, no sandbox)..."
    opam init --bare --no-setup --disable-sandboxing --yes
  fi

  if ! opam switch list --short 2>/dev/null | grep -qx "$switch"; then
    echo "↓ from-opam-git: creating opam switch '$switch' (OCaml $ocaml)..."
    opam switch create "$switch" "ocaml-base-compiler.$ocaml" --yes
  fi

  eval "$(opam env --switch="$switch" --set-switch)"

  if opam exec -- "$pkg_name" --version >/dev/null 2>&1; then
    echo "✓ from-opam-git $pkg_name already installed: $(opam exec -- "$pkg_name" --version 2>&1 | head -n1)"
    continue
  fi

  echo "↓ from-opam-git: building $pkg_name from $commit..."
  echo "  (heavy OCaml build — first run compiles deps + backends)"
  opam pin add -n -y "$pkg_name" "${git_repo}#${commit}" || true

  src_dir="$(mktemp -d)"
  trap 'rm -rf "${src_dir}"' EXIT
  git clone "$git_repo" "$src_dir"
  git -C "$src_dir" checkout -q "$commit"
  opam install -y "$src_dir/." --deps-only

  (
    cd "$src_dir"
    dune build -p "$pkg_name" @install
    dune install -p "$pkg_name" --prefix="$OPAM_SWITCH_PREFIX"
    if [ -f "$OPAM_SWITCH_PREFIX/lib/$pkg_name/Makefile.post-install" ]; then
      make -C "$OPAM_SWITCH_PREFIX/lib/$pkg_name" -f Makefile.post-install
    fi
  )
  rm -rf "$src_dir"
  trap - EXIT

  if opam exec -- "$pkg_name" --version >/dev/null 2>&1; then
    echo "✓ from-opam-git $pkg_name: $(opam exec -- "$pkg_name" --version 2>&1 | head -n1)"
  else
    echo "warning: from-opam-git $pkg_name build attempted but binary not resolvable; continuing" >&2
  fi
done < "$MANIFEST"

echo "✓ from-opam-git complete"
