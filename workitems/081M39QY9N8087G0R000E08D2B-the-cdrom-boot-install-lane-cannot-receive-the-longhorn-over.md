---
id: 081M39QY9N8087G0R000E08D2B
type: bug
state: backlog
priority: P2
slug: the-cdrom-boot-install-lane-cannot-receive-the-longhorn-over
title: "The cdrom-boot install lane cannot receive the Longhorn override: no vfat partition exists to stage an ESP conf on"
created: 2026-09-24T12:58:40.680Z
depends_on: []
composes_with: []
---

# The cdrom-boot install lane cannot receive the Longhorn override: no vfat partition exists to stage an ESP conf on

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M39QY9N8087G0R000E08D2B-*.md` glob. -->

## The condition

`081KSNY2Z0008QG0R0008PN7RQ scenario 2 — boot + install substrate` boots the
installer from `-cdrom`, not from a flashed USB image. A cdrom exposes **no
vfat partition**, so there is nowhere to stage `/zeta-firstboot.conf` — and
therefore no way to deliver `ZETA_ALLOW_LONGHORN_UNDERSIZED=1`. The lane bails
before the wipe on the #17611/#17614 pre-wipe Longhorn refusal and cannot be
unblocked by the mechanism that unblocks every other lane.

## Measured, and the instrumentation names the cause in one line

Run 35996447262, `qemu-full-install-serial.log`:

```
[081M392JR97087G0R003QAFH0Y-esp-conf] esp-conf=none tried=/dev/disk/by-label/ZETA_INSTALL(no-vfat)
...
ERROR: BOOT disk /dev/vda is 40 GiB, which cannot hold ESP 1 GiB + root floor 120 GiB
+ a 1 GiB minimum longhorn1 tail (need >= 122 GiB).
[zeta-first-boot] Install failed (rc=1).
```

`tried=` lists exactly one candidate — the ISO9660 label — and `(no-vfat)` says
it would not mount as vfat. That is the whole diagnosis, and it is the first
thing the WP27 scan instrumentation (081M392JR97087G0R003QAFH0Y) was used for.

## It is a regression from the gate, not from the harness

| run | time | scenario 2 |
|---|---|---|
| 35968222668 | 07:10, **before** #17611/#17614 | **success** |
| 35985197702 | 10:05, after | failure |
| 35996447262 | 12:01, after | failure |

The gate is correct on its own terms: a 40 GiB disk genuinely cannot hold the
943 GiB roster. What is missing is a delivery path for the override on a lane
that boots read-only media.

## A claim in #17625 that this refutes

That PR body says *"all five `qemu-full-install-test.ts` invocations in
`build-ai-cluster-iso.yml` set a flag that reaches the USB-image branch, so no
lane needs the override and misses it."* **That is wrong.** Scenario 2 reaches
the harness through `src/Core.TypeScript/zflash/test-harness/run.ts --scenario
boot-cluster-up`, so a grep for `qemu-full-install-test.ts` in the workflow does
not find it. It sets only `QEMU_FIRST_SESSION_PHASE3=1`, which does **not**
force the USB-image branch, so it takes the `-cdrom` path.

## Options, strongest first — none taken here

1. **Attach a small FAT image as a non-boot USB stick** carrying only
   `/zeta-firstboot.conf`, while still booting from the cdrom. Uses only
   existing machinery (`qemuUsbStorageDeviceArg`), preserves what the lane is
   for (ISO/cdrom boot), and the installer already excludes USB from install
   targets. Risk: it changes the device topology this lane's own disk
   enumeration (`RM`/`HOTPLUG` filter) is partly there to test.
2. **A fw_cfg-delivered first-boot conf.** `zeta-creds-restore.nix` already
   reads `/sys/firmware/qemu_fw_cfg/by_name/...`, so the door exists. But it
   would put a hypervisor-controlled channel into the installer's *config*
   path, which is a security-surface decision and not a harness one. Also
   `fw_cfg` does not exist on metal, so it can never be the general answer.
3. **Raise the lane's disk above 122 GiB.** Clears the FIRST gate only. The
   capacity verdict (`tail x 75%` vs `ZETA_LONGHORN_DEMAND_GIB=943`) still
   refuses at any plausible virtual size, so this is not sufficient alone.
4. **Give the lane a role conf by switching it to a flashed USB image.** Then
   it is no longer the cdrom lane and the coverage is simply gone.

## Not blocking the WP11 lane

WP11 boots a flashed image and reads its ESP conf correctly
(`esp-conf=esp:/dev/disk/by-label/EFIBOOT`, run 35996447262). This is scenario
2 only.
