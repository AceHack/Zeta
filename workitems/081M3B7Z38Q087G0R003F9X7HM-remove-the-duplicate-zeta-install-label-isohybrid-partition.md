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
