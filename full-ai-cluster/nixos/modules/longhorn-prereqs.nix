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

  # Longhorn's default data path. On real installs zeta-install.sh mounts a
  # dedicated partition under /var/lib/longhorn-disk1; this just guarantees
  # the default directory exists so longhorn-manager can start cleanly even
  # on a single-disk / minimal install.
  systemd.tmpfiles.rules = [
    "d /var/lib/longhorn 0700 root root - -"
  ];
}
