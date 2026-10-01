---
id: 081M3B7Z38Q087G0R003F9X7HM
type: task
state: backlog
priority: P2
slug: remove-the-duplicate-zeta-install-label-isohybrid-partition
title: "Remove the duplicate ZETA_INSTALL label: isohybrid partition 1 at LBA 0 makes by-label resolution a coin flip"
created: 2026-09-25T02:57:58.551Z
depends_on: []
composes_with: []
---

# Remove the duplicate ZETA_INSTALL label: isohybrid partition 1 at LBA 0 makes by-label resolution a coin flip

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3B7Z38Q087G0R003F9X7HM-*.md` glob. -->

## The ambiguity

The installer ISO is isohybrid, and its MBR partition 1 starts at **LBA 0** and
spans the whole image:

```
part0  type=0x00  startLBA=0    sectors=3420480   (1_751_285_760 bytes — the entire ISO)
part1  type=0xef  startLBA=268  sectors=6144      (the 3 MiB FAT12 ESP)
```

So `/dev/sda` and `/dev/sda1` expose the **same iso9660 filesystem** with the
**same `ZETA_INSTALL` label**, and `/dev/disk/by-label/ZETA_INSTALL` resolves to
whichever of them udev processed last. That is a coin flip, and it decides
whether the boot medium is mounted from the whole disk or from a partition.

## Why it matters — it is not cosmetic

Measured under 081M39CJP96087G0R001T4J2R3. When the boot medium is mounted from
the **whole disk**, that mount holds `/dev/sda` `O_EXCL`, and **every partition
of it becomes unopenable for the rest of the install**:

```
picker lane   sda1 AND sda2 = fsconfig system call failed: Can't open blockdev
four others   sda1 = openable (iso9660, not FAT), sda2 = mounted
```

Same ISO, same CI run, minutes apart. The ESP is the casualty: the operator's
injected SSH pubkeys, the chosen hostname, the wifi credentials and the
firstboot conf are all read from it, and all of them are silently lost. The
node comes up as `node-<6hex>` with no operator key and no stated reason.

**This is not CI-specific.** A real USB stick is the same image with the same
LBA-0 partition 1, the same duplicate label and the same udev race.

## The relationship to what already shipped

081M39CJP96087G0R001T4J2R3 landed a fourth rung on the ESP mount ladder that
routes **around** the claim — it reads the ESP through the whole disk with
`mcopy -i /dev/sda@@<derived offset>`, which needs no mount, no loop device and
no kernel FAT driver, and is verified working while the claim is held.

**That is a workaround for an ambiguity that may be deletable, and it should
not be allowed to become the design.** If the ISO build can stop presenting
partition 1 at LBA 0, or the boot medium can be pinned to a partition rather
than resolved by label, the race disappears and nothing has to route around it.

## What to investigate

- **The xorriso/isohybrid invocation** in the NixOS `isoImage` module: is the
  LBA-0 partition-1 entry required for BIOS/UEFI boot compatibility, or is it
  an artefact? Its type byte is `0x00` ("empty"), which the kernel normally
  ignores — yet `sda1` exists, so something is creating it.
- **Pin the boot medium to a partition** rather than to `by-label`, if the
  stage-1 medium search can be told which device to use.
- **Blast radius is the reason this is separate**: changing how the ISO's
  partition table is written touches BIOS boot, UEFI boot, `dd`-to-USB and
  every QEMU lane at once. It needs its own measurement, not a ride-along.

## Falsifier for whatever lands

`/dev/disk/by-label/ZETA_INSTALL` must resolve to the same device on every
boot of the same image, and the whole disk must never be the boot medium's
mount source. Both are now recorded on every run by the WP29 scan line
(`boot-medium=` and the `part->target` symlink resolution), so the check is a
grep over a serial log rather than new machinery.

## What landed (2026-09-27) — and what is NOT yet verified

- **Pinned, not deleted.** The image layout is unchanged (the blast radius above
  still applies to touching it). Instead a udev rule gives the whole disk
  `link_priority=-100` when it carries the ISO volume label, so the LBA-0
  partition always owns `by-label/ZETA_INSTALL` and `/iso` is never mounted
  from the whole disk. Applied in the initrd (the stage-1 `/iso` mount) and in
  stage 2 (the first-boot scan): `full-ai-cluster/usb-nixos-installer/nixos/modules/install-label-single-device.nix`.
  Optical media keep working: `sr0` has no partitions, so it stays the only
  candidate.
- **The falsifier above is now live.** `bootMediumShape` in
  `src/Core.TypeScript/ci/qemu-full-install-test.ts` fails a USB lane whose
  guest reports `boot-medium=` a whole disk, and reports "did not run" (not a
  pass) when the line is absent.
- **Rung 4 hardened.** An LBA-0 or whole-disk candidate no longer refuses; it
  resolves the parent disk and reads the ESP at the ESP partition's own start
  (by type `0xef` / the GPT ESP GUID). `(no-conf)` now carries `saw=` so a
  readable-but-unstaged ESP is distinguishable on sight. Nightly 36297481926's
  `/dev/sda2(no-conf)` was that case: the initial-format lane stages no
  `/zeta-firstboot.conf` at all, and the ESP mounted fine.
- **Not verified:** the udev rule has not run on any built ISO or real hardware
  at the time of writing (no local `nix`). The first ISO CI run carrying it is
  the measurement; until it prints `boot-medium=` a partition on every USB
  lane across repeated runs, this item stays open.

## What the first measurement showed (2026-10-01) — #17751 was INERT

Run 36870188468 (WP11 scoped dispatch) failed with `boot-medium=/dev/sda`; the
WP11 USB lane's `boot-medium=` over every run since #17751 merged: `/dev/sda`
in 36856972760, 36865505620, 36870188468 and `/dev/sda1` in 36858893664,
36832486494. Three of five: not rare, and exactly what the unpinned by-label
race predicts. Cause, found by the post-merge grade (Vera) and confirmed against
the pinned nixpkgs source: `installation-cd-base.nix:36` sets
`fileSystems = lib.mkImageMediaOverride config.lib.isoFileSystems` (priority 60
on the whole option). The module system filters an option's definitions by
**top-level** priority, so #17751's default-priority
`fileSystems."/iso".device = lib.mkForce …` was dropped whole and the evaluated
`/iso` device stayed `/dev/disk/by-label/ZETA_INSTALL`. The udev rules created
a symlink nothing mounted. Every check that "verified" it read source text.

Fixed by defining `fileSystems` at priority 60 at both levels (merges with the
base; `device` alone carries `mkForce`), gated on the isohybrid MBR
(`makeBiosBootable && makeUsbBootable`) so the aarch64 ISO — no LBA-0 partition,
nothing to claim the symlink — keeps by-label. dm-/loop-/nbd- whole disks claim
the symlink outright (nothing can partition them). New falsifiers: the flake
check `install-medium-device-eval` (asks the real module system), a model that
refuses a pin the base discards, a sysfs-derived `verdict=` line the guest
prints on every boot (`zeta_boot_medium_verdict`) which the QEMU harness
convicts on, and a fake-sysfs bash parity suite.

**Source fix (delete the ambiguity in the image): evaluated, NOT taken.** The
LBA-0 partition is the syslinux `isohdpfx.bin` MBR template that nixpkgs passes
as `-isohybrid-mbr`; the ESP entry (`0xEF`, the one zflash's Windows flasher
finds as `MBR 0xEF @ LBA 276`) is `-isohybrid-gpt-basdat` marking
`boot/efi.img` inside the ISO, not an `-append_partition`. Moving or dropping the
LBA-0 entry means replacing nixpkgs' ISO builder (`make-iso9660-image.sh` has no
hook for xorriso flags), changes BIOS-USB, UEFI-USB and dd boot at once, and its
BIOS half cannot be measured by any lane here (every QEMU lane is UEFI). With the
pin effective the duplicate label no longer matters to the mount; it stays a
possible future simplification, not a defect.

**Still open until measured:** that the pin now holds on a built ISO across
repeated USB lane runs (`verdict=PARTITION`), and that `ID_PART_TABLE_TYPE` is
reported on an isohybrid whole disk by real udev (assumed by the rules, observed
only indirectly).
