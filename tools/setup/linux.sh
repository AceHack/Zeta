#!/usr/bin/env bash
#
# tools/setup/linux.sh — Linux bootstrap path (Debian/Ubuntu for now).
#
# Order matters:
#   1. apt packages from manifests/apt (build-essential, curl, etc.)
#   1b. mechanisms/from-deb.sh + from-shim.sh + from-autotools-tarball.sh — platform fallbacks after apt
#   2. mise (via official installer; no apt package yet)
#   3. common/mise.sh     — installs dotnet/python/java/bun/uv
#                           per .mise.toml
#   4. mechanisms/from-uv-tool.sh — uv tool install (manifests/from-uv-tool)
#   5. mechanisms/from-uv-venv.sh — project .venv pip deps (manifests/from-uv-venv; opt-in)
#   6. mechanisms/from-elan.sh     — Lean toolchain manager
#   7. mechanisms/from-dotnet-global.sh — dotnet global tools
#   8. mechanisms/from-dotnet-workload.sh — dotnet workloads
#   9. mechanisms/from-url.sh   — HTTPS assets → repo paths
#  10. mechanisms/from-opam-git.sh — opam git source-build (ZETA_INSTALL_FULL)
#  11. mechanisms/from-bun-global.sh — bun-global CLIs
#  12. mechanisms/from-bun-link.sh — repo package bins on PATH
#  13. mechanisms/from-installer.sh — vendor install scripts
#  14. mechanisms/from-ollama.sh — local-LLM primitive
#  12. common/shellenv.sh    — managed PATH file
#  13. common/profile-edit.sh — append the managed-PATH source line to the shell profile
#
# Non-Debian Linuxes (RHEL/Fedora/Arch/Alpine) are deferred — the
# install-script layering supports adding them alongside apt.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"

# Retry-equipped curl helper — DST exception for external dep
# downloads, durable retry inside the script instead of ephemeral
# `gh run rerun --failed`. Sources curl_fetch (file-output, with
# `--retry 5 --retry-delay 2`, plus `--retry-all-errors` when the
# local curl supports it — curl-fetch.sh feature-detects and falls
# back on older curl builds).
# shellcheck source=tools/setup/common/curl-fetch.sh
source "$SETUP_DIR/common/curl-fetch.sh"

# ── Detect NixOS — skip apt step entirely, use systemPackages instead ──
# iter-5.5.0 (081KSGS9H0008QG0R001JNKBFD Phase 2, operator 2026-05-27 ALIGNMENT catch):
# NixOS provides system packages declaratively via common.nix
# environment.systemPackages, NOT apt. The same install.sh entry-point
# can still bootstrap a NixOS cluster node by skipping the apt step and
# going directly to mise.sh for runtime version management. Operator
# framing: "our install.sh for mac and linux this is our default" —
# extending NixOS support keeps that default operational on cluster
# nodes invoked from zeta-install.sh Step 6.95a.
if [ -f /etc/NIXOS ]; then
  echo "✓ NixOS detected — skipping apt (system packages declared in common.nix);"
  echo "  proceeding directly to mise + downstream runtime setup"
  IS_NIXOS=1
else
  IS_NIXOS=0
  # ── Detect apt availability (Debian/Ubuntu) ─────────────────────────
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "error: this script currently supports Debian/Ubuntu + NixOS"
    echo "  (NixOS detected via /etc/NIXOS marker file)"
    echo "  RHEL/Fedora/Arch/Alpine support is backlogged — see"
    echo "  docs/research/build-machine-setup.md"
    exit 1
  fi
fi

# ── 1. apt packages (from manifest) ─────────────────────────────────
# NixOS handles system packages via common.nix systemPackages declarative;
# skip the entire apt step. mise + downstream still run.
APT_MANIFEST="$SETUP_DIR/manifests/apt"
if [ "$IS_NIXOS" = 1 ]; then
  echo "✓ skipping apt (NixOS — see common.nix environment.systemPackages)"
elif [ -f "$APT_MANIFEST" ]; then
  # Extract non-comment non-empty lines via awk (doesn't fail
  # under pipefail when manifest is all comments — unlike
  # `grep -vE` which exits 1 on no-match).
  #
  # Strip inline `# ...` comments + trim whitespace (same parser fix
  # as macos.sh BREW_MANIFEST per the maintainer 2026-05-26 bug
  # surface: `p7zip-full  # comment` was passed to apt-get install
  # verbatim, producing "Unable to locate package").
  PKGS="$(awk '
    { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
    NF > 0 { print }
  ' "$APT_MANIFEST" | tr '\n' ' ')"
  # manifests/apt canonical names target Ubuntu 24.04 (Noble). Map to jammy
  # equivalents so install.sh works on 22.04 dev boxes / cloud VMs too.
  if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    if [ "${ID:-}" = "ubuntu" ] && [ "${VERSION_ID:-}" = "22.04" ]; then
      for _pair in libicu74:libicu70 libssl3t64:libssl3 cvc5:cvc4; do
        _noble="${_pair%%:*}"
        _jammy="${_pair#*:}"
        case " $PKGS " in
          *" $_noble "*)
            echo "↻ apt package alias: $_noble → $_jammy (Ubuntu 22.04 jammy)"
            PKGS="${PKGS//$_noble/$_jammy}"
            ;;
        esac
      done
    fi
  fi
  if [ -n "$PKGS" ]; then
    echo "↓ installing apt packages from $(basename "$APT_MANIFEST")..."
    # Use sudo only when not already root (CI containers often run as root).
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
    # `apt-get update` refreshes EVERY configured source, including any
    # third-party PPAs the host image shipped that we don't control. Under
    # `set -euo pipefail` a single unreachable source (e.g. a launchpad PPA
    # returning 403 behind a restricted-network policy) aborts the whole
    # install before any runtime tooling is set up.
    #
    # apt's EXIT CODE is an unreliable partial-failure signal: a signature/403
    # error exits non-zero, but a DNS/connection failure on one source can exit
    # 0 with only `W: Some index files failed to download` (Codex review on
    # PR #6419, confirmed by docker-ubuntu-install-sh-test). So detect partial
    # failure from BOTH the exit code AND the output, and warn in either case —
    # otherwise a real third-party-source outage stays silent, which is the very
    # failure this guard exists to surface. Per
    # `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md`
    # ("grace in the artifact, assert in the test"): the update is GRACEFUL
    # (warn + continue) while the install below stays STRICT — `apt-get install`
    # still fails loudly if a package we actually need is unavailable, so the
    # assert is preserved at install time rather than skipped to a false-green.
    # STREAM the output live (a slow/retry-heavy mirror must not look hung —
    # Copilot P1 on PR #6419) WHILE capturing it to a temp file for the
    # partial-failure probe. `tee` consumes ALL of apt's output, so the
    # SIGPIPE/pipefail hazard that ruled out `printf | grep -q` (Codex P2) does
    # not apply here — the probe greps the FILE, not a pipe. Take apt's OWN exit
    # from PIPESTATUS[0]; the pipeline's own status would be `tee`'s, masking
    # apt. grep on the file stays line-oriented so `^Err:` still anchors per-line.
    apt_log="$(mktemp)"
    apt_update_rc=0
    if $SUDO apt-get update -y 2>&1 | tee "$apt_log"; then :; else apt_update_rc="${PIPESTATUS[0]}"; fi
    if [ "$apt_update_rc" -ne 0 ] \
       || grep -qiE 'Failed to fetch|Some index files failed to download|^Err:' "$apt_log"; then
      echo "⚠ apt-get update reported errors — likely an unreachable third-party" >&2
      echo "  source the host image shipped (not a Zeta manifest source). Continuing;" >&2
      echo "  the apt-get install below still asserts the packages we need are present." >&2
    fi
    rm -f "$apt_log"
    # shellcheck disable=SC2086
    $SUDO apt-get install -y --no-install-recommends $PKGS
  else
    echo "✓ apt manifest empty; skipping"
  fi
fi
echo "✓ apt packages up to date"

# Jammy mechanism fallbacks (from-deb, from-shim, from-autotools-tarball) after apt.
if [ "$IS_NIXOS" != 1 ]; then
  "$SETUP_DIR/mechanisms/from-deb.sh"
  "$SETUP_DIR/mechanisms/from-shim.sh"
  "$SETUP_DIR/mechanisms/from-autotools-tarball.sh"
fi

# ── 2. mise ─────────────────────────────────────────────────────────
# NixOS: use declarative system mise (common.nix / installer ISO). Upstream
# release tarballs are glibc-linked and fail with "cannot execute: required
# file not found" when copied to ~/.local/bin (observed iter-5.5.0 QEMU CI +
# zeta-install.sh Step 6.95a on the live ISO).
linux_sh_prepend_nixos_mise() {
  for _bin_dir in \
      /run/current-system/sw/bin \
      "${HOME}/.nix-profile/bin" \
      /nix/var/nix/profiles/default/bin; do
    if [ -x "${_bin_dir}/mise" ]; then
      export PATH="${_bin_dir}:${PATH}"
      return 0
    fi
  done
  return 1
}

if [ "$IS_NIXOS" = 1 ]; then
  linux_sh_prepend_nixos_mise || true
  if [ -f "${HOME}/.local/bin/mise" ] && ! "${HOME}/.local/bin/mise" --version >/dev/null 2>&1; then
    echo "↻ removing broken tarball mise from ${HOME}/.local/bin/mise (not executable on NixOS)"
    rm -f "${HOME}/.local/bin/mise"
  fi
fi

# Pinned to a specific mise release tarball + verified SHA256 (per
# arch). Resolves Scorecard PinnedDependenciesID #16 (downloadThenRun
# not pinned by hash). The official `curl mise.run | sh` installer
# auto-detects the latest release at runtime, which is what Scorecard
# flags. Bumping: pull /repos/jdx/mise/releases/latest, update
# MISE_VERSION + both MISE_SHA256_* values together — they form a
# content-pin set.
# Skipped on real NixOS — tarball mise is not FHS-compatible; use system mise.
# 081KSKBP80008QG0R000E3RKPK docker harness wires /lib64/ld-linux-*.so.* so tarball mise works there.
linux_sh_nixos_tarball_mise_allowed() {
  [ -f /.dockerenv ] \
    || [ -e /lib64/ld-linux-x86-64.so.2 ] \
    || [ -e /lib/ld-linux-aarch64.so.1 ]
}

MISE_PIN_VERSION="2026.6.12"
MISE_VERSION="v${MISE_PIN_VERSION}"
MISE_SHA256_X64="89c88e407c6e3a19f5f86af2cbbf88c6ef6147d55a7098c84da12b36f44f1ff3"
MISE_SHA256_ARM64="0318f90fccf8bad6547ad6b2191764233309ceb3b6cece94c48454f385f091f5"
MISE_SHA256_ARMV7="f9ea7f661e24371769899d85130ddf3978d32c966daf2f25bbbc3be5a7b531e6"

installed_mise_version=""
if command -v mise >/dev/null 2>&1; then
  installed_mise_version="$(mise --version 2>/dev/null | awk '{print $1}')"
fi

if [ "$installed_mise_version" != "$MISE_PIN_VERSION" ]; then
  if [ "$IS_NIXOS" = 1 ] && ! linux_sh_nixos_tarball_mise_allowed; then
    echo "error: mise not found on PATH on NixOS" >&2
    echo "  declare mise in environment.systemPackages (installer ISO + common.nix)" >&2
    echo "  and ensure /run/current-system/sw/bin is on PATH during target bootstrap" >&2
    exit 1
  fi
  if [ -n "$installed_mise_version" ]; then
    echo "↓ upgrading mise ${installed_mise_version} → ${MISE_PIN_VERSION} (pinned release tarball)..."
  elif [ "$IS_NIXOS" = 1 ]; then
    echo "↓ NixOS (docker/FHS): installing mise from pinned tarball..."
  else
    echo "↓ installing mise from pinned release tarball..."
  fi
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
  # Retry-equipped fetch — absorbs transient upstream 5xx without
  # requiring a workflow rerun.
  curl_fetch --output "${MISE_TMP}/${MISE_TARBALL}" "${MISE_URL}"
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
  export PATH="${HOME}/.local/bin:${PATH}"
fi
# Pinned tarball installs above; pre-existing mise on PATH is kept as-is.
# Always mark self-update disabled — Zeta bumps mise via linux.sh / flake / brew.
mkdir -p "${MISE_DATA_DIR:-$HOME/.local/share/mise}"
touch "${MISE_DATA_DIR:-$HOME/.local/share/mise}/.disable-self-update"
echo "✓ mise: $(mise --version)"

# ── 3-10. Common steps ──────────────────────────────────────────────
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

"$SETUP_DIR/mechanisms/from-uv-tool.sh"
"$SETUP_DIR/mechanisms/from-uv-venv.sh"

# Make ~/.dotnet/tools available for the remainder of this install.sh
# process so from-dotnet-global can install globals into $HOME/.dotnet/tools
# and find them on PATH in the same run.
export PATH="$HOME/.dotnet/tools:$PATH"

"$SETUP_DIR/mechanisms/from-elan.sh"
"$SETUP_DIR/mechanisms/from-dotnet-global.sh"
"$SETUP_DIR/mechanisms/from-dotnet-workload.sh"
"$SETUP_DIR/mechanisms/from-url.sh"
"$SETUP_DIR/mechanisms/from-opam-git.sh" || echo "⚠ from-opam-git failed — see output above; continuing"
"$SETUP_DIR/mechanisms/from-bun-global.sh"
"$SETUP_DIR/mechanisms/from-bun-link.sh"
"$SETUP_DIR/mechanisms/from-installer.sh"
"$SETUP_DIR/mechanisms/from-ollama.sh"
"$SETUP_DIR/common/shellenv.sh"
"$SETUP_DIR/common/profile-edit.sh"
