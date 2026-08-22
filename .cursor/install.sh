#!/usr/bin/env bash
#
# .cursor/install.sh — Cursor Cloud Agent environment bootstrap for Zeta.
#
# Scope: the day-to-day build / test / lint loop a Cloud Agent needs —
#   * .NET 10 SDK (dotnet build + dotnet test)               ← the build+test gate
#   * Bun + Node + the TypeScript tooling (bun test, tsc, eslint)
#   * Go, Rust, Java, Python + the language linters preflight runs
#     (shellcheck, actionlint, golangci-lint, markdownlint, semgrep,
#      yamllint, ruff, mypy)
#
# All runtime versions come from the repo's own `.mise.toml` — the single
# source of truth — so this environment never drifts from what CONTRIBUTING.md
# and CI pin. This script is a deliberately SCOPED subset of the full
# `tools/setup/install.sh`: it omits the heavy formal-verification proof stack
# (Lean / TLA+ / Alloy / TLAPS / Agda), the local-LLM (ollama), QEMU/USB-ISO,
# R, and the Kubernetes tool set — none of which the core build+test+lint loop
# needs. A contributor who needs the full proof/cluster toolchain runs the
# canonical `tools/setup/install.sh` instead.
#
# Idempotent: safe to run repeatedly. Because environment builds bake `install`
# into a baseline snapshot, keep this terminating and side-effect-stable.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Zeta Cloud Agent install (scoped: build + test + lint) ==="
echo "Repo root: $REPO_ROOT"

# ── 1. System packages (.NET native deps + build tools) ──────────────
# Language runtimes come from mise below; apt only supplies the shared
# libraries the .NET SDK needs to RUN plus the C toolchain.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
if command -v apt-get >/dev/null 2>&1; then
  echo "↓ apt: build tools + .NET native runtime deps"
  $SUDO apt-get update -y
  $SUDO apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates git \
    libicu74 libssl3t64 libgssapi-krb5-2 tzdata zstd
else
  echo "→ apt-get not present; skipping system packages (assuming provided by base image)"
fi

# ── 2. mise (pinned) ─────────────────────────────────────────────────
# Pinned to the same release the repo's tools/setup/linux.sh pins, verified
# by SHA256. Bump in lockstep with .mise.toml `min_version` / linux.sh.
export PATH="$HOME/.local/bin:$PATH"
MISE_PIN_VERSION="2026.6.12"
MISE_VERSION="v${MISE_PIN_VERSION}"
MISE_SHA256_X64="cc9b5bc96ba616d88d0ee515196bec6871a33d64cec774924fbfaa2717a921fd"
MISE_SHA256_ARM64="6cef74020f98b06a62d6f925c116235b629b4badb197b20a33217bff96d60f0f"
MISE_SHA256_X64_MUSL="3ce5ad40a9ce0280e0f80e447cfbcfa0b40281b9d4d0fd5a0a66c47c28c2a5e3"
MISE_SHA256_ARM64_MUSL="39905c8a85c3ef0bae3ba665b0ac602bc338da599f8c4a0c7912e7ebc4930201"

installed_mise_version=""
if command -v mise >/dev/null 2>&1; then
  installed_mise_version="$(mise --version 2>/dev/null | awk '{print $1}')"
fi

if [ "$installed_mise_version" != "$MISE_PIN_VERSION" ]; then
  echo "↓ installing mise ${MISE_PIN_VERSION} (pinned release tarball)"
  # gnu tarballs need glibc >= 2.38; fall back to the static musl twin otherwise.
  MISE_LIBC=gnu
  if ldd --version 2>&1 | head -n1 | grep -qi musl; then
    MISE_LIBC=musl
  else
    _glibc_ver="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}')" || _glibc_ver=""
    if [ -n "$_glibc_ver" ]; then
      _maj="${_glibc_ver%%.*}"; _min="${_glibc_ver#*.}"; _min="${_min%%.*}"
      if [ "$_maj" -lt 2 ] || { [ "$_maj" -eq 2 ] && [ "$_min" -lt 38 ]; }; then MISE_LIBC=musl; fi
    fi
  fi
  case "$(uname -m)" in
    x86_64|amd64)  MISE_ARCH=x64;   MISE_SHA256="$MISE_SHA256_X64";   MISE_SHA256_MUSL="$MISE_SHA256_X64_MUSL" ;;
    aarch64|arm64) MISE_ARCH=arm64; MISE_SHA256="$MISE_SHA256_ARM64"; MISE_SHA256_MUSL="$MISE_SHA256_ARM64_MUSL" ;;
    *) echo "error: unsupported arch $(uname -m) for mise install" >&2; exit 1 ;;
  esac
  if [ "$MISE_LIBC" = musl ]; then MISE_ARCH="${MISE_ARCH}-musl"; MISE_SHA256="$MISE_SHA256_MUSL"; fi
  MISE_TARBALL="mise-${MISE_VERSION}-linux-${MISE_ARCH}.tar.gz"
  MISE_URL="https://github.com/jdx/mise/releases/download/${MISE_VERSION}/${MISE_TARBALL}"
  MISE_TMP="$(mktemp -d)"
  trap 'rm -rf "$MISE_TMP"' EXIT
  curl -fsSL --retry 5 --retry-delay 2 -o "$MISE_TMP/$MISE_TARBALL" "$MISE_URL"
  echo "${MISE_SHA256}  $MISE_TMP/$MISE_TARBALL" | sha256sum -c -
  tar -C "$MISE_TMP" -xzf "$MISE_TMP/$MISE_TARBALL"
  mkdir -p "$HOME/.local/bin"
  mv "$MISE_TMP/mise/bin/mise" "$HOME/.local/bin/mise"
  trap - EXIT
  rm -rf "$MISE_TMP"
fi
# mise manages its own version; never let it self-update under us.
mkdir -p "${MISE_DATA_DIR:-$HOME/.local/share/mise}"
touch "${MISE_DATA_DIR:-$HOME/.local/share/mise}/.disable-self-update"
echo "✓ mise: $(mise --version)"

# ── 3. Provision the pinned runtimes + linters from .mise.toml ───────
# `standard` host tier keeps every core runtime + linter but skips the
# full-tier Kubernetes tool set (.mise.full.toml) a Cloud Agent doesn't need.
export ZETA_HOST_TIER="${ZETA_HOST_TIER:-standard}"
export MISE_PYTHON_GITHUB_ATTESTATIONS=0
export MISE_TRUSTED_CONFIG_PATHS="$REPO_ROOT"
mise trust --all --yes
echo "↓ mise install (runtimes + linters from .mise.toml)"
mise install --yes
# Pin the exact rust toolchain mise resolved so rustc/clippy don't re-sync the
# channel manifest from the network on first use.
_rust_tc="$(mise current rust 2>/dev/null || true)"
[ -n "$_rust_tc" ] && export RUSTUP_TOOLCHAIN="$_rust_tc"

# Put mise shims on PATH for the rest of this script.
export PATH="$HOME/.local/share/mise/shims:$HOME/.dotnet/tools:$PATH"

# ── 4. TypeScript / tooling dependencies ─────────────────────────────
echo "↓ bun install (repo tooling deps)"
bun install --frozen-lockfile

# ── 5. Make the toolchain visible to the agent's shells ──────────────
# Cloud Agent commands run in non-login shells that don't pick up mise
# automatically. Append an idempotent PATH block to ~/.bashrc so dotnet /
# bun / node / the linters resolve without a manual export.
BASHRC="$HOME/.bashrc"
MARKER="# >>> zeta cloud-agent toolchain (managed by .cursor/install.sh) >>>"
if ! grep -qF "$MARKER" "$BASHRC" 2>/dev/null; then
  {
    echo ""
    echo "$MARKER"
    echo 'export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$HOME/.dotnet/tools:$PATH"'
    echo "export MISE_TRUSTED_CONFIG_PATHS=\"$REPO_ROOT\""
    echo "export DOTNET_CLI_TELEMETRY_OPTOUT=1"
    echo "export DOTNET_NOLOGO=1"
    echo "# <<< zeta cloud-agent toolchain <<<"
  } >> "$BASHRC"
  echo "✓ appended toolchain PATH block to ~/.bashrc"
else
  echo "✓ ~/.bashrc toolchain PATH block already present"
fi

echo ""
echo "=== install complete — toolchain summary ==="
printf 'dotnet %s | bun %s | node %s | rustc %s | java %s | python %s\n' \
  "$(dotnet --version 2>/dev/null)" "$(bun --version 2>/dev/null)" \
  "$(node --version 2>/dev/null)" "$(rustc --version 2>/dev/null | awk '{print $2}')" \
  "$(java --version 2>/dev/null | head -n1 | awk '{print $2}')" \
  "$(python --version 2>/dev/null | awk '{print $2}')"
echo "Build:  dotnet build Zeta.sln -c Release"
echo "Test:   dotnet test  Zeta.sln -c Release"
echo "Gate:   bun run preflight   (bun run preflight:quick for lints+tsc only)"
