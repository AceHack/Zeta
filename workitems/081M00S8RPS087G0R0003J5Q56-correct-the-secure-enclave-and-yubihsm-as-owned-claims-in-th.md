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
