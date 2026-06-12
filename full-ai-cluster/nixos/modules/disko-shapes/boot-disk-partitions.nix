# Shared ESP + max-fill root + longhorn1 tail layout for the boot disk.
# Matches zeta-install on the USB installer (Step 4 partition geometry).
{ longhorn1Tail }:
{
  ESP = {
    priority = 1;
    size = "1G";
    type = "EF00"; # EFI System Partition
    content = {
      type = "filesystem";
      format = "vfat";
      mountpoint = "/boot";
      mountOptions = [ "umask=0077" ];
    };
  };

  root = {
    priority = 2;
    start = "0";
    # sgdisk end code: root fills from after ESP to the longhorn1 tail.
    end = "-${longhorn1Tail}";
    content = {
      type = "filesystem";
      format = "ext4";
      mountpoint = "/";
      mountOptions = [ "noatime" ];
    };
  };

  longhorn1 = {
    # "100%" = remaining tail after root (default 1G; actual bytes follow disk).
    size = "100%";
    content = {
      type = "filesystem";
      format = "ext4";
      mountpoint = "/var/lib/longhorn-disk1";
      mountOptions = [ "noatime" "nofail" ];
    };
  };
}
