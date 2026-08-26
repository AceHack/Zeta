# USB hardware setup — test procedure

**Owner:** Nazar (security-operations-engineer) · **Written:** 2026-08-23

This document is the manual half of a deliberate split. Everything in the USB
hardware setup path that can be checked without a device attached **is** checked,
automatically, on every run. What is written here is the residue: the checks that
need a stick in a port or a token in a slot, and that no CI runner will ever run.

The register these ids come from is
`src/Core.TypeScript/zflash/usb-hardware-manual-lane.ts`, and
`usb-hardware-manual-lane.test.ts` fails if this document drifts from it — an id
here that is not in the register, or a register entry not written up here, is a
test failure rather than a discovery six months later.

---

## 0. The two USB paths, and what each already has

Zeta has **two** USB hardware paths. They are unrelated devices with a shared
property: the interesting behaviour is physical.

| | installer stick | security token |
|---|---|---|
| what it is | a flash drive holding the NixOS installer ISO | a YubiKey / YubiHSM / SmartCard-HSM holding a FROST share |
| code | `src/Core.TypeScript/zflash/` | `tools/setup/persona-keys/` |
| automated coverage | `flash-usb.test.ts` (macOS), `flash-usb-linux.test.ts`, `flash-usb-windows.test.ts` | `frost-share-adapter.test.ts`, `frost-token-roster.test.ts` |
| hardware lane | this document | `frost-share-adapter.hardware.test.ts` (opt in via `ZETA_FROST_HARDWARE_LANE`) |

### What moved from manual to automatic on 2026-08-23

Before this change the macOS arm of the flasher — the arm the maintainer's own
laptop runs — had **no test file at all**, and did not appear in
`bun test --coverage src/Core.TypeScript/zflash/` because no test ever imported
it. It could not have had one: the module called `main()` at file scope with no
`import.meta.main` guard, so importing it ran the flasher.

Both are fixed. The following are now asserted with no hardware present, and are
**deliberately absent** from the manual list below:

- the flag allowlist, including misspelled near-misses (`--shrot`) and value
  flags given with no value
- the `diskutil` plist parse, including malformed input
- the USB / USB-C bus filter and the `Internal` refusal
- zero / one / **many** target selection — the many case is a refusal, not a picker
- the ISO gate and both size bounds, at the exact boundary
- the boot-disk parse and the `disk3` vs `disk30` comparison
- device-path shapes, including partition paths and injected newlines
- consent-challenge construction, nonce freshness, and the exact-match comparison

---

## 1. Before you start

**Read-only preconditions.** None of these steps prints key material, and none of
them should be modified to. Where presence of a secret matters, prove presence —
exit status, length, a fingerprint — never the value.

**Two steps are destructive** (`MAN-USB-03`, `MAN-USB-04`). They overwrite the
target stick completely. Use a stick you are willing to lose. Do not run them
against anything you have not first identified with `MAN-USB-01`.

**Key rotation is out of scope for this document.** No step here rotates,
deletes, or re-provisions a key. Rotation requires the ceremony
(human maintainer + witness) and is owned elsewhere.

Record results as a dated table at the bottom of this file, or in an incident
writeup under `docs/security/incidents/` if any step fails.

---

## 2. Installer-stick procedure

### MAN-USB-01 — the stick enumerates with a USB bus and is not internal

Non-destructive. Run first; every later step depends on knowing which `diskN` is
the stick.

```bash
diskutil list -plist external physical | plutil -convert json -o - -
# then, for the DeviceIdentifier you find:
diskutil info -plist /dev/diskN | plutil -convert json -o - -
```

**Expected.** `AllDisksAndPartitions` contains the stick's `DeviceIdentifier`.
The `info` output shows `BusProtocol` of exactly `USB` or `USB-C`, `Internal`
`false`, `RemovableMedia` `true`, and `TotalSize` between 4 GiB and 256 GiB.

**Why it cannot be automated.** The values come from the USB controller via
IOKit. A fixture proves the *parse* is right and says nothing about what a real
SanDisk reports on this Mac's controller — and `isUsbCandidate()` accepts exactly
two bus strings.

**On mismatch.** A third `BusProtocol` string means the filter is incomplete for
this controller. Record the exact string and file it **before** flashing.

---

### MAN-USB-02 — two attached sticks produce a refusal, not a choice

Non-destructive: the refusal fires before any prompt.

```bash
# Plug in TWO USB sticks.
bun src/Core.TypeScript/zflash/flash-usb.ts <iso-path>
echo "rc=$?"
```

**Expected.** `rc=2`, before any challenge is printed. stderr lists **both**
devices with size and model, then:

```
refusing to pick one. Unplug all but the target USB and re-run, OR
use manual flow: sudo dd if=<iso> of=/dev/rdiskN bs=4m
```

**Why it cannot be automated.** `selectUsbTarget()` is proven on arrays. What is
unproven without hardware is that two plugged-in sticks actually produce two
enumerated candidates — a hub or a card reader presenting one node for two
devices would defeat the rail *upstream* of the tested function.

**On mismatch.** If it selects one and prompts: **stop, do not answer the
challenge.** Enumeration is collapsing two devices into one candidate. That is a
P0; file it in `docs/BUGS.md`.

---

### MAN-USB-03 — Touch ID, not a password, gates the write

**DESTRUCTIVE.** Completing this step overwrites the target stick.

First establish that the PAM chain is configured (this part is non-destructive):

```bash
grep -n pam_tid /etc/pam.d/sudo /etc/pam.d/sudo_local 2>/dev/null
echo "rc=$?"
```

Then run the flasher and answer the challenge:

```bash
bun src/Core.TypeScript/zflash/flash-usb.ts --short <iso-path>
```

**Expected.** After the `yes <4-hex>` challenge is answered, the macOS Touch ID
sheet appears and waits. A fingerprint proceeds. **Escape aborts with a non-zero
exit and no write** — verify the abort path first, then re-run and complete it.
No password is typed at any point.

**Why it cannot be automated.** `pam_tid.so` talks to the Secure Enclave and the
physical sensor. `analyzeSudoAuthChain()` proves the chain is *configured*; only
a finger on the trackpad proves the biometric actually gates the write.

**On mismatch.** A password prompt instead of the Touch ID sheet means the
biometric factor was **not** established — the run is authorised by a shared
secret an agent could hold. Treat the resulting flash as unattributed and record
the factor honestly (`biometric.ts` `establishedFactor()`), rather than claiming
a biometric that did not fire.

> This is the standing constraint made concrete: the agent executes the setup,
> the human approves the sensitive gate, and **the biometric is the
> authorization**. A password at this prompt breaks that property silently.

---

### MAN-USB-04 — the read-back verify compares real written media

**DESTRUCTIVE.** Usually observed as part of the same run as `MAN-USB-03`.

```bash
bun src/Core.TypeScript/zflash/flash-usb.ts <iso-path>
# complete the accept-destroy challenge
echo "rc=$?"
```

**Expected.** After `dd`, the read-back stage runs to completion and reports a
match; `rc=0` and `Flash complete.` The stick then mounts with the `ZETA_INSTALL`
volume label.

**Why it cannot be automated.** `verifyReadBack()` is tested against file-backed
readers. Only a real device exercises the privileged `sudo dd` reader, the raw
`/dev/rdiskN` path, block alignment against a real sector size, and a controller
that may short-read.

**On mismatch.** The bytes on the stick are not the bytes that were verified.
**Do not boot it.** Re-flash; if it mismatches twice, the stick is failing —
discard it.

---

### MAN-USB-05 — the stick actually boots the target machine

Non-destructive to the stick; boots the target node.

**Expected.** Firmware offers the stick in the boot menu; selecting it reaches
the Zeta installer's first serial marker.

**Why it cannot be automated.** This is firmware behaviour on the destination
host. Nothing in this repository can observe a UEFI boot, and every check above
can be green while firmware still declines to select the stick.

**On mismatch.** If firmware does not offer the stick, the ESP is not being
recognised. Check the partition type GUID
(`c12a7328-f81f-11d2-ba4b-00a0c93ec93b`) before re-flashing.

---

## 3. Security-token procedure

These steps do **not** replace `frost-share-adapter.hardware.test.ts` — they
point at it. That lane already has the property that matters: opting in asserts
hardware is attached, so opting in **without** hardware fails rather than skips.

> **Prerequisite — provision the wrapping key first, and check before you assume.**
> Every step below needs an AES-256 key labelled `zeta-frost-wrap` on the token.
> A factory device does not have one, and until 2026-08-26 that state was
> indistinguishable from a broken device: both exited 1. It now has its own exit
> code, so **read it before debugging hardware**:
>
> ```bash
> bun tools/setup/persona-keys/frost-hsm-provision.ts status
> # rc 0 = provisioned · rc 3 = reachable but NOT provisioned (expected; one command away)
> # rc 1 = unreachable — a REAL failure, and the STAGE line names which of eight
> ```
>
> On rc 3, `… frost-hsm-provision.ts plan` prints the exact command with the
> password redacted and touches nothing; `… apply --apply` raises the ceremony
> brief and the biometric prompt. Declining leaves the device byte-for-byte as it
> was. This is **not** a manual step and is deliberately absent from the register
> below — it is committed, tested code behind `ceremony-gate.ts`'s
> `provision-or-reconfigure-hardware-token`, not a snippet to retype.
>
> For **MAN-TOK-02** specifically, run it once per token: each device needs its
> **own, distinct** wrapping key. Provisioning the same key on every token is the
> silent 1-of-N collapse that step exists to catch.

### MAN-TOK-01 — a token is attached and reports a stable identity

```bash
bun tools/setup/persona-keys/frost-token-roster.ts tokens <path-to-pkcs11-module>
echo "rc=$?"
```

**Expected.** One line per attached token as `label#serial`, and the serial
matches the number printed on the outside of the device. No key material is
printed.

**Why it cannot be automated.** Enumeration goes through the vendor PKCS#11
module against a real chip. **A driver `.dylib` present on disk is not an
attached token** — that exact confusion was a shipped bug (PR-10644).

**On mismatch.** An empty list with the device plugged in means the module path
is wrong or the token is claimed by another process. **Do not fall back to a
software adapter.**

---

### MAN-TOK-02 — each token opens only its own share

```bash
ZETA_FROST_HARDWARE_LANE=pkcs11-multi \
ZETA_FROST_PKCS11_LIB=<module> \
ZETA_FROST_PKCS11_PIN=<pin> \
ZETA_FROST_PKCS11_TOKENS='<a#serial>,<b#serial>' \
bun test ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts
echo "rc=$?"
```

Do not put the PIN in shell history; read it from your credential store.

**Expected.** HW-6 through HW-11 pass. HW-9 in particular shows every
cross-token load throwing `wrong token for share x=`.

**Why it cannot be automated.** The failure mode is silent and physical:
provisioning the same wrapping key on every token (one PIN, plus a spare) makes
any token open any share, with nothing in the artifact to show it.

**On mismatch.** If HW-9 fails, the roster has silently collapsed to 1-of-N —
the threshold you believe you have is not the threshold you have. Stop and
re-provision distinct wrapping keys.

---

### MAN-TOK-03 — touch presence is required for signing

**Expected.** With touch policy on: an untouched signing attempt **blocks** until
timeout; the same attempt with a touch completes. The difference between the two
runs is the evidence — a single successful touched run proves nothing.

**Why it cannot be automated.** Touch presence is a physical capacitive event. No
software observation distinguishes "the token required a touch" from "the token
signed unattended" after the fact.

**On mismatch.** If the **untouched** attempt succeeds, touch policy is not
enabled on that key. An unattended signer is a different threat model from the
one the custody design assumes — record it before relying on the key.

---

### MAN-TOK-04 — the attestation chain verifies to the vendor root

```bash
# Export the attestation cert and intermediate from the token using the vendor
# tool, then:
openssl verify -CAfile <vendor-root> -untrusted <intermediate> <attestation-cert>
echo "rc=$?"
```

**Expected.** `rc=0` and openssl reports `OK`. The attestation extension states
the key was **generated on the device**, not imported.

**Why it cannot be automated.** The attestation statement is signed by a
per-device key injected at manufacture. There is no way to produce a genuine one
in software — a fixture proves the parser works and never that the device this
repo will trust is genuine.

**On mismatch.** A chain that does not verify, or an attestation saying the key
was **imported**, means the private key may have existed off-device. Do not enrol
it as a custody share.

---

### MAN-TOK-05 — key generation happened on the device

**Expected.** Generate the key with the vendor tool's **on-device** generate
operation, then re-run `MAN-TOK-04` against the resulting attestation; it
confirms on-device origin for the new key handle.

**Why it cannot be automated.** This is a claim about what did *not* happen on a
bus. Only the device's own attestation, read from the device, can support it.

**On mismatch.** If the tool silently generated in software and imported, every
downstream custody claim about that share is overstated. Treat the share as
compromised-by-provenance.

---

## 4. Results log

Append one row per execution. An empty row for a step is not a pass.

| date (UTC) | step | operator | result | notes |
|---|---|---|---|---|
| — | — | — | — | *no hardware execution recorded yet* |

The last column is where a `BusProtocol` string we have not seen, or a controller
that short-reads, gets written down. Those are the observations that turn a
manual step into an automatable one.

---

## Pointers

- `src/Core.TypeScript/zflash/usb-hardware-manual-lane.ts` — the register these ids come from
- `src/Core.TypeScript/zflash/flash-usb.test.ts` — the automated half for the macOS arm
- `tools/setup/persona-keys/frost-share-adapter.hardware.test.ts` — the token hardware lane
- `registry/unexecuted-test-files.json` — why the token lane is out of the whole-suite gate
- `docs/security/THREAT-MODEL.md` · `docs/security/SECURITY-BACKLOG.md`
