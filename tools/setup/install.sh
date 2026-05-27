#!/usr/bin/env bash
#
# tools/setup/install.sh — the one install script consumed three ways
# (dev laptops, CI runners, devcontainer images) per GOVERNANCE.md §24,
# plus iter-B-0857.2: NixOS-aware routing for cluster nodes.
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
#       B-0857.2 below)
#
# The CI `gate.yml` workflow asserts this script completes with exit 0
# twice in sequence in its tested environments (none of which are NixOS
# live-USB), so exit 2 from the live-USB branch does NOT affect CI gate
# assertions.
#
# B-0857.2 routing (added 2026-05-27):
#   - macOS (uname -s = Darwin)              -> setup/macos.sh
#   - Linux non-NixOS (no /etc/NIXOS)        -> setup/linux.sh
#   - NixOS installed (/etc/NIXOS,           -> setup/linux.sh
#     not docker, no /iso, no                   (NixOS-installed nodes get the same
#     /run/initramfs)                            mise + bun + claude runtime setup
#                                                as any Linux build machine; nixos-
#                                                rebuild handles the NixOS-side
#                                                declarative config)
#   - NixOS docker test harness (/etc/NIXOS  -> setup/linux.sh (treated as installed;
#     + /.dockerenv from B-0849 docker          discriminator-2 short-circuit)
#     test harness)
#   - NixOS live-USB (/etc/NIXOS + /iso OR   -> message pointing to zeta-install.sh
#     /run/initramfs canonical installer-       (B-0857.3 will factor that body into
#     ISO markers)                              a callable nixos-install-from-usb.sh;
#                                                this routing stub lands first)
#
# Per B-0857 operator framing (2026-05-27): install.sh is the universal
# Unix-like-OS install + self-update entry — "there is no distinction
# between build machines and prod when prod can update itself." This
# row's substrate scope is environment-routing dispatch.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"

echo "=== Zeta install — universal Unix-like-OS entry (GOVERNANCE.md §24 + B-0857.2) ==="
echo "Repo root: $REPO_ROOT"

# Detect-NixOS-and-mode helper (B-0857.2).
#
# Outputs one of: "nixos-live", "nixos-installed", "linux-non-nixos".
# Caller decides routing.
#
# Discriminator priority (per B-0849 docker-test-harness composition):
#   1. /etc/NIXOS marker → NixOS (else linux-non-nixos)
#   2. /.dockerenv → installed (Docker container, e.g., the B-0849
#      docker-nixos-install-sh-test harness, which manually creates
#      /etc/NIXOS to exercise the NixOS userspace path; Docker uses
#      overlayfs at root which would false-positive on the live-USB
#      check, so the docker discriminator runs FIRST)
#   3. /iso present OR /run/initramfs present → live-USB (the canonical
#      NixOS-installer-ISO markers; these are what zeta-install.sh
#      itself probes for in its boot-USB detection logic)
#   4. Otherwise → installed (safer default; overlayfs-without-iso is
#      more likely an unusual installed config than a live boot)
detect_linux_flavor() {
  if [ ! -f /etc/NIXOS ]; then
    echo "linux-non-nixos"
    return 0
  fi
  # Discriminator 2: Docker container short-circuits to installed
  # (the B-0849 harness creates /etc/NIXOS manually but is not a
  # live USB; its overlayfs root would otherwise false-positive).
  if [ -f /.dockerenv ]; then
    echo "nixos-installed"
    return 0
  fi
  # Discriminator 3: canonical NixOS-installer-ISO markers.
  if [ -d /iso ] || [ -d /run/initramfs ]; then
    echo "nixos-live"
    return 0
  fi
  # Discriminator 4 (default): installed.
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
        echo "OS: NixOS (installed; runtime setup via mise + bun + claude)"
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
runtime tooling (mise + bun + claude). The same script entry —
different routing.

B-0857.3 (follow-up sub-row) will factor zeta-install.sh into a
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
  *)
    echo "error: unsupported OS '$os' (macOS + Linux only this round; Windows backlogged)"
    exit 1
    ;;
esac

echo
echo "=== Install complete ==="
echo "If this is your first run, open a new shell or source"
echo "\$HOME/.config/zeta/shellenv.sh to pick up PATH changes."
