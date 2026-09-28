# install-label-single-device.nix — ONE block device answers to ZETA_INSTALL.
#
# 081M3B7Z38Q087G0R003F9X7HM (composes with 081M39CJP96087G0R001T4J2R3).
#
# THE AMBIGUITY. nixpkgs' make-iso9660-image.sh builds this ISO with
# `xorriso -as mkisofs -isohybrid-mbr ... -isohybrid-gpt-basdat`, and that
# pairing writes an MBR whose partition 1 starts at LBA 0 and spans the whole
# image (type 0x00), beside partition 2 (type 0xEF, the EFIBOOT ESP):
#
#   part0  type=0x00  startLBA=0    sectors=3420480   (the entire ISO)
#   part1  type=0xef  startLBA=268  sectors=6144      (the 3 MiB FAT12 ESP)
#
# The kernel's msdos parser skips a zero-LENGTH entry, not a zero-TYPE one, so
# `/dev/sda1` exists and exposes the SAME iso9660 -- same `ZETA_INSTALL`
# label, same UUID -- as `/dev/sda`. Two devices claim one by-label symlink and
# udev hands it to whichever event it processed last.
#
# WHY THE COIN FLIP COSTS AN INSTALL. Upstream, stage 1 mounts the boot medium
# at /iso through that symlink (the systemd initrd uses
# `/dev/disk/by-label/ZETA_INSTALL` directly, see
# nixos/modules/installer/cd-dvd/iso-image.nix) and holds it for the whole
# install. A mount of the WHOLE DISK claims `/dev/sda` O_EXCL, after which no
# partition of it can be opened -- the ESP included, and the ESP is where zflash
# puts the operator's SSH key, the hostname, the wifi credentials and the
# first-boot conf. Measured (081M39CJP96087G0R001T4J2R3, run 36073981145):
#
#   boot-medium=/dev/sda    sda1 AND sda2: `Can't open blockdev`      -> all lost
#   boot-medium=/dev/sda1   sda2 mounts, zflash's files are readable -> healthy
#
# Same ISO, same run, minutes apart. A real USB stick is the same image with
# the same race; nothing about it is CI-specific.
#
# WHY HERE AND NOT IN XORRISO. The partition-1-at-LBA-0 entry is the classic
# isohybrid layout (syslinux's `isohybrid`, which `-isohybrid-mbr` reproduces),
# kept for BIOSes that will not boot a stick unless a partition covers the boot
# code -- that compatibility claim is upstream's, NOT re-measured here. And
# `-partition_offset` would move the entry but, by design, keep a mountable
# iso9660 (so the duplicate label) on it. Changing the image layout touches BIOS
# boot, UEFI boot, dd-to-USB and every QEMU lane at once, and it would mean
# replacing nixpkgs' whole ISO builder to pass one flag. The ambiguity that
# costs us is not "two devices carry the label" -- it is "which one the symlink
# picks is unordered". The rules below remove the coin flip without touching a
# byte of the image.
#
# THE FIRST RULE (PR #17695). When the WHOLE DISK carries the ZETA_INSTALL
# label, its symlinks lose to any partition that carries the same label: udev
# gives a link to the claimant with the highest link_priority (default 0). That
# ranks claimants that EXIST. It cannot rank one that has not been processed.
#
# WHY IT DID NOT HOLD (run 36406378420, main@88b688444e): three USB lanes still
# mounted /iso from /dev/sda while other lanes of the same ISO got /dev/sda1.
# The chain, from the pinned sources (nixpkgs c25784012c99, systemd 260.2):
#
#   - stage 1 is the SYSTEMD initrd: `boot.initrd.systemd.enable` defaults to
#     true (nixos/modules/system/boot/systemd/initrd.nix) and nothing here
#     overrides it. `root=LABEL=` -> `/dev/root` + `udevadm settle` is the
#     SCRIPTED initrd's path; with systemd, iso-image.nix sets
#     `fileSystems."/iso".device = "/dev/disk/by-label/${volumeID}"`.
#   - sysroot-iso.mount is bound to that path's .device unit, and systemd makes
#     a devlink unit ready as soon as it handles a uevent whose symlink resolves
#     to the device (src/core/device.c, device_setup_devlink_unit_one). There
#     is no settle.
#   - udevd never runs a partition's event while its disk's is running, so sda
#     is ALWAYS processed before sda1. At that moment sda is the only claimant,
#     the symlink points at it, and the mount may start before sda1 exists to
#     outrank it. Whether it does is timing -- the race the run measured.
#
# THE FIX. /iso mounts through a symlink that only the right device ever
# claims, so there is nothing to race. `disk/zeta-install-medium` goes to:
#
#   - a PARTITION carrying the ISO label and an iso9660 (the isohybrid LBA-0
#     partition: sda1, nvme0n1p1, vda1);
#   - an optical drive (sr*): the kernel never partitions it, though blkid may
#     still report the isohybrid MBR on it;
#   - a whole disk with NO partition table (a plain iso9660 on a stick).
#
# A whole disk that HAS a partition table never claims it, so on an isohybrid
# stick the .device unit cannot become ready until sda1's event lands, and the
# mount source is sda1 under every event order. The same path works for the
# scripted initrd (its waitDevice polls the /iso device path, and these rules
# land in its 99-local.rules too). The priority rule stays: it keeps stage 2's
# /dev/disk/by-label/ZETA_INSTALL -- walked by the first-boot ESP scan -- on the
# same partition.
#
# BOTH STAGES. `boot.initrd.services.udev.rules` feeds stage 1's udev (the
# initrd's 99-local.rules); `services.udev.extraRules` gives stage 2 the same
# links, so the fstab entry for /iso names a device that exists there too.
#
# THE FALSIFIERS. src/Core.TypeScript/installer/install-medium-selection.test.ts
# evaluates THESE rules over every legal uevent order and mount timing (red on
# the priority rule alone, green here). zeta-first-boot.sh prints `boot-medium=`
# on every boot, and src/Core.TypeScript/ci/qemu-full-install-test.ts
# (`bootMediumShape`) FAILS a USB lane whose boot medium is a whole disk. The
# mtools rung in the scan is kept as the second line, not the design: it reads
# the ESP through the whole disk and works whether or not these rules hold.
{ config, lib, ... }:

let
  zetaInstallLabelOnePartition = ''
    # 081M3B7Z38Q087G0R003F9X7HM: an isohybrid whole disk and its LBA-0 partition 1
    # both carry the ISO volume label; the partition must own by-label/by-uuid.
    SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", OPTIONS+="link_priority=-100"
    # 081M3B7Z38Q087G0R003F9X7HM: /iso mounts through disk/zeta-install-medium, which only
    # ONE device ever claims. A partitioned whole disk never does, so there is no race.
    SUBSYSTEM=="block", ENV{DEVTYPE}=="partition", ENV{ID_FS_TYPE}=="iso9660", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", SYMLINK+="disk/zeta-install-medium"
    SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", KERNEL=="sr*", ENV{ID_FS_TYPE}=="iso9660", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", SYMLINK+="disk/zeta-install-medium"
    SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", KERNEL!="sr*", ENV{ID_PART_TABLE_TYPE}!="?*", ENV{ID_FS_TYPE}=="iso9660", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", SYMLINK+="disk/zeta-install-medium"
  '';
in
{
  boot.initrd.services.udev.rules = zetaInstallLabelOnePartition;
  services.udev.extraRules = zetaInstallLabelOnePartition;

  # mkForce (50) beats iso-image.nix's mkImageMediaOverride (60) on this one
  # field; fsType, neededForBoot and noCheck stay as nixpkgs sets them.
  fileSystems."/iso".device = lib.mkForce "/dev/disk/zeta-install-medium";
}
