---
id: 081M037KPG1087G0R0005ANAFV
type: task
state: in-progress
priority: P3
slug: zflash-linux-variant-lsblk-device-enumeration-pam-fprintd-bi
title: "zflash Linux variant — lsblk device enumeration + pam_fprintd biometric gate + pkexec fallback (flash-usb.ts is darwin-only today; recovered lost row B0738)"
created: 2026-08-15T17:30:44.097Z
depends_on: []
composes_with: []
---

# zflash Linux variant — lsblk device enumeration + pam_fprintd biometric gate + pkexec fallback (flash-usb.ts is darwin-only today; recovered lost row B0738)

> **Legacy-id rendering:** old ids appear here **without the hyphen** (`B0747`, not the
> hyphenated form). `lint-no-b-refs` forbids hyphenated legacy refs on live authored surfaces,
> and `docs/research/` + `workitems/` are live surfaces — exempting them would make that lint
> unfalsifiable. The hyphenless form is already the repo's convention in directory names.

## Provenance — recovered, not new

Resurrected from **B0738**, which never landed on `main`. Only surviving copy under
`docs/recovered-orphan-branches-2026-05/misc/backlog/b0738-b0739-zflash-linux-windows-extensions-2026-05-25/docs/backlog/P3/`
(139 lines). Alias map assigned `081KSE6WT0008QG0R003BG8M6J`; no file with that id was ever added
on any ref.

**3 live surfaces cite the phantom id**, including a shipped skill blueprint:

- `.claude/skills/agent-runtime-and-persistence/blueprints/flash-cluster-iso.md`
- `docs/backlog/P2/081KSE6WT0008QG0R003G0Y62D-cluster-install-ux-audit-*`
- `docs/backlog/P2/081KSE6WT0008QG0R000YYH3DY-reference-k8s-local-stack-*`

## The gap is confirmed in code, not inferred

`src/Core.TypeScript/zflash/flash-usb.ts:188` gates the whole flow on `platform() !== "darwin"`,
and line 192 then *prints manual instructions* rather than flashing:

```text
"  lsblk; sudo dd if=<iso> of=/dev/<device> bs=4M status=progress conv=fsync",
```

So on Linux, zflash today is a printed `dd` command.

**The asymmetry is the tell:** the sibling row (B0739, Windows) **did** get built —
`flash-usb-windows.ts` + `flash-usb-windows.test.ts` exist, `Get-Disk` is used, and "Windows
Hello" appears 32 times across the tree. Windows landed; Linux did not. That is why this row is
the still-wanted half of the pair and B0739 is not being re-minted.

Corroborating dangling pointer: `tools/setup/secret-clip.sh:28` says biometric-gated reads via
"Touch ID / Windows Hello / **fprintd**" are "the next layer — **see backlog**", pointing at a
backlog item that no longer exists.

## Assessment against three months of change (2026-08-15)

Still wanted. zflash is actively developed (10+ research docs through 2026-06, a runbook,
`src/Core.TypeScript/zflash/` with ~20 modules). Linux is the cluster-node OS, and the
zero-dev-machines direction (`081KSGS9H0008QG0R00153CQ8B`) makes Linux flashing *more*
load-bearing, not less. Nothing superseded it; it was simply dropped.

## Register

`unmetered`. Scope is concrete and bounded (one platform branch + a biometric gate), which is why
it survives triage at P3 despite low ceremony.

## Scope sketch (from the recovered row)

- `lsblk`-based device enumeration (replacing the darwin-only `diskutil` path).
- `pam_fprintd` biometric gate where fingerprint hardware is present.
- `pkexec`/polkit password fallback where it is not — the gate must degrade, never bypass.
- `tools/setup/linux.sh` integration touchpoint (the file exists today).

## Pointers

- Census + method: `docs/research/2026-08-15-lost-bnnnn-work-on-recovered-orphan-branches-census-and-triage.md`
- Sibling that landed: `src/Core.TypeScript/zflash/flash-usb-windows.ts`

## Status — 2026-08-17 (slice 1 landed)

`state: in-progress`. The FLASHER is built and merged; the wrapper integration is not.

**Landed**

- `src/Core.TypeScript/zflash/flash-usb-linux.ts` — lsblk enumeration + every rail the
  macOS and Windows arms carry (whole-disk only, `tran=usb`, not read-only, size bounds,
  no system mount point, not the disk backing `/`, exactly one candidate) + the runtime
  nonce consent gate + `pam_fprintd` gate with `pkexec`/polkit fallback.
- `src/Core.TypeScript/pam/auth-chain.ts` — the PAM `auth`-chain resolver, generalized out
  of `tools/setup/persona-keys/biometric.ts`'s `analyzeSudoAuthChain` so both hosts ask the
  same question of their own target module. Copying it would have been *wrong*: the macOS
  parser knows only OpenPAM's `auth include`, so on Debian/Ubuntu — which splice sudo's
  chain in with `@include common-auth` — it resolves to an EMPTY chain and would conclude
  the fingerprint was the only possible factor.
- `flash-usb.ts` and `cli.ts` no longer print a bare `sudo dd` line for Linux operators;
  they point at the arm that carries the rails.
- 57 tests in `flash-usb-linux.test.ts` + 19 in
  `src/Core.TypeScript/pam/auth-chain.test.ts`, all running on ANY OS with no USB stick,
  no root and no fingerprint.

**Honest limits**

- The gate reports `unattributed`, not `biometric`, on every mainstream Linux stack, and
  says why: `pam_unix.so` shares the chain with `pam_fprintd.so`, and neither `sudo` nor
  `pkexec` reports which module satisfied PAM. Same seam, same honesty as
  081M06DSQ0Q087G0R000H91391 established for macOS.
- NOT executed against real hardware. Every decision is unit-tested; no ISO has been
  written to a physical stick by this arm.

**Remaining (why this row is in-progress, not done)**

- `tools/setup/linux.sh` has no `zflash` touchpoint yet.
- A QEMU test-harness scenario driving `flash-usb-linux.ts` end to end against a
  file-backed device
  (`src/Core.TypeScript/zflash/test-harness/prepare-boot-image.ts` already builds images
  without physical USB).

## Status — 2026-08-17 (slice 2 landed: the wrapper reaches the arm)

`cli.ts` no longer refuses on Linux. The slice-1 arm existed but was unreachable through
`zflash`, which is the state this slice closes.

**The design decision worth reading**

The ESP pubkey-injection step was NOT ported verb-for-verb. The macOS flow is
flash → rescan → find FAT partition → `diskutil mount` → `sudo tee` → unmount → eject, and
the literal Linux translation (`lsblk` → `mount -t vfat` → write → `umount`) would have
introduced a **second wrong-target surface**: picking and mounting a partition on a device
whose partition table the kernel has just re-read, one step after `selectUsbCandidate`
finished guaranteeing which disk we may touch.

Instead the ESP writes are **baked into a keyed COPY of the ISO before the flash**, using
the mount-free `qemu-img` + `mtools` pipeline `lib.ts` already drives for the file-backed
(QEMU) path — `mcopy -i <image>@@<espOffset>` writes into the FAT ESP at a byte offset with
no mount, no partition choice and no root. The device write is then delegated to
`flash-usb-linux.ts` unchanged.

This is the third platform to arrive at bake-before-write: the Windows arm
(`flash-and-inject.ts`, 2026-06-14) was forced there by handle invalidation after the raw
write. Linux chooses it because it *deletes a destructive-target decision*.

**Landed**

- `src/Core.TypeScript/zflash/linux-arm.ts` — pure wiring: `flashUsbLinuxArgv` (which
  structurally cannot emit `--no-eject` — a flag the Linux arm's allowlist rejects, so the
  macOS argv would have aborted every Linux flash at the child), `planLinuxBakedImagePath`
  (refuses a device path, a non-`.iso` name, and baking in place over the operator's
  pristine cached ISO), `linuxWrapperRefusals`, `linuxBakeIsRequired`,
  `requireLinuxBakeTools` (missing `qemu-img`/`mcopy`/`mdir` REFUSES the flash — a stick
  written without the key boots a node the operator cannot log into).
- `cli.ts` — platform-selected flash arm, pre-flash bake on Linux, `injectPubkeyToUsb`
  (diskutil-shaped) never runs on the Linux path, and `--bake-cred` is refused BY NAME
  rather than silently dropped.
- `lib.ts` — `isPhysicalDevicePath` exported so both paths refuse the same shapes rather
  than drifting apart on what counts as a device.
- 29 tests in `linux-arm.test.ts`, including cross-module contract tests asserted against
  `flash-usb-linux.ts`'s **own** exported `validateIso` and `buildShortChallenge` (a
  hand-copied expectation would keep passing after the arm changed). Suite: 401 pass.

**Honest limits**

- The ESP bake MECHANISM is executed and verified: against a synthetic isohybrid ISO
  (MBR 0xEF at LBA 276 + a real `mformat` FAT), the bake wrote `zeta-authorized-keys.pub`
  and `zeta-hostname.txt`, `mdir` read both back, and the source ISO's ESP was confirmed
  still empty. That ran on **macOS**, on the same cross-platform code path Linux uses.
- **Unverified:** no Linux host was involved. `lsblk` enumeration, the `pam_fprintd` gate,
  the escalation, and the `dd` write to a real block device remain executed-nowhere. The
  wiring is typechecked and unit-tested; it has never selected a real disk.
- `--bake-cred` has no Linux path and refuses.
