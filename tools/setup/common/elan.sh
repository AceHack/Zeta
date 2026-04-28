#!/usr/bin/env bash
#
# tools/setup/common/elan.sh — installs/updates elan (Lean 4 toolchain
# manager). Lean stays outside mise for now — no mise plugin yet.
# Contributing that plugin is a candidate open-source task per
# GOVERNANCE.md §23.
#
# The pinned toolchain lives at `tools/lean4/lean-toolchain` and elan
# reads it automatically when `lake build` runs in that directory.

set -euo pipefail

# shellcheck source=curl-fetch.sh
# shellcheck disable=SC1091  # CI runs without -x; source path verified in tools/setup/common/curl-fetch.sh
source "$(dirname "${BASH_SOURCE[0]}")/curl-fetch.sh"

if ! command -v elan >/dev/null 2>&1; then
  echo "↓ installing elan (Lean 4 toolchain manager)..."
  # Use the stream variant (NO --retry, NO --retry-all-errors).
  # Codex P0 review on PR #75: even bare `--retry` can retry
  # after bytes are piped to sh, and the consumer cannot
  # un-receive piped bytes. Streamed installers fail-fast on
  # transient errors; user re-runs install.sh. Proper
  # download-to-temp + checksum-verify hardening tracked as
  # B-0063.
  curl_fetch_stream https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
    | sh -s -- -y --default-toolchain none
fi

# Source the elan env file for the remainder of this script run; also
# make sure it's wired into the managed shellenv later.
if [ -f "$HOME/.elan/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.elan/env"
fi

if command -v elan >/dev/null 2>&1; then
  echo "✓ elan: $(elan --version 2>&1 | head -n1)"
  # Self-update is cheap and idempotent; running daily keeps elan fresh.
  elan self update >/dev/null 2>&1 || true
else
  echo "warning: elan install attempted but 'elan' is still not on PATH."
  echo "  Add \$HOME/.elan/bin to PATH and re-run."
fi
