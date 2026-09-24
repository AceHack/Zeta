---
id: 081M39CJP96087G0R001T4J2R3
type: bug
state: backlog
priority: P2
slug: a-full-workflow-dispatch-silently-loses-every-boot-usb-esp-i
title: "A full workflow_dispatch silently loses EVERY boot-USB ESP injection: pubkey, hostname and the WP11 marker"
created: 2026-09-24T09:40:06.054Z
depends_on: []
composes_with: []
---

# A full workflow_dispatch silently loses EVERY boot-USB ESP injection: pubkey, hostname and the WP11 marker

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M39CJP96087G0R001T4J2R3-*.md` glob. -->

## The condition

On one measured run of `build-ai-cluster-iso.yml`, the installer guest found
**none** of the files zflash baked onto the boot USB ESP. Not one injection
survived, and the install reported success anyway.

## Measured, two runs, same artifact, opposite outcomes

| | run **35965945581** | run **35960376641** |
|---|---|---|
| trigger | `workflow_dispatch` (full) | `schedule` |
| branch | `claude/k3s-zero-length-tls-self-heal` | `main` |
| operator SSH pubkey | `reason: no operator SSH pubkey found on boot USB ESP` | `[iter-4.2]   found: /tmp/zeta-boot-esp/zeta-authorized-keys.pub` |
| injected hostname | `[iter-5.2]   no zeta-hostname.txt on USB ESP` -> generated `node-24cfc8` | `found injected hostname: node-qemu-k3s-verify` |
| USB UUID capture | absent | `captured USB UUID: 1234-5678 (device: /dev/sda2)` |
| WP11 marker | `[k3s-first-boot-verify] no zeta-qemu-k3s-first-boot-verify on boot USB ESP` | `found` + `wrote /mnt/etc/zeta/qemu-k3s-first-boot-verify` |
| WP11 verdicts | **zero** — `wp11-k3s-verify` appears 0 times in a 445 KB serial | all six emitted |

The symptom the lane reported was a **100-minute timeout** "waiting for k3s
first-boot verdict", which reads as *k3s was slow* and was in fact *k3s was
never measured*.

## What has been ruled out

- **Not a shared or cached boot image.** `qemu-full-install-test.ts` builds
  `usbImagePath` inside a per-invocation `mkdtempSync` directory, so no two
  workflow steps can touch the same image.
- **Not visible in the bake's own output.** Both runs printed the identical two
  harness lines and took ~2 s to bake (35965945581 at 07:37:26.66 -> 07:37:29.12;
  35960376641 at 05:48:25.47 -> 05:48:27.03). Nothing in the harness log
  distinguishes the failing run from the passing one.
- **Not WP11-specific.** Every ESP consumer failed, which is why this is filed
  separately from the WP11 lane rather than inside it.

## Where the evidence points

The guest side of the probe. `zeta-install.sh` iter-4.2 mounts the boot USB ESP
at `/tmp/zeta-boot-esp` and a healthy run prints `found:
/tmp/zeta-boot-esp/zeta-authorized-keys.pub`; the failing run printed
`not in mounted FS; probing USB partitions ...` and then the DIAGNOSTICS block.
Its `lsblk` shows the image attached as `sda` (RO=1, 1.6G, mounted `/iso`) with
`sda2` at 3M and **no mountpoint** — i.e. the ESP partition was present and was
not mounted, or was mounted and was empty.

The remaining discriminator not yet tested: 35965945581 was a FULL
`workflow_dispatch`, so the eleven dispatch-only steps ran before WP11 (the
UEFI-keyfile-restore harness ran at 07:20:28, WP11 baked at 07:37); 35960376641
was a `schedule`, where those steps are skipped. A full dispatch lost the
injections, a schedule kept them.

## Why it matters beyond WP11

A lane that boots with a random hostname and no operator key is not testing the
install it believes it is testing, and it says nothing about that while it does
so. Any future ESP-carried injection inherits the same silence.

## Already landed (does not fix this)

`wp11PreconditionFailure` / `assertWp11VerdictUnitEnabled` in
`src/Core.TypeScript/ci/qemu-full-install-test.ts` (WP27,
081M392JR97087G0R003QAFH0Y) abort **during phase 1** on either observable — the
missing WP11 marker or the lost injected hostname — about two minutes in rather
than after ~100 minutes, and distinguish "the whole ESP probe came back empty"
from "only this marker is missing" so the next reader is sent at the right
producer. That makes the condition loud and fast. It does not explain it.

## Reproduce

Dispatch `build-ai-cluster-iso.yml` on `main` with **no** `only_wp11`, so the
full set of dispatch-only steps runs before WP11, and read the
`qemu-k3s-first-boot-verify-serial-log` artifact for the `[iter-4.2]` block.

---

# MEASURED 2026-09-24 (WP29) — the title is wrong, and so was the discriminator

Two hypotheses above are now falsified and the symptom is sharper than "not
found". None of this is a fix; it is what the next reader should start from.

## FALSIFIED: "a full dispatch loses them, a schedule keeps them"

| | run **36014672753** | run **36044770870** |
|---|---|---|
| trigger | `workflow_dispatch` on `main`, `only_wp11` | `workflow_dispatch` on `main`, `only_wp11` |
| steps before WP11 | discriminator, scenario 1, scenario 2 (18 min), UEFI keyfile restore (18 min) | **identical, step for step** |
| phase-1 QEMU command | — | **byte-identical** modulo tmpdir + nix-store hash |
| ISO delta | 3 commits, touching only `zeta-first-boot-k3s-verify.nix` (an *installed-system* unit) and the TS harness | |
| WP11 ESP injections | **all found**, six verdicts green | **all lost** |

Same trigger, same preceding steps, same invocation. So neither the trigger
type nor "eleven QEMU-heavy steps ran first" is the discriminator. The loss is
**intermittent**. The schedule/dispatch pairing in the table at the top of this
file is a confound: those two runs also differed in ref and ISO.

## FALSIFIED: disk pressure / ENOSPC truncating the image

Measured from both job logs, at the moment of each bake (the harness prints
`df -B1 --output=avail` on the bake's own filesystem):

- 36014672753: restore phase 1 ends with `runner free: 49.9 GiB`; 25.80 GiB
  reclaimed 1.1 s later; WP11 bakes into ~75.7 GiB free.
- 36044770870: `runner free: 49.6 GiB`; 26.10 GiB reclaimed; WP11 bakes into
  ~75.7 GiB free.

Indistinguishable, and ~75 GiB free for a 1.63 GiB image. The
`runner free: 72.9 GiB` in the failing run is measured *after* its phase 1 died
early, so it describes nothing — but the numbers above are taken at the bake.

Separately: **a truncated image does not produce this symptom.** The real
failing ISO was baked locally through this exact path and then truncated to
1 MB and 2 MB; a loop-mount of the ESP **still succeeded** both times.

## The bake is not reproducibly broken — but note what that does and does not say

The ISO artifact of run 36044770870 was pulled and the real bake path replayed
(`qemu-img convert -f raw -O raw`, then the four `mcopy -o -i img@@offset`
writes). Result: ESP mounts as vfat, all four files present, byte-exact on
read-back, `fsck.vfat` clean (10 files, 723/1525 clusters).

**That proves the bake's INPUTS are deterministic-good. It does not prove the
bytes QEMU booted were.** The baked USB image is not uploaded as an artifact,
so the thing that actually failed was never available to inspect. Those are
different claims and the difference is the open question.

Measured ISO geometry, for whoever picks this up: ESP at **LBA 268**
(offset 137 216), 6144 sectors = 3 MiB, FAT12, `mkfs.fat`, label `EFIBOOT`,
volume serial `1234-5678`. The `ISOHYBRID_ESP_OFFSET_FALLBACK_BYTES` constant
(141 312, LBA 276) is **4 096 bytes inside that ESP**, so a fallback write
would land in the middle of a live filesystem rather than missing it.

## The symptom, stated precisely

The WP27 esp-conf line from the two serials:

```
36014672753  esp-conf=none tried=EFIBOOT(no-conf),ZETA_INSTALL(no-vfat),/dev/sda1(no-vfat),/dev/sda2(no-conf)
36044770870  esp-conf=none tried=EFIBOOT(no-vfat),ZETA_INSTALL(no-vfat),/dev/sda1(no-vfat),/dev/sda2(no-vfat)
```

Four candidates in both. In the failing run **every** one refused `mount -t
vfat` — including `/dev/disk/by-label/EFIBOOT`, a symlink that exists only
because blkid had already parsed that boot sector. So udev could read the FAT
and the kernel would not mount it, and it stayed that way for the whole install
(iter-4.2 missed the pubkey, iter-5.2 missed the hostname, WP11 missed its
marker), which rules out a boot-time enumeration race that later settles.

That is a narrow failure class — `Unable to load NLS charset`, an `-EINVAL`
from the BPB, `EBUSY` on the mountpoint — and **the kernel names which one, on
stderr, every time.** Both guest probes were discarding it with `2>/dev/null`.

## FALSIFIED: "the bake took the LBA-276 fallback and wrote over the real FAT"

The most promising remaining hypothesis, and the only one that explained both
halves of the symptom at once: the fallback constant (141 312) sits **4 096
bytes inside** the real ESP (137 216), so a bake that fell back would write on
top of the FAT tables while leaving the boot sector — and therefore the
`EFIBOOT` label udev reads — untouched. Label readable, filesystem unmountable,
permanently. It also explained the intermittency, since the two runs booted
different ISOs.

It is wrong, on three independent measurements. **Both ISOs were pulled from
their run artifacts and their MBRs parsed:**

| | 36014672753 (green) | 36044770870 (lost every injection) |
|---|---|---|
| ISO size | 1 751 285 760 | 1 751 285 760 |
| ISO sha256 | `ee4d1602b293d18c…` | `94c84a355cd41107…` (different content, as expected) |
| MBR part1 | type `0xEF`, **startLBA 268**, 6144 sectors | type `0xEF`, **startLBA 268**, 6144 sectors |
| ESP | offset 137 216, 3.00 MiB | offset 137 216, 3.00 MiB |
| BPB at 137 216 | FAT, label `EFIBOOT`, oem `mkfs.fat` | identical |
| BPB at 141 312 (fallback) | **absent** | **absent** |
| pre-WP29 `detectIsohybridEspOffsetBytes`, run byte-for-byte on the exact 141 824-byte head it was given | **137 216, via the MBR branch** | **137 216, via the MBR branch** |

1. **The geometry does not vary between builds.** Both ISOs put the ESP at LBA
   268. The ISO is not the hidden variable.
2. **The fallback was never reached in either run.** The old algorithm resolves
   through the MBR branch on both heads.
3. **And if it had been reached it would have been LOUD, not silent.** There is
   no FAT boot sector at 141 312, and mtools refuses one. Measured on the real
   failing ISO:

   ```
   mcopy -o -i fb.img@@141312 payload ::/zeta-authorized-keys.pub
     exit=1   init :: non DOS media / Cannot initialize '::'
   mdir  -i fb.img@@141312 ::
     exit=1   (same)
   real ESP at 137216 afterwards: MOUNTS OK
   bytes differing inside the 3 MiB ESP vs a clean convert: 0
   ```

   A fallback bake fails at `mcopy`, so `runFileBackedZflashCli` returns
   command-failed, `prepareBootImage` errors, and the harness exits 2 in about
   two seconds. It never produces a booting guest, and it writes nothing.

**Consequence for what shipped:** `prepareBootImage`'s `fallback-unconfirmed`
refusal is a **guard, not the fix.** It turns a cryptic `init :: non DOS media`
into a named refusal one step earlier, which is worth having; it is not what
lost these injections, and this work item does not close on it.

**Still open, and now narrowed to one question:** what made the kernel refuse
`mount -t vfat` on a partition whose FAT label blkid had just read, for a whole
install, on one run and not the next, from an image whose ESP geometry is
identical and whose bake path is deterministic. The mount-error capture below
is what answers that, on the next occurrence.

## What landed, and what did not

Landed (PR for this work item):

1. `zeta-first-boot.sh` / `zeta-install.sh` now KEEP the mount error.
   `(no-vfat)` becomes `(no-vfat:<reason>)` and the iter-4.2 diagnostics block
   prints one `partition: reason` line per refusal. **The next occurrence
   reports its own cause instead of costing another ~40-minute run.**
2. `build-ai-cluster-iso.yml`: `UEFI keyfile restore decrypt` was missing the
   `&& !inputs.only_wp11` half its own upload sibling already had, so a scoped
   dispatch ran it for 15m 48s and then discarded its log. Fixed, plus
   `docs/ops/WP11-SCOPED-DISPATCH.md` and the `-F`-not-`-f` note on the input.
3. The post-bake ESP read-back walks the filesystem recursively (`mdir -/`) and
   reads every inline write's bytes back through the FAT chain (`mtype`)
   instead of listing the root directory. Measured: the old root listing exits
   0 on an image truncated to 1 MB.
4. `detectIsohybridEspOffset` now reports whether the offset was *confirmed*;
   the old function's two branches returned the same value, so its FAT-BPB
   guard could not change the answer. `prepareBootImage` refuses a
   `fallback-unconfirmed` offset rather than writing to it and then reading its
   own writes back from it as proof. The head buffer also grew from 141 824
   bytes — exactly enough to check the fallback and nothing else — to 8 MiB,
   read with a bounded `read()` instead of loading the whole ISO into memory.

  5. Every bake now LOGS the offset it used and what backed it — on the good
     case too, not only on a refusal. `[qemu-full-install-test] ESP offset
     137216 bytes (LBA 268) source=mbr — ...` in the job log. The two runs
     compared above printed identical bake lines, so answering "did this bake
     resolve the offset or guess it?" required downloading an ISO artifact and
     parsing its MBR by hand. It now requires reading one line. The post-bake
     read-back prints its own one-line result for the same reason: a bake that
     verified everything and one that verified nothing used to be
     indistinguishable in a log.

NOT closed: **why the kernel refused the mount.** Item 1 is what answers it,
and it answers it on the next occurrence rather than by another sampling run.
