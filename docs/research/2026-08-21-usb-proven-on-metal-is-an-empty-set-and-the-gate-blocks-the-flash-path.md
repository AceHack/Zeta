# USB stick: proven-on-metal is an empty set, and the gate I landed tonight blocks the flash path

**Gap analysis, 2026-08-21.** Answering *"a full inventory of what was asked of the usb stick and where
we are now — what are we still missing."* **No device was written to; read-only `diskutil` only.**

> **One-line answer: nothing has ever been flashed to a physical stick and booted.** Every capability
> is either proven *in QEMU* or unproven entirely — and as of PR #13030, **`zflash` cannot complete a
> flash at all**, because the new integrity gate has no supply path.

## 1. The blocker, measured — and it is worse than predicted

The gate looks for exactly three paths beside the ISO. Replayed against the real `~/Downloads`:

```
ISO           : zeta-installer-25.11-ci27181806800-2026-06-09.iso
manifest found: /Users/acehack/Downloads/SHA256SUMS
gate ok       : false
refusal reason: iso-not-in-manifest
```

**The refusal is not `manifest-missing` as the landed docs predicted.** There *is* a `SHA256SUMS` —
**it belongs to Bitcoin Knots** (28 entries, Sep 2025, zero mention of zeta). The gate finds it,
parses it happily, and refuses while printing 28 bitcoin filenames.

> **Looking up a bare well-known filename in a shared download directory is a namespace collision,
> not a per-ISO manifest.**

And **CI produced none of the three files.** The digest was written only to `$GITHUB_OUTPUT` and the
step summary; aarch64 emits no digest and no signature; and `cli.ts` writes no manifest when it
downloads a fresh ISO. **Both routes to an ISO produce something the gate refuses. The gate is
correct; it had no source of truth.** *(Fixed in this same change — §7.)*

## 2. Two rules that cannot fire in production

**R1 is dead code on the live path.** It detects *"labelled `ZETA_INSTALL` but the head digest
disagrees"* and needs two digest fields. The only production call site passes three fields and **omits
both** — the sole supplier is the test file.

> **Consequence: a stick that was labelled but whose bytes are wrong classifies as `provisioned`** —
> precisely the dangerous misread R1 was written to prevent. **Green in tests, unreachable in life.**

**The first identity check is vacuous by default.** `expectedIdentity` falls back to
`observedIdentity` field-by-field, so with no `--expect-*` flag it **compares observed to itself**. The
code prints `UNPINNED TARGET` — a warning, never a refusal — and **`cli.ts` never passes `--expect-*`**,
so the common path is always unpinned. The *second* call, re-read immediately before the write, **is**
load-bearing and does work.

Also: **only `unrecognized` blocks.** `half-provisioned` is printed and then proceeds to the destroy
prompt. **Detection landed without policy.**

## 3. The stick, classified on real evidence

`/dev/disk6` — PNY "USB 3.2.1 FD", 124.0 GB, `FDisk_partition_scheme`, one `0xEF` partition of
3,145,728 bytes, no filesystem — fed verbatim to the real classifier:

```
state = half-provisioned   rule = R4   alloc = 3145728
reason = ...less is allocated than the smallest ISO we would write (209715200),
         so a write started and stopped
```

**Measured, not cited. The classifier works.**

## 4. The three-way split

| | |
|---|---|
| **Proven** | ISO builds (x86_64 + aarch64) · QEMU boot to login · cosign signing of the x86 ISO · 494 zflash + 365 installer tests, all hermetic |
| **Built, unproven on hardware** | every zflash safety rail · the integrity gate · the device-state classifier · read-back verify · ESP injection · WiFi credential injection · role picker · self-registration |
| **Missing** | repair · reformat · bad-block / media health · mid-flash recovery · **provenance verification** · **pre-format existence check on the target disk** · multi-platform parity |

> **Proven-on-metal is an empty set**, and the repo's own ladder says so: tiers S0–S4 green, **S6
> (physical boot) has never run.** Two P2 bugs have sat in backlog for **12 days** carrying the
> identical close condition, verbatim: **"one clean boot on Aaron's hardware."**

## 5. Asked and never built — the highest-value rows

Primary source, 2026-06-09, verbatim:

> *"check if the partition exists every time before formatting; ask the questions BEFORE formatting;
> format and persist/repersist right after — **do this now**"*

**73 days ago.** Refined the same day: *"it should NOT ask before format — it should ask to CANCEL for
a minute before format; this USB should fully boot headless."*

**Status today, measured in `zeta-install.sh`:** the pre-format existence check **does not exist** —
`wipefs -af` runs over *every* internal disk, and the only pre-checks are capacity and set-membership.
The 60-second cancel window **does not exist** — the only "Ctrl-C to cancel" is *after* install, before
reboot.

**And worse:** `zeta-first-boot.sh` exports `ZETA_AUTO_CONFIRM=WIPE`, which the script honours by
skipping the typed prompt. **On the default zero-typing path every internal disk is wiped ~30–130 s
after power-on, and the OS is then installed from an unpinned, unverified `git clone` of `main`.**

> **The structural miss: tonight's classifier landed on the USB-STICK side (the macOS flasher). The
> 2026-06-09 ask was about the TARGET-DISK side. Detection is on the wrong side of the wire.**

Other asks with no row anywhere: USB-as-repair-disk (*"am I already running on this? Let me recover any
hardware IDs and reinstall"*, 2026-05-25) · the repair-loop circuit-breaker + validate-before-wipe
flagged **P0** on 2026-06-09 · unifying the three flashers · Windows Hello parity.

## 6. Other measured findings

- **No platform parity.** All four new gates are **macOS-only** — the Linux and Windows arms import
  nothing from `verify.ts`. And **`MIN_ISO_BYTES` is now defined three times**, despite `verify.ts`'s
  own comment claiming it is exported centrally *"so they cannot drift apart."*
- **Windows read-back is narrower than advertised** — it verifies a small SSH-pubkey text file written
  to the ESP, **not the ISO image.**
- **Signing exists; verification does not.** `cosign verify-blob` appears **nowhere in executable
  code** — only in comments and step-summary echoes.
- **aarch64 downgrades TIMEOUT and STALLED to advisory**; only BOOT-FAILED exits 1. The workflow's own
  comment is honest: *"This gate catches images that fail to boot, not images that hang."*
- **The new tests run but do not gate** — `test (TS hermetic)` is *"deliberately absent from the
  `gate-required` needs list."* **26 passing verify tests are signal, not a gate.**
- **Every operator document is stale** — the runbook, the first-metal preflight and both blueprints
  contain **zero** mentions of the manifest, `--expect-*`, device state, or read-back. **The
  preflight's failure-signature list does not include the refusal you will actually hit.**
- **Both local ISOs are pre-fix** (Jun 9 and Jun 21), predating the 2026-08-09 fixes that made
  first-boot install work. **Flashing either reproduces a bug that is already fixed.**

## 7. The smallest next step — and it is applied in this change

**Have CI write a per-ISO digest manifest beside the image and upload it.** Done here: the x86_64 job
now writes `<iso>.sha256` and uploads it as its own artifact.

**Written per-ISO rather than as a bare `SHA256SUMS`, deliberately** — §1 is the reason, and it is
measured rather than theoretical: a stray Bitcoin Knots manifest already hijacked the lookup on the
maintainer's machine. **A per-ISO sidecar cannot be hijacked that way.**

This is the keystone because it **unblocks the flash path** (currently hard-stopped), turns the
integrity gate from refusing-everything into a working check, makes the whole verify-before-write half
**exercised rather than merely present**, and is a prerequisite for everything downstream — **you
cannot read-back-verify a write you were never allowed to start.**

Then, in order, each small: fix the manifest lookup to prefer the per-ISO sidecar and require the
basename to match · **pass the head digests at the classifier call site so R1 can fire** · have
`cli.ts` pass `--expect-*` from the device it just showed you · refresh the runbook and blueprints ·
**emit the same manifest from the aarch64 job**, which still emits nothing.

**Then the one act no agent can do:** flash and boot. That single act closes two open P2 bugs, moves S6
from never-run to attempted, and **converts the entire "built, unproven" column into evidence.
Everything else here is preparation for it.**

The destructive command, device named explicitly — **for a human, and note the ISO must be a
post-2026-08-09 build, not the stale ones in `~/Downloads`:**

```
diskutil unmountDisk /dev/disk6
sudo dd if=<verified-iso> of=/dev/rdisk6 bs=4m conv=sync status=progress
diskutil eject /dev/disk6
```

### Verification note (Otto, landing this)

The CI change is mine, applied on the strength of the measurement above; `actionlint` passes on the
edited workflow. **The digest emission is designed-but-unrun** — it has not executed in CI yet, and the
first ISO build after this lands is what proves it. The refusal replay, the classifier verdict on
`/dev/disk6`, and the dead-R1 call-site analysis are **measured**.
