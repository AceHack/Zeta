---
id: 081M24BB3TD087G0R001PJTW9A
type: bug
state: backlog
priority: P2
slug: zflash-qemu-scenarios-3-and-4-boot-legacy-csm-because-buildq
title: "zflash QEMU scenarios 3 and 4 boot legacy CSM because buildQemuSystemBootArgs passes no OVMF pflash"
created: 2026-09-10T00:26:35.213Z
depends_on: []
composes_with: []
---

# zflash QEMU scenarios 3 and 4 boot legacy CSM because buildQemuSystemBootArgs passes no OVMF pflash

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24BB3TD087G0R001PJTW9A-*.md` glob. -->

## The measurement

Dispatch run 34410308790 (2026-09-09/10, `main` @ cf6de5aa), the first run on a SHA
carrying PR #17130's serial tail. Scenarios 3 and 4 both failed identically:

```
timeout (1800000ms) waiting for serial markers: ZETA CLUSTER NODE INSTALL COMPLETE.
last 40 serial line(s):
  ...
  [R7] No keypress; proceeding (headless default preserved).
  [R9-breaker] ledger not writable; this attempt is NOT counted (breaker stays blind next boot)
  ERROR: not booted in UEFI mode (/sys/firmware/efi absent). This ISO is hybrid, so it
  will boot in legacy/CSM and then fail at bootloader install AFTER the disk has been
  wiped. Reboot and choose the 'UEFI:' entry for this USB device.
```

**The serial tail did exactly the job it was added for.** The hypothesis on file was
"the guest never started". It is refuted: the guest booted, ran `zeta-first-boot`, ran
discovery, probed the disks, and ran the 60-second wipe countdown. It then hit a
FAIL-CLOSED refusal from the installer, which is behaving correctly.

## The cause, confirmed in code

There are TWO QEMU launchers in this harness, with different firmware:

| scenario                                                      | launcher                                                             | firmware                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2 (`boot-cluster-up`)                                         | delegates to `ci/qemu-full-install-test.ts` (`run.ts:20`, `:243`)    | resolves `OVMF_FIRMWARE_CANDIDATES` and passes `if=pflash,...` — **UEFI**               |
| 3, 4 (and every non-`boot-cluster-up` scenario, `run.ts:381`) | `buildQemuSystemBootArgs` in `zflash/test-harness/qemu-state.ts:497` | `-machine q35` and **no pflash at all** — QEMU defaults to **SeaBIOS**, i.e. legacy/CSM |

So scenario 2 passes the UEFI check and scenarios 3/4 cannot. This is a defect in the
HARNESS's QEMU configuration, not in the installer and not in zflash.

Secondary confirmation: scenarios 3/4 take the `bootMedia.kind === "usb-image"` branch
(`multi-vm.ts:329`, `path-fork.ts:191`) while scenario 2 takes `kind: "iso"`
(`multi-vm.ts:296`). Both branches are downstream of the same missing pflash, so the
media kind is not the cause — it only changes which SeaBIOS boot path is taken.

## Cost this is burning today

Each of scenarios 3 and 4 waits the full `1800000ms` for a marker that CANNOT arrive:
the installer has already printed a fatal `ERROR:` line. That is **~60 runner-minutes
per dispatch spent proving a determined failure**. A second finding sits inside this
one: the harness has no fail-fast on a known-fatal serial marker, so any deterministic
guest-side refusal costs the whole timeout.

## Proposed shape (NOT landed — needs a round and a dispatch to verify)

1. `buildQemuSystemBootArgs` takes UEFI firmware the same way `qemu-full-install-test.ts`
   does. `OVMF_FIRMWARE_CANDIDATES` is already `export`ed from that file
   (`qemu-full-install-test.ts:157`), and `prepareWritableOvmfVars` already exists — so
   the resolution logic is reusable rather than reinvented.
2. **Each VM needs its OWN writable `OVMF_VARS` copy.** `multi-vm.ts` boots more than one
   guest; sharing one VARS file would have two guests writing the same NVRAM.
3. A FAIL-FAST marker set: `ERROR: not booted in UEFI mode` (and siblings) should abort
   the wait immediately instead of burning 30 minutes. This is worth doing on its own
   merits even if 1 and 2 slip.
4. A falsifier that `buildQemuSystemBootArgs` emits `if=pflash` — with a mutation control
   proving it goes red when the firmware args are dropped. Without that, this fix is one
   refactor away from silently reverting.

## Why it is filed rather than fixed here

Verifying it requires a `workflow_dispatch` of `build-ai-cluster-iso`, which measures
~2.5 h wall clock, and item 2 is a real design decision about per-VM NVRAM in the
multi-VM harness. Landing a CI behaviour change unverified is the thing this audit is
about.

## Blocked-on-another-lane note

The same dispatch showed scenario 2 RED on `main` for an unrelated cause — `install.sh`
exits 1 on first boot because the rolling `tla2tools.jar` pin no longer matches upstream
(`from-url` row `sha256=bb82311b...`; upstream `v1.8.0/tla2tools.jar` now measures
`8836549e83db7f0b3f9fdde679ab56270d18e06198366d217d960738c02b9dbe`). That is owned by
PR #17178 / workitem 081M243P7N2087G0R001541V8M and is NOT duplicated here.
