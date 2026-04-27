#!/usr/bin/env bash
#
# tools/setup/linux.sh — Linux bootstrap path (Debian/Ubuntu for now).
#
# Order matters:
#   1. apt packages from manifests/apt (build-essential, curl, etc.)
#   2. mise (via official installer; no apt package yet)
#   3. common/mise.sh     — installs dotnet/python/java/bun/uv
#                           per .mise.toml
#   4. common/python-tools.sh — uv-managed Python CLI tools
#                              (ruff, etc.) from manifests/uv-tools
#   5. common/elan.sh     — Lean toolchain
#   6. common/dotnet-tools.sh — dotnet global tools from
#                              manifests/dotnet-tools
#   7. common/verifiers.sh    — TLA+ + Alloy jars from manifests/verifiers
#   8. common/shellenv.sh     — managed PATH file
#
# Non-Debian Linuxes (RHEL/Fedora/Arch/Alpine) are deferred — the
# install-script layering supports adding them alongside apt.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"

# ── Detect apt availability (Debian/Ubuntu) ─────────────────────────
if ! command -v apt-get >/dev/null 2>&1; then
  echo "error: this script currently supports Debian/Ubuntu only"
  echo "  RHEL/Fedora/Arch/Alpine support is backlogged — see"
  echo "  docs/research/build-machine-setup.md"
  exit 1
fi

# ── 1. apt packages (from manifest) ─────────────────────────────────
APT_MANIFEST="$SETUP_DIR/manifests/apt"
if [ -f "$APT_MANIFEST" ]; then
  # Extract non-comment non-empty lines via awk (doesn't fail
  # under pipefail when manifest is all comments — unlike
  # `grep -vE` which exits 1 on no-match).
  PKGS="$(awk '!/^[[:space:]]*#/ && NF > 0 { print }' "$APT_MANIFEST" | tr '\n' ' ')"
  if [ -n "$PKGS" ]; then
    echo "↓ installing apt packages from $(basename "$APT_MANIFEST")..."
    # Use sudo only when not already root (CI containers often run as root).
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
    $SUDO apt-get update -y
    # shellcheck disable=SC2086
    $SUDO apt-get install -y --no-install-recommends $PKGS
  else
    echo "✓ apt manifest empty; skipping"
  fi
fi
echo "✓ apt packages up to date"

# ── 2. mise ─────────────────────────────────────────────────────────
# Pinned to a specific mise release tarball + verified SHA256 (per
# arch). Resolves Scorecard PinnedDependenciesID #16 (downloadThenRun
# not pinned by hash). The official `curl mise.run | sh` installer
# auto-detects the latest release at runtime, which is what Scorecard
# flags. Bumping: pull /repos/jdx/mise/releases/latest, update
# MISE_VERSION + both MISE_SHA256_* values together — they form a
# content-pin set.
if ! command -v mise >/dev/null 2>&1; then
  echo "↓ installing mise from pinned release tarball..."
  MISE_VERSION="v2026.4.24"
  MISE_SHA256_X64="de2f924940c29b8983035833e2fb3a50092c5794562ca0dcd0cf87b40cae2c58"
  MISE_SHA256_ARM64="cf5f4899c3f1b56239d2eedf173c68c47b7db95400c4fa1b61e943dee4965727"
  MISE_SHA256_ARMV7="2e122fd8bec64f86449872c633e47023b56416f887e4646307ad176baae3bfa9"
  # The previous `curl mise.run | sh` shape supported armv7 implicitly
  # (the installer auto-detects). Preserve that here — no Zeta CI leg
  # uses armv7 today, but dev laptops on a Raspberry Pi 4 in 32-bit
  # mode or older single-board computers do, and the cost of carrying
  # the case is tiny (one extra SHA256 to bump per release).
  case "$(uname -m)" in
    x86_64|amd64)  MISE_ARCH=x64;    MISE_SHA256="${MISE_SHA256_X64}"   ;;
    aarch64|arm64) MISE_ARCH=arm64;  MISE_SHA256="${MISE_SHA256_ARM64}" ;;
    armv7l|armv7)  MISE_ARCH=armv7;  MISE_SHA256="${MISE_SHA256_ARMV7}" ;;
    *) echo "error: unsupported arch $(uname -m) for mise install" >&2; exit 1 ;;
  esac
  MISE_TARBALL="mise-${MISE_VERSION}-linux-${MISE_ARCH}.tar.gz"
  MISE_URL="https://github.com/jdx/mise/releases/download/${MISE_VERSION}/${MISE_TARBALL}"
  MISE_TMP="$(mktemp -d)"
  # Always clean up the tmp dir, even on failure (download error, SHA
  # mismatch, tar extract failure). `set -euo pipefail` would otherwise
  # leak the directory on any failure path.
  trap 'rm -rf "${MISE_TMP}"' EXIT
  curl -fsSL "${MISE_URL}" -o "${MISE_TMP}/${MISE_TARBALL}"
  # Portable SHA256 verification: sha256sum (Linux) or shasum (macOS,
  # though linux.sh runs on Linux only). Per the 4-shell portability
  # target (macOS bash 3.2 / Ubuntu / git-bash / WSL).
  if command -v sha256sum >/dev/null 2>&1; then
    echo "${MISE_SHA256}  ${MISE_TMP}/${MISE_TARBALL}" | sha256sum -c -
  else
    echo "${MISE_SHA256}  ${MISE_TMP}/${MISE_TARBALL}" | shasum -a 256 -c -
  fi
  tar -C "${MISE_TMP}" -xzf "${MISE_TMP}/${MISE_TARBALL}"
  mkdir -p "${HOME}/.local/bin"
  mv "${MISE_TMP}/mise/bin/mise" "${HOME}/.local/bin/mise"
  # Tmp dir cleanup happens via the EXIT trap above.
  # The installer puts mise at $HOME/.local/bin/mise; ensure we can
  # invoke it for the remainder of this script run.
  export PATH="${HOME}/.local/bin:${PATH}"
fi
echo "✓ mise: $(mise --version)"

# ── 3-8. Common steps ───────────────────────────────────────────────
# mise.sh runs `mise install` from .mise.toml, which now includes
# dotnet (round-34 flip). No separate dotnet install step needed;
# mise shims handle PATH. `~/.dotnet/tools` still needs PATH for
# `dotnet tool install -g` globals — that's dotnet's own convention
# independent of where the SDK lives. shellenv.sh wires it.
"$SETUP_DIR/common/mise.sh"

# Put mise shims on THIS shell's PATH so subsequent common/*.sh
# subprocesses (python-tools, dotnet-tools, verifiers) inherit it
# and can invoke dotnet / uv / bun / java / python from the mise
# install. mise.sh also tries to export this but it exports inside
# its own subprocess; parent inherit needs the parent to export.
for shim_dir in \
    "$HOME/.local/share/mise/shims" \
    "/opt/homebrew/opt/mise/shims" \
    "/opt/homebrew/share/mise/shims"; do
  if [ -d "$shim_dir" ]; then
    export PATH="$shim_dir:$PATH"
    break
  fi
done

"$SETUP_DIR/common/python-tools.sh"

# Make ~/.dotnet/tools available for the remainder of this install.sh
# process so dotnet-tools.sh can install globals (semgrep / stryker)
# into $HOME/.dotnet/tools and find them on PATH in the same run.
export PATH="$HOME/.dotnet/tools:$PATH"

"$SETUP_DIR/common/elan.sh"
"$SETUP_DIR/common/dotnet-tools.sh"
"$SETUP_DIR/common/verifiers.sh"
"$SETUP_DIR/common/shellenv.sh"
"$SETUP_DIR/common/profile-edit.sh"
