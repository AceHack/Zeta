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

if ! command -v elan >/dev/null 2>&1; then
  echo "↓ installing elan (Lean 4 toolchain manager)..."
  # Pinned to v4.2.1 commit SHA + verified SHA256 of elan-init.sh.
  # Bumping procedure: bump both ELAN_INIT_COMMIT (gh api
  # /repos/leanprover/elan/releases/latest) and ELAN_INIT_SHA256
  # (curl <url> | sha256sum) together — they form a content-pin pair.
  # Resolves Scorecard PinnedDependenciesID #15 (downloadThenRun
  # not pinned by hash).
  ELAN_INIT_COMMIT="58e8d545e33641f66dbcbd22c4283109e71757be"  # v4.2.1
  ELAN_INIT_SHA256="4bacca9502cb89736fe63d2685abc2947cfbf34dc87673504f1bb4c43eda9264"
  ELAN_INIT_URL="https://raw.githubusercontent.com/leanprover/elan/${ELAN_INIT_COMMIT}/elan-init.sh"
  ELAN_INIT_TMP="$(mktemp)"
  # Always clean up the tmp file, even on failure (download error, SHA
  # mismatch, installer non-zero exit). `set -euo pipefail` would
  # otherwise leak the file on any failure path.
  trap 'rm -f "${ELAN_INIT_TMP}"' EXIT
  curl -fsSL "${ELAN_INIT_URL}" -o "${ELAN_INIT_TMP}"
  # Portable SHA256 verification: sha256sum (Linux/git-bash/WSL) or
  # shasum -a 256 (macOS default). Per the 4-shell portability target
  # (macOS bash 3.2 / Ubuntu / git-bash / WSL).
  if command -v sha256sum >/dev/null 2>&1; then
    echo "${ELAN_INIT_SHA256}  ${ELAN_INIT_TMP}" | sha256sum -c -
  else
    echo "${ELAN_INIT_SHA256}  ${ELAN_INIT_TMP}" | shasum -a 256 -c -
  fi
  sh "${ELAN_INIT_TMP}" -y --default-toolchain none
  # Tmp file cleanup happens via the EXIT trap above.
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
