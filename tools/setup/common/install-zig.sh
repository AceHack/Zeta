#!/usr/bin/env bash
# tools/setup/common/install-zig.sh
#
# Install Zig 0.13.0 on Linux (x86_64 or aarch64).
# Zig is NOT in Ubuntu Noble apt — this script downloads the official release
# tarball and installs it to /usr/local/zig (symlinked to /usr/local/bin/zig).
#
# Desired-state rationale:
#   - Zig is declared in .mise.toml (zig = "0.13.0") for dev workstations.
#   - On CI runners and cluster nodes where mise is not available, this script
#     provides the same pinned version via direct tarball download.
#   - Idempotent: skips if zig is already installed at the correct version.
#
# Usage:
#   bash tools/setup/common/install-zig.sh
#   bash tools/setup/common/install-zig.sh --version 0.13.0
#
# Called by: tools/setup/linux.sh (after apt packages)
set -euo pipefail

ZIG_VERSION="${1:-0.13.0}"
ZIG_INSTALL_DIR="/usr/local/zig-${ZIG_VERSION}"
ZIG_LINK="/usr/local/bin/zig"

# Idempotency check
if command -v zig >/dev/null 2>&1 && [ "$(zig version 2>/dev/null)" = "$ZIG_VERSION" ]; then
  echo "zig ${ZIG_VERSION} already installed — skipping"
  exit 0
fi

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ZIG_ARCH="x86_64" ;;
  aarch64) ZIG_ARCH="aarch64" ;;
  arm64)   ZIG_ARCH="aarch64" ;;
  *)
    echo "ERROR: unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

ZIG_TAR="zig-linux-${ZIG_ARCH}-${ZIG_VERSION}.tar.xz"
ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/${ZIG_TAR}"

echo "Installing Zig ${ZIG_VERSION} (${ZIG_ARCH})..."
echo "  URL: ${ZIG_URL}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL "$ZIG_URL" -o "$TMP_DIR/$ZIG_TAR"
tar -xf "$TMP_DIR/$ZIG_TAR" -C "$TMP_DIR"

# The tarball extracts to zig-linux-<arch>-<version>/
ZIG_EXTRACTED="$TMP_DIR/zig-linux-${ZIG_ARCH}-${ZIG_VERSION}"

sudo rm -rf "$ZIG_INSTALL_DIR"
sudo mv "$ZIG_EXTRACTED" "$ZIG_INSTALL_DIR"
sudo ln -sf "$ZIG_INSTALL_DIR/zig" "$ZIG_LINK"

echo "zig $(zig version) installed at $ZIG_LINK"
echo "  -> $ZIG_INSTALL_DIR/zig"
