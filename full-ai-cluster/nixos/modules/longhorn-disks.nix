# full-ai-cluster/nixos/modules/longhorn-disks.nix
#
# Declarative wiring between local filesystem mounts and the
# Longhorn node-level data-path catalog.
#
# Usage in a per-host config (already auto-wired by the
# disko-shapes/longhorn-node.nix shape):
#
#     zeta.longhorn.dataDisks = [
#       "/var/lib/longhorn-disk1"
#       "/var/lib/longhorn-disk2"
#     ];
#
# What this module does:
#
#   1. Ensures the mount directories exist with permissions Longhorn
#      expects (0755 root:root).
#   2. Emits a Longhorn Node CR annotation file per host under
#      /etc/longhorn/node-disks-<host>.yaml that the cluster-side
#      Longhorn deployment can pick up to extend the Node CR with
#      the extra data paths (the default chart only knows about
#      `/var/lib/longhorn`; multi-path nodes need explicit `disks`
#      entries on the Node CR).
#   3. Adds the K3S node label `zeta.io/longhorn-disks=<N>` so the
#      scheduler can target high-capacity nodes.
#
# Cluster-side companion: the longhorn Application under
# k8s/applications/longhorn/ runs a small post-install Job that
# reads /etc/longhorn/node-disks-*.yaml from each node (via a
# DaemonSet that mounts /etc/longhorn) and patches the Node CRs.
# (TODO once first physical node is up — for now, run
# `kubectl -n longhorn-system edit node <hostname>` to add the
# extra disks; the YAML on disk is the documented intent.)

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.longhorn;
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
    systemd.tmpfiles.rules = lib.concatMap (path: [
      "d ${path} 0755 root root - -"
    ]) cfg.dataDisks;

    # 2. Drop the documented intent on disk for the cluster-side
    #    Job to consume. The data the cluster-side companion needs
    #    is just "hostname -> list of mount paths" — keep it simple.
    environment.etc."longhorn/node-disks.yaml".text = ''
      # Auto-generated by zeta.longhorn module — do not edit by hand.
      # The cluster-side longhorn application reads this to patch
      # Node CRs with the multi-disk catalog.
      apiVersion: longhorn.io/v1beta2
      kind: NodeDiskCatalog
      metadata:
        name: ${config.networking.hostName}
      spec:
        host: ${config.networking.hostName}
        disks:
      ${lib.concatMapStrings (path: ''
            - path: ${path}
              allowScheduling: true
              storageReserved: 0
              tags: []
      '') cfg.dataDisks}
    '';

    # 3. K3S node label so the scheduler can target high-capacity
    #    nodes. extraFlags uses mkAfter to compose with whatever
    #    the host config already passes.
    services.k3s.extraFlags = lib.mkAfter [
      "--node-label=zeta.io/longhorn-disks=${toString (lib.length cfg.dataDisks)}"
    ];
  };
}
