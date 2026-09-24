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
