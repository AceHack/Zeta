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

# shellcheck source=common/curl-fetch.sh
# shellcheck disable=SC1091  # CI runs without -x; source path verified in tools/setup/common/curl-fetch.sh
source "$SETUP_DIR/common/curl-fetch.sh"

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
if ! command -v mise >/dev/null 2>&1; then
  echo "↓ installing mise via the official installer..."
  # Use the stream variant (bare --retry only, no
  # --retry-all-errors) — the curl output is piped directly
  # into sh, and partial-output replay on retry would be a
  # supply-chain hazard.
  curl_fetch_stream https://mise.run | sh
  # The installer puts mise at $HOME/.local/bin/mise; ensure we can
  # invoke it for the remainder of this script run.
  export PATH="$HOME/.local/bin:$PATH"
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
