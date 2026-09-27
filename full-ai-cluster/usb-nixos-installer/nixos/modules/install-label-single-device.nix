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
# WHY THE COIN FLIP COSTS AN INSTALL. Stage 1 mounts the boot medium at /iso
# through that symlink (`root=LABEL=ZETA_INSTALL` -> `/dev/root`, see
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
# picks is unordered". That is exactly what udev's `link_priority` orders, so
# the rule below deletes the coin flip without touching a byte of the image.
#
# THE RULE. When the WHOLE DISK carries the ZETA_INSTALL label, its symlinks
# lose to any partition that carries the same label. udev's documented
# semantics: devices with a higher link_priority overwrite the symlinks of
# devices with a lower one; the default is 0. So:
#
#   - isohybrid USB / QEMU usb-storage: sda1 (priority 0) beats sda (-100),
#     on every boot, whatever order the events arrive in. Stage 1 runs
#     `udevadm settle` before it mounts, so both events are in when it looks.
#   - optical media / `-cdrom` lanes: sr0 has no partitions, so it is the only
#     candidate and still owns the link. Lower priority is not "no link".
#   - scoped to OUR label: nothing else on the machine changes order.
#
# BOTH STAGES. `boot.initrd.services.udev.rules` is what stage 1 uses to pick
# the /iso mount source (it lands in the initrd's 99-local.rules for both the
# scripted and the systemd initrd). `services.udev.extraRules` keeps stage 2's
# /dev/disk/by-label/ZETA_INSTALL pointing at the same device, so the
# first-boot ESP scan -- which walks by-label -- and the mount agree.
#
# THE FALSIFIER. zeta-first-boot.sh prints `boot-medium=` on every boot, and
# src/Core.TypeScript/ci/qemu-full-install-test.ts (`bootMediumShape`) FAILS a
# USB lane whose boot medium is a whole disk. The mtools rung in the scan is
# kept as the second line, not the design: it reads the ESP through the whole
# disk and works whether or not this rule holds.
{ config, ... }:

let
  zetaInstallLabelOnePartition = ''
    # 081M3B7Z38Q087G0R003F9X7HM: an isohybrid whole disk and its LBA-0 partition 1
    # both carry the ISO volume label; the partition must own by-label/by-uuid.
    SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", ENV{ID_FS_LABEL}=="${config.isoImage.volumeID}", OPTIONS+="link_priority=-100"
  '';
in
{
  boot.initrd.services.udev.rules = zetaInstallLabelOnePartition;
  services.udev.extraRules = zetaInstallLabelOnePartition;
}
