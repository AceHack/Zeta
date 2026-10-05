# full-ai-cluster/nixos/modules/containerd-on-data-disk.nix
#
# THE CONTAINER STORE LIVES ON A BIG DATA DISK, NEVER ON THE 120 GiB ROOT -- and k3s REFUSES TO START
# rather than fall back onto root. Work item 081M44HD9T2087G0R000G9NR1N.
#
# -- THE FINDING (measured 2026-10-05, node-5b2dfa, NixOS 26.05) --------------------------------------
# Root `/dev/nvme0n1p2` is the installer's computed 120 GiB floor (zeta-install.sh ZETA_ROOT_FLOOR_GIB)
# and held /var/lib/rancher/k3s/agent/containerd at 48 GiB (overlayfs snapshots 35 GiB, content blobs
# 14 GiB, 132 images, 534k files) next to the Nix store (12 GiB), /home/zeta (14 GiB) and the local-path
# volumes (5 GiB), at 22 GiB free. The kubelet evicts at imagefs.available<15% (~17.7 GiB free) and
# sets DiskPressure, which blocks every pod, production included; a CI job needing 24 GiB can never be
# admitted. Meanwhile the two Longhorn data disks (797 GiB and 916 GiB) were 88% free.
#
# -- THE MECHANISM -------------------------------------------------------------------------------------
# A systemd BIND MOUNT, <dataDisk>/containerd -> /var/lib/rancher/k3s/agent/containerd. Not k3s's
# `--data-dir` (which moves the WHOLE agent tree, certificates and kubeconfigs included, and is what
# k3s-agent-tls-self-heal.nix and the installer's recovery paths hard-code), and not a containerd
# `root = ` template (k3s regenerates config.toml on every start). The bind mount changes the disk
# under one path and nothing else, exactly as zeta-local-storage-placement does for local-path.
#
#   zeta-containerd-store-prepare.service   oneshot, before the mount: the disk must be mounted; creates
#                                           <disk>/containerd; REFUSES when it would hide a populated
#                                           root copy behind an empty store (containerd-store.sh)
#   var-lib-rancher-k3s-agent-containerd.mount
#                                           the bind itself, as a first-class unit k3s can depend on
#   k3s.service                             Requires= the mount, RequiresMountsFor= the path (which also
#                                           pulls in the data disk's own mount), and its FIRST ExecStartPre
#                                           asserts the target is a mount of the data disk's directory --
#                                           so k3s cannot start on a bare directory on root even if the
#                                           unit graph is bypassed by hand
#
# -- THE FAILURE MODE, CHOSEN ON PURPOSE ----------------------------------------------------------------
# FAIL CLOSED. If the data disk is missing, the directory on it is gone, or the bind is not the right
# one, k3s.service does not start (a dependency failure, or the assert's exit 1) and the message names
# the remedy. The alternative -- starting anyway -- is silent: k3s would recreate an empty store on
# root and re-pull 132 images onto the disk this module exists to protect, with no error anywhere
# until DiskPressure arrives. The node still boots, sshd is up, and nothing is deleted.
#
# Why the mount is a systemd.mounts unit rather than `fileSystems.<path>` with `bind`: an fstab bind is
# wanted by local-fs.target, so a missing data disk would drop a headless machine into emergency mode;
# and the source directory it needs cannot be created by tmpfiles, which runs AFTER local-fs.target.
# Here the failure is scoped to k3s.
#
# NOTE ON THE FORCED `after`: k3s-wait-for-address.nix sets `systemd.services.k3s.after = lib.mkForce [...]`,
# which would silently discard an `after` this module added to k3s. So the ordering is expressed on
# THIS module's own units (`before = [ "k3s.service" ]`) and via RequiresMountsFor, never `after` on k3s.
# The eval test asserts the three edges on the resolved host config rather than on this text.
#
# -- WHEN IT IS ON -------------------------------------------------------------------------------------
# `zeta.containerdStore.dataDisk` defaults to the content of /etc/zeta/containerd-data-disk, written by
# zeta-install.sh ONLY when a mounted /var/lib/longhorn-disk* of >= ZETA_CONTAINERD_MIN_GIB (200) exists
# (the largest wins, ties to the lowest number -- the rule local-storage-placement.sh uses). Absent file
# and unset option -> this module contributes NOTHING: a single small disk or a QEMU lane keeps the store
# on root, which is the only place it fits. PRESENT but not a declared mount -> refused at evaluation.
# Like every injected-*.nix this reads an absolute path, so it needs `nixos-rebuild --impure`.
#
# -- WHAT IT COSTS LONGHORN ----------------------------------------------------------------------------
# The store now shares a filesystem with Longhorn's replicas, which docs/ops/NODE-DISK-HEADROOM.md
# (option A) warned about. Measured on the node: Longhorn counts only `storageAvailable` for scheduling
# (the 25% storage-minimal-available-percentage line), and the installer's capacity check already
# discounts 25% of raw (ZETA_LONGHORN_USABLE_PERCENT=75), so a 48-100 GiB store sits inside space
# Longhorn was never going to schedule. No Longhorn setting changes. docs/ops/CONTAINERD-ON-BIG-DISK.md
# has the numbers and the one case (a data disk near the 200 GiB floor) where it does bite.
#
# NOT MOVED: /var/lib/kubelet (2.6 GiB measured). It is 280 tmpfs + 116 ext4 mount points, the CSI
# plugin sockets and every pod's volume tree; bind-mounting it adds a second must-be-mounted-first
# dependency for 2.6 GiB, and k3s `--kubelet-arg=root-dir` moves state the kubelet's own eviction
# reads. The images were the 48 GiB; the rest is not worth a second failure mode.
#
# NOT PROVEN: this module has been evaluated (tests/containerd-on-data-disk-eval-test.nix, and by hand
# on the live node's nixpkgs) but never booted. systemd honouring the ordering on a real boot, and the
# first boot's mount of a fresh <disk>/containerd, are unmeasured.

{ config, lib, pkgs, utils, ... }:

let
  cfg = config.zeta.containerdStore;

  injectedFile = "/etc/zeta/containerd-data-disk";
  readTrimmed =
    f:
    if builtins.pathExists f then
      let
        m = builtins.match "[[:space:]]*([^[:space:]]*)[[:space:]]*" (builtins.readFile f);
      in
      if m == null then "" else builtins.head m
    else
      "";
  injected = readTrimmed injectedFile;

  # The path k3s's containerd uses (default root of its snapshotter/content store). One literal, read
  # by the guard script, the mount unit and the k3s ordering below.
  containerdDir = "/var/lib/rancher/k3s/agent/containerd";
  mountUnit = "${utils.escapeSystemdPath containerdDir}.mount";
  prepareUnit = "zeta-containerd-store-prepare";

  enabled = cfg.dataDisk != null;

  # One wrapper per mode, so the unit's environment is the script's whole interface.
  storeScript =
    mode:
    pkgs.writeShellScript "zeta-containerd-store-${mode}" ''
      export PATH=${lib.makeBinPath [ pkgs.coreutils pkgs.util-linux ]}
      export ZETA_CONTAINERD_DISK=${lib.escapeShellArg cfg.dataDisk}
      export ZETA_CONTAINERD_DIR=${lib.escapeShellArg containerdDir}
      export ZETA_CONTAINERD_SUBDIR=${lib.escapeShellArg cfg.subdir}
      exec ${pkgs.bash}/bin/bash ${./containerd-store.sh} ${mode}
    '';
in
{
  options.zeta.containerdStore = {
    dataDisk = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = if injected == "" then null else injected;
      defaultText = lib.literalMD ''
        The content of `/etc/zeta/containerd-data-disk` (written by `zeta-install.sh` when a mounted
        `/var/lib/longhorn-disk*` of at least 200 GiB exists), or `null` when the file is absent.
      '';
      example = "/var/lib/longhorn-disk2";
      description = ''
        Mount point of the data disk that holds k3s's container store (images and snapshots), bound onto
        `${containerdDir}`. `null` leaves the store on the root filesystem and this module inert.

        Must be a filesystem this host declares (`fileSystems`): a path that is merely a directory on root
        would put the store on root with extra steps, and is refused at evaluation.
      '';
    };

    subdir = lib.mkOption {
      type = lib.types.str;
      default = "containerd";
      description = "Directory on the data disk that is bound onto the containerd path.";
    };
  };

  config = lib.mkMerge [
    {
      assertions = [
        {
          assertion = !enabled || (lib.hasPrefix "/" cfg.dataDisk && cfg.dataDisk != "/" && !(lib.hasSuffix "/" cfg.dataDisk));
          message = "zeta.containerdStore.dataDisk = ${builtins.toJSON cfg.dataDisk} is not a normalised absolute mount point (e.g. /var/lib/longhorn-disk2). ${injectedFile} supplies the default; fix or remove it to leave the store on root.";
        }
        {
          assertion = !enabled || builtins.hasAttr cfg.dataDisk config.fileSystems;
          message = "zeta.containerdStore.dataDisk = ${builtins.toJSON cfg.dataDisk} is not a filesystem this host declares (fileSystems has: ${lib.concatStringsSep ", " (builtins.attrNames config.fileSystems)}). Binding the store onto a plain directory would keep it on the root filesystem. Declare the mount, or remove ${injectedFile}.";
        }
        {
          assertion = !enabled || (cfg.subdir != "" && !(lib.hasInfix "/" cfg.subdir) && cfg.subdir != "." && cfg.subdir != "..");
          message = "zeta.containerdStore.subdir = ${builtins.toJSON cfg.subdir} must be one plain directory name.";
        }
      ];
    }

    (lib.mkIf (enabled && config.services.k3s.enable) {
      # 1. Before the mount: the disk is there, the directory on it exists, and an upgraded node's
      #    populated root copy is not about to be hidden behind an empty one.
      systemd.services.${prepareUnit} = {
        description = "Prepare the container store directory on ${cfg.dataDisk} (refuses rather than use the root filesystem)";
        # The data disk's own mount (and its parents) are required and ordered before. No default
        # dependencies: DefaultDependencies would order this after sysinit.target, and the mount unit
        # it precedes would then be Before local-fs.target -- a cycle through sysinit.target.
        unitConfig = {
          DefaultDependencies = false;
          RequiresMountsFor = [ cfg.dataDisk ];
        };
        before = [ mountUnit "shutdown.target" ];
        conflicts = [ "shutdown.target" ];
        serviceConfig = {
          Type = "oneshot";
          RemainAfterExit = true;
          ExecStart = "${storeScript "prepare"}";
          StandardOutput = "journal+console";
          StandardError = "journal+console";
        };
      };

      # 2. The bind mount, as a unit k3s can depend on. Not wantedBy anything but k3s, so a failure here
      #    stops k3s and nothing else (no emergency mode on a headless box).
      systemd.mounts = [
        {
          what = "${cfg.dataDisk}/${cfg.subdir}";
          where = containerdDir;
          type = "none";
          options = "bind";
          requires = [ "${prepareUnit}.service" ];
          after = [ "${prepareUnit}.service" ];
          before = [ "k3s.service" "umount.target" ];
          requiredBy = [ "k3s.service" ];
          conflicts = [ "umount.target" ];
          unitConfig = {
            DefaultDependencies = false;
            RequiresMountsFor = [ cfg.dataDisk ];
          };
        }
      ];

      # 3. k3s: Requires the mount, RequiresMountsFor the path, and asserts it before anything else runs.
      #    NO `after` here: k3s-wait-for-address.nix mkForce-overrides it (see the header).
      systemd.services.k3s = {
        requires = [ mountUnit ];
        unitConfig.RequiresMountsFor = [ containerdDir ];
        serviceConfig.ExecStartPre = lib.mkBefore [ "${storeScript "assert"}" ];
      };
    })
  ];
}
