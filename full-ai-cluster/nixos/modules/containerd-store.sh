#!/usr/bin/env bash
# containerd-store.sh -- keep k3s's container store (images + snapshots) OFF the root filesystem, and
# REFUSE TO START k3s rather than let it fall back onto root.
#
# THE FINDING (measured 2026-10-05, node-5b2dfa, a real install): root is the installer's computed
# 120 GiB floor and held /var/lib/rancher/k3s/agent/containerd at 48 GiB -- 35 GiB of overlayfs
# snapshots, 14 GiB of content blobs, 132 images -- while the two Longhorn data disks (797 GiB and
# 916 GiB, ~88% free) sat beside it. The kubelet evicts at imagefs.available<15% (~17.7 GiB free on
# that root) and sets DiskPressure, which blocks EVERY pod including production; a CI job that needs
# 24 GiB could never be admitted. The images were the bulk of the root and the thing that grows.
#
# WHAT THIS IS: the two checks around a bind mount that nixos/modules/containerd-on-data-disk.nix
# declares as a systemd mount unit (<data disk>/containerd -> /var/lib/rancher/k3s/agent/containerd).
# The mount itself is systemd's, not this script's, so k3s.service can REQUIRE it.
#
#   prepare   runs BEFORE the mount unit, once per boot
#             * the data disk must be a mount point, or exit 1: creating <disk>/containerd while the disk
#               is unmounted would create it on ROOT and then bind root onto root;
#             * creates <disk>/containerd on the disk;
#             * REFUSES (exit 1) when the target directory already holds a store on root and the
#               directory on the disk is EMPTY. A mount over a populated directory hides it: k3s would
#               see an empty store, re-pull 132 images onto the data disk, and the 48 GiB on root would
#               sit invisible and undeletable-by-k3s under the mount. That state is "a node upgraded in
#               place without the copy", and the answer is docs/ops/CONTAINERD-ON-BIG-DISK.md, not a boot.
#             * a populated target AND a populated disk directory is allowed, loudly: the cut-over
#               copied first, and the root copy that remains is the rollback source until reclaimed.
#   assert    runs as k3s.service's first ExecStartPre, every start (including Restart=always restarts)
#             * the target must be a mount point whose SOURCE is exactly <disk's device>[/<subdir>]
#               (findmnt prints a subdirectory bind that way). A target that is merely "a directory on
#               root", or a mount of something else, exits 1.
#
# FAIL CLOSED, DELIBERATELY. Both refusals keep k3s down. The status quo ante is a working system, and
# a unit that blocks k3s over an optimisation would be wrong -- except that here the fallback is not the
# status quo: a k3s that starts with the mount missing silently re-pulls every image onto the 119 GiB
# root, which is the incident this exists to prevent, delivered without a single error. The cost of
# refusing is a node that stays down until someone mounts a disk; the node still boots, sshd is up,
# and the message names the remedy. (This is the opposite choice from local-storage-placement.sh, which
# fails OPEN for the never-placed case: there the fallback is the old, working behaviour.)
#
# SINGLE-DISK / SMALL-DISK MACHINES: this script is never configured on them. The installer writes
# /etc/zeta/containerd-data-disk only when a mounted /var/lib/longhorn-disk* of at least
# ZETA_CONTAINERD_MIN_GIB exists (usb-nixos-installer/zeta-install.sh, ZETA-CONTAINERD-DISK block), and
# with the file absent the module contributes NOTHING -- root keeps the store, exactly as before.
#
# Standalone, not a Nix string, so a test EXECUTES it
# (src/Core.TypeScript/hygiene/lint-containerd-store.test.ts). NOT PROVEN: systemd honouring the
# ordering on a booted guest and `findmnt` printing the `[/subdir]` form on every kernel -- the latter is
# measured on the live node (`/nix/store /dev/nvme0n1p2[/nix/store]`), the former has not been run.
#
# Environment (the module sets the first two; the rest are test seams):
#   ZETA_CONTAINERD_DISK     mount point of the data disk                  (required)
#   ZETA_CONTAINERD_DIR      the path k3s uses     /var/lib/rancher/k3s/agent/containerd
#   ZETA_CONTAINERD_SUBDIR   directory on the disk                          containerd
#   ZETA_MOUNTPOINT_BIN / ZETA_FINDMNT_BIN
#
# Exit 0 = safe to start; 1 = REFUSED (k3s stays down); 2 = misconfigured (a wrong value must not guess).

set -u

DISK="${ZETA_CONTAINERD_DISK:-}"
DST="${ZETA_CONTAINERD_DIR:-/var/lib/rancher/k3s/agent/containerd}"
# `-` not `:-`: an EMPTY value is a typo to refuse, not a request for the default.
SUBDIR="${ZETA_CONTAINERD_SUBDIR-containerd}"
MOUNTPOINT_BIN="${ZETA_MOUNTPOINT_BIN:-mountpoint}"
FINDMNT_BIN="${ZETA_FINDMNT_BIN:-findmnt}"

TAG="[zeta-containerd-store]"
log() { echo "$TAG $*"; }
refuse() { log "REFUSED: $*"; exit 1; }
misconfigured() { log "MISCONFIGURED: $*"; exit 2; }

MODE="${1:-}"
case "$MODE" in
  prepare | assert) ;;
  *) misconfigured "usage: containerd-store.sh prepare|assert (got '${MODE}')" ;;
esac

[ -n "$DISK" ] || misconfigured "ZETA_CONTAINERD_DISK is empty"
case "$DISK" in /*) ;; *) misconfigured "ZETA_CONTAINERD_DISK='$DISK' is not an absolute path" ;; esac
case "$SUBDIR" in '' | */* | . | ..) misconfigured "ZETA_CONTAINERD_SUBDIR='$SUBDIR' must be one plain directory name" ;; esac

SRC="$DISK/$SUBDIR"
REMEDY="docs/ops/CONTAINERD-ON-BIG-DISK.md"

# The one comparison both modes rely on: is $DST a bind mount of $SRC, and not of anything else?
assert_bound() {
  if ! "$MOUNTPOINT_BIN" -q "$DST" 2>/dev/null; then
    refuse "$DST is not a mount point. Starting k3s now would create its container store on the ROOT filesystem and re-pull every image there -- the disk-pressure incident this guard exists to prevent. Mount $DISK and start the mount unit for $DST (or reboot). See $REMEDY."
  fi
  WANT_DEV="$("$FINDMNT_BIN" -n -o SOURCE "$DISK" 2>/dev/null | head -n 1)"
  local got want
  got="$("$FINDMNT_BIN" -n -o SOURCE "$DST" 2>/dev/null | head -n 1)"
  if [ -z "$WANT_DEV" ]; then
    refuse "$DISK is not a mounted filesystem, so $DST cannot be on it. See $REMEDY."
  fi
  want="${WANT_DEV}[/${SUBDIR}]"
  if [ "$got" != "$want" ]; then
    refuse "$DST is mounted from '${got:-<unknown>}', expected '${want}' (the ${SUBDIR}/ directory on $DISK). Refusing to start k3s on a store that is not the data disk's. See $REMEDY."
  fi
}

if [ "$MODE" = "assert" ]; then
  assert_bound
  log "OK: $DST is $SRC ($WANT_DEV)"
  exit 0
fi

# ---- prepare -------------------------------------------------------------------------------------

# Already mounted (a second run, a `systemctl restart`, the cut-over's manual bind adopted by the unit):
# verify it is the RIGHT mount and leave it alone.
if "$MOUNTPOINT_BIN" -q "$DST" 2>/dev/null; then
  assert_bound
  log "ALREADY-PLACED: $DST is already $SRC; nothing to do"
  exit 0
fi

"$MOUNTPOINT_BIN" -q "$DISK" 2>/dev/null \
  || refuse "the data disk $DISK is not mounted. The container store is on that disk; starting k3s without it would put the store on the ROOT filesystem. Mount it (zeta-longhorn-preflight names a missing one), then restart this unit. See $REMEDY."

mkdir -p "$SRC" 2>/dev/null || refuse "cannot create $SRC on the data disk"
chmod 0700 "$SRC" 2>/dev/null || true

# `ls -A` so dotfiles count. A missing $DST counts as empty.
root_populated=0
[ -n "$(ls -A "$DST" 2>/dev/null)" ] && root_populated=1
disk_populated=0
[ -n "$(ls -A "$SRC" 2>/dev/null)" ] && disk_populated=1

if [ "$root_populated" -eq 1 ] && [ "$disk_populated" -eq 0 ]; then
  refuse "$DST already holds a container store on the ROOT filesystem and $SRC is empty. Mounting now would HIDE that store: k3s would see nothing, re-pull every image onto the data disk, and the old copy would sit invisible under the mount. Nothing was moved or deleted. Run the cut-over (it copies first): $REMEDY. Or, if the images should simply be re-pulled, stop k3s, 'rm -rf $DST/*', and restart this unit."
fi

mkdir -p "$DST" 2>/dev/null || refuse "cannot create the mount point $DST"

if [ "$root_populated" -eq 1 ]; then
  log "WARNING: $DST still holds the OLD root copy of the store; it will be hidden by the mount and keeps taking root space until reclaimed ($REMEDY, step 'reclaim')."
fi
log "READY: $DST will be bound to $SRC"
exit 0
