# First real HSM hardware capture — two vendors, both provisioned

**Date:** 2026-09-08. **Measured on** the maintainer's box, by an agent running on that box with the
devices physically attached. Aaron 2026-09-08: *"we support the smartcard hsm too, it's attached to
this box, there has been some code on this but not from an agent that's attached to this box where
we have one plugged in."*

That is the whole point of this document. The smartcard/HSM support in this tree was written
**blind** — by agents with no device present — and this is the first capture taken with the hardware
in the reader.

**Read-only.** Enumeration and identification only. No PIN was presented, nothing was written, no
object was created or destroyed. A PIN attempt against an initialised token risks a lockout, and a
measurement is not worth a bricked device.

## What is actually attached

| reader | device | token label | manufacturer | state |
|---|---|---|---|---|
| 0 | Yubico YubiKey FIDO+CCID | `PIV_II` | `piv_II` | initialized, PIN initialized |
| 1 | Identiv uTrust Token Flex → **SmartCard-HSM version 4.1** | **`zeta-test-token`** | `www.CardContact.de` | initialized, PIN initialized |

Both report `PKCS#15 emulated` with flags `login required, rng, token initialized, PIN initialized`.
Serial numbers are deliberately **not** recorded here: this repository is public and a serial
identifies a specific physical device. Model, vendor and version are enough to settle every claim
below.

**So "two manufacturers" is confirmed on hardware** — Yubico and CardContact — and the SmartCard-HSM
is not merely present but **already provisioned for this project**, carrying a token labelled
`zeta-test-token`. Somebody set it up; nothing in the tree records that they did.

Tooling present: `opensc-tool`, `pkcs11-tool`, `p11tool`, `yubico-piv-tool`, `ykman`. `pcscd` is not
running, which is expected on macOS — CryptoTokenKit provides the reader stack, and `opensc-tool -l`
enumerates both readers regardless. Note `security list-smartcards` returns *"No smartcards found"*
on the same box at the same moment: **two OS-level surfaces disagree**, and a probe that consulted
only the second would report absence with total confidence.

## What this refutes in the tree

`tools/setup/persona-keys/named-probe-from-frost.ts:37` hardcodes:

```ts
smartcardHsm: false,
```

On this box that value is **factually wrong**. A SmartCard-HSM v4.1 is attached, initialised, and
labelled for Zeta.

**The hardcode is not simply an oversight, and that is what makes it interesting.** The file's own
header states the discipline it is following: *"A YubiKey / CCID reader does not set
`smartcardHsm`"* — a deliberate refusal to infer an HSM from the presence of a reader, exactly
parallel to its refusal to upgrade `tpm2` from `/dev/tpmrm0`. That refusal is **correct**. The
defect is what it wrote instead.

The same header says: *"Null is unmeasured, not absent."* But `false` is not null. It says **absent**,
about a device the mapper never looked for.

## The type is what makes the mistake unavoidable

`src/Core.TypeScript/cluster/host-seal-profile.ts`:

```
Tpm2CaptureState     = "present" | "absent" | "unreadable" | "unavailable" | "indeterminate" | "not-asked"
YubiHsm2CaptureState = "attached" | "absent" | "indeterminate" | "not-asked"
smartcardHsm         : boolean
```

TPM and YubiHSM each carry an explicit **`not-asked`**. `smartcardHsm` — along with
`smartCardReaderAttached` and `yubikeyDetected` — is a bare boolean with **no way to express
"unmeasured"**. So a mapper that does not measure has only two options, and both are lies: `true`
claims presence, `false` claims absence.

**And the field is already being read with two different meanings, in the same file.**

- `host-seal-profile.ts:145` — `if (capture.smartcardHsm) return "smartcard-hsm";`
  Here `false` means **absent**: the oracle is not selected.
- `host-seal-profile.ts:163` — `automaticOracleUnprobed` returns
  `tpm2 === "not-asked" && yubiHsm2 === "not-asked" && !capture.smartcardHsm`.
  Here `false` counts toward **unprobed** — i.e. it is read as *"we did not look"*.

One field, two incompatible readings, decided by whichever function happens to consult it. Its
siblings have `not-asked` precisely so that this cannot happen to them. `:172` repeats the pattern
inside `automaticCheckDidNotRun` — the function whose entire job is telling a check that did not run
from one that ran and found nothing.

## Why this matters beyond tidiness

`unseal-path.ts` routes the seal decision through `smartcardHsmAccessible`, which is a direct read of
this boolean (`:195-196`), and it is consulted at four decision points (`:320`, `:330`, `:357`,
`:398`) including the `pkcs11-smartcard` selection. So a value that is hardcoded, unmeasured, and
already wrong on real hardware feeds the choice of unseal path.

Under the standing constraint that the hardware should be **controlled by the AI and the code after
bootup, without human intervention**, the smartcard/HSM path is not a convenience — it is the
mechanism that replaces a person at the console. A field that cannot say *"I did not look"* is a poor
foundation for that decision, and one that says `false` while the device sits in the reader is worse.

## What is NOT claimed here

- **Nothing about the device's keys.** No PIN, no login, no object enumeration beyond slot metadata.
  Whether `zeta-test-token` holds usable key material is unmeasured.
- **Nothing about NixOS.** This capture is macOS. On NixOS the relevant blocker is separate and
  already recorded: `host-seal-profile.nix:61` gates `pcscd` and the YubiHSM udev rules on
  `zeta.hostSeal.boxRole`, and **no host sets it**, so the reader stack is off there regardless of
  what is plugged in.
- **No fix is applied by this document.** Changing `smartcardHsm` to a capture state touches ~50
  sites across ten files including the seal-oracle decision, and that is a change to make
  deliberately with the suite green, not as a footnote to a measurement.

## The falsifier this suggests

The cheapest one: a probe that reports `not-asked` when it did not look, run on this box, must not
say `false`. Today the type cannot express the difference — which is why the first honest step is the
type, not the probe.
