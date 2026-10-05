#!/usr/bin/env bash
# move-containerd-to-data-disk.sh -- move a RUNNING k3s node's container store
# (/var/lib/rancher/k3s/agent/containerd) from the root filesystem onto a big data disk, with a
# dry-run mode, an online pre-copy, a short cut-over window, an explicit rollback, and a reclaim step
# that only runs after the new store has been seen working.
#
# THE RUNBOOK IS docs/ops/CONTAINERD-ON-BIG-DISK.md. Read it first: it has the numbers this was designed
# against (measured on node-5b2dfa, 2026-10-05), the exact launch commands, and the failure drills.
#
# WHAT THE FIX IS (the installer's half is nixos/modules/containerd-on-data-disk.nix): a systemd bind mount
# <data disk>/containerd -> /var/lib/rancher/k3s/agent/containerd that k3s.service REQUIRES. This script
# does the same thing to a node that already exists, copying first.
#
# PHASES (each idempotent, each safe to re-run):
#   preflight   read-only checks: disk mounted, >= 1.5x the store free, Longhorn headroom left, no
#               DiskPressure, k3s discovered. Changes nothing.
#   precopy     online (the cluster keeps running): rsync the store to <disk>/containerd, repeated until a
#               pass moves less than ZETA_MOVE_DELTA_MIB; throttled; aborts if DiskPressure appears.
#   build       writes /etc/zeta/containerd-data-disk and BUILDS (does not activate) the NixOS generation that
#               declares the persistent mount, verifies the built system really contains it, and prints the
#               unit and package delta against the running system so a human can judge the blast radius.
#   cutover     THE DOWNTIME WINDOW: cordon, stop the application pods gracefully and wait for Longhorn to detach, stop k3s, kill the shims and containerd, final rsync
#               --delete, verify the copy, bind-mount, switch to the built generation, start k3s, wait Ready,
#               check the images are present (not being re-pulled), uncordon, then check workloads and the public
#               endpoints. A hard failure before the core checks pass ROLLS BACK: the old root copy is untouched
#               until `reclaim`.
#   verify      the post-checks, standalone (run it after a reboot test).
#   reclaim     ONLY after verify: delete the old root copy through a second bind of `/` (the data hidden under
#               the mount), with a device check that refuses to delete anything that is not on the root device.
#   rollback    by hand, before reclaim: unmount the bind, switch back, restart k3s on the original directory.
#   status      what state the move is in.
#   launch <phase> [flags]   run a phase DETACHED as a transient systemd unit. The cluster, and any privileged
#               pod you launched from, goes away while k3s is stopped; a transient unit on the host survives that.
#
# FLAGS: --disk <mount point> (required)  --dry-run  --yes (required for any mutating phase)
#        --flake <path> (default /etc/zeta/full-ai-cluster)  --host <flake attr> (default control-plane)
#
# DRY-RUN: every command that changes the system is printed as `DRY-RUN: <cmd>` and not run; read-only probes and
# `rsync --dry-run` do run, so a dry run prints the real preflight verdicts and the real size of the delta.
#
# WHAT THIS DELIBERATELY DOES NOT DO
#   * it never deletes the old copy before `reclaim` (the rollback source), and `reclaim` refuses unless the
#     directory it is about to empty is provably on the ROOT device and is not a mount;
#   * it never builds the NixOS generation inside the downtime window (`build` first, or cutover refuses);
#   * it does not roll back for slow workloads: only for the hard failures (k3s will not run, the store is not the
#     data disk's, the node does not become Ready, the images are gone). A node that is up but whose pods are still
#     starting ends as VERIFY-INCOMPLETE on the new store, not as a rollback;
#   * it never touches Docker's containerd (this node runs docker.service too): k3s's processes are told apart by
#     the executable they run (the k3s binary, or a path containing k3s-containerd), not by the name `containerd`.
#
# NOT PROVEN: this was exercised against stubs (src/Core.TypeScript/hygiene/lint-containerd-move.test.ts) and never
# run on a node. What it leans on was READ from the live node, not exercised: k3s runs with KillMode=process (stopping
# it leaves containerd and every container running), 355 overlay mounts under /run/k3s, 36+ Longhorn iSCSI sessions
# with 116 ext4 volume mounts, k3s-killall.sh's contents, and nixos-rebuild evaluating offline from
# /etc/zeta/full-ai-cluster#control-plane.
#
# Exit codes: 0 done / nothing to do; 1 refused or failed (rolled back where that applies); 2 usage;
#             3 aborted by DiskPressure; 4 another run holds the lock; 5 verify incomplete (new store in use).

set -u
set -o pipefail

SELF="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"

# ---- configuration (every external command is a variable: that is what the test stubs) ---------------------
if [ -d /run/current-system/sw/bin ] && [ -z "${ZETA_MOVE_KEEP_PATH:-}" ]; then
  export PATH="/run/current-system/sw/bin:/run/wrappers/bin:$PATH"
fi
STATE_DIR="${ZETA_MOVE_STATE_DIR:-/var/lib/zeta-containerd-move}"
LOG="${ZETA_MOVE_LOG:-$STATE_DIR/move.log}"
LOCK_DIR="${ZETA_MOVE_LOCK_DIR:-/run/zeta-containerd-move.lock}"
OLD="${ZETA_MOVE_OLD:-/var/lib/rancher/k3s/agent/containerd}"
SUBDIR="${ZETA_MOVE_SUBDIR:-containerd}"
ROOTVIEW="${ZETA_MOVE_ROOTVIEW:-/mnt/zeta-rootview}"
INJECTED_FILE="${ZETA_MOVE_INJECTED_FILE:-/etc/zeta/containerd-data-disk}"
MOUNTINFO="${ZETA_MOVE_MOUNTINFO:-/proc/self/mountinfo}"
CURRENT_SYSTEM="${ZETA_MOVE_CURRENT_SYSTEM:-/run/current-system}"

RSYNC="${ZETA_MOVE_RSYNC:-rsync}"
MOUNT="${ZETA_MOVE_MOUNT:-mount}"
UMOUNT="${ZETA_MOVE_UMOUNT:-umount}"
MOUNTPOINT="${ZETA_MOVE_MOUNTPOINT:-mountpoint}"
FINDMNT="${ZETA_MOVE_FINDMNT:-findmnt}"
SYSTEMCTL="${ZETA_MOVE_SYSTEMCTL:-systemctl}"
SYSTEMD_RUN="${ZETA_MOVE_SYSTEMD_RUN:-systemd-run}"
DF="${ZETA_MOVE_DF:-df}"
DU="${ZETA_MOVE_DU:-du}"
PGREP="${ZETA_MOVE_PGREP:-pgrep}"
PROC_EXE="${ZETA_MOVE_PROC_EXE:-}"                  # test seam: a command printing a pid's executable
CURL="${ZETA_MOVE_CURL:-curl}"
ISCSIADM="${ZETA_MOVE_ISCSIADM:-iscsiadm}"
NIXOS_REBUILD="${ZETA_MOVE_NIXOS_REBUILD:-nixos-rebuild}"
SLEEP="${ZETA_MOVE_SLEEP:-sleep}"
KILL="${ZETA_MOVE_KILL:-kill}"

# ~293 MiB/s. The NVMe devices run the `none` I/O scheduler, so ionice/nice have NO effect on them: the bandwidth
# limit is the throttle that protects production latency.
BWLIMIT_KIB="${ZETA_MOVE_BWLIMIT_KIB:-300000}"
DELTA_MIB="${ZETA_MOVE_DELTA_MIB:-512}"
MAX_PASSES="${ZETA_MOVE_MAX_PASSES:-5}"
MIN_FREE_PCT_AFTER="${ZETA_MOVE_MIN_FREE_PCT_AFTER:-35}"   # Longhorn refuses replicas below 25% available; +10 margin
POLL_SECS="${ZETA_MOVE_POLL_SECS:-20}"
DRAIN_TIMEOUT="${ZETA_MOVE_DRAIN_TIMEOUT:-420}"          # wait for the application pods to be gone (a Windows VM's virt-launcher has a 330 s grace)
DETACH_TIMEOUT="${ZETA_MOVE_DETACH_TIMEOUT:-180}"        # then for every Longhorn volume to detach
APP_GRACE="${ZETA_MOVE_APP_GRACE:-}"                      # empty = each pod's OWN terminationGracePeriodSeconds; set to cap it
SYSTEM_NAMESPACES="${ZETA_MOVE_SYSTEM_NAMESPACES:-kube-system longhorn-system}"
DRAIN_FAILURE="${ZETA_MOVE_DRAIN_FAILURE:-abort}"          # abort | continue
TERM_WAIT="${ZETA_MOVE_TERM_WAIT:-20}"
READY_TIMEOUT="${ZETA_MOVE_READY_TIMEOUT:-600}"
PODS_TIMEOUT="${ZETA_MOVE_PODS_TIMEOUT:-900}"
MIN_IMAGE_PCT="${ZETA_MOVE_MIN_IMAGE_PCT:-90}"
WORKLOAD_CHECKS="${ZETA_MOVE_WORKLOAD_CHECKS:-flowdent-prod:2 postgres-shared:3 gitlab:1}"
HEALTH_URLS="${ZETA_MOVE_HEALTH_URLS:-https://api.flowdent.net/health https://gitlab.flowdent.net/users/sign_in https://flowdent.net}"
FLAKE="${ZETA_MOVE_FLAKE:-/etc/zeta/full-ai-cluster}"
FLAKE_HOST="${ZETA_MOVE_HOST:-control-plane}"
K3S_UNIT="${ZETA_MOVE_K3S_UNIT:-k3s.service}"

DISK=""
NEW=""
DRY_RUN=0
YES=0
PHASE=""
LAUNCH_ARGS=()
K3S_BIN=""
KILLALL=""
KC=()
CRICTL=()
STAGE="none"          # none | cordoned | stopping | bound | switched | manual
ROLLBACK_ARMED=0
LOCK_HELD=0
DRAINED_NODE=""
PASS_BYTES=0

TAG="[zeta-containerd-move]"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() {
  local line
  line="$TAG $(ts) $*"
  echo "$line"
  { mkdir -p "$STATE_DIR" && echo "$line" >> "$LOG"; } 2>/dev/null || true
}
die() { log "FATAL: $*"; exit 1; }

# ---- helpers ------------------------------------------------------------------------------------------------
# Commands that change the system go through here: printed in dry-run, run otherwise. Never use it for a probe.
mut() {
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY-RUN: $*"
    return 0
  fi
  log "RUN: $*"
  "$@"
}

state_set() {
  [ "$DRY_RUN" -eq 1 ] && return 0
  mkdir -p "$STATE_DIR" && printf '%s\n' "$2" > "$STATE_DIR/$1.tmp" && mv "$STATE_DIR/$1.tmp" "$STATE_DIR/$1"
}
state_get() { [ -f "$STATE_DIR/$1" ] && head -n 1 "$STATE_DIR/$1"; return 0; }

kc() { "${KC[@]}" "$@"; }

discover_k3s() {
  "$SYSTEMCTL" cat "$K3S_UNIT" >/dev/null 2>&1 \
    || die "systemd unit '$K3S_UNIT' not found (set ZETA_MOVE_K3S_UNIT if this node names it differently)"
  K3S_BIN="${ZETA_MOVE_K3S_BIN:-}"
  if [ -z "$K3S_BIN" ]; then
    K3S_BIN="$("$SYSTEMCTL" cat "$K3S_UNIT" 2>/dev/null | sed -n 's/^ExecStart=\([^ ]*\) .*/\1/p' | head -n 1)"
  fi
  if [ -z "$K3S_BIN" ] || [ ! -x "$K3S_BIN" ]; then
    K3S_BIN="$(command -v k3s || true)"
  fi
  { [ -n "$K3S_BIN" ] && [ -x "$K3S_BIN" ]; } || die "cannot find the k3s binary (not in the $K3S_UNIT ExecStart, not on PATH)"
  KILLALL="${ZETA_MOVE_KILLALL:-$(dirname "$K3S_BIN")/k3s-killall.sh}"
  KC=("$K3S_BIN" kubectl)
  [ -n "${ZETA_MOVE_KUBECTL:-}" ] && KC=("$ZETA_MOVE_KUBECTL")
  CRICTL=("$K3S_BIN" crictl)
  [ -n "${ZETA_MOVE_CRICTL:-}" ] && CRICTL=("$ZETA_MOVE_CRICTL")
  return 0
}

is_root() { [ "${ZETA_MOVE_EUID:-$(id -u)}" = "0" ]; }
require_root() { is_root || die "must run as root (ssh -t zeta@... sudo ..., or the privileged-pod route in the runbook)"; }

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$LOCK_DIR/pid"
    LOCK_HELD=1
    return 0
  fi
  local holder
  holder="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then
    log "REFUSED: another run (pid $holder) holds $LOCK_DIR"
    exit 4
  fi
  log "stale lock from pid '${holder:-?}' removed"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" || die "cannot take $LOCK_DIR"
  echo "$$" > "$LOCK_DIR/pid"
  LOCK_HELD=1
}
release_lock() { [ "$LOCK_HELD" -eq 1 ] && rm -rf "$LOCK_DIR" 2>/dev/null; LOCK_HELD=0; return 0; }

disk_dev() { "$FINDMNT" -n -o SOURCE "$1" 2>/dev/null | head -n 1; }

# Is $OLD a bind mount of $NEW (and not of anything else)?
old_is_new() {
  "$MOUNTPOINT" -q "$OLD" 2>/dev/null || return 1
  local dev
  dev="$(disk_dev "$DISK")"
  [ -n "$dev" ] && [ "$(disk_dev "$OLD")" = "${dev}[/${SUBDIR}]" ]
}

node_name() { kc get nodes -o jsonpath='{.items[0].metadata.name}' 2>/dev/null; }
node_cond() { kc get nodes -o jsonpath="{.items[0].status.conditions[?(@.type==\"$1\")].status}" 2>/dev/null; }

store_bytes() { "$DU" -sxb "$OLD" 2>/dev/null | awk '{print $1}'; }
# df -> "<size> <avail>" in bytes for a mount point
df_size_avail() { "$DF" -P -B1 "$1" 2>/dev/null | awk 'NR==2 {print $2, $4}'; }
gib() { echo $(( ${1:-0} / 1073741824 )); }

# systemd's unit name for a mount path (var-lib-rancher-k3s-agent-containerd.mount); the path has no special characters
mount_unit_name() { local p="${1#/}"; printf '%s.mount' "${p//\//-}"; }

# ---- preflight ------------------------------------------------------------------------------------------------
PREFLIGHT_FAILS=0
refuse() { log "PREFLIGHT REFUSED: $*"; PREFLIGHT_FAILS=$((PREFLIGHT_FAILS + 1)); }
okay() { log "preflight ok: $*"; }

preflight() {
  PREFLIGHT_FAILS=0
  [ -n "$DISK" ] || { log "PREFLIGHT REFUSED: --disk <mount point> is required"; return 1; }
  case "$DISK" in /*) ;; *) { log "PREFLIGHT REFUSED: --disk '$DISK' is not absolute"; return 1; } ;; esac

  if is_root; then okay "running as root"; else refuse "not root"; fi

  if "$MOUNTPOINT" -q "$DISK" 2>/dev/null; then okay "$DISK is a mount point"; else refuse "$DISK is not a mount point (mount the data disk first; never create the store on root)"; fi
  local root_dev disk_src
  root_dev="$(disk_dev /)"
  disk_src="$(disk_dev "$DISK")"
  if [ -n "$disk_src" ] && [ "$disk_src" = "$root_dev" ]; then refuse "$DISK is on the ROOT device ($root_dev): moving the store there frees nothing"; fi

  if [ -d "$OLD" ]; then okay "$OLD exists"; else refuse "$OLD does not exist"; fi
  if [ -L "$OLD" ]; then refuse "$OLD is a symlink; this script moves a directory"; fi

  if "$MOUNTPOINT" -q "$OLD" 2>/dev/null; then
    if old_is_new; then
      okay "$OLD is already a bind mount of $NEW (a previous run, or an install that placed it there)"
    else
      refuse "$OLD is already a mount point, and not of $NEW ($(disk_dev "$OLD"))"
    fi
  fi

  local c
  for c in "$RSYNC" "$MOUNT" "$UMOUNT" "$FINDMNT" "$MOUNTPOINT" "$SYSTEMCTL" "$DF" "$DU" "$PGREP" find sha256sum; do
    command -v "$c" >/dev/null 2>&1 || refuse "required tool '$c' is not on PATH"
  done

  discover_k3s
  okay "k3s unit $K3S_UNIT, binary $K3S_BIN"
  if [ -x "$KILLALL" ]; then okay "killall script $KILLALL"; else refuse "k3s-killall.sh not found at $KILLALL (needed to stop the container shims; set ZETA_MOVE_KILLALL)"; fi

  # The API being up is a precondition: the pre-copy is ONLINE and the drain needs it.
  case "$(node_cond DiskPressure)" in
    False) okay "node DiskPressure=False" ;;
    True) refuse "node has DiskPressure=True: the kubelet is already evicting; fix that first (a copy would add IO to a node in trouble)" ;;
    *) refuse "cannot read the node's DiskPressure condition (is the API up? the pre-copy and the drain need it)" ;;
  esac

  local sz=0 sa=0 bytes
  bytes="$(store_bytes)"
  case "$bytes" in '' | *[!0-9]*) refuse "cannot measure the size of $OLD"; bytes=0 ;; esac
  read -r sz sa <<< "$(df_size_avail "$DISK")"
  case "${sz:-}" in '' | *[!0-9]*) refuse "cannot read $DISK's size"; sz=0 ;; esac
  case "${sa:-}" in '' | *[!0-9]*) refuse "cannot read $DISK's free space"; sa=0 ;; esac
  # >= 1.5x the store free ...
  if [ "$bytes" -gt 0 ] && [ $((sa * 2)) -ge $((bytes * 3)) ]; then
    okay "free space on $DISK: $(gib "$sa") GiB >= 1.5 x the store ($(gib "$bytes") GiB)"
  else
    refuse "free space on $DISK ($(gib "$sa") GiB) is under 1.5 x the store ($(gib "$bytes") GiB)"
  fi
  # ... and Longhorn keeps its headroom afterwards.
  if [ "$sz" -gt 0 ] && [ $(((sa - bytes) * 100)) -ge $((sz * MIN_FREE_PCT_AFTER)) ]; then
    okay "after the copy $DISK keeps $(((sa - bytes) * 100 / sz))% free (>= ${MIN_FREE_PCT_AFTER}%: Longhorn's 25% minimum + margin)"
  else
    refuse "after the copy $DISK would have under ${MIN_FREE_PCT_AFTER}% free; Longhorn stops scheduling replicas below 25% available"
  fi

  [ "$(state_get state)" = "reclaimed" ] && refuse "the move is already complete (state=reclaimed)"

  # Not refusals (a CI job pod is always bare), but the window deletes them: say so while it is cheap to act.
  local bare vms
  bare="$(bare_pods)"
  vms="$(vm_pods)"
  [ -z "$bare" ] || log "WARNING: bare pod(s) with no controller will be DELETED and NOT re-created (a running CI job fails): $bare -- pause the GitLab runner first; the cutover refuses unless ZETA_MOVE_ALLOW_BARE_PODS=1"
  [ -z "$vms" ] || log "WARNING: running VirtualMachineInstance(s) will be shut down with their pod's own grace period: $vms -- stop the VMs gracefully first (docs/ops/CONTAINERD-ON-BIG-DISK.md)"

  if [ "$PREFLIGHT_FAILS" -eq 0 ]; then log "PREFLIGHT PASSED"; return 0; fi
  log "PREFLIGHT FAILED: $PREFLIGHT_FAILS check(s)"
  return 1
}

# ---- rsync ----------------------------------------------------------------------------------------------------
RSYNC_FLAGS=(-aHAX --numeric-ids -x --delete)

# One pass. Sets PASS_BYTES. $2=1 watches the node for DiskPressure (only meaningful while the API is up).
rsync_pass() { # <label> <watch 0|1>
  local label="$1" watch="$2" outfile rc pid
  outfile="$STATE_DIR/rsync-$label.out"
  mkdir -p "$STATE_DIR"
  local flags=("${RSYNC_FLAGS[@]}" --stats "--bwlimit=$BWLIMIT_KIB")
  [ "$DRY_RUN" -eq 1 ] && flags+=(--dry-run)
  log "rsync pass '$label': $RSYNC ${flags[*]} $OLD/ $NEW/"
  "$RSYNC" "${flags[@]}" "$OLD/" "$NEW/" > "$outfile" 2>&1 &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    "$SLEEP" "$POLL_SECS"
    if [ "$watch" = "1" ] && [ "$(node_cond DiskPressure)" = "True" ]; then
      log "ABORT: node DiskPressure=True appeared during the copy; stopping rsync (pid $pid)"
      "$KILL" "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null
      return 3
    fi
  done
  wait "$pid"
  rc=$?
  PASS_BYTES="$(sed -n 's/^Total transferred file size: \([0-9,]*\) bytes.*/\1/p' "$outfile" | tr -d ',' | head -n 1)"
  PASS_BYTES="${PASS_BYTES:-0}"
  # 24 = "some source files vanished": expected while the store is live.
  case "$rc" in
    0 | 24) log "rsync pass '$label' done (rc=$rc): $PASS_BYTES bytes transferred"; return 0 ;;
    *) log "rsync pass '$label' FAILED rc=$rc; last lines:"; tail -n 5 "$outfile" | sed "s/^/    /"; return 1 ;;
  esac
}

phase_precopy() {
  preflight || return 1
  if [ "$DRY_RUN" -eq 1 ]; then log "DRY-RUN: mkdir -p $NEW"; else mkdir -p "$NEW" && chmod 0700 "$NEW"; fi
  if old_is_new; then log "nothing to copy: $OLD is already $NEW"; return 0; fi
  local n=0 limit=$((DELTA_MIB * 1048576)) rc
  while [ "$n" -lt "$MAX_PASSES" ]; do
    n=$((n + 1))
    rsync_pass "pre$n" 1
    rc=$?
    [ "$rc" -eq 3 ] && return 3
    [ "$rc" -eq 0 ] || return 1
    if [ "$PASS_BYTES" -le "$limit" ]; then
      log "pre-copy converged after $n pass(es): the last pass moved $((PASS_BYTES / 1048576)) MiB (<= ${DELTA_MIB} MiB)"
      state_set precopy "converged $(ts)"
      return 0
    fi
    if [ "$DRY_RUN" -eq 1 ]; then log "DRY-RUN: one pass only; a real run repeats until the delta is under ${DELTA_MIB} MiB"; return 0; fi
  done
  log "pre-copy did not converge in $MAX_PASSES passes (last: $((PASS_BYTES / 1048576)) MiB); the cutover's top-up and final passes move the rest"
  state_set precopy "unconverged $(ts)"
  return 0
}

# ---- build: the persistent config, BUILT and not activated -------------------------------------------------------------
restore_injected() {
  local prev
  prev="$(state_get injected-previous)"
  [ -n "$prev" ] || return 0
  if [ "$prev" = "<absent>" ]; then rm -f "$INJECTED_FILE"; else printf '%s\n' "$prev" > "$INJECTED_FILE"; fi
  log "restored $INJECTED_FILE (previous: $prev)"
}

phase_build() {
  preflight || return 1
  { [ "$YES" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; } || die "build changes $INJECTED_FILE: pass --yes (or --dry-run)"
  local prev_content=""
  [ -f "$INJECTED_FILE" ] && prev_content="$(head -n 1 "$INJECTED_FILE")"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY-RUN: write '$DISK' to $INJECTED_FILE (now: ${prev_content:-<absent>})"
    log "DRY-RUN: (cd $STATE_DIR && $NIXOS_REBUILD build --impure --flake $FLAKE#$FLAKE_HOST)"
    return 0
  fi
  state_set injected-previous "${prev_content:-<absent>}"
  mkdir -p "$(dirname "$INJECTED_FILE")"
  printf '%s\n' "$DISK" > "$INJECTED_FILE.tmp" && mv "$INJECTED_FILE.tmp" "$INJECTED_FILE" && chmod 0644 "$INJECTED_FILE"
  log "wrote $INJECTED_FILE = $DISK (previous: ${prev_content:-<absent>})"
  log "building the NixOS generation (no activation): $NIXOS_REBUILD build --impure --flake $FLAKE#$FLAKE_HOST"
  rm -f "$STATE_DIR/result" "$STATE_DIR/new-system"
  if ! ( cd "$STATE_DIR" && "$NIXOS_REBUILD" build --impure --flake "$FLAKE#$FLAKE_HOST" ); then
    log "build FAILED"; restore_injected; return 1
  fi
  local built
  built="$(readlink -f "$STATE_DIR/result" 2>/dev/null)"
  if [ -z "$built" ] || [ ! -x "$built/bin/switch-to-configuration" ]; then
    log "build produced no usable system at $STATE_DIR/result"; restore_injected; return 1
  fi
  # PROOF that the persistent mechanism is in what was built (not merely that a build succeeded).
  local unit
  unit="$built/etc/systemd/system/$(mount_unit_name "$OLD")"
  if [ -f "$unit" ] && grep -q "^What=$NEW\$" "$unit"; then
    log "built system declares $(basename "$unit") with What=$NEW"
  else
    log "REFUSED: the built system has no mount unit binding $NEW onto $OLD ($unit). The flake in $FLAKE does not contain nixos/modules/containerd-on-data-disk.nix, or $INJECTED_FILE was not read (nixos-rebuild needs --impure)."
    restore_injected; return 1
  fi
  if ! grep -q "zeta-containerd-store-assert" "$built/etc/systemd/system/$K3S_UNIT" 2>/dev/null; then
    log "REFUSED: the built $K3S_UNIT has no containerd-store assert ExecStartPre"
    restore_injected; return 1
  fi
  state_set new-system "$built"
  log "BUILT: $built"
  log "---- unit files that differ from the RUNNING system (anything beyond the containerd units is outside this change: STOP and read it) ----"
  diff -rq "$CURRENT_SYSTEM/etc/systemd/system" "$built/etc/systemd/system" 2>/dev/null | sed "s#$built#NEW#g; s#$CURRENT_SYSTEM#RUNNING#g" | head -n 60 | sed "s/^/    /"
  if command -v nix >/dev/null 2>&1; then
    log "---- package delta ----"
    nix store diff-closures "$CURRENT_SYSTEM" "$built" 2>&1 | head -n 60 | sed "s/^/    /"
  fi
  return 0
}

# ---- stopping k3s and everything under it ---------------------------------------------------------------------------------
containerd_refs() { grep -c -- "$OLD" "$MOUNTINFO" 2>/dev/null || true; }

proc_exe() { if [ -n "$PROC_EXE" ]; then "$PROC_EXE" "$1"; else readlink "/proc/$1/exe" 2>/dev/null; fi; }

# k3s's own processes: its containerd daemon (the k3s binary re-exec'd as `containerd`), the shims, k3s itself. Told
# apart from Docker's containerd (docker.service runs on this node) by the executable, never by the name.
k3s_pids() {
  local p exe
  {
    "$PGREP" -f 'k3s-containerd[^ ]*/bin/containerd-shim' 2>/dev/null
    "$PGREP" -x containerd 2>/dev/null
    "$PGREP" -f 'k3s server' 2>/dev/null
  } | sort -u | while read -r p; do
    [ -n "$p" ] || continue
    exe="$(proc_exe "$p")"
    case "$exe" in
      "$K3S_BIN" | *k3s-containerd* | */bin/k3s) echo "$p" ;;
    esac
  done
}

stop_k3s_and_containers() {
  STAGE="stopping"
  mut "$SYSTEMCTL" stop "$K3S_UNIT" || log "systemctl stop $K3S_UNIT returned non-zero (continuing: KillMode=process leaves the containers running anyway)"
  # KillMode=process: stopping k3s leaves containerd and every container running. The killall script kills the shim
  # trees and unmounts /run/k3s, /var/lib/kubelet/pods|plugins and the CNI netns.
  mut "$KILLALL" || log "k3s-killall.sh returned non-zero (continuing; the checks below decide)"
  [ "$DRY_RUN" -eq 1 ] && return 0
  kill_k3s_processes || return 1
  local refs
  refs="$(containerd_refs)"
  if [ "${refs:-0}" -gt 0 ]; then
    log "$refs mount(s) still reference $OLD; unmounting them lazily"
    grep -- "$OLD" "$MOUNTINFO" | awk '{print $5}' | sort -r | while read -r m; do "$UMOUNT" -l "$m" 2>/dev/null || true; done
    "$SLEEP" 2
    refs="$(containerd_refs)"
    [ "${refs:-0}" -eq 0 ] || { log "FAILED: $refs mount(s) still reference $OLD"; return 1; }
  fi
  iscsi_cleanup
  log "k3s, its containerd and every container are stopped; nothing references $OLD"
  return 0
}

kill_k3s_processes() {
  local left p waited=0
  left="$(k3s_pids | tr '\n' ' ')"
  [ -z "${left// /}" ] && return 0
  log "k3s processes still running: $left -> SIGTERM (containerd flushes its metadata on TERM)"
  for p in $left; do "$KILL" -TERM "$p" 2>/dev/null || true; done
  while [ "$waited" -lt "$TERM_WAIT" ]; do
    left="$(k3s_pids | tr '\n' ' ')"
    [ -z "${left// /}" ] && return 0
    "$SLEEP" 2
    waited=$((waited + 2))
  done
  log "still running after ${TERM_WAIT}s: $left -> SIGKILL"
  for p in $left; do "$KILL" -9 "$p" 2>/dev/null || true; done
  "$SLEEP" 2
  left="$(k3s_pids | tr '\n' ' ')"
  [ -z "${left// /}" ] || { log "FAILED: k3s processes survived SIGKILL: $left"; return 1; }
  return 0
}

# After a proper drain there are no sessions. Anything left is a Longhorn volume whose engine just died.
iscsi_cleanup() {
  command -v "$ISCSIADM" >/dev/null 2>&1 || return 0
  local sessions
  sessions="$("$ISCSIADM" -m session 2>/dev/null | grep -c 'iqn.2019-10.io.longhorn' || true)"
  [ "${sessions:-0}" -gt 0 ] || return 0
  log "$sessions Longhorn iSCSI session(s) remain after the stop; logging them out (best effort; Longhorn re-attaches on start)"
  "$ISCSIADM" -m node -u >/dev/null 2>&1 || log "iscsiadm logout returned non-zero"
}

# Pods outside the system namespaces, as "<ns> <name> <owner kind>" lines. A DaemonSet pod tolerates the cordon and is
# simply re-created, so it is not counted; a pod with NO owner (`<none>`) is a bare pod and is never re-created.
app_pod_lines() {
  kc get pods -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,KIND:.metadata.ownerReferences[0].kind --no-headers 2>/dev/null     | awk -v sys="$SYSTEM_NAMESPACES" 'BEGIN { n = split(sys, a, " "); for (i = 1; i <= n; i++) s[a[i]] = 1 } NF >= 3 && !($1 in s) && $3 != "DaemonSet" { print }'
}
app_pods_left() { app_pod_lines | wc -l | tr -d ' '; }
bare_pods() { app_pod_lines | awk '$3 == "<none>" { printf "%s/%s ", $1, $2 }'; }
vm_pods() { app_pod_lines | awk '$3 == "VirtualMachineInstance" { printf "%s/%s ", $1, $2 }'; }
app_pods_gone() { [ "$(app_pods_left)" = "0" ]; }
attached_volumes() {
  kc -n longhorn-system get volumes.longhorn.io -o custom-columns=STATE:.status.state --no-headers 2>/dev/null \
    | awk 'NF >= 1 && $1 != "detached" { c++ } END { print c + 0 }'
}
volumes_detached() { [ "$(attached_volumes)" = "0" ]; }

# WHY THIS IS NOT `kubectl drain`: measured on the node, eviction can never finish on a single-node cluster. The PDBs
# postgres-shared-primary (allowed 0), the Longhorn instance-manager (allowed 0), gatekeeper (allowed 0) and
# flowdent-api (min 1 of 2) all refuse, because the replacement pod has nowhere else to go. So a `drain` would sit out
# its whole timeout and then be a delete anyway, and the delete would take the Longhorn instance-manager down at the
# same moment as the databases writing through it. What is done instead, in the order that matters:
#   1. cordon (nothing is re-created here: controllers' new pods stay Pending);
#   2. delete every pod outside the system namespaces, gracefully: each keeps ITS OWN terminationGracePeriodSeconds (a
#      Windows VM's virt-launcher has 330 s to shut the guest down; overriding that with a short grace would power a
#      guest off mid-flush). ZETA_MOVE_APP_GRACE caps it if a hung pod must not hold the window;
#   3. wait until they are gone, THEN until every Longhorn volume is detached (so the engines die idle);
#   4. only then does the caller stop k3s, which takes the system namespaces (cilium, coredns, Longhorn) with it.
drain_node() {
  local node ns
  node="$(node_name)"
  [ -n "$node" ] || { log "cannot determine the node name"; return 1; }
  DRAINED_NODE="$node"
  STAGE="cordoned"
  mut "${KC[@]}" cordon "$node" || return 1
  log "stopping the application pods gracefully (grace: ${APP_GRACE:-the pods own terminationGracePeriodSeconds}); system namespaces left running: $SYSTEM_NAMESPACES"
  for ns in $(kc get namespaces -o custom-columns=NAME:.metadata.name --no-headers 2>/dev/null); do
    case " $SYSTEM_NAMESPACES " in *" $ns "*) continue ;; esac
    if [ -n "$APP_GRACE" ]; then
      mut "${KC[@]}" delete pods --all -n "$ns" "--grace-period=$APP_GRACE" --wait=false
    else
      mut "${KC[@]}" delete pods --all -n "$ns" --wait=false
    fi
  done
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY-RUN: wait up to ${DRAIN_TIMEOUT}s for the application pods to be gone, then up to ${DETACH_TIMEOUT}s for every Longhorn volume to detach"
    return 0
  fi
  if wait_until "$DRAIN_TIMEOUT" "every application pod is gone" app_pods_gone \
     && wait_until "$DETACH_TIMEOUT" "every Longhorn volume is detached" volumes_detached; then
    return 0
  fi
  log "still running: $(app_pods_left) application pod(s), $(attached_volumes) attached Longhorn volume(s)"
  if [ "$DRAIN_FAILURE" = "continue" ]; then
    log "WARNING: ZETA_MOVE_DRAIN_FAILURE=continue, so the stop proceeds and Postgres/Longhorn will see an unclean stop"
    return 0
  fi
  log "FAILED: the application pods did not stop cleanly. k3s has NOT been stopped. Re-run with ZETA_MOVE_DRAIN_FAILURE=continue to accept an unclean stop."
  return 1
}

# ---- verification -------------------------------------------------------------------------------------------------------------
wait_until() { # <timeout secs> <what> <cmd...>
  local timeout="$1" what="$2" waited=0
  shift 2
  while ! "$@" >/dev/null 2>&1; do
    if [ "$waited" -ge "$timeout" ]; then log "TIMEOUT after ${timeout}s waiting for: $what"; return 1; fi
    "$SLEEP" 5
    waited=$((waited + 5))
  done
  log "ok: $what (after ~${waited}s)"
}

api_ready() { kc get --raw=/readyz; }
node_ready() { [ "$(node_cond Ready)" = "True" ]; }
k3s_active() { "$SYSTEMCTL" is-active --quiet "$K3S_UNIT"; }
image_count() { "${CRICTL[@]}" images -q 2>/dev/null | wc -l | tr -d ' '; }

# Hard failures: the caller rolls back.
core_checks() {
  k3s_active || { log "CORE FAIL: $K3S_UNIT is not active"; return 1; }
  old_is_new || { log "CORE FAIL: $OLD is not the bind mount of $NEW"; return 1; }
  wait_until "$READY_TIMEOUT" "the API answers /readyz" api_ready || return 1
  wait_until "$READY_TIMEOUT" "the node is Ready" node_ready || return 1
  local before after
  before="$(state_get images-before)"
  after="$(image_count)"
  if [ -n "$before" ] && [ "$before" -gt 0 ]; then
    if [ $((${after:-0} * 100)) -lt $((before * MIN_IMAGE_PCT)) ]; then
      log "CORE FAIL: containerd lists ${after:-0} images, there were $before (< ${MIN_IMAGE_PCT}%): this is not the store that was copied; k3s would re-pull everything onto the data disk"
      return 1
    fi
    log "ok: containerd lists $after images (was $before): the store was adopted, not re-pulled"
  fi
  return 0
}

# Soft: reported, never a rollback.
workload_checks() {
  local spec ns min have rc=0 bad
  for spec in $WORKLOAD_CHECKS; do
    ns="${spec%%:*}"
    min="${spec##*:}"
    have="$(kc -n "$ns" get pods --no-headers 2>/dev/null | awk '$3=="Running" {split($2,a,"/"); if (a[1]==a[2]) n++} END {print n+0}')"
    if [ "${have:-0}" -ge "$min" ]; then log "ok: $ns has $have ready pod(s) (>= $min)"; else log "NOT YET: $ns has ${have:-0} ready pod(s), want >= $min"; rc=1; fi
  done
  bad="$(kc get pods -A --no-headers 2>/dev/null | awk '$4!="Running" && $4!="Completed" && $4!="Succeeded" {n++} END {print n+0}')"
  if [ "${bad:-0}" -eq 0 ]; then log "ok: every pod is Running or Completed"; else log "NOT YET: $bad pod(s) are neither Running nor Completed"; rc=1; fi
  return "$rc"
}

health_checks() {
  local url code rc=0
  for url in $HEALTH_URLS; do
    code="$("$CURL" -sS -m 15 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)"
    case "$code" in
      2* | 3*) log "ok: $url -> $code" ;;
      *) log "NOT YET: $url -> ${code:-no answer}"; rc=1 ;;
    esac
  done
  return "$rc"
}

load_disk() {
  [ -n "$DISK" ] || DISK="$(head -n 1 "$INJECTED_FILE" 2>/dev/null)"
  [ -n "$DISK" ] || die "--disk is required (and $INJECTED_FILE is absent)"
  NEW="$DISK/$SUBDIR"
}

phase_verify() {
  discover_k3s
  load_disk
  core_checks || return 1
  local waited=0
  while :; do
    if workload_checks && health_checks; then
      log "VERIFIED: the node is Ready on $NEW, workloads are Running, public endpoints answer"
      state_set verified "$(ts)"
      state_set state "verified"
      return 0
    fi
    [ "$waited" -ge "$PODS_TIMEOUT" ] && break
    "$SLEEP" 15
    waited=$((waited + 15))
  done
  log "VERIFY-INCOMPLETE after ${PODS_TIMEOUT}s: the node is on the new store but not everything is up yet. NOT rolling back. Re-run 'verify'."
  return 5
}

# ---- rollback -------------------------------------------------------------------------------------------------------------------
uncordon_node() {
  local node="${DRAINED_NODE:-$(node_name)}"
  [ -n "$node" ] || return 0
  kc uncordon "$node" >/dev/null 2>&1 && log "uncordoned $node"
  return 0
}

rollback() {
  log "ROLLBACK (stage: $STAGE): returning to the original store on the root filesystem"
  if [ "$STAGE" = "cordoned" ]; then
    # k3s was never stopped: the only thing to undo is the cordon.
    uncordon_node
    state_set state "rolled-back"
    log "ROLLED BACK: nothing had been stopped; the node is schedulable again"
    return 0
  fi
  local prev
  prev="$(state_get prev-system)"
  if k3s_active; then "$SYSTEMCTL" stop "$K3S_UNIT" || true; "$KILLALL" || true; fi
  kill_k3s_processes || log "WARNING: some k3s processes survived; the unmount below may fail"
  if "$MOUNTPOINT" -q "$OLD" 2>/dev/null; then
    "$UMOUNT" "$OLD" 2>/dev/null || { log "umount $OLD failed; lazy unmount"; "$UMOUNT" -l "$OLD" || true; }
  fi
  if "$MOUNTPOINT" -q "$OLD" 2>/dev/null; then
    log "FATAL: $OLD is still a mount point. The ORIGINAL store is untouched underneath it. By hand: umount $OLD; systemctl start $K3S_UNIT"
    return 1
  fi
  if [ -z "$(ls -A "$OLD" 2>/dev/null)" ]; then
    log "FATAL: $OLD is empty after the unmount: the original store is gone. The copy at $NEW is complete as of the last pass: mount --bind $NEW $OLD; systemctl start $K3S_UNIT"
    return 1
  fi
  if [ "$(state_get switched)" = "yes" ] && [ -n "$prev" ] && [ -x "$prev/bin/switch-to-configuration" ]; then
    log "switching back to the previous generation $prev"
    "$prev/bin/switch-to-configuration" switch || log "switch back returned non-zero (continuing)"
    state_set switched "no"
  fi
  restore_injected
  k3s_active || "$SYSTEMCTL" start "$K3S_UNIT" || log "systemctl start $K3S_UNIT failed"
  if wait_until "$READY_TIMEOUT" "the API answers /readyz (after rollback)" api_ready; then
    uncordon_node
    state_set state "rolled-back"
    log "ROLLED BACK: k3s is running on the original store. The copy at $NEW is kept (re-run precopy to refresh it)."
    return 0
  fi
  log "FATAL: k3s did not come back after the rollback. On the console: journalctl -u $K3S_UNIT -b ; systemctl status $K3S_UNIT"
  return 1
}

on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$ROLLBACK_ARMED" -eq 1 ] && [ "$rc" -ne 0 ]; then
    log "the cutover failed (rc=$rc) before the core checks passed"
    rollback || log "ROLLBACK FAILED: see above; the original store at $OLD is untouched"
  fi
  release_lock
  exit "$rc"
}

# ---- cutover ------------------------------------------------------------------------------------------------------------------------
# Same bytes? rsync's own comparison must find NOTHING to do (size, mtime, mode, owner, xattrs, hard links, deletions),
# and SHA-256 of the metadata DB(s) and the three largest blobs must match.
verify_copy() {
  local diff f rel sa sb line n=0
  diff="$("$RSYNC" "${RSYNC_FLAGS[@]}" --dry-run --itemize-changes "$OLD/" "$NEW/" 2>&1 | grep -v '^$' | head -n 5)"
  if [ -n "$diff" ]; then
    log "COPY CHECK FAIL: rsync still sees differences between $OLD and $NEW:"
    while read -r line; do log "    $line"; done <<< "$diff"
    return 1
  fi
  while read -r f; do
    [ -n "$f" ] || continue
    rel="${f#"$OLD"/}"
    sa="$(sha256sum "$f" 2>/dev/null | awk '{print $1}')"
    sb="$(sha256sum "$NEW/$rel" 2>/dev/null | awk '{print $1}')"
    if [ -z "$sa" ] || [ "$sa" != "$sb" ]; then log "COPY CHECK FAIL: SHA-256 mismatch for $rel"; return 1; fi
    n=$((n + 1))
  done < <({ find "$OLD" -xdev -type f -name '*.db' 2>/dev/null; find "$OLD" -xdev -type f -printf '%s %p\n' 2>/dev/null | sort -rn | head -n 3 | cut -d' ' -f2-; } | sort -u)
  log "copy verified: rsync sees no difference, SHA-256 of $n file(s) (metadata DBs + the largest blobs) match"
  return 0
}

phase_cutover() {
  preflight || return 1
  { [ "$YES" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; } || die "cutover STOPS THE WHOLE CLUSTER: pass --yes (and read docs/ops/CONTAINERD-ON-BIG-DISK.md first)"
  local new_system
  new_system="$(state_get new-system)"
  if [ -z "$new_system" ] || [ ! -x "$new_system/bin/switch-to-configuration" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      log "DRY-RUN: no built system recorded; a real cutover REFUSES until 'build' has run"
      new_system="<not-built>"
    else
      die "no built NixOS generation: run the 'build' phase first (the build is never done inside the downtime window)"
    fi
  fi
  if old_is_new; then log "already cut over: $OLD is $NEW"; return 0; fi
  if [ -n "$(bare_pods)" ] && [ "${ZETA_MOVE_ALLOW_BARE_PODS:-}" != "1" ]; then
    die "bare pods (no controller) would be deleted and never re-created: $(bare_pods). Pause the runner / wait, or set ZETA_MOVE_ALLOW_BARE_PODS=1"
  fi
  state_set prev-system "$(readlink -f "$CURRENT_SYSTEM" 2>/dev/null || echo none)"

  log "---- online top-up before the window (the cluster is still running) ----"
  rsync_pass "topup" 1 || return 1
  [ "$PASS_BYTES" -le $((DELTA_MIB * 1048576)) ] || log "the top-up moved $((PASS_BYTES / 1048576)) MiB; the final pass moves the rest while k3s is stopped"
  if [ "$DRY_RUN" -eq 0 ]; then state_set images-before "$(image_count)"; log "images in containerd before the window: $(state_get images-before)"; fi

  local t0 t1
  t0="$(date +%s)"
  if [ "$DRY_RUN" -eq 0 ]; then state_set state "cutover-started"; ROLLBACK_ARMED=1; fi
  log "==== DOWNTIME WINDOW BEGINS ===="
  drain_node || return 1
  stop_k3s_and_containers || return 1

  log "final sync (k3s and containerd are stopped, so the store is consistent)"
  rsync_pass "final" 0 || return 1
  if [ "$DRY_RUN" -eq 0 ]; then verify_copy || return 1; fi

  mut "$MOUNT" --bind "$NEW" "$OLD" || return 1
  if [ "$DRY_RUN" -eq 0 ]; then
    old_is_new || { log "the bind mount did not take"; return 1; }
    STAGE="bound"
    state_set state "bound"
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY-RUN: $new_system/bin/switch-to-configuration switch"
    log "DRY-RUN: wait for k3s, the API and the node; check the images; uncordon; verify the workloads and endpoints"
    log "==== (dry run) no window was opened ===="
    return 0
  fi
  state_set switched "yes"
  STAGE="switched"
  "$new_system/bin/switch-to-configuration" switch
  local src=$?
  [ "$src" -eq 0 ] || log "switch-to-configuration exited $src (a unit that failed to restart can do that); the core checks decide"
  k3s_active || "$SYSTEMCTL" start "$K3S_UNIT" || return 1

  core_checks || return 1
  ROLLBACK_ARMED=0
  state_set state "cutover-done"
  uncordon_node
  t1="$(date +%s)"
  log "==== DOWNTIME WINDOW ENDS: the node was drained/stopped/restarted for $((t1 - t0)) s ===="
  phase_verify
  local vrc=$?
  t1="$(date +%s)"
  log "everything-up time, measured from the window's start: $((t1 - t0)) s"
  log "NEXT: a reboot test (recommended), then 'verify', then 'reclaim'. The old copy on root is still there."
  return "$vrc"
}

# ---- reclaim --------------------------------------------------------------------------------------------------------------------------
phase_reclaim() {
  discover_k3s
  load_disk
  { [ "$YES" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; } || die "reclaim DELETES the old root copy: pass --yes"
  case "$(state_get state)" in
    verified | cutover-done) ;;
    reclaimed) log "already reclaimed"; return 0 ;;
    *) die "state is '$(state_get state)': reclaim only runs after a successful cutover (state verified). Run 'verify' first." ;;
  esac
  old_is_new || die "$OLD is not the bind mount of $NEW: refusing to reclaim"
  { k3s_active && node_ready; } || die "k3s is not active and Ready on the new store: refusing to delete the rollback source"
  [ -n "$(ls -A "$NEW" 2>/dev/null)" ] || die "$NEW is empty: refusing"

  local root_dev hidden="$ROOTVIEW$OLD"
  root_dev="$(disk_dev /)"
  mut mkdir -p "$ROOTVIEW"
  # A NON-recursive bind of `/` shows the root filesystem WITHOUT its submounts: the directory the bind hides.
  mut "$MOUNT" --bind / "$ROOTVIEW" || return 1
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY-RUN: check $hidden is on $root_dev and is not a mount, empty it with find -xdev -mindepth 1 -delete, umount $ROOTVIEW"
    return 0
  fi
  local hsrc disk_src
  hsrc="$("$FINDMNT" -n -o SOURCE -T "$hidden" 2>/dev/null | head -n 1)"
  disk_src="$(disk_dev "$DISK")"
  if [ ! -d "$hidden" ] || "$MOUNTPOINT" -q "$hidden" 2>/dev/null || [ "${hsrc%%\[*}" != "${root_dev%%\[*}" ] || [ "${hsrc%%\[*}" = "${disk_src%%\[*}" ]; then
    log "REFUSED: $hidden is not provably the hidden directory on the ROOT device (source='$hsrc', root='$root_dev', data disk='$disk_src'). Deleting it could delete the live store. Nothing was deleted."
    "$UMOUNT" "$ROOTVIEW" 2>/dev/null || true
    return 1
  fi
  local before after entries
  read -r _ before <<< "$(df_size_avail /)"
  entries="$(find "$hidden" -xdev 2>/dev/null | wc -l | tr -d ' ')"
  log "emptying the old root copy at $hidden ($entries entries)"
  find "$hidden" -xdev -mindepth 1 -delete 2>/dev/null
  "$UMOUNT" "$ROOTVIEW" || log "WARNING: could not unmount $ROOTVIEW; unmount it by hand"
  rmdir "$ROOTVIEW" 2>/dev/null || true
  read -r _ after <<< "$(df_size_avail /)"
  state_set state "reclaimed"
  log "RECLAIMED: root free space $(gib "$before") GiB -> $(gib "$after") GiB"
  return 0
}

# ---- manual rollback / status / launch ---------------------------------------------------------------------------------------------------
phase_rollback() {
  discover_k3s
  load_disk
  { [ "$YES" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; } || die "rollback stops the cluster briefly: pass --yes"
  [ "$(state_get state)" = "reclaimed" ] && die "the old copy was reclaimed: there is nothing to roll back to. The data is on $NEW."
  STAGE="manual"
  if [ "$DRY_RUN" -eq 1 ]; then log "DRY-RUN: stop $K3S_UNIT, kill its processes, umount $OLD, switch back, start $K3S_UNIT, uncordon"; return 0; fi
  rollback
}

phase_status() {
  log "state: $(state_get state)  precopy: $(state_get precopy)  verified: $(state_get verified)  built system: $(state_get new-system)"
  if "$MOUNTPOINT" -q "$OLD" 2>/dev/null; then log "$OLD is a mount point from $(disk_dev "$OLD")"; else log "$OLD is a plain directory on the root filesystem"; fi
  local sz sa
  read -r sz sa <<< "$(df_size_avail /)"
  log "root: $(gib "${sa:-0}") GiB free of $(gib "${sz:-0}") GiB"
  return 0
}

phase_launch() {
  local what="${LAUNCH_ARGS[0]:-}"
  case "$what" in
    precopy | build | cutover | verify | reclaim | rollback) ;;
    *) echo "launch needs a phase: precopy|build|cutover|verify|reclaim|rollback" >&2; return 2 ;;
  esac
  require_root
  local unit="zeta-containerd-move-$what" args=()
  [ "${#LAUNCH_ARGS[@]}" -gt 1 ] && args=("${LAUNCH_ARGS[@]:1}")
  [ -n "$DISK" ] && args+=(--disk "$DISK")
  [ "$YES" -eq 1 ] && args+=(--yes)
  [ "$DRY_RUN" -eq 1 ] && args+=(--dry-run)
  # A transient unit does not inherit this shell's environment: what the phase needs must travel as flags.
  args+=(--flake "$FLAKE" --host "$FLAKE_HOST")
  local setenv=() kv
  while IFS= read -r kv; do
    case "$kv" in ZETA_MOVE_*=*) setenv+=("--setenv=$kv") ;; esac
  done < <(env)
  if "$SYSTEMCTL" is-active --quiet "$unit.service" 2>/dev/null; then log "REFUSED: $unit.service is already running"; return 4; fi
  mkdir -p "$STATE_DIR"
  # The script must exist on the HOST. From a privileged pod, pipe it in first (the runbook has the exact command).
  "$SYSTEMD_RUN" "--unit=$unit" --collect "--description=zeta containerd move: $what" \
    "--setenv=PATH=$PATH" "--setenv=HOME=/root" "${setenv[@]}" "--property=StandardOutput=append:$LOG" "--property=StandardError=append:$LOG" \
    /usr/bin/env bash "$SELF" "$what" "${args[@]}" || return 1
  log "launched $unit.service (detached). Follow:  journalctl -u $unit -f   or   tail -f $LOG"
  return 0
}

usage() { sed -n '2,64p' "$SELF" | sed 's/^# \{0,1\}//'; }

# ---- main -----------------------------------------------------------------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --disk) DISK="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes) YES=1; shift ;;
    --flake) FLAKE="${2:-}"; shift 2 ;;
    --host) FLAKE_HOST="${2:-}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    preflight | precopy | build | cutover | verify | reclaim | rollback | status)
      [ -z "$PHASE" ] || { echo "one phase only (got '$PHASE' and '$1')" >&2; exit 2; }
      PHASE="$1"; shift ;;
    launch)
      PHASE="launch"; shift
      i=0
      args=("$@")
      LAUNCH_ARGS=()
      while [ "$i" -lt "${#args[@]}" ]; do
        case "${args[$i]}" in
          --disk) DISK="${args[$((i + 1))]:-}"; i=$((i + 2)) ;;
          --dry-run) DRY_RUN=1; i=$((i + 1)) ;;
          --yes) YES=1; i=$((i + 1)) ;;
          --flake) FLAKE="${args[$((i + 1))]:-}"; i=$((i + 2)) ;;
          --host) FLAKE_HOST="${args[$((i + 1))]:-}"; i=$((i + 2)) ;;
          *) LAUNCH_ARGS+=("${args[$i]}"); i=$((i + 1)) ;;
        esac
      done
      break ;;
    *) echo "unknown argument '$1' (try --help)" >&2; exit 2 ;;
  esac
done
[ -n "$PHASE" ] || { usage; exit 2; }
[ -n "$DISK" ] && NEW="$DISK/$SUBDIR"

case "$PHASE" in
  launch) phase_launch; exit $? ;;
  status) phase_status; exit $? ;;
  preflight) preflight; exit $? ;;
esac

# Every remaining phase changes (or can change) the system: root, a lock, and the exit trap that rolls back a failed cutover.
require_root
[ "$DRY_RUN" -eq 1 ] || acquire_lock
trap on_exit EXIT INT TERM
case "$PHASE" in
  precopy) phase_precopy ;;
  build) phase_build ;;
  cutover) phase_cutover ;;
  verify) phase_verify ;;
  reclaim) phase_reclaim ;;
  rollback) phase_rollback ;;
esac
