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
#   6. mechanisms/from-uv-tool.sh — uv-managed Python CLI tools
#   7. mechanisms/from-uv-venv.sh — optional project .venv deps (opt-in)
#   8. mechanisms/from-elan.sh     — Lean toolchain
#   9. mechanisms/from-dotnet-global.sh — dotnet global tools
#  10. mechanisms/from-url.sh   — HTTPS assets → repo paths
#  10b. mechanisms/from-opam-git.sh — opam git source-build (ZETA_INSTALL_FULL)
#  11. mechanisms/from-bun-global.sh — bun-global CLIs
#  12. mechanisms/from-installer.sh — vendor install scripts
#  13. mechanisms/from-ollama.sh   — local-LLM primitive
#  14. common/shellenv.sh    — managed PATH file
#  15. common/profile-edit.sh — append the managed-PATH source line to the shell profile

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"
SETUP_REALIZE="$REPO_ROOT/src/Core.TypeScript/ace/setup-realize.ts"

realize_mechanism() {
  local id="$1"
  if command -v bun >/dev/null 2>&1 && bun "$SETUP_REALIZE" --available "$id" >/dev/null 2>&1; then
    bun "$SETUP_REALIZE" "$id"
  else
    "$SETUP_DIR/mechanisms/${id}.sh"
  fi
}

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
  # Download to temp file then exec — the 081KQ8P5D0008QG0R001DMK8JD structural fix.
  # Homebrew does not publish a SHA256 for install.sh (the script
  # tracks HEAD of github.com/Homebrew/install with no tagged
  # releases). Trust anchor: HTTPS + GitHub + the Homebrew project.
  # We verify non-empty to catch truncated downloads.
  HOMEBREW_INSTALLER_TMP="$(mktemp)" || { echo "error: mktemp failed" >&2; exit 1; }
  trap 'rm -f "${HOMEBREW_INSTALLER_TMP}"' EXIT
  curl_fetch --output "${HOMEBREW_INSTALLER_TMP}" \
    https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh
  if [ ! -s "${HOMEBREW_INSTALLER_TMP}" ]; then
    echo "error: Homebrew installer empty after download; refusing to exec" >&2
    exit 1
  fi
  /bin/bash "${HOMEBREW_INSTALLER_TMP}"
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
  #
  # the maintainer 2026-05-26 surfaced a parser bug where a manifest
  # line like `p7zip  # cascade #4 audit (7z list)` was passed to
  # brew install verbatim (formula name became the whole line including
  # the inline comment), producing "No available formula". Fix: strip
  # inline `# ...` AND trim surrounding whitespace before emitting.
  PKGS="$(awk '
    { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
    NF > 0 { print }
  ' "$BREW_MANIFEST")"
  # HOST TIERS — entries may carry tier=<slim|standard|full>; host declares or auto-detects
  # (workitem 081KTWQZY7F08QG0R0034KN17T).
  # shellcheck disable=SC1091
  . "$SETUP_DIR/common/host-tier.sh"
  if [ -n "$PKGS" ]; then
    echo "↓ installing brew packages from $(basename "$BREW_MANIFEST")..."
    # `brew install` is idempotent on already-installed formulae.
    printf '%s\n' "$PKGS" | while IFS= read -r pkg_line; do
      required_tier="$(zeta_tier_of_line "$pkg_line")"
      pkg="$(zeta_strip_tier "$pkg_line" | awk '{print $1}')"
      [ -z "$pkg" ] && continue
      if ! zeta_tier_allows "$required_tier"; then
        echo "→ $pkg skipped: requires tier=$required_tier, host is $ZETA_HOST_TIER ($ZETA_HOST_TIER_SOURCE)"
        continue
      fi
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

# ── 3b. Brew CASKS (from manifests/brew-cask) ───────────────────────
# Casks are a separate brew namespace (`--cask` / `brew list --cask`), so they get
# their own declarative manifest + loop (mirrors the formula loop above, tier-aware).
CASK_MANIFEST="$SETUP_DIR/manifests/brew-cask"
if [ -f "$CASK_MANIFEST" ]; then
  CASKS="$(awk '
    { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
    NF > 0 { print }
  ' "$CASK_MANIFEST")"
  if [ -n "$CASKS" ]; then
    echo "↓ installing brew casks from $(basename "$CASK_MANIFEST")..."
    printf '%s\n' "$CASKS" | while IFS= read -r cask_line; do
      required_tier="$(zeta_tier_of_line "$cask_line")"
      stripped="$(zeta_strip_tier "$cask_line")"
      cask="$(printf '%s' "$stripped" | awk '{print $1}')"
      [ -z "$cask" ] && continue
      # Optional `tap=<owner/tap>` token — a custom tap (e.g. cvc5/cvc5) is tapped + trusted
      # before install. Generalizes the former cvc5 one-off into the manifest framework.
      tap="$(printf '%s' "$stripped" | awk '{for(i=2;i<=NF;i++){if($i ~ /^tap=/){sub(/^tap=/,"",$i); print $i}}}')"
      if ! zeta_tier_allows "$required_tier"; then
        echo "→ $cask skipped: requires tier=$required_tier, host is $ZETA_HOST_TIER ($ZETA_HOST_TIER_SOURCE)"
        continue
      fi
      if [ -n "$tap" ]; then
        brew tap "$tap" >/dev/null 2>&1 || true
        brew trust "$tap" >/dev/null 2>&1 || true
      fi
      if brew list --cask "$cask" >/dev/null 2>&1; then
        brew upgrade --cask "$cask" >/dev/null 2>&1 || true
      else
        brew install --cask "$cask"
      fi
    done
  fi
fi
echo "✓ brew casks up to date"

# ── 4. mise ─────────────────────────────────────────────────────────
# Keep in sync with .mise.toml min_version and tools/setup/linux.sh MISE_PIN_VERSION.
MISE_PIN_VERSION="2026.6.12"

installed_mise_version=""
if command -v mise >/dev/null 2>&1; then
  installed_mise_version="$(mise --version 2>/dev/null | awk '{print $1}')"
fi

if ! command -v mise >/dev/null 2>&1; then
  echo "↓ installing mise via Homebrew..."
  brew install mise
fi

installed_mise_version="$(mise --version 2>/dev/null | awk '{print $1}')"
if [ "$installed_mise_version" != "$MISE_PIN_VERSION" ]; then
  echo "↓ upgrading mise ${installed_mise_version:-unknown} → ${MISE_PIN_VERSION} via Homebrew..."
  brew update
  brew upgrade mise || brew install mise
  installed_mise_version="$(mise --version 2>/dev/null | awk '{print $1}')"
  if [ "$installed_mise_version" != "$MISE_PIN_VERSION" ]; then
    echo "error: mise is ${installed_mise_version}, but .mise.toml requires ${MISE_PIN_VERSION}" >&2
    echo "  run: brew update && brew upgrade mise" >&2
    exit 1
  fi
fi
mkdir -p "${MISE_DATA_DIR:-$HOME/.local/share/mise}"
touch "${MISE_DATA_DIR:-$HOME/.local/share/mise}/.disable-self-update"
echo "✓ mise: $(mise --version)"

# ── 5-12. Common steps ──────────────────────────────────────────────
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

realize_mechanism from-uv-tool
"$SETUP_DIR/mechanisms/from-uv-venv.sh"

# Make ~/.dotnet/tools available for the remainder of this install.sh
# process so from-dotnet-global can install globals into $HOME/.dotnet/tools
# and find them on PATH in the same run.
export PATH="$HOME/.dotnet/tools:$PATH"

realize_mechanism from-elan
realize_mechanism from-dotnet-global
realize_mechanism from-dotnet-workload
realize_mechanism from-url
"$SETUP_DIR/mechanisms/from-opam-git.sh" || echo "⚠ from-opam-git failed — see output above; continuing"
realize_mechanism from-bun-global
realize_mechanism from-bun-link
"$SETUP_DIR/mechanisms/from-installer.sh"
"$SETUP_DIR/mechanisms/from-ollama.sh"
"$SETUP_DIR/common/shellenv.sh"
"$SETUP_DIR/common/profile-edit.sh"
