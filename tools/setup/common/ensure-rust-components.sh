#!/usr/bin/env bash
# Ensure rustfmt and clippy exist without refreshing an already usable toolchain.

set -euo pipefail

if ! command -v rustc >/dev/null 2>&1 || ! command -v cargo >/dev/null 2>&1; then
  exit 0
fi

# rustup component add refreshes channel metadata even for exact installed
# toolchains. Probe the actual commands first so a warm cache stays offline.
if command -v rustfmt >/dev/null 2>&1 &&
   rustfmt --version >/dev/null 2>&1 &&
   cargo clippy --version >/dev/null 2>&1; then
  echo "✓ rustfmt and clippy already available"
  exit 0
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "warning: rustup not on PATH; cannot provision rustfmt/clippy components" >&2
  exit 0
fi

rust_toolchain="$(rustc -vV | awk -F ': ' '
  $1 == "release" { release = $2 }
  $1 == "host" { host = $2 }
  END {
    if (release != "" && host != "") print release "-" host
  }
')"

if [ -n "$rust_toolchain" ]; then
  rustup component add --toolchain "$rust_toolchain" rustfmt clippy
else
  rustup component add rustfmt clippy
fi
