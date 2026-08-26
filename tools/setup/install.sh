#!/usr/bin/env bash
#
# tools/setup/install.sh — the one install script consumed three ways
#
# zeta-stage0-entrypoint: the repo's primary documented cold-clone door (README,
#   CONTRIBUTING, every install-test Dockerfile, and the nix modules all name it).
#   zeta-install.sh re-enters it on the NixOS live-USB path, so pure graph
#   reachability would file it as "internal"; this marker is the declaration that
#   it is a door. Declaring RAISES the ratcheted count in
#   src/Core.TypeScript/hygiene/measure-stage0-independence.ts, never lowers it.
# (dev laptops, CI runners, devcontainer images) per GOVERNANCE.md §24,
# plus iter-081KDWYPGV008QG0R00072K2NH: NixOS-aware routing for cluster nodes.
#
# Safe to run repeatedly — detect-first-install-else-update. Safe to
# run daily to keep tools fresh.
#
# Usage:
#   tools/setup/install.sh
#
# Exit codes:
#   0 — success (install/runtime-setup completed on a routable environment)
#   1 — error (unsupported OS, unrecognized Linux flavor, or downstream
#       failure from setup/macos.sh or setup/linux.sh)
#   2 — intentional routing guard (NixOS live-USB environment detected;
#       script directs operator to zeta-install.sh — this is NOT a
#       dev-experience bug, it's the live-USB-vs-installed routing per
#       081KDWYPGV008QG0R00072K2NH below)
#
# The CI `gate.yml` workflow asserts this script completes with exit 0
# twice in sequence in its tested environments (none of which are NixOS
# live-USB), so exit 2 from the live-USB branch does NOT affect CI gate
# assertions.
#
# 081KDWYPGV008QG0R00072K2NH routing (added 2026-05-27):
#   - macOS (uname -s = Darwin)              -> setup/macos.sh
#   - Linux non-NixOS (no /etc/NIXOS)        -> setup/linux.sh
#   - NixOS installed (/etc/NIXOS,           -> setup/linux.sh
#     not docker, no /iso, no                   (NixOS-installed nodes get the same
#     /run/initramfs)                            mise + bun + agent CLI runtime setup
#                                                as any Linux build machine; nixos-
#                                                rebuild handles the NixOS-side
#                                                declarative config)
#   - NixOS docker test harness (/etc/NIXOS  -> setup/linux.sh (treated as installed;
#     + /.dockerenv from 081KSKBP80008QG0R000E3RKPK docker          discriminator-2 short-circuit)
#     test harness)
#   - NixOS live-USB (/etc/NIXOS + /iso OR   -> message pointing to zeta-install.sh
#     /run/initramfs canonical installer-       (081KDWYPGV008QG0R002TP2RA9 will factor that body into
#     ISO markers)                              a callable nixos-install-from-usb.sh;
#                                                this routing stub lands first)
#   - NixOS target bootstrap inside zeta-      -> setup/linux.sh via explicit
#     install.sh while the live ISO is still      ZETA_INSTALL_NIXOS_MODE=installed
#     mounted (/etc/NIXOS + /iso present)         override; this keeps target runtime
#                                                  setup on the canonical install.sh
#                                                  graph instead of duplicating it in
#                                                  zeta-install.sh
#   - Windows (Git Bash MINGW/MSYS/CYGWIN)   -> exec tools/setup/install.ps1 via PowerShell
#                                                (b2; the PowerShell graph is the
#                                                Windows install path)
#
# Per 081KSKBP80008QG0R002J03WGA operator framing (2026-05-27): install.sh is the universal
# Unix-like-OS install + self-update entry — "there is no distinction
# between build machines and prod when prod can update itself." This
# row's substrate scope is environment-routing dispatch.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"

# Mise trust/tier env MUST be exported here (install.sh parent) — common/mise.sh is
# invoked as a child script so exports there never reach python-tools/agent-clis in
# linux.sh/macos.sh. Without this, `uv tool install` triggers mise hook-env and fails
# "config not trusted" even after mise.sh succeeds (2026-06-21 docker + VM regression).
if [ -z "${ZETA_HOST_TIER:-}" ] && [ "${GITHUB_ACTIONS:-}" != "true" ]; then
  export ZETA_HOST_TIER=full
fi
case ":${MISE_TRUSTED_CONFIG_PATHS:-}:" in
  *:"$REPO_ROOT":*) ;;
  *) export MISE_TRUSTED_CONFIG_PATHS="${MISE_TRUSTED_CONFIG_PATHS:+$MISE_TRUSTED_CONFIG_PATHS:}$REPO_ROOT" ;;
esac

echo "=== Zeta install — universal Unix-like-OS entry (GOVERNANCE.md §24 + 081KDWYPGV008QG0R00072K2NH) ==="
echo "Repo root: $REPO_ROOT"

# Detect-NixOS-and-mode helper (081KDWYPGV008QG0R00072K2NH).
#
# Outputs one of: "nixos-live", "nixos-installed", "linux-non-nixos".
# Caller decides routing.
#
# Discriminator priority (per 081KSKBP80008QG0R000E3RKPK docker-test-harness composition):
#   1. /etc/NIXOS marker → NixOS (else linux-non-nixos)
#   2. ZETA_INSTALL_NIXOS_MODE=installed|live override for callers
#      that intentionally run inside a live-ISO namespace while
#      bootstrapping the installed target (zeta-install.sh Step 6.95)
#   3. /.dockerenv → installed (Docker container, e.g., the 081KSKBP80008QG0R000E3RKPK
#      docker-nixos-install-sh-test harness, which manually creates
#      /etc/NIXOS to exercise the NixOS userspace path; Docker uses
#      overlayfs at root which would false-positive on the live-USB
#      check, so the docker discriminator runs FIRST)
#   4. /iso present OR /run/initramfs present → live-USB (the canonical
#      NixOS-installer-ISO markers; these are what zeta-install.sh
#      itself probes for in its boot-USB detection logic)
#   5. Otherwise → installed (safer default; overlayfs-without-iso is
#      more likely an unusual installed config than a live boot)
detect_linux_flavor() {
  if [ ! -f /etc/NIXOS ]; then
    echo "linux-non-nixos"
    return 0
  fi
  case "${ZETA_INSTALL_NIXOS_MODE:-auto}" in
    auto|"")
      ;;
    installed|nixos-installed)
      echo "nixos-installed"
      return 0
      ;;
    live|nixos-live)
      echo "nixos-live"
      return 0
      ;;
    *)
      echo "error: invalid ZETA_INSTALL_NIXOS_MODE='${ZETA_INSTALL_NIXOS_MODE}' (expected auto, installed, or live)" >&2
      exit 1
      ;;
  esac
  # Discriminator 3: Docker container short-circuits to installed
  # (the 081KSKBP80008QG0R000E3RKPK harness creates /etc/NIXOS manually but is not a
  # live USB; its overlayfs root would otherwise false-positive).
  if [ -f /.dockerenv ]; then
    echo "nixos-installed"
    return 0
  fi
  # Discriminator 4: canonical NixOS-installer-ISO markers.
  if [ -d /iso ] || [ -d /run/initramfs ]; then
    echo "nixos-live"
    return 0
  fi
  # Discriminator 5 (default): installed.
  echo "nixos-installed"
}

os="$(uname -s)"
case "$os" in
  Darwin)
    echo "OS: macOS"
    "$SETUP_DIR/macos.sh"
    ;;
  Linux)
    flavor="$(detect_linux_flavor)"
    case "$flavor" in
      linux-non-nixos)
        echo "OS: Linux (non-NixOS)"
        "$SETUP_DIR/linux.sh"
        ;;
      nixos-installed)
        echo "OS: NixOS (installed; runtime setup via mise + bun + agent CLIs)"
        echo "Note: NixOS-side declarative config managed via nixos-rebuild;"
        echo "      this step only sets up the operator runtime tooling."
        "$SETUP_DIR/linux.sh"
        ;;
      nixos-live)
        # Resolve the absolute path to zeta-install.sh so the message
        # works regardless of caller's cwd. install.sh is callable
        # from any working directory (e.g., on a fresh live-USB boot
        # the operator may invoke this via a symlink / absolute path /
        # bash <(...) — relative path would fail in those cases).
        ZETA_INSTALL_ABS="$REPO_ROOT/full-ai-cluster/usb-nixos-installer/zeta-install.sh"
        INJECTION_POINTS_ABS="$REPO_ROOT/full-ai-cluster/INJECTION-POINTS.md"
        cat >&2 <<EOF
OS: NixOS live-USB

This is a NixOS live-USB environment. To install Zeta onto a target
disk, run the NixOS USB-disk installer (absolute path so it works
regardless of cwd):

  sudo bash $ZETA_INSTALL_ABS

That script handles disk partitioning, nixos-install, and the
operator-injection points (SSH pubkey, hostname, password) per:

  $INJECTION_POINTS_ABS

After the target machine reboots into installed-NixOS, run this
install.sh script again on the installed system to set up the
runtime tooling (mise + bun + agent CLIs). The same script entry —
different routing.

081KDWYPGV008QG0R002TP2RA9 (follow-up sub-row) will factor zeta-install.sh into a
callable nixos-install-from-usb.sh that this script can dispatch
to directly. Until then, this stub points operators to the
existing entry.

Exit 2 from this branch is the intentional routing guard (NOT a
dev-experience bug — see exit-code documentation in the script
header).
EOF
        exit 2
        ;;
      *)
        echo "error: unrecognized Linux flavor '$flavor'" >&2
        exit 1
        ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    # Windows under Git Bash / MSYS. install.sh is the Unix-like entry; on Windows the install
    # graph is PowerShell (user-mode, scoop-primary, no admin). b2 (operator 2026-05-31): rather
    # than just print instructions, DRIVE the Windows install directly — exec install.ps1 via pwsh
    # (PowerShell 7+) or fall back to Windows PowerShell (powershell.exe). `bash install.sh` from
    # Git Bash then installs Zeta on Windows in one shot — parity with the Unix one-liner. exec
    # replaces this shell so install.ps1's exit code propagates. Only if NO PowerShell is found do
    # we emit the routing message + exit 2 (the intentional guard, matching the NixOS-live branch).
    echo "OS: Windows ($os) — dispatching to the PowerShell install graph (install.ps1)"
    ps1_path="$REPO_ROOT/tools/setup/install.ps1"
    # Git Bash paths are MSYS-style (/c/Users/...); convert to a native Windows path so PowerShell
    # -File resolves it. cygpath ships with Git Bash/MSYS; fall back to the raw path if absent.
    if command -v cygpath >/dev/null 2>&1; then
      ps1_path="$(cygpath -w "$ps1_path")"
    fi
    # 081KT07NV0008QG0R002ZFN79J: route-only guard — assert the git-bash -> PowerShell handoff WITHOUT running
    # install.ps1 (install.ps1 itself is already shielded by docker-windows-install-ps1-test).
    # When ZETA_INSTALL_ROUTE_ONLY=1, resolve the PowerShell binary + the native -File path,
    # print the exact command line that WOULD exec, then exit 0. The gitbash-install-routing-test
    # shield asserts this output (branch taken + cygpath conversion + PowerShell -File path), so a
    # regression in this routing branch fails CI instead of reading as covered — assert, don't
    # skip-to-green per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md.
    if [ "${ZETA_INSTALL_ROUTE_ONLY:-0}" = "1" ]; then
      if command -v pwsh >/dev/null 2>&1; then
        route_ps_bin="pwsh"
      elif command -v powershell.exe >/dev/null 2>&1; then
        route_ps_bin="powershell.exe"
      else
        route_ps_bin="(none-on-PATH)"
      fi
      echo "ROUTE-ONLY: MINGW/MSYS/CYGWIN branch -> Windows PowerShell install graph"
      echo "ROUTE-ONLY: ps1_path=$ps1_path"
      echo "ROUTE-ONLY: would exec: $route_ps_bin -NoProfile -ExecutionPolicy Bypass -File $ps1_path $*"
      exit 0
    fi
    if command -v pwsh >/dev/null 2>&1; then
      exec pwsh -NoProfile -ExecutionPolicy Bypass -File "$ps1_path" "$@"
    elif command -v powershell.exe >/dev/null 2>&1; then
      exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ps1_path" "$@"
    else
      cat >&2 <<WINEOF
OS: Windows ($os)

No PowerShell found on PATH (looked for pwsh + powershell.exe). Install
PowerShell 7+ (https://aka.ms/powershell), then run:

  pwsh "$REPO_ROOT/tools/setup/install.ps1"

Exit 2 is the intentional routing guard (see exit-code documentation in the header).
WINEOF
      exit 2
    fi
    ;;
  *)
    echo "error: unsupported OS '$os' (macOS + Linux + Windows supported; others unsupported)"
    exit 1
    ;;
esac

echo

# --- Provision agent loop cells (081KRQ1AB0008QG0R0014PKF49) ---
# After deps are installed, provision the 4 system cells from the
# cluster-cells manifest. macOS + launchd only (host-loop-bootstrap.sh).
# Skip on CI, non-macOS Linux/Windows dev VMs, and ZETA_SKIP_CELLS=1.
if [ "${CI:-}" != "true" ] && [ "${ZETA_SKIP_CELLS:-0}" != "1" ]; then
  if [ "$os" = "Darwin" ] && [ -f "$SETUP_DIR/host-loop-bootstrap.sh" ]; then
    echo ""
    echo "=== Provisioning agent loop cells (081KRQ1AB0008QG0R0014PKF49) ==="
    bash "$SETUP_DIR/host-loop-bootstrap.sh" --skip-health-check || {
      echo "Warning: cell provisioning failed (non-fatal). Cells can be"
      echo "provisioned manually: bash tools/setup/host-loop-bootstrap.sh"
    }
  elif [ "$os" != "Darwin" ]; then
    echo ""
    echo "→ agent loop cells skipped (launchd provisioning is macOS-only on this install path)"
  fi
fi

# --- Tracked git hooks (081KWN0JKJV / 081KWMY831H) ---
# Symlink scripts/hooks/commit-msg into this clone's .git/hooks so Manus/Lumen
# shell-wrapper leaks cannot land in commit subjects. Best-effort: skip when
# not a git work tree (tarball extracts, some CI layouts).
if [ -f "$REPO_ROOT/scripts/hooks/install-git-hooks.sh" ]; then
  echo ""
  echo "=== Installing tracked git hooks (081KWN0JKJV) ==="
  bash "$REPO_ROOT/scripts/hooks/install-git-hooks.sh" || {
    echo "Warning: git-hooks install failed (non-fatal)."
  }
fi

echo "=== Install complete ==="

# --- Provision ZETA_FIRST_SESSION_MARKER (permanent) ---
# The first-session credential adventure writes `.first-session-complete` in the repo root
# on success. Promote it to the stable user-level path so every future shell + observe loop
# sees the adventure as done — survives repo re-clones, worktree switches, agent reboots.
MARKER_STABLE="$HOME/.config/zeta/first-session-complete"
MARKER_REPO="$REPO_ROOT/.first-session-complete"
if [ ! -f "$MARKER_STABLE" ]; then
  if [ -f "$MARKER_REPO" ]; then
    cp "$MARKER_REPO" "$MARKER_STABLE"
    echo "✓ first-session marker promoted to $MARKER_STABLE"
  else
    # Fresh install — no adventure completed yet. The observe loop's nodeSession channel
    # will fire the credential adventure on next tick. Marker gets created when it finishes.
    :
  fi
fi

echo "If this is your first run, open a new shell or source"
echo "\$HOME/.config/zeta/shellenv.sh to pick up PATH changes."
