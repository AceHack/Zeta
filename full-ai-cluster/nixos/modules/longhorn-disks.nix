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

      # DERIVED from this host's own `fileSystems`, not a fixed literal.
      #
      # It used to be the fixed literal [ "/var/lib/longhorn" ], and that is
      # the node-side half of the same "use every disk" hole the multi-disk
      # mechanism fix (PR #12175) closes on the cluster side. The two halves
      # are independent and BOTH are required:
      #
      #   zeta-install.sh formats EVERY non-boot internal disk as
      #   longhorn{2..N} and mounts them at /var/lib/longhorn-disk{2..N}
      #   (plus longhorn1 in the boot disk's tail). hosts/control-plane and
      #   hosts/worker-gpu -- menu options 1 and 2 of that same installer --
      #   are hardware-configuration hosts, so nothing ever set this option
      #   on them. Only disko-shapes/longhorn-node.nix sets it, and only
      #   hosts/worker-template imports that shape.
      #
      #   So on the host the USB actually installs, the disk set handed to
      #   Longhorn was the ONE-element literal below: /var/lib/longhorn, a
      #   directory on the ROOT filesystem (longhorn-prereqs.nix creates it
      #   with tmpfiles precisely so longhorn-manager can start on a node
      #   with no data partition). Every dedicated Longhorn partition the
      #   installer had just made contributed ZERO schedulable capacity --
      #   while zeta-install.sh's capture check and the boot-time
      #   zeta-longhorn-preflight both went green, because both of them
      #   measure `fileSystems`, and `fileSystems` was correct. A check that
      #   did not run, looking exactly like a check that passed.
      #
      # Deriving it from `requiredMounts` -- the SAME value
      # longhorn-node-preflight.nix refuses to boot without -- makes the set
      # Longhorn is TOLD about and the set the node is REQUIRED to have
      # mounted one expression rather than two rosters that agree by
      # coincidence. Drift between them is now impossible by construction,
      # which is why the falsifier in
      # tests/longhorn-disk-registration-eval-test.nix asserts identity
      # against that file rather than against a copied list.
      #
      # The [ "/var/lib/longhorn" ] fallback is kept for the genuine
      # no-Longhorn-filesystem host (hosts/control-plane's committed
      # placeholder, and every VM test that declares no data disk): that is
      # today's behaviour, and changing it to [ ] would disable the module
      # via its own `lib.mkIf (cfg.dataDisks != [ ])` and take the node
      # label with it.
      default =
        let
          declared =
            (import ./longhorn-preflight-checks.nix {
              inherit lib;
              inherit (config) fileSystems;
            }).requiredMounts;
        in
        if declared == [ ] then [ "/var/lib/longhorn" ] else declared;

      defaultText = lib.literalMD ''
        Every mountpoint this host declares under `/var/lib/longhorn`
        (i.e. `longhorn-preflight-checks.nix`'s `requiredMounts`), or
        `[ "/var/lib/longhorn" ]` when the host declares none.
      '';

      description = ''
        Filesystem paths that Longhorn should use as data paths on
        this node. Each path must already be a mountpoint backed by
        a real partition (typically declared via the disko-shape).
        The first entry IS Longhorn's defaultDataPath; additional
        entries get added to the Node CR as named disks.

        Defaults to the host's own declared Longhorn mountpoints, so a
        node uses every disk zeta-install.sh formatted for it without
        anyone restating the list. Set it explicitly only to use FEWER
        disks than the host mounts -- and that override is precisely what
        the parity property in
        `tests/longhorn-disk-registration-eval-test.nix` exists to make
        visible, so state the reason where the override lives.
      '';
      example = [ "/var/lib/longhorn-disk1" "/var/lib/longhorn-disk2" ];
    };
  };

  config = lib.mkIf (cfg.dataDisks != [ ]) {
    # 1. Make sure each mount directory exists with the right perms
    #    before kubelet / Longhorn try to access them.
    # /var/lib/longhorn is deliberately EXCLUDED: longhorn-prereqs.nix already
    # declares it (mode 0700), and two tmpfiles rules for one path with
    # different modes is a conflict systemd resolves unpredictably. This module
    # owns only the EXTRA data paths.
    systemd.tmpfiles.rules = lib.concatMap (path: [
      "d ${path} 0755 root root - -"
    ]) (lib.filter (p: p != "/var/lib/longhorn") cfg.dataDisks);

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
