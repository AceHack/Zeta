---
id: 081M3K29CQM087G0R000B5ZV3N
type: bug
state: backlog
priority: P2
slug: windows-usb-flasher-cannot-flash-removable-media-set-disk-is
title: "Windows USB flasher cannot flash removable media: Set-Disk -IsOffline refused; restore removable path (bake ESP into ISO copy, partition table last, read-back sha256)"
created: 2026-09-28T03:52:39.924Z
depends_on: []
composes_with: []
---

# Windows USB flasher cannot flash removable media: Set-Disk -IsOffline refused; restore removable path (bake ESP into ISO copy, partition table last, read-back sha256)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3K29CQM087G0R000B5ZV3N-*.md` glob. -->

## Defect

`src/Core.TypeScript/zflash/flash-usb-windows.ts` main() ran `Set-Disk -Number N -IsOffline $true`
before the raw write. Windows rejects that for removable media ("Set-Disk : Not Supported ...
Removable media cannot be set to offline"), reproduced 2026-09-27 on a PNY USB 3.2.1 FD (disk 3),
so the flasher aborted on every USB stick. PR #6981 (db4f8f274e) had a removable-media path
(Clear-Disk + raw-FAT key injection); refactor #8076 dropped it.

## Fix

Stage a sha256-verified copy of the ISO, bake the shared planner's ESP payloads into its FAT ESP in
pure TypeScript (`esp-fat-writer.ts`, read back), Clear-Disk (no offline, no `mountvol /N`), raw-write
the partition table (first 1 MiB) LAST, read back the written range and compare sha256.

## Falsifiers

`flash-usb-windows-removable.test.ts`, `esp-fat-writer.test.ts` (red on origin/main).
Not verified by any test: a real flash on an elevated Windows host.
