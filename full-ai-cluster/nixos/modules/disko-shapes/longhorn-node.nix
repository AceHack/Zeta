# full-ai-cluster/nixos/modules/disko-shapes/longhorn-node.nix
#
# Unified Longhorn-node disko shape: 1 to N internal disks.
# Root max-fills the boot disk (no fixed OS cap); each extra disk is
# one whole-disk longhorn{2..N} partition. Matches zeta-install layout.
#
# Layout (1-disk — omit extraDisks):
#
#   boot
#     p1   1 GiB   FAT32   /boot
#     p2   max     ext4    /
#     p3   tail    ext4    /var/lib/longhorn-disk1
#
# Layout (2-disk — one extraDisks entry):
#
#   boot   → ESP + root max + longhorn1 tail (as above)
#   data1  → whole disk → /var/lib/longhorn-disk2
#
# Per-host: set `zeta.disko.bootDisk` to a /dev/disk/by-id symlink.
# Add `zeta.disko.extraDisks` for each additional data disk (may be []).
#
# Install path:
#   nix run github:nix-community/disko -- \
#     --mode disko \
#     --flake /mnt/etc/zeta/full-ai-cluster#<host>
#   nixos-install --flake /mnt/etc/zeta/full-ai-cluster#<host> --no-root-password

{ config, lib, ... }:

let
  cfg = config.zeta.disko;

  bootDevice =
    if cfg.bootDisk != null then
      cfg.bootDisk
    else if cfg.nvme0 != null then
      cfg.nvme0
    else
      throw ''
        zeta.disko.bootDisk must be set to a /dev/disk/by-id path.
        (Legacy alias zeta.disko.nvme0 is still accepted.)
      '';

  extraDevices =
    if cfg.extraDisks != [ ] then
      cfg.extraDisks
    else
      lib.optional (cfg.nvme1 != null) cfg.nvme1;

  bootPartitions = import ./boot-disk-partitions.nix {
    longhorn1Tail = cfg.longhorn1Tail;
  };

  extraDiskConfigs = lib.listToAttrs (
    lib.imap1 (
      i: device:
      {
        name = "data${toString i}";
        value = {
          type = "disk";
          device = device;
          content = {
            type = "gpt";
            partitions = {
              "longhorn${toString (i + 1)}" = {
                size = "100%";
                content = {
                  type = "filesystem";
                  format = "ext4";
                  mountpoint = "/var/lib/longhorn-disk${toString (i + 1)}";
                  mountOptions = [ "noatime" "nofail" ];
                };
              };
            };
          };
        };
      }
    ) extraDevices
  );

  longhornMountPaths =
    [ "/var/lib/longhorn-disk1" ]
    ++ lib.genList (i: "/var/lib/longhorn-disk${toString (i + 2)}") (lib.length extraDevices);
in
{
  options.zeta.disko = {
    bootDisk = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        /dev/disk/by-id symlink for the boot disk (ESP + max root +
        longhorn1 tail). Find candidates on the live system with
        `ls -l /dev/disk/by-id/`.
      '';
      example = "/dev/disk/by-id/nvme-Samsung_SSD_990_PRO_8TB_S6Z2NS0WB12345";
    };

    extraDisks = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = ''
        Additional internal disks, each formatted as a single
        longhorn{2..N} data path. Leave empty for single-disk nodes.
      '';
      example = [
        "/dev/disk/by-id/nvme-WD_BLACK_SN850X_1000GB_25092A800123"
      ];
    };

    # Deprecated aliases kept so existing host configs keep working.
    nvme0 = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        Deprecated: use `bootDisk`. Accepted as a fallback when
        `bootDisk` is unset.
      '';
    };

    nvme1 = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        Deprecated: use `extraDisks = [ ... ]`. Accepted as a fallback
        when `extraDisks` is empty.
      '';
    };

    longhorn1Tail = lib.mkOption {
      type = lib.types.str;
      default = "1G";
      description = ''
        Fixed tail slice on the boot disk for longhorn1. Root max-fills
        the space between the 1 GiB ESP and this tail (same geometry as
        zeta-install on the USB installer).
      '';
    };
  };

  config = {
    disko.devices.disk =
      {
        boot = {
          type = "disk";
          device = bootDevice;
          content = {
            type = "gpt";
            partitions = bootPartitions;
          };
        };
      }
      // extraDiskConfigs;

    zeta.longhorn.dataDisks = lib.mkDefault longhornMountPaths;
  };
}
