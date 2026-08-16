#!/usr/bin/env bash
# tools/setup/common/install-rust-wasm32.sh
#
# Install Rust via rustup and add the wasm32-unknown-unknown target.
# Idempotent: skips if rustup and the wasm32 target are already installed.
#
# Desired-state rationale:
#   - Rust is declared in .mise.toml (rust = "1.87.0") for dev workstations.
#   - On CI runners and cluster nodes where mise is not available, this script
#     provides the same pinned version via rustup.rs.
#   - The wasm32-unknown-unknown target is required for Oracle 12 (Rust WASM
#     substrate, 7.4KB DLA binary) and Conjecture Z-7 discharge.
#
# Usage:
#   bash tools/setup/common/install-rust-wasm32.sh
#   RUST_VERSION=1.87.0 bash tools/setup/common/install-rust-wasm32.sh
#
# Called by: tools/setup/linux.sh (after apt packages)
set -euo pipefail

RUST_VERSION="${RUST_VERSION:-1.87.0}"

# Select the exact pinned toolchain before any rustc/rustup probe. A bare
# rustup proxy may otherwise refresh channel metadata even when this version
# and its components are already cached, turning an idempotent install into a
# network dependency during static.rust-lang.org outages.
export RUSTUP_TOOLCHAIN="$RUST_VERSION"

# Step 1: Install rustup if not present
if ! command -v rustup >/dev/null 2>&1; then
  echo "Installing rustup (Rust ${RUST_VERSION})..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --default-toolchain "$RUST_VERSION" --no-modify-path
  # Source cargo env for the rest of this script
  # shellcheck source=/dev/null
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
  echo "rustup $(rustup --version 2>&1 | head -1) installed"
else
  echo "rustup already installed: $(rustup --version 2>&1 | head -1)"
  # rustup may be provisioned by mise without a ~/.cargo/env file. `source` is
  # a special builtin, so a missing file can terminate this shell even with
  # `|| true`; guard the path explicitly.
  if [ -f "$HOME/.cargo/env" ]; then
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"
  fi
fi

# Step 2: Ensure the pinned toolchain is installed
if ! rustup toolchain list 2>/dev/null | grep -q "${RUST_VERSION}"; then
  echo "Installing Rust toolchain ${RUST_VERSION}..."
  rustup toolchain install "$RUST_VERSION"
fi
# A fresh rustup install above already makes this version the default, while
# repo shells select it through mise. Re-running `rustup default <version>` for
# an installed exact toolchain still refreshes channel metadata, so the
# exported RUSTUP_TOOLCHAIN is the offline-safe selection for this invocation.
echo "  rustc $(rustc --version)"

# Step 3: Add wasm32-unknown-unknown target
if rustup target list --installed 2>/dev/null | grep -q "wasm32-unknown-unknown"; then
  echo "  wasm32-unknown-unknown target already installed"
else
  echo "Adding wasm32-unknown-unknown target..."
  rustup target add wasm32-unknown-unknown
  echo "  wasm32-unknown-unknown target installed"
fi

echo "Rust ${RUST_VERSION} + wasm32-unknown-unknown ready"
