---
id: 081M00S8RPS087G0R0003J5Q56
type: task
state: backlog
priority: P2
slug: correct-the-secure-enclave-and-yubihsm-as-owned-claims-in-th
title: "Correct the Secure Enclave and YubiHSM-as-owned claims in the code-bound key access note"
created: 2026-08-14T18:41:36.985Z
depends_on: []
composes_with: []
---

# Correct the Secure Enclave and YubiHSM-as-owned claims in the code-bound key access note

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00S8RPS087G0R0003J5Q56-*.md` glob. -->

## Why

Two claims in `docs/research/2026-08-14-code-bound-key-access-preliminary-integration-…md` do not
survive measurement. Both are load-bearing for routed work, so they should not sit uncorrected.

**1. §4 — "the hardware probe now reports [the Secure Enclave] as present-but-unusable."**
`frost-hardware-probe.ts` has **no Secure Enclave code path**. It probes Linux TPM device nodes,
`ykman`, and five PKCS#11 library paths. On the M2 Ultra it returns `noHardwareDetected: true` and
says nothing about the Enclave. The conclusion is right; the reason is wrong, and the correct one is
already recorded two files away — `frost-partial-signer.ts:110-113`: the Enclave is P-256 only
through the Keychain, exposes no AES key-wrapping primitive of the required shape, and cannot do
Ed25519 FROST partials. Curve/primitive mismatch, not a missing probe.

**2. §3 — "A YubiHSM offers domains and authentication keys."** Reads as inventory; it is
procurement. `docs/inventory/hardware-to-buy.md` §2 lists YubiHSM 2 on the **buy list** at ~$650.
No HSM is owned. This makes the note's own open question 2 unanswerable by measurement, and it
means "L1 (today)" describes a tier the fleet is not on.

Adjacent, same class, separate owner: `ace verify` on `origin/main`
(`src/Core.TypeScript/ace/ace.ts:1794`) prints "present" and returns 0 without calling
`verifySignature` or re-hashing content — the tenth could-not-fail check. Branch
`feat/ace-capability-manifest` (28f6b424bc) is titled "ace verify can now fail"; confirm it landed
rather than fixing it here.

## Done when

- §3 and §4 of the preliminary note state the measured position.
- Optional and cheap: `frost-hardware-probe.ts` gains a real macOS Enclave probe, or states in the
  header that it does not look — so no future reader infers a measurement that was never taken.

## Pointers

- `docs/research/2026-08-14-what-can-be-the-enforcer-…md` §0

---

## Resolution 2026-08-20 (Otto) — both claims corrected themselves; the reality caught up with the docs

Measured on the maintainer's Mac Studio with the YubiHSM 2 physically attached. **No credential
was read or handled and no authenticated session was opened.** Full evidence:
`docs/research/2026-08-20-the-hardware-probe-met-real-hardware-and-spusbdatatype-is-a-vacuity-trap-under-a-sandbox.md`.

**Claim 1 — RESOLVED, by the code, not by an edit.** This item said `frost-hardware-probe.ts` has
"no Secure Enclave code path", making the note's §4 sentence false. The probe now **has** one, and
documents it in its own header (§"THE SECURE ENCLAVE IS PRESENT AND NO SEAL TIER CAN USE IT").
Live output:

```
  Secure Enclave:     Present (no seal tier can use it — see header)
```

So the note's §4 — *"the hardware probe now reports [the Enclave] as present-but-unusable"* — **is
now true as written.** It was false when this item was filed. Nothing in the note needed changing;
the code caught up to it. **The `Done when` clause is satisfied by the stronger of its two arms:**
the probe gained a real macOS Enclave probe rather than merely stating that it does not look.

**What did NOT change, and must not be read as changed:** the *reason* the Enclave is unusable is
still the one this item identified — **P-256 only through the Keychain, no AES key-wrapping
primitive of the shape `frost-share-adapter` needs, no Ed25519 FROST partials.** Curve/primitive
mismatch, not a missing probe. `secureEnclaveAvailable` is `true` while `noHardwareDetected` is
**also** `true`, deliberately: letting SEP presence clear that flag would reintroduce the
driver-is-not-a-device false positive fixed on 2026-08-14.

**Claim 2 — RESOLVED by acquisition.** This item said *"No HSM is owned"*, which made the note's §3
read as inventory when it was procurement. **One YubiHSM 2 is now owned and attached** — firmware
2.4.1, serial 39160506, enumerated over USB (Yubico `0x1050`, product `0x0030`) and confirmed by an
unauthenticated `get-device-info`. So "L1 (today)" now describes a tier the fleet **is** on, for one
node.

**Partially, and the remainder is stated rather than closed:** `docs/inventory/hardware-to-buy.md`
recommends **3× YubiHSM 2** for a per-guard-node root (plus 1× NetHSM for the open/auditable axis).
**One of three is owned.** The procurement row stays open; only the "none owned" premise is retired.
Aaron 2026-08-20: *"i will buy many over time if its a secure device."*

**One buy-list row confirmed against the device rather than the vendor page:** the table credits the
YubiHSM 2 with Ed25519 / ECDSA / RSA / AES on-chip, and `get-device-info` agrees — and adds that
**`eck256` (secp256k1) is present**, which the table does not mention and which is the curve the
wallet path needs. The table's *"no in-firmware Shamir → threshold runs above it"* also survives:
**no FROST-capable mechanism is offered**, so threshold signing stays software FROST over
HSM-sealed shares.

**Still open, untouched by this resolution:** the adjacent `ace verify` finding in this item's body
(`ace.ts` printing "present" and returning 0 without verifying) has a **separate owner** and is not
addressed here — flagged so this resolution is not misread as closing it.
