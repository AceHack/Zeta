# full-ai-cluster/nixos/modules/longhorn-disks.nix
#
# Declarative wiring between local filesystem mounts and Longhorn's
# per-node disk set, using LONGHORN'S OWN mechanism.
#
# Usage in a per-host config (already auto-wired by the
# disko-shapes/longhorn-node.nix shape):
#
#     zeta.longhorn.dataDisks = [
#       "/var/lib/longhorn-disk1"
#       "/var/lib/longhorn-disk2"
#     ];
#
# WHAT THIS REPLACED, AND WHY
# ---------------------------
# This module used to write /etc/longhorn/node-disks.yaml containing a
# `kind: NodeDiskCatalog` document, with a header noting that a
# cluster-side DaemonSet+Job would read it "once the first physical node
# is up". That companion was never built. Measured 2026-08-18:
#
#   $ grep -rl "node-disks" --include=*.yaml --include=*.nix --include=*.ts .
#   full-ai-cluster/nixos/modules/longhorn-disks.nix        <- only the WRITER
#   $ kubectl get crd | grep -i nodediskcatalog
#   (nothing -- NodeDiskCatalog is not a real CRD)
#
# So every extra data disk was declared into a file nothing read, in a
# format nothing understood. On a 2-NVMe box that means Longhorn uses
# /var/lib/longhorn on the boot disk and the second drive sits idle --
# which matters, because k8s/single-node-budget.json records the
# manifests implying ~1.6 TiB of `longhorn`-class PVCs.
#
# THE REAL MECHANISM (Longhorn 1.7.2 docs, "Default Disk and Node
# Configuration"). Three parts, all required, none sufficient alone:
#
#   1. label      node.longhorn.io/create-default-disk=config
#   2. annotation node.longhorn.io/default-disks-config=<JSON array>
#   3. setting    createDefaultDiskLabeledNodes=true   (chart side, see
#                 k8s/applications/longhorn/Application.yaml)
#
# ORDERING CONSTRAINT, load-bearing: the annotation "only takes effect
# when there are no existing disks or tags on the node" -- i.e. at FIRST
# registration. Applying it after longhorn-manager has already registered
# the node is a silent no-op. That is safe here because Longhorn arrives
# via ArgoCD long after k3s boots, but it is why the annotator runs as a
# boot-time oneshot rather than a manual step.
#
# k3s sets node LABELS via --node-label, but kubelet has no equivalent for
# arbitrary ANNOTATIONS, so the annotation is applied by a systemd oneshot
# that waits for the node object and patches it. Idempotent: it re-applies
# the same value every boot, and Longhorn ignores it once disks exist.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.longhorn;

  # The exact shape Longhorn's `node.longhorn.io/default-disks-config`
  # annotation expects: a JSON array of disk objects. Built with
  # builtins.toJSON rather than string-concatenation so paths containing
  # a quote or backslash cannot break out of the annotation value.
  #
  # storageReserved = 0: these are dedicated data partitions, so nothing
  # is held back for the OS. allowScheduling = true: the whole point is
  # for Longhorn to place replicas here.
  disksConfigJson = builtins.toJSON (
    map (path: {
      inherit path;
      allowScheduling = true;
      storageReserved = 0;
      tags = [ ];
    }) cfg.dataDisks
  );
in
{
  options.zeta.longhorn = {
    dataDisks = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ "/var/lib/longhorn" ];
      description = ''
        Filesystem paths that Longhorn should use as data paths on
        this node. Each path must already be a mountpoint backed by
        a real partition (typically declared via the disko-shape).
        The first entry IS Longhorn's defaultDataPath; additional
        entries get added to the Node CR as named disks.
      '';
      example = [ "/var/lib/longhorn-disk1" "/var/lib/longhorn-disk2" ];
    };
  };

  config = lib.mkIf (cfg.dataDisks != [ ]) {
    # 1. Make sure each mount directory exists with the right perms
    #    before kubelet / Longhorn try to access them.
    systemd.tmpfiles.rules = lib.concatMap (path: [
      "d ${path} 0755 root root - -"
    ]) cfg.dataDisks;

    # 2. Node LABELS. `create-default-disk=config` is the opt-in Longhorn
    #    requires before it will read the disks annotation at all; without
    #    it the annotation is ignored outright. `zeta.io/longhorn-disks`
    #    stays for scheduler targeting. mkAfter composes with whatever the
    #    host config already passes.
    services.k3s.extraFlags = lib.mkAfter [
      "--node-label=node.longhorn.io/create-default-disk=config"
      "--node-label=zeta.io/longhorn-disks=${toString (lib.length cfg.dataDisks)}"
    ];

    # 3. Node ANNOTATION carrying the disk set. kubelet can set labels but
    #    not arbitrary annotations, so this is a boot-time oneshot that
    #    waits for the node object and patches it.
    #
    #    Runs BEFORE Longhorn exists (it arrives via ArgoCD minutes later),
    #    which is what makes it effective: the annotation is only honoured
    #    while the node has no disks. Re-applying the same value on every
    #    boot is harmless -- Longhorn ignores it once disks are registered.
    systemd.services.zeta-longhorn-node-disks = {
      description = "Annotate this node with its Longhorn disk set";
      after = [ "k3s.service" ];
      wants = [ "k3s.service" ];
      wantedBy = [ "multi-user.target" ];
      path = [ pkgs.k3s ];
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        # k3s can take a while to write the kubeconfig and admit the node;
        # retry rather than fail the boot on a race.
        Restart = "on-failure";
        RestartSec = "10s";
      };
      script = ''
        set -euo pipefail
        export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
        node="${config.networking.hostName}"

        # Wait for our own Node object to exist before patching it.
        for _ in $(seq 1 60); do
          if k3s kubectl get node "$node" >/dev/null 2>&1; then break; fi
          sleep 5
        done

        k3s kubectl annotate node "$node" --overwrite \
          'node.longhorn.io/default-disks-config=${disksConfigJson}'
      '';
    };
  };
}
