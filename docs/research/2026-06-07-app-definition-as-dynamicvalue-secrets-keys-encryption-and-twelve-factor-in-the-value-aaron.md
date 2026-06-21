# App-definition as DynamicValue — secrets/keys with optional in-value encryption + the Twelve-Factor app built into the value (Aaron, 2026-06-07)

Two coherent requirements: (1) represent **secrets/keys** in DynamicValue with optional encryption, and
(2) build the **app-construction methodology** (the **Twelve-Factor App**, confirmed) *into* DynamicValue
itself. They're the same theme — *the app definition is data, and config +
secrets are factors of it.* Faithful capture; Beacon-anchored.

## 1. Secrets / keys in DynamicValue, with optional in-value encryption

> Aaron: *"represent Nostr ids (pub + private) in DynamicValue with optional encryption in DynamicValue
> itself, so it points to secrets — many different types here, and non-secret config too. Could point to
> hardware key locations (keys that never leave the hardware), n-of-m, etc."*

- **Nostr ids (pub + private)** as DynamicValue (pub = the cross-system identity; private = a secret).
- **Optional encryption *inside* the value** — parts of a DynamicValue can be encrypted in place, so the
  value *points to / carries* secrets (encrypted), alongside **non-secret config** in the clear. Mixed
  resolution: some branches plaintext, some encrypted (like soft-vs-collapsed mixing).
- **Pointers, not embeds, for hardware-held keys** — a value can **point to a hardware key location** for
  keys that *never leave the hardware* (HSM/TPM/secure-enclave); the value references the key, the key
  stays in silicon.
- **n-of-m threshold** — "divine n of m": a secret split so *n of m* shares/holders are required (Shamir
  secret sharing / threshold crypto).

### The four use-modes for the key/encryption (Aaron's enumeration)

1. **License-gate** — parts are encrypted so the value **won't load/run without a license key**. (This is
   an *admission gate*: ties to ZetaID-is-a-pointer-not-authority — resolve → verify → ADMIT → use.)
2. **Protection** — parts are encrypted for **confidentiality** (at rest / in transit).
3. **Hardware/enclave-bound** — parts require **hardware keys / secrets / an enclave** to decrypt —
   exactly the shape of **.NET's Data Protection API (DPAPI)** (OS/hardware-bound protection).
4. **Hardware-pointer** — the value **points to specific hardware** for its keys (singular, or n-of-m).

These are not a new codec: encryption is a **transform** over canonical CBOR (the PQ `.zc` privacy codec
already does this — "privacy is a TRANSFORM, not a 5th codec", 081KSNY2Z0008QG0R002JKH50A/081KT07NV0008QG0R0032MCYER; DynamicValue
`encryptValue`/`decryptValue` memory-fence). The new part is **per-branch / pointer-to-secret / hardware
& n-of-m / license-gate** semantics expressed *in the value*.

## 2. The Twelve-Factor app built INTO DynamicValue ("the 8-fold app")

> Aaron: *"we are building our way up to the 8-fold app or whatever it's called, but in our DynamicValue
> itself."*

The **"8-fold app" is the Twelve-Factor App** (Adam Wiggins / Heroku, 2011 — **confirmed by Aaron**) —
the methodology for building SaaS apps (codebase, **dependencies**, **config**, **backing services**,
build/release/run, processes, port binding, concurrency, disposability, dev/prod parity, **logs**, admin
processes).

The move: **represent the app's factors AS DynamicValue** — everything-is-data applied to app
construction. Config = DynamicValue (incl. the §1 secrets); dependencies = ZetaID refs (the DI-as-data /
service-discovery thread); backing services = ZetaID-resolved cells; build/release/run + processes + logs
= data over the substrate. So an *app* is just a DynamicValue arrangement (factors as fields), versioned/
forked/composed like everything else — the same closure as tenant-as-DynamicValue and cell-as-data.
**Config + secrets (§1) are two of the factors** — which is why these two requirements are one theme.

## Ties

- §1 secrets: PQ `.zc` codec (081KSNY2Z0008QG0R002JKH50A/081KT07NV0008QG0R0032MCYER, encryption-as-transform), DynamicValue
  `encryptValue`/`decryptValue`, ZetaID (pointer-to-secret), the determinism contract (`081KTGEVV75` —
  a secret/hardware key is a *host-injected declared capability*, not embedded), the
  pointer-not-authority admission gate, Nostr keys (the identity thread, `2026-06-07-identity-*`).
- §2 app-as-data: the everything-is-data frame (`2026-06-07-zeta-is-declarative-desired-state-*`),
  DI-as-data / service-discovery (ZetaID), tenant-as-DynamicValue, plugin-as-data (`081KTGES048`).

## Beacon anchors

- **Twelve-Factor App** — Adam Wiggins / Heroku (2011). · **.NET Data Protection API / DPAPI** (hardware/
  OS-bound protection). · **HSM / TPM / secure enclave** (Intel SGX, Apple Secure Enclave) — keys that
  never leave hardware. · **Shamir Secret Sharing** (Adi Shamir, 1979) — n-of-m threshold. · **Nostr**
  (fiatjaf, NIP-01) — keypair identity. Honest: composition of known primitives expressed in one
  self-describing value, not new crypto.

## Secrets design — distinct cases, not one blob; pointer-not-leak; license ≠ authority (Amara 2026-06-07)

Amara's review sharpened §1 into a typed design (model secrets as **distinct DynamicValue cases**, not
one overloaded "secret" blob — they have different semantics):

| Case | Semantics |
|------|-----------|
| `PublicKeyRef` | public Nostr id — identity, **safe to expose** |
| `EncryptedValue` | a confidential subtree, encrypted in place |
| `SecretPointer` | a ZetaID ref to a secret resolved elsewhere (not embedded) |
| `HardwareKeyPointer` | points to a key that **never leaves hardware** (HSM/TPM/enclave) |
| `ThresholdSecretPolicy` | **n-of-m** quorum required before unwrap/sign/use |
| `LicenseGate` | the value **cannot load/run until a key admits it** |
| `NonSecretConfig` | plain config, in the clear |

### Blade — self-describing must not become self-LEAKING

> Amara: *"DynamicValue may carry secret *references* or *encrypted branches*. It should NOT casually
> carry raw private keys."*

Normal operation is **pointer-based**, never raw-key-bearing:

```text
DynamicValue → SecretPointer (ZetaID) → hardware/enclave/DPAPI/HSM/threshold resolver → capability result
```

A raw private key in a DynamicValue is **exceptional** — test fixtures or an explicit export/import flow
only, never in normal values. (Private Nostr key: never plaintext by default; pub side is the
`PublicKeyRef`.) This keeps "self-describing" from becoming "self-leaking."

### License-gate must bake in pointer-NOT-authority, HARD

> Amara: *"a key should unlock INSPECTION or use; it should not bypass validation."*

```text
WRONG:  has key  → run
RIGHT:  has key  → decrypt/load candidate  → VERIFY tests/laws/capabilities  → policy ADMITS  → run
```

This is the §"ZetaID is a pointer, not authority" invariant applied to encryption/license: possessing
the key admits the value to *inspection*, then the normal verify→admit gate still runs. Otherwise
DRM/security becomes **magic authority** (key ⇒ unconditional run), the spooky failure. The
self-shipping-tests property makes the VERIFY step cheap even for an encrypted/licensed value.

(Beacon add: this is capability-security discipline — possession of a key is *one* input to an admission
decision, not the decision itself.)
