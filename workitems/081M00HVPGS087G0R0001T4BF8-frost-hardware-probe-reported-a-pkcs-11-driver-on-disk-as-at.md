---
id: 081M00HVPGS087G0R0001T4BF8
type: bug
state: backlog
priority: P2
slug: frost-hardware-probe-reported-a-pkcs-11-driver-on-disk-as-at
title: "frost-hardware-probe reported a PKCS#11 driver on disk as attached hardware"
created: 2026-08-14T16:32:08.729Z
depends_on: []
composes_with: []
---

# frost-hardware-probe reported a PKCS#11 driver on disk as attached hardware

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00HVPGS087G0R0001T4BF8-*.md` glob. -->

**Found by:** Nazar, 2026-08-14, while exercising the hardware lane on real hardware.
**Fixed in the same PR.** Filed because a bug is a priced measurement, not a liability to hide.

## The bug (two of them, opposite directions)

`probeHardwareSecurity()` computed

```ts
const hardwareAvailable = tpm.available || yubi.detected || pkcs11.found;
```

where `pkcs11.found` is true when a shared **library exists on disk**.

1. **False positive on presence.** `brew install yubico-piv-tool` drops `ykcs11.dylib` into
   `/opt/homebrew/lib` on a machine with no token anywhere near it, and the probe then printed
   `Hardware present: YES`. A PKCS#11 module is a **driver**; a driver is evidence that someone ran
   brew, not that a device is attached. The probe's own docstring says `noHardwareDetected` means
   "do not ask for a hardware tier here" — a driver clearing that flag inverts the meaning.
2. **False negative on presence.** YubiKey detection shelled out to `ykman`, so a genuinely attached
   token on a machine without the Yubico CLI read as *not detected*. `ykman` is not installed on the
   dev machine this was found on.

Neither is a silent-downgrade (the adapter still throws), but both make the probe's answer wrong, and
nothing else in the repo answers the question it is there to answer.

## Two further findings, fixed alongside

3. **The Secure Enclave was invisible.** Apple Silicon has a real hardware root and the probe never
   looked. It is now reported — and deliberately does **not** clear `noHardwareDetected`, because no
   `FrostSealTier` can reach it. SEP-present *and* no-honourable-tier is the honest answer, not a
   contradiction.
4. **The tests could not fail.** All four were `expect(typeof x).toBe("boolean")`, which passes for
   any implementation returning an object — including one that always answers "hardware present".
   The probe now takes an injected host (§13 noninterference) so tests describe a machine and assert
   the answer. 23 tests, 7/7 planted mutants killed.

## Repro (pre-fix)

```bash
touch /opt/homebrew/lib/ykcs11.dylib     # no token attached
bun tools/setup/persona-keys/frost-hardware-probe.ts
# old: "Hardware present:  YES"
# new: "Device present: NO", "Honourable tiers: (none)"
```

## Second bug, found on the follow-up pass: the roster could collapse to 1-of-N silently

With a YubiKey pack inbound, the question became "what does N tokens actually buy". The answer is
distribution — one compromised token yields one share — and the code could not deliver it.

- `const slotId = opts.slotId ?? 0` binds every share to slot 0 by default.
- `C_GetSlotList` is **declared in the FFI symbol table and never called**; there is no slot
  enumeration anywhere, so nothing discovers which token is where.
- Worse, and the actual defect: `FrostSealedShareFileV2` recorded **no token identity at all**, and
  `keyLabel` defaults to the same `zeta-frost-wrap` on every token. An operator provisioning the same
  wrapping key onto each token — the obvious move: one PIN, plus a spare if one is lost — gets a
  roster where **any one token opens every share**, with nothing in the artifact, the types, or the
  logs to distinguish it from a real threshold. Cryptography cannot catch this: the second token
  genuinely can decrypt.

Fixed by recording `sealedByToken` (label#serial from `C_GetTokenInfo`) and refusing a mismatched
token on load. It is bound into the AAD *and* the in-plaintext bind string, so stripping or editing
it fails the binding check even on the non-AEAD PKCS#11 tier. Optional and omitted-when-absent, so
pre-existing artifacts reconstruct byte-identical AAD and still load. 12 new tests, 7/7 mutants dead.

Slot ids are module-assigned and change with replug order, so they are **not** identities — the
binding is to label+serial and is re-read on every call rather than cached, or a swapped token would
inherit the previous one's identity.

## Follow-ups NOT done here

- A Secure Enclave seal tier (`kSecAttrTokenIDSecureEnclave`, P-256, no AES key-wrap of the shape
  `frost-share-adapter.ts` needs) — would need its own adapter and a Security.framework bridge.
- Exercising the PKCS#11 FFI path against a real token, and the TPM2 path on a Linux TPM host.
  Both remain documentary; see the "What has actually been exercised" section of
  `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md`.
