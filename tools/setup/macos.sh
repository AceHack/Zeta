#!/usr/bin/env bash
#
# tools/setup/macos.sh — macOS bootstrap path. Called by install.sh.
#
# Order matters:
#   1. Xcode Command Line Tools (prerequisite for everything else)
#   2. Homebrew (system-package source on macOS)
#   3. Brew packages from manifests/brew (currently empty after
#      round-34 JDK → mise migration)
#   4. mise (runtime manager)
#   5. common/mise.sh     — installs dotnet/python/java/bun/uv
#                           per .mise.toml
#   6. common/python-tools.sh — uv-managed Python CLI tools
#                              (ruff, etc.) from manifests/uv-tools
#   7. common/elan.sh     — Lean toolchain (no mise plugin yet)
#   8. common/dotnet-tools.sh — dotnet global tools (semgrep,
#                              stryker, etc.) from manifests/dotnet-tools
#   9. common/verifiers.sh    — TLA+ + Alloy jars from manifests/verifiers
#  10. common/shellenv.sh     — managed PATH file

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"

# shellcheck source=tools/setup/common/curl-fetch.sh
# shellcheck disable=SC1091  # SC1091 fires because the source path is
# constructed via $SETUP_DIR (a runtime variable) rather than a
# literal; shellcheck cannot statically resolve it. The source=
# directive above tells shellcheck where the file actually lives so
# it follows the include for static analysis. The SC1091 disable is
# the matching runtime-side suppression.
source "$SETUP_DIR/common/curl-fetch.sh"

# ── 1. Xcode Command Line Tools ─────────────────────────────────────
if ! xcode-select -p >/dev/null 2>&1; then
  echo "↓ installing Xcode Command Line Tools (non-interactive)..."
  # Apple still shows one confirmation prompt on this path; we accept
  # that rather than fail fast per the maintainer's standing
  # "just install everything" framing for first-run setup.
  xcode-select --install || true
  echo "  If a GUI prompt appeared, complete the install and re-run this script."
fi
echo "✓ Xcode CLT at $(xcode-select -p 2>/dev/null || echo 'pending user confirmation')"

# ── 2. Homebrew ─────────────────────────────────────────────────────
if ! command -v brew >/dev/null 2>&1; then
  echo "↓ installing Homebrew..."
  # Capture to a named variable + check exit code explicitly.
  # bash's `set -e` is not reliably triggered by a failing
  # command substitution without `inherit_errexit`. Pattern:
  # capture, check length, exec only on non-empty + curl-
  # success. The proper fix (download-to-temp + checksum-
  # verify) is tracked as B-0063; this is a small-improvement-
  # not-structurally-safe form acknowledged in
  # tools/setup/common/curl-fetch.sh COMMAND-SUBSTITUTION +
  # SET-E section.
  if ! HOMEBREW_INSTALLER="$(curl_fetch_stream https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; then
    echo "error: failed to fetch Homebrew installer; check network and re-run install.sh" >&2
    exit 1
  fi
  if [ -z "$HOMEBREW_INSTALLER" ]; then
    echo "error: Homebrew installer was empty; refusing to exec" >&2
    exit 1
  fi
  /bin/bash -c "$HOMEBREW_INSTALLER"
  # Ensure brew is on PATH for the remainder of this script run.
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi
echo "✓ brew: $(brew --version | head -n1)"

# ── 3. Brew packages (from manifest) ────────────────────────────────
BREW_MANIFEST="$SETUP_DIR/manifests/brew"
if [ -f "$BREW_MANIFEST" ]; then
  # Extract non-comment non-empty lines via awk (doesn't fail under
  # pipefail when the manifest is all comments — unlike `grep -vE`
  # which exits 1 on no-match). Round-34 brew has no packages
  # after the JDK migration to mise.
  PKGS="$(awk '!/^[[:space:]]*#/ && NF > 0 { print }' "$BREW_MANIFEST")"
  if [ -n "$PKGS" ]; then
    echo "↓ installing brew packages from $(basename "$BREW_MANIFEST")..."
    # `brew install` is idempotent on already-installed formulae.
    printf '%s\n' "$PKGS" | while IFS= read -r pkg; do
      if brew list --formula "$pkg" >/dev/null 2>&1; then
        brew upgrade "$pkg" >/dev/null 2>&1 || true
      else
        brew install "$pkg"
      fi
    done
  else
    echo "✓ brew manifest empty; skipping"
  fi
fi
echo "✓ brew packages up to date"

# ── 4. mise ─────────────────────────────────────────────────────────
if ! command -v mise >/dev/null 2>&1; then
  echo "↓ installing mise via Homebrew..."
  brew install mise
fi
echo "✓ mise: $(mise --version)"

# ── 5-10. Common steps ──────────────────────────────────────────────
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
