#!/usr/bin/env bash
# local-storage-placement.sh -- keep the local-path provisioner's volumes OFF the root
# filesystem when a big data disk exists, and say so out loud when they stay.
#
# THE FINDING (measured 2026-10-02, one real node): the installer gave root 120.5 GB, put
# 39 GB of container images and 2 GB of kubelet state on it, and then ALSO pointed the
# default StorageClass (`zeta-block-local`, rancher.io/local-path) at
# /var/lib/zeta-local-storage -- a plain directory on that same root. Meanwhile the two
# Longhorn data disks held 25 GB of 1.7 TB. local-path has NO QUOTA, so a "20Gi" local PVC
# is an unbounded directory on the filesystem the kubelet evicts pods from. Every database
# and the blob store were living there.
#
# WHAT THIS DOES, once, at boot, before k3s: if a mounted /var/lib/longhorn-disk* filesystem
# of at least ZETA_LOCAL_STORAGE_MIN_GIB exists, bind-mount <largest>/zeta-local-storage onto
# /var/lib/zeta-local-storage. The PATH the provisioner, the PVs' hostPath fields, the
# setup/teardown guards and every test pin does not change; only which disk is under it.
#
# WHAT IT REFUSES TO DO
#   * It never moves, copies or deletes anything. If /var/lib/zeta-local-storage already holds
#     volumes (an upgraded node, or a boot where an earlier attempt failed and local-path wrote to
#     root) it STAYS on root and says so: a mount over a populated directory would HIDE every
#     volume under it -- the data would look destroyed and nothing would have been removed.
#   * It never fails the boot. Every non-placement is exit 0, because the status quo (root) is a
#     working system and a unit that blocks k3s over an optimisation would turn a space problem
#     into an outage. The cost of fail-open is that the problem can persist silently, which is why
#     each stay-on-root branch prints a distinct, greppable reason.
#   * It does not pick a disk by name. The LARGEST mounted data disk wins (ties: the lowest
#     number), so on the measured node that is longhorn-disk2, the second physical drive.
#
# This is a standalone script, not a Nix string, so a test EXECUTES it
# (src/Core.TypeScript/hygiene/lint-local-storage-placement.test.ts). No workflow runs
# `nix flake check` on full-ai-cluster/flake.nix.
#
# Environment (all optional; the defaults are production):
#   ZETA_LOCAL_STORAGE_DIR      the path the provisioner uses            /var/lib/zeta-local-storage
#   ZETA_LONGHORN_DISK_GLOB     candidate data-disk mount points         /var/lib/longhorn-disk*
#   ZETA_LOCAL_STORAGE_SUBDIR   directory created on the chosen disk     zeta-local-storage
#   ZETA_LOCAL_STORAGE_MIN_GIB  smallest disk worth placing on           200
#   ZETA_MOUNTPOINT_BIN / ZETA_MOUNT_BIN / ZETA_DF_BIN   tool overrides (tests)
#
#   ZETA_LOCAL_STORAGE_SENTINEL  written on placement, read on every later boot   <dir>.placed
#
# Exit 0 for every outcome that is safe to boot on (placed, already placed, stays on root).
# Exit 1 ONLY for the one dangerous state: a node that WAS placed whose data disk is not
# available now. Falling back to root there would hand the local-path PVs (whose hostPath
# fields still name the old directory) EMPTY directories, and a database pod would initialise
# a fresh cluster over what looks like a blank volume. The unit is `requiredBy` k3s, so exit 1
# keeps k3s down until the disk is back -- the one place fail-closed is the safe direction.
# Exit 2 for a malformed ZETA_LOCAL_STORAGE_MIN_GIB (a typo must not silently disable or force
# the placement).

set -u

DST="${ZETA_LOCAL_STORAGE_DIR:-/var/lib/zeta-local-storage}"
DISK_GLOB="${ZETA_LONGHORN_DISK_GLOB:-/var/lib/longhorn-disk*}"
SUBDIR="${ZETA_LOCAL_STORAGE_SUBDIR:-zeta-local-storage}"
# `-` not `:-`: an EMPTY value is a typo to refuse, not a request for the default.
MIN_GIB="${ZETA_LOCAL_STORAGE_MIN_GIB-200}"
MOUNTPOINT_BIN="${ZETA_MOUNTPOINT_BIN:-mountpoint}"
MOUNT_BIN="${ZETA_MOUNT_BIN:-mount}"
DF_BIN="${ZETA_DF_BIN:-df}"
SENTINEL="${ZETA_LOCAL_STORAGE_SENTINEL:-${DST}.placed}"

TAG="[zeta-local-storage-placement]"
log() { echo "$TAG $*"; }
stay() { log "STAYS-ON-ROOT: $*"; exit 0; }

case "$MIN_GIB" in
  '' | *[!0-9]*)
    log "REFUSED: ZETA_LOCAL_STORAGE_MIN_GIB='$MIN_GIB' is not a whole number of GiB"
    exit 2
    ;;
esac

# Idempotent: a second run (systemctl restart, a switch) must not stack a second mount.
if "$MOUNTPOINT_BIN" -q "$DST" 2>/dev/null; then
  log "ALREADY-PLACED: $DST is a mount point; nothing to do"
  exit 0
fi

# A node that was placed before MUST be placed again, or refuse. The sentinel lives on the ROOT
# filesystem next to the directory (not inside it, where the mount would hide it).
if [ -f "$SENTINEL" ]; then
  prior="$(head -n 1 "$SENTINEL" 2>/dev/null)"
  prior_disk="$(dirname "$prior" 2>/dev/null)"
  if [ -n "$prior" ] && [ -d "$prior" ] && "$MOUNTPOINT_BIN" -q "$prior_disk" 2>/dev/null; then
    mkdir -p "$DST" 2>/dev/null
    if "$MOUNT_BIN" --bind "$prior" "$DST" 2>/dev/null; then
      log "RE-PLACED: $DST is $prior again (placed on an earlier boot)"
      exit 0
    fi
  fi
  log "REFUSED: this node placed its local volumes on '$prior' but that disk is not available (or the bind mount failed). Starting k3s now would give every local-path volume an EMPTY directory over data that is still on that disk. Mount the data disk (zeta-longhorn-preflight names the missing one), then restart this unit."
  exit 1
fi

mkdir -p "$DST" 2>/dev/null || stay "cannot create $DST"

# Never shadow existing volumes. `ls -A` so dotfiles count.
if [ -n "$(ls -A "$DST" 2>/dev/null)" ]; then
  stay "$DST already holds data on the root filesystem; a mount over it would hide every volume in it. Move the volumes first (docs/ops/STORAGE-RELOCATION.md)"
fi

best=""
best_bytes=0
for mp in $DISK_GLOB; do
  [ -d "$mp" ] || continue
  "$MOUNTPOINT_BIN" -q "$mp" 2>/dev/null || continue
  bytes="$("$DF_BIN" -P -B1 "$mp" 2>/dev/null | awk 'NR==2 {print $2}')"
  case "$bytes" in
    '' | *[!0-9]*) continue ;;
  esac
  if [ "$bytes" -gt "$best_bytes" ]; then
    best="$mp"
    best_bytes="$bytes"
  fi
done

[ -n "$best" ] || stay "no mounted data-disk filesystem matches $DISK_GLOB"

min_bytes=$((MIN_GIB * 1024 * 1024 * 1024))
if [ "$best_bytes" -lt "$min_bytes" ]; then
  stay "the largest data disk ($best, $((best_bytes / 1024 / 1024 / 1024)) GiB) is under the ${MIN_GIB} GiB threshold, so root is no worse than it"
fi

src="$best/$SUBDIR"
mkdir -p "$src" 2>/dev/null || stay "cannot create $src"
chmod 0755 "$src" 2>/dev/null || true

if ! "$MOUNT_BIN" --bind "$src" "$DST" 2>/dev/null; then
  stay "bind mount of $src onto $DST failed"
fi

echo "$src" > "$SENTINEL" 2>/dev/null || log "WARNING: could not write $SENTINEL; a later boot with the disk missing would NOT be refused"
log "PLACED: $DST is now $src ($((best_bytes / 1024 / 1024 / 1024)) GiB filesystem), not the root filesystem"
exit 0
