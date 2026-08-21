# full-ai-cluster/nixos/modules/longhorn-prereqs.nix
#
# Node-level prerequisites for Longhorn distributed storage. Imported by
# common.nix so EVERY cluster node (control-plane + workers) has them.
#
# Longhorn's engine attaches each volume to its consumer pod over a
# host-local iSCSI target, so open-iscsi (iscsid + the iscsiadm binary +
# the iscsi_tcp kernel module) MUST be present and running on every node.
# Without it, longhorn-manager cannot create working volumes, so every
# PVC bound to the `longhorn` StorageClass stays Pending forever and all
# stateful workloads (vault, spire, kube-prometheus-stack, nats, weaviate,
# and any agent StatefulSet for persistent memory) never schedule.
#
# Observed on node-09485d (2026-06-07): open-iscsi was configured nowhere,
# Longhorn never provisioned, and vault-0 was stuck on an unbound PVC. This
# module is the storage analog of the checkReversePath/rpfilter fix — a
# missing node prerequisite that silently breaks the whole stateful layer.
#
# nfs-utils + the NFS client are needed for Longhorn RWX (ReadWriteMany)
# volumes, which are exported over NFSv4. RWO volumes need only iSCSI.
{ config, pkgs, lib, ... }:

{
  imports = [
    # The RUNTIME half of this module. Everything below is a DECLARATION --
    # services.openiscsi, boot.kernelModules, tmpfiles symlinks -- and a
    # declaration is not evidence that the thing is there on the node. The
    # 62-day outage recorded above happened with all of these declared and
    # correct; what was missing was anyone LOOKING at the running system.
    #
    # Imported here rather than from common.nix so the preflight travels with
    # the prerequisites it checks: any host (or VM test) that pulls in
    # longhorn-prereqs.nix gets the check that says whether it worked.
    ./longhorn-node-preflight.nix
  ];

  # iSCSI initiator — Longhorn's volume-attach transport. Requires a
  # globally-unique initiator name per node (derived from the hostname).
  services.openiscsi = {
    enable = true;
    name = "iqn.2026-06.dev.zeta:${config.networking.hostName}";
  };
  boot.kernelModules = [ "iscsi_tcp" ];

  # RWX (ReadWriteMany) Longhorn volumes are served over NFSv4; the
  # node needs the userspace tools + client to mount them.
  environment.systemPackages = [ pkgs.nfs-utils ];

  # ── FHS shim: the host binaries longhorn-manager nsenters to ──────────
  #
  # longhorn-manager does NOT exec iscsiadm from its own image. It nsenters
  # into the host's PID-1 mount+net namespace and execs `iscsiadm` there,
  # resolving it through the CONTAINER's PATH:
  #
  #   /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  #
  # NixOS populates NONE of those (only /usr/bin/env and /bin/sh). So
  # `services.openiscsi.enable` above is necessary but NOT sufficient:
  # iscsid runs, iscsi_tcp is loaded, and `command -v iscsiadm` succeeds for
  # a login shell (it resolves via /run/current-system/sw/bin, which is not
  # on the container PATH) — while longhorn-manager dies with
  #
  #   nsenter: failed to execute iscsiadm: No such file or directory
  #
  # and crash-loops forever. longhorn-manager never registers a Node CR ->
  # the `longhorn` StorageClass is never created -> every PVC bound to it
  # stays Pending with `storageclass "longhorn" not found`.
  #
  # Empirical (node-5b2dfa, 2026-08-16): 16495 restarts over 62 days, zero
  # nodes.longhorn.io CRs, 10 PVCs Pending since install (cockroachdb x3,
  # mimir x7). The whole stateful layer was silently dead from first boot;
  # the workaround was to put everything on zeta-local-path instead.
  #
  # This is also why the `command -v iscsiadm` assertion in
  # nixos/tests/k3s-control-plane-platform-fixes.nix passed on a node where
  # Longhorn was completely dead: a login shell resolves it, Longhorn's
  # nsenter does not. That test now asserts the path Longhorn actually uses.
  #
  # The bridge is declarative: tmpfiles `L+` recreates the symlink every
  # boot and replaces it on rebuild, so it belongs to the generation rather
  # than lingering as imperative `ln -s` state from an activation script.
  #
  # Store paths (not /run/current-system/sw/bin) so the shim does not depend
  # on these packages also being in environment.systemPackages.
  systemd.tmpfiles.rules = [
    # Longhorn's default data path. On real installs the disko shape mounts
    # a dedicated partition under /var/lib/longhorn-disk1; this guarantees
    # the default directory exists so longhorn-manager can start cleanly
    # even on a single-disk / minimal install.
    "d /var/lib/longhorn 0700 root root - -"

    "d /usr/local/bin 0755 root root - -"

    # RWO volumes — the iSCSI attach path. This is the one that was fatal.
    "L+ /usr/local/bin/iscsiadm - - - - ${pkgs.openiscsi}/bin/iscsiadm"

    # RWX (ReadWriteMany) volumes — share-manager mounts NFSv4 on the host
    # through the same nsenter path, so these need the same bridge.
    "L+ /usr/local/bin/mount.nfs - - - - ${pkgs.nfs-utils}/bin/mount.nfs"
    "L+ /usr/local/bin/mount.nfs4 - - - - ${pkgs.nfs-utils}/bin/mount.nfs4"
    "L+ /usr/local/bin/umount.nfs - - - - ${pkgs.nfs-utils}/bin/umount.nfs"
    "L+ /usr/local/bin/umount.nfs4 - - - - ${pkgs.nfs-utils}/bin/umount.nfs4"
  ];
}
