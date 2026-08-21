# full-ai-cluster/nixos/modules/longhorn-preflight-checks.nix
#
# The PURE half of the Longhorn node preflight: given a host's declared
# filesystem set, produce (a) the list of paths that MUST be real mounts at
# runtime and (b) the shell text that checks them at boot.
#
# It is a separate file from longhorn-node-preflight.nix for one reason: a
# `lib.mkIf`-wrapped module config cannot be read by an evaluation test without
# reaching through `.content`, and a test that reaches through a wrapper is a
# test that will silently read the WRONG value the day the wrapper changes
# shape -- the hazard k3s-first-boot-apply-order-eval-test.nix refuses outright
# at its P0 check. Splitting the derivation out means the eval test calls
# exactly the function the module calls, with no unwrapping.
#
# WHAT IT REFUSES, AND WHY EACH ONE IS FATAL RATHER THAN UNTIDY
# ------------------------------------------------------------
#
#   1. A declared Longhorn filesystem that is NOT mounted.
#
#      disko-shapes/longhorn-node.nix:71 and disko-shapes/boot-disk-partitions.nix
#      mount every Longhorn partition with `mountOptions = [ "noatime" "nofail" ]`.
#      nofail means a missing or failed device does not stop the boot -- by
#      design, so a dead data disk does not brick a node. The cost is that the
#      mount silently does not happen.
#
#      Then longhorn-prereqs.nix:77 and longhorn-disks.nix create the SAME paths
#      with systemd tmpfiles `d`. So after a failed mount the path still exists,
#      still has the right mode, and is a plain directory on the ROOT filesystem.
#      Nothing downstream can tell the difference: Longhorn registers a "disk",
#      reports its capacity as the root filesystem's free space, and places
#      replicas there. The operator sees a healthy Longhorn with the wrong disk
#      underneath it, and finds out when root fills.
#
#      That is strictly worse than a Pending pod, because a Pending pod is
#      visible. Hence: refuse at boot, and name the device and the remedy.
#
#   2. iscsid not ACTIVE (not merely installed, not merely enabled).
#
#      Longhorn attaches every RWO volume over a host-local iSCSI target. With
#      iscsid down, longhorn-manager cannot register a working node, the
#      `longhorn` StorageClass is never created, and every PVC bound to it hangs
#      with `storageclass "longhorn" not found`.
#
#      Measured on node-5b2dfa (recorded in longhorn-prereqs.nix:56-59): 16495
#      longhorn-manager restarts over 62 days, zero nodes.longhorn.io CRs, 10
#      PVCs Pending since install -- with every CI lane green. The one VM test
#      covering this asserted `systemctl cat iscsid.service`, which proves a unit
#      FILE exists and passes on a dead daemon, and printed
#      `systemctl is-enabled iscsid.service || true`, which is diagnostic output
#      and cannot fail. Before this file, `systemctl is-active iscsid` appeared
#      nowhere in the repository.
#
#   3. The FHS nsenter shims missing.
#
#      longhorn-manager does not exec iscsiadm from its own image; it nsenters
#      into the host PID-1 namespace and resolves the binary through the
#      CONTAINER's PATH, which on NixOS is empty. longhorn-prereqs.nix bridges
#      that with tmpfiles `L+` symlinks under /usr/local/bin. tmpfiles is applied
#      at runtime, so "the module declares it" is not evidence the symlink is
#      there -- only looking is.
#
#   4. iscsi_tcp not loaded.
#
#      Requested via `boot.kernelModules`. A restatement of what
#      systemd-modules-load.service should have done, checked where it matters,
#      so the diagnosis reads "Longhorn cannot attach volumes" rather than "some
#      module did not load".
#
# WHAT IT DELIBERATELY DOES NOT DO
# --------------------------------
# It does not check CAPACITY. "Is the declared disk big enough for the manifests'
# PVCs" is a different question with a different owner
# (k8s/single-node-budget.json + src/Core.TypeScript/cluster/single-node-readiness.ts).
# This file only answers "is the device the config named actually there".
#
# It does not exercise RWX/NFS end to end, only that the mount helpers resolve.
# No NFS server exists at boot to mount from.
#
# HONEST VACUITY, STATED RATHER THAN HIDDEN
# -----------------------------------------
# `requiredMounts` is DERIVED from the host's own `fileSystems`, never from a
# hand-written roster, so it cannot drift away from what the host declares. The
# consequence is that on a host declaring no filesystem under the Longhorn root
# -- which today includes hosts/control-plane, whose hardware-configuration.nix
# declares only `/` and `/boot` -- the mount check has NOTHING to check and
# passes trivially. That is the correct answer to "are the declared devices
# present" when none were declared, and it is why the unit reports the count it
# checked rather than only saying OK. Checks 2-4 have teeth on every node.

{ lib, fileSystems }:

let
  # Every Longhorn data path lives at this prefix. The disko shape names its
  # partitions /var/lib/longhorn-disk1..N (a SIBLING suffix, not a child
  # directory), and the chart's defaultDataPath is /var/lib/longhorn itself, so
  # a prefix test -- not a child test -- is what covers both.
  longhornRoot = "/var/lib/longhorn";

  isLonghornPath = p: lib.hasPrefix longhornRoot p;

  # `fileSystems` is keyed BY MOUNT POINT, so the attribute names are the paths.
  declaredMountPoints = builtins.attrNames fileSystems;

  requiredMounts = lib.sort (a: b: a < b) (builtins.filter isLonghornPath declaredMountPoints);

  # The exact set longhorn-prereqs.nix bridges into /usr/local/bin. Kept in one
  # place so a helper added there and forgotten here is a visible diff rather
  # than a silent hole.
  shimBinaries = [
    "/usr/local/bin/iscsiadm"
    "/usr/local/bin/mount.nfs"
    "/usr/local/bin/mount.nfs4"
    "/usr/local/bin/umount.nfs"
    "/usr/local/bin/umount.nfs4"
  ];

  # Markers on the serial console, in the shape k3s-join-observer.nix already
  # established for this cluster: a fixed token a harness can grep for without
  # parsing prose.
  okMarker = "ZETA_LONGHORN_PREFLIGHT_OK";
  failMarker = "ZETA_LONGHORN_PREFLIGHT_FAILED";

  # POSIX sh. Every failure increments a counter and the script exits 1 only at
  # the end, so ONE boot reports EVERY problem -- an operator on metal should not
  # have to reboot four times to discover four missing prerequisites.
  #
  # No backticks anywhere below: this is a Nix indented string, where a
  # backslash is NOT an escape, so a "quoted" backtick would survive into the
  # shell and open a command substitution.
  script = ''
    set -u

    failures=0

    # note()  -> journal only. shout() -> journal AND the physical console.
    # systemd already prints a red "[FAILED] Failed to start ..." for a failing
    # oneshot; shout() is what turns that into an actionable message on the
    # screen an operator is looking at during bring-up.
    note() { printf '%s\n' "$*" >&2; }
    shout() {
      printf '%s\n' "$*" >&2
      printf '%s\n' "$*" > /dev/console 2>/dev/null || true
    }

    fail() {
      failures=$((failures + 1))
      shout "zeta-longhorn-preflight: REFUSED -- $1"
      shout "zeta-longhorn-preflight:   remedy: $2"
    }

    # ---- 1. declared Longhorn filesystems are really mounted --------------
    checked_mounts=0
    ${lib.concatMapStrings (path: ''
      checked_mounts=$((checked_mounts + 1))
      src=$(findmnt --noheadings --first-only --output SOURCE --mountpoint ${lib.escapeShellArg path} 2>/dev/null) || src=""
      if [ -n "$src" ]; then
        note "zeta-longhorn-preflight: ok   ${path} <- $src"
      else
        fail "${path} is declared as a filesystem in this host NixOS config but is NOT mounted. Longhorn would place replicas on the ROOT filesystem there and report the wrong capacity." \
             "the mount carries the 'nofail' option, so a missing or failed device boots silently. Run: lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINT ; systemctl list-units --type=mount --all ; journalctl -b. Then either attach the device, or drop it from zeta.disko.extraDisks and rebuild."
      fi
    '') requiredMounts}

    # ---- 2. the Longhorn default data path exists -------------------------
    if [ -d ${lib.escapeShellArg longhornRoot} ]; then
      note "zeta-longhorn-preflight: ok   ${longhornRoot} exists"
    else
      fail "${longhornRoot} does not exist; longhorn-manager cannot start." \
           "it is created by systemd-tmpfiles from nixos/modules/longhorn-prereqs.nix. Run: systemctl status systemd-tmpfiles-setup.service"
    fi

    # ---- 3. iscsid is ACTIVE, not merely installed -------------------------
    if systemctl is-active --quiet iscsid.service; then
      note "zeta-longhorn-preflight: ok   iscsid.service active"
    else
      fail "iscsid.service is not active. Longhorn attaches every RWO volume over iSCSI, so with iscsid down the 'longhorn' StorageClass is never created and every PVC bound to it hangs Pending forever." \
           "run: systemctl status iscsid.service ; journalctl -u iscsid.service -b. The unit comes from services.openiscsi in nixos/modules/longhorn-prereqs.nix."
    fi

    # ---- 4. iscsi_tcp is loaded (or built in) ------------------------------
    if [ -d /sys/module/iscsi_tcp ]; then
      note "zeta-longhorn-preflight: ok   iscsi_tcp loaded"
    else
      fail "the iscsi_tcp kernel module is not loaded; iSCSI sessions cannot be established." \
           "it is requested via boot.kernelModules in nixos/modules/longhorn-prereqs.nix. Run: modprobe iscsi_tcp ; systemctl status systemd-modules-load.service"
    fi

    # ---- 5. the FHS shims longhorn-manager nsenters to ---------------------
    ${lib.concatMapStrings (binary: ''
      if [ -x ${lib.escapeShellArg binary} ]; then
        note "zeta-longhorn-preflight: ok   ${binary}"
      else
        fail "${binary} is missing or not executable. longhorn-manager nsenters into this namespace and resolves it through the CONTAINER PATH (/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin), where NixOS provides nothing -- it does NOT see /run/current-system/sw/bin. Missing, longhorn-manager crash-loops on 'nsenter: failed to execute'." \
             "the symlink is a systemd-tmpfiles 'L+' rule in nixos/modules/longhorn-prereqs.nix. Run: systemctl status systemd-tmpfiles-setup.service"
      fi
    '') shimBinaries}

    # ---- verdict -----------------------------------------------------------
    if [ "$failures" -gt 0 ]; then
      shout "${failMarker} failures=$failures mounts_checked=$checked_mounts"
      shout "zeta-longhorn-preflight: the stateful layer of this node will NOT work until the above is fixed."
      exit 1
    fi

    note "${okMarker} mounts_checked=$checked_mounts"
  '';
in
{
  inherit
    longhornRoot
    requiredMounts
    shimBinaries
    okMarker
    failMarker
    script
    ;
}
