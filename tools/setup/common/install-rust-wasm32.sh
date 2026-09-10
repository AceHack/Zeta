#!/usr/bin/env bash
# tools/setup/common/install-rust-wasm32.sh
#
# Install Rust via a PINNED, checksum-verified rustup-init and add the
# wasm32-unknown-unknown target. Idempotent: skips if rustup and the wasm32
# target are already installed.
#
# Desired-state rationale:
#   - Rust is declared in .mise.toml (rust = "1.99.0-beta.3") for dev workstations.
#   - On CI runners and cluster nodes where mise is not available, this script
#     provides the same pinned version via a pinned rustup-init (see THE PIN below).
#   - The wasm32-unknown-unknown target is required for Oracle 12 (Rust WASM
#     substrate, 7.4KB DLA binary) and Conjecture Z-7 discharge.
#
# Usage:
#   bash tools/setup/common/install-rust-wasm32.sh
#   RUST_VERSION=1.99.0-beta.3 bash tools/setup/common/install-rust-wasm32.sh
#
# Called by: tools/setup/linux.sh (after apt packages)
#
# THE PIN (081M24HZCYN087G0R002MT55TV). Until 2026-09-10 line 32 of this file was
#
#     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
#       sh -s -- -y --default-toolchain "$RUST_VERSION" --no-modify-path
#
# the last live pipe-to-shell on the install path -- and install.sh is consumed
# three ways (dev laptops, CI runners, devcontainer images; GOVERNANCE.md §24),
# so whatever that URL served at that instant executed on all three. It is now a
# fetch of ONE version-addressed artifact, SHA-256 verified BEFORE anything is
# made executable. The ordering is the property: a pipe runs the bytes as its
# first act, so no check it could perform afterwards would be a check.
#
# Pin:      tools/setup/rustup-pin.json   (4 platforms; see its _doc)
# Mechanism: src/Core.TypeScript/ace/install-pinned-artifact.ts  (the ollama one)
# Refresh:  bun src/Core.TypeScript/ace/refresh-rustup-pin.ts
# Proof:    .github/workflows/verify-rustup-pin.yml, on any PR touching the pin
#
# FAILS CLOSED, and that is not an increase in blast radius: `set -euo pipefail`
# meant the old `curl | sh` already aborted install.sh whenever the fetch failed.
# What is refused is a FALLBACK to the unpinned installer -- a check with a
# bypass is not a check. No rolling exception is needed either
# (tools/setup/manifests/from-url-rolling-exceptions): the archive URL is
# version-addressed, so a new rustup release leaves this pin stale, not broken.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

RUST_VERSION="${RUST_VERSION:-1.99.0-beta.3}"

# Select the exact pinned toolchain before any rustc/rustup probe. A bare
# rustup proxy may otherwise refresh channel metadata even when this version
# and its components are already cached, turning an idempotent install into a
# network dependency during static.rust-lang.org outages.
export RUSTUP_TOOLCHAIN="$RUST_VERSION"

# Step 1: Install rustup if not present
if ! command -v rustup >/dev/null 2>&1; then
  echo "Installing rustup (pinned, checksum-verified) for Rust ${RUST_VERSION}..."
  # bun is on PATH by the time linux.sh reaches this line -- it runs the setup
  # realizers (which refuse without bun) some 20 lines earlier. A standalone run
  # of this script may not have it, and that is a REFUSAL rather than a quiet
  # fall-back to the shape this change removed.
  if ! command -v bun >/dev/null 2>&1; then
    echo "error: bun is required to install rustup from the pin (tools/setup/rustup-pin.json)." >&2
    echo "       Run tools/setup/install.sh, or install bun first. There is deliberately no" >&2
    echo "       unpinned fallback: restoring \`curl | sh\` is what this replaced." >&2
    exit 1
  fi
  # --default-toolchain is passed as argv rather than written into the pin: the
  # Rust version is declared once, in .mise.toml, and a second copy in the pin
  # would be free to drift from it. The BYTES are what the pin guarantees.
  bun "$REPO_ROOT/src/Core.TypeScript/ace/install-pinned-artifact.ts" \
    --pin "$REPO_ROOT/tools/setup/rustup-pin.json" \
    "--run-arg=--default-toolchain" "--run-arg=$RUST_VERSION"
  # Source cargo env for the rest of this script
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
