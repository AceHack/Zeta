# USB boot verification in QEMU — what moved, what is costed, and the irreducible hardware remainder

**Date:** 2026-08-26 · **Lane:** installer stick + security token · **Author:** shadow

Aaron, on the ordering:

> *"we need to test every k8s yaml possible pre-hardware in workflows and CI and only
> leave the absolute minimal to real human intervention hardware testing."*

and, on the physical step specifically:

> *"not yet — only my usb after exhaustive ci/github workflow/action tests."*

So this document is a **gate, not a report**. Every row it marks `hardware-only` is a
row asking a human to do something physical with a stick in his hand — the scarcest
resource in this lane, and the only one that cannot be re-run at 3am. Each such row
therefore carries a reason someone could **dispute**, and the rows that are merely *not
yet built* are kept in a **separate section** so the two can never be confused.

The subject is `docs/security/USB-HARDWARE-SETUP-TEST-PROCEDURE.md` and its register
`src/Core.TypeScript/zflash/usb-hardware-manual-lane.ts` — ten steps, `MAN-USB-01..05`
and `MAN-TOK-01..05`. **Its results log is empty: no step has ever been executed.**
That is not neglect; it is the ordinary fate of manual steps, and it is the argument
for this whole exercise.

---

## 1. What actually moved today

`multiboot-qemu-uefi-smoke.yml` gained a second lane, `gpt-esp-usb-boot-smoke.ts`, and
it is green:

```
[gpt-esp-usb-boot-smoke] observed ZETA-GPT-ESP-USB-BOOT from a GPT ESP
(type c12a7328-f81f-11d2-ba4b-00a0c93ec93b, LBA 2048) on -device usb-storage;
1 stick enumerated as [hd0], 2 sticks as [hd0 hd1];
negative control (loader removed) correctly did NOT boot
```

Run `32977525049`, **67 seconds** for all three boots.

### Why it is a different claim from the lane that already existed

The pre-existing smoke boots a **synthesised directory** through QEMU vvfat. vvfat
manufactures its own volume, so that lane proves `BOOTX64.EFI` and `grub.cfg` are the
right files and proves **nothing about a partition table** — there isn't one anywhere in
its path. Its own source comment says so. In the vocabulary of the k8s census
(PR #15592), it is a *measured-but-never-deployed* lane: it verified an artifact was
**built**, not that it **boots**.

The new lane wraps the assembled FAT image in a real GPT — protective MBR, primary and
backup headers, a 128-entry array, one ESP at LBA 2048 — and attaches it as
`-device usb-storage` on `qemu-xhci`. Firmware has to walk the partition table, find an
ESP, mount FAT and load the removable-media default loader before the marker appears.

### Non-vacuity is structural, not asserted

Every run boots **three times**:

| phase | configuration | required outcome |
|---|---|---|
| A | one stick, loader present | reaches `ZETA-GPT-ESP-USB-BOOT` |
| B | one stick, loader **removed** | must **NOT** reach it — evaluated *first* |
| C | two sticks, distinct iSerials | firmware enumerates **two** disks |

If B reaches the marker the run fails with *"treat any green from it as vacuous"*
rather than reporting A's result. This matters in this exact file: the mtools smoke
next door was, until today, a bare `return` inside `it(...)` — which bun reports as a
**PASS** — and the test count was **15 before and 15 after** the fix. A count that does
not move is not evidence a test ran.

### Three independent GPT readers, none of them ours

- `sfdisk --json` (util-linux) inside the lane.
- macOS `diskutil`, run locally against the same image: `GUID_partition_scheme`,
  Partition Type **EFI**, Partition Offset 1048576 bytes (2048 blocks), FAT32 mounts.
- OVMF's own partition driver — the boot itself.

The CRC-32 unit tests use published check values (`0xcbf43926` for `"123456789"`), and
the ESP type GUID's mixed-endian byte sequence is written by hand rather than generated
by the encoder under test. `f(x) = f(x)` proves nothing; these do not.

---

## 2. The measurement nobody predicted, and what it cost us

`ZETA_GPT_ESP_SMOKE_MUTATE=esp-type-guid` retypes the ESP entry to Microsoft Basic
Data and re-runs. Expected: firmware declines to boot. **Measured (run `32977813494`):**

> **OVMF booted it anyway.**

OVMF's FAT driver binds to any partition carrying a FAT filesystem and never consults
the type GUID. This is a genuine finding and it costs us a claim:

- **The boot cannot falsify the ESP type GUID.** The only thing in this repository that
  enforces `c12a7328-f81f-11d2-ba4b-00a0c93ec93b` is the **static** `sfdisk` cross-check.
- The lane was changed so that cross-check runs **unconditionally** rather than only on
  unmutated runs. Skipping it under mutation would have left the `esp-type-guid` mutant
  caught by nothing — the vacuity class, reintroduced by the falsifier itself.
- `MAN-USB-05`'s standing advice — *"if firmware does not offer the stick, check the
  partition type GUID"* — is advice about **real** firmware, which may well be stricter
  than OVMF. That difference is now an explicit open hardware question rather than an
  assumption. **Register: `consistent with`, not `metered`.**

This is what the mutation knob is for. Without it the lane would have shipped claiming
coverage it does not have.

### The full mutate-red / restore-green cycle, as executed

| run | `ZETA_GPT_ESP_SMOKE_MUTATE` | result | why |
|---|---|---|---|
| `32977525049` | `none` | **green**, 67 s | marker observed; `[hd0]` / `[hd0 hd1]`; negative control did not boot |
| `32977813494` | `esp-type-guid` | **red** | *"the boot STILL reached the marker — the mutant is not falsifying"*. This is the finding above. |
| `32977847861` | `zero-gpt` | **red** | boot never reached the marker within 120 s — the partition table is load-bearing |
| `32978777533` | `remove-loader` | **red** | boot never reached the marker — the loader is load-bearing |
| `32979381604` | `esp-type-guid` (after fix) | **red** | *"sfdisk read partition type `ebd0a0a2-…`, expected `c12a7328-…` — caught by the static check, which is where the type GUID is enforced"* |
| `32979570729` | `none` (restore) | **green** | same message as the first run |

The two `esp-type-guid` rows are the same mutation with different verdicts, and the
difference is the fix between them. The first red was the check reporting *honestly that
it could not falsify what it claimed to*; the second is the mutant being caught where it
is actually catchable.

---

## 3. Step-by-step classification

Three buckets, and the third is deliberately not merged into the second:

- **COVERED** — runs in CI today, with a falsifier.
- **COSTED** — QEMU/CI *can* do it; the recipe and the runtime cost are given; **not built**.
- **HARDWARE-ONLY** — a stated physical reason someone could dispute.

| step | what it asserts | verdict |
|---|---|---|
| `MAN-USB-01` macOS | real stick reports `BusProtocol` ∈ {USB, USB-C}, `Internal` false | **split** — see §4.1 |
| `MAN-USB-01` Linux | `lsblk` reports `tran: "usb"` on a real stick | **COSTED** (§5.1) |
| `MAN-USB-02` firmware layer | two sticks → two enumerated devices | **COVERED** (phase C) |
| `MAN-USB-02` OS layer | two sticks → two `lsblk`/`diskutil` candidates; hub / card-reader collapse | **COSTED** (§5.1) |
| `MAN-USB-03` | Touch ID, not a password, gates the write | **HARDWARE-ONLY** (§6.1) |
| `MAN-USB-04` raw device path | privileged reader against `/dev/rdiskN`, real sector alignment | **split** — see §4.2 |
| `MAN-USB-04` short-read controller | a controller that returns fewer bytes than asked | **split** — see §4.2 |
| `MAN-USB-05` partition table + loader | GPT/ESP is well-formed and a UEFI firmware boots it | **COVERED** (phases A/B) |
| `MAN-USB-05` type-GUID enforcement | firmware *requires* the ESP type GUID | **HARDWARE-ONLY** (§6.2) |
| `MAN-USB-05` secure boot policy | a signed loader boots, a tampered one does not | **COSTED** (§5.2) |
| `MAN-USB-05` destination firmware | *this* machine's firmware offers *this* stick | **HARDWARE-ONLY** (§6.3) |
| `MAN-TOK-01` | a PKCS#11 token is attached and reports a stable identity | **HARDWARE-ONLY** (§6.4) |
| `MAN-TOK-02` | each token opens only its own share | **HARDWARE-ONLY** (§6.5) |
| `MAN-TOK-03` | touch presence is required for signing | **HARDWARE-ONLY** (§6.6) |
| `MAN-TOK-04/05` verifier logic | the chain verifier rejects a bad chain / an imported-key attestation | **COSTED** (§5.3) |
| `MAN-TOK-04/05` device genuineness | *this* device's attestation is real | **HARDWARE-ONLY** (§6.7) |

---

## 4. The two steps that split cleanly, with the measurement that split them

### 4.1 `MAN-USB-01` on macOS — the bus-protocol string is the whole residue

Measured locally, 2026-08-26, on a raw disk image attached with
`hdiutil attach -nomount -imagekey diskimage-class=CRawDiskImage`, read through the
**real** `diskutil`:

```
BusProtocol       'Disk Image'      <- NOT 'USB'
Internal          False             <- reproducible
RemovableMedia    True              <- reproducible
Ejectable         True              <- reproducible
VirtualOrPhysical 'Virtual'
```

and, decisively:

```
diskutil list -plist external physical  ->  ['disk6']   # the image is NOT listed
```

So a disk-image-backed device **cannot** stand in for a stick here, for two separate
reasons: it reports a third bus-protocol string, and `external physical` filters it out
before the parser ever sees it.

What *is* newly available on a hosted macOS runner: real `diskutil -plist` output for
`info` on a real device node, which is strictly better evidence than a hand-written
fixture for the **parse**. What is not available at any price without a stick: the
string a real controller emits. `isUsbCandidate()` accepts exactly two strings, and a
third would defeat it — that is precisely `MAN-USB-01`'s stated worry, and it survives.

**Verdict: parse half is COSTED (cheap); the bus-protocol string is HARDWARE-ONLY.**

### 4.2 `MAN-USB-04` — the raw path is reachable, the misbehaving controller is not

The step bundles four claims. They do not share a verdict:

| sub-claim | verdict | why |
|---|---|---|
| privileged `sudo dd` reader | **COSTED** — a loop device on a Linux runner, or `hdiutil` on macOS, goes through the real privileged path | |
| raw `/dev/rdiskN` character device | **COSTED, cheap** — measured: `hdiutil attach` *does* create `/dev/rdisk15`. A real raw character device, on a hosted macOS runner, no stick | |
| block alignment against a real sector size | **COSTED** — the kernel block layer enforces this on a loop device as much as on a stick | |
| a controller that **short-reads** | **split** | |

That last one is the interesting one, and the current framing gives away more than it
has to. *"Does this particular stick's controller short-read"* is a property of one
physical device and is irreducibly hardware. But *"does `verifyReadBack` handle a short
read, or silently pass"* is a **software** question with a software answer: inject a
short read at the reader port and assert it fails. Today we are relying on hardware to
reveal a bug in our own error handling — which is the expensive way round.

**Verdict: three quarters COSTED and cheap; the residue is "this device misbehaves",
which no emulator can invent for you.**

---

## 5. COSTED — QEMU/CI can do this, it is not built, here is the price

This section exists so that *"I did not get to it"* can never be read as
*"QEMU cannot do this"*. Nothing below is a hardware limit.

### 5.1 Linux-guest USB enumeration lane

**Covers:** `MAN-USB-01` Linux (`tran: "usb"`), `MAN-USB-02` OS layer including the
**hub** and **card-reader / multi-LUN** collapse cases the register names explicitly.

**Why it works:** QEMU emulates a real xHCI controller and a real USB mass-storage
device. A Linux guest's own USB stack enumerates it, and `lsblk -J` reports
`tran: "usb"`, `rm: true`, `type: "disk"` — the exact fields `flash-usb-linux.ts`
decides on. `-device usb-hub` reproduces the hub topology; `usb-bot` with multiple
`scsi-hd` LUNs reproduces the card reader. **These are the two upstream collapses
`MAN-USB-02` says cannot be tested, and both are emulable.**

**Recipe:** kernel + initramfs carrying `lsblk` and the `xhci_hcd` / `usb_storage` /
`sd_mod` modules; capture `lsblk -J` over serial; feed it to the existing pure parser
on the host. Or, lower-risk and higher-cost, a NixOS QEMU test — the repo already
builds installer ISOs in `build-ai-cluster-iso.yml`.

**Cost:** ~30 s to build the initramfs, ~30–60 s per scenario under TCG (no KVM on
hosted runners). Three scenarios ≈ **4 minutes** added. NixOS route: image build minutes
plus ~2–4 min boot.

**Risk:** module availability in the runner's distro kernel; must be copied from
`/lib/modules` and `modprobe`d by the init script. This is the reason it is not done
today, and it is a schedule reason, not a physics one.

### 5.2 Secure Boot policy lane — the highest-value remaining move

**Covers:** the enforcement half of secure boot. The k8s census currently files secure
boot under *"attestation against real silicon cannot be emulated"*, which is true of
**attestation** and not true of **policy**.

**Why it works:** Ubuntu's `ovmf` package ships `OVMF_CODE_4M.secboot.fd` and a
pre-enrolled `OVMF_VARS_4M.ms.fd`. Sign a loader with `sbsign` (`sbsigntool`), enrol our
own db key with `virt-fw-vars` (`python3-virt-firmware`), boot. Positive: the signed
loader boots. Negative: flip **one byte** in the signed image and firmware must refuse —
a falsifier that is trivially constructed and cannot be faked.

**Cost:** ~1 day of work; ~3 minutes of added runtime.

**What it would leave:** only key **enrolment on real hardware** (a vendor firmware's PK
in its own NVRAM) and **attestation against real silicon**. That is a much smaller
hardware ask than "secure boot".

### 5.3 Attestation-verifier lane (documented, deliberately not built here)

`MAN-TOK-04/05` bundle *"is this device genuine"* with *"does our verifier correctly
reject a bad chain"*. The second is coverable with a synthetic CA and a synthetic
attestation certificate: assert the verifier rejects a broken chain and rejects an
attestation stating the key was **imported**.

**Not implemented here, and not by this agent:** `tools/setup/persona-keys/` is another
agent's lane (PR #15564) and is out of bounds. Recorded so the next person in that lane
starts from it. **Cost:** ~half a day; seconds of runtime.

---

## 6. The irreducible hardware-only list, with a per-item reason

Each reason below is stated so it can be **argued with**. If any one of them is wrong,
that row moves to §5 and Aaron does less physical work.

### 6.1 `MAN-USB-03` — Touch ID gates the write

`pam_tid.so` talks to the Secure Enclave, a separate coprocessor with its own key
storage, and to the physical capacitive sensor. There is no software Secure Enclave and
Apple ships no simulator for it, so a fingerprint match cannot be synthesised at any
layer we can reach. The *chain-configuration* half is already automated
(`analyzeSudoAuthChain()`); the residue is the assertion *a finger was present*, which
is the one thing a biometric exists to assert and therefore the one thing no software
observation can stand in for.

**Disputable if:** someone finds a supported PAM test harness that can drive a
successful `pam_tid` conversation. We know of none.

### 6.2 `MAN-USB-05` — does firmware *require* the ESP type GUID

Measured above: OVMF does not. Whether a given vendor firmware does is a property of
that firmware's partition-driver policy, and the only way to learn it is to present a
mistyped partition to it. **This row exists because of a measurement, which is the
strongest form this list can take.**

**Disputable if:** a second emulated firmware that *does* enforce it can be obtained —
then the enforcement path becomes testable, though still not for *your* machine.

### 6.3 `MAN-USB-05` — this machine's firmware offers this stick

Boot-menu selection depends on the destination host's NVRAM boot order, its USB
controller's enumeration timing, and vendor quirks in how removable media are ranked.
None of these exist in the emulator, because the emulator is not that machine.

**Disputable if:** the target host's firmware were itself available as a QEMU image.
For commodity hardware it is not.

### 6.4 `MAN-TOK-01` — a token is attached and reports a stable identity

Enumeration goes through the vendor PKCS#11 module against a real chip. The register
records that *a driver `.dylib` present on disk is not an attached token* — that exact
confusion was a shipped bug (PR-10644). A software adapter would reproduce the
confusion rather than falsify it.

**Blocked on hardware, not software.**

### 6.5 `MAN-TOK-02` — each token opens only its own share

Requires **a second physical token**. The failure mode is that the same wrapping key was
provisioned on every token, silently collapsing the roster to 1-of-N; only two real
chips with genuinely distinct keys can falsify it. `pkcs11-multi` cannot run at all with
one token attached.

**Blocked on: a second token.**

### 6.6 `MAN-TOK-03` — touch presence is required for signing

Touch presence is a physical capacitive event, and the evidence is the *difference*
between an untouched attempt that blocks and a touched one that completes. A single
successful run proves nothing. **The YubiHSM is not touch-capable**, so this needs a
different, touch-capable token.

**Blocked on: a touch-capable token.**

### 6.7 `MAN-TOK-04/05` — this device's attestation is genuine

The attestation statement is signed by a per-device key injected at manufacture. There
is no way to produce a genuine one in software; that is the entire point of the
construction. A fixture proves the parser works and can never prove the device is real.

**Irreducible by design, not by effort.**

---

## 7. Next blocking step — what a human must physically do

Everything above `§6` is either running in CI or costed in §5. When Aaron decides CI is
exhausted, the physical session is short and its order matters, because the destructive
steps come last.

**Bring:** one USB stick you are willing to lose (4–256 GiB), the target node, one
YubiKey or other **touch-capable** PKCS#11 token, and — for `MAN-TOK-02` — **a second
token**.

1. **`MAN-USB-01`, non-destructive, 2 minutes.** Plug the stick in and run
   `diskutil list -plist external physical` then `diskutil info -plist /dev/diskN`.
   **Write down the literal `BusProtocol` string.** This is the single highest-value
   observation of the whole session: `isUsbCandidate()` accepts exactly two strings, and
   the value you record either confirms the filter or retires it. It also cannot be
   obtained any other way — measured above, a disk image reports `Disk Image` and is
   filtered out of `external physical` entirely.
2. **`MAN-USB-02`, non-destructive, 3 minutes.** Plug in a **second** stick and run the
   flasher. Expect `rc=2` before any prompt. QEMU has now confirmed that two attached
   sticks enumerate as two devices *at the firmware layer* (`[hd0 hd1]`); what you are
   checking is that the macOS enumeration path agrees. If it prompts instead of
   refusing, **do not answer the challenge** — that is a P0.
3. **`MAN-USB-03` + `MAN-USB-04`, DESTRUCTIVE, 10 minutes.** Run the flasher, answer the
   challenge, and **verify the abort path first**: press Escape at the Touch ID sheet and
   confirm a non-zero exit with no write. Then re-run and complete it with a fingerprint.
   If a **password** prompt appears instead of the sheet, record the factor honestly —
   the run was authorised by a shared secret an agent could hold.
4. **`MAN-USB-05`, non-destructive, 5 minutes.** Boot the target node from the stick.
   **If firmware does not offer it, this is now a specific question rather than a vague
   one:** the GPT is known-good (three independent parsers agree), the ESP type GUID is
   known-correct, and a UEFI firmware is known to boot it. So a refusal here isolates to
   *this* firmware's policy — record what it did, because §6.2 is exactly the row that
   would move.
5. **Token steps.** `MAN-TOK-01` with one token; `MAN-TOK-02` only once a second token
   exists; `MAN-TOK-03` only with a touch-capable token — **the YubiHSM is not one**.

**Then fill in the results table at the bottom of
`docs/security/USB-HARDWARE-SETUP-TEST-PROCEDURE.md`.** It has never had a row. An empty
row for a step is not a pass, and the last column — where an unrecognised `BusProtocol`
string or a short-reading controller gets written down — is what turns a manual step
into an automatable one next time.

---

## 8. Register and anchors

**Metered:** the GPT byte layout (golden hex vector, plus three independent readers);
OVMF's acceptance of the assembled image over `usb-storage`; two attached USB devices
enumerating as two disks under emulation; OVMF's *indifference* to the ESP type GUID
(run `32977813494`).

**Consistent with, not metered:** that a physical firmware will behave as OVMF did.
One firmware implementation is one data point.

**Speculative:** the runtime costs in §5, which are estimates from the 67-second
three-boot measurement and have not been built.

**Anchors (Beacon):**

- **UEFI Specification 2.10**, §5.3 *GUID Partition Table (GPT) Disk Layout* — protective
  MBR, the 92-byte header CRC with the CRC field zeroed, mixed-endian GUID encoding; and
  §13.3.1.3, the removable-media default loader path `\EFI\BOOT\BOOTX64.EFI`.
- **CRC-32**, IEEE 802.3 / zlib reflected polynomial `0xEDB88320`; W. W. Peterson &
  D. T. Brown, *Cyclic Codes for Error Detection* (Proc. IRE, 1961) for the underlying
  cyclic-code construction.
- **Deterministic simulation testing** — Zhou et al., *FoundationDB* (SIGMOD 2021); Will
  Wilson, *Testing Distributed Systems with Deterministic Simulation* (Strange Loop
  2014). The GPT writer is pure and seedless precisely so the image replays byte-identically.

**Pointers:**

- `src/Core.TypeScript/installer/multiboot/gpt-esp.ts` · `gpt-esp-usb-boot-smoke.ts`
- `.github/workflows/multiboot-qemu-uefi-smoke.yml` — both lanes; **not** in
  `gate (required)`'s `needs`, per the tiering rule (these lanes cannot bring their
  toolchain; promotion to blocking is the maintainer's call)
- `docs/security/USB-HARDWARE-SETUP-TEST-PROCEDURE.md` · `usb-hardware-manual-lane.ts`
- `docs/research/2026-08-26-k8s-pre-hardware-verification-census-four-depths-and-the-irreducible-remainder.md`
  (PR #15592) — the four-depth framing this document borrows, and the row that files
  secure boot as hardware-only, which §5.2 argues is half wrong
