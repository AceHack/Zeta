# App-definition as DynamicValue — secrets/keys with optional in-value encryption + the Twelve-Factor app built into the value (Aaron, 2026-06-07)

Two coherent requirements: (1) represent **secrets/keys** in DynamicValue with optional encryption, and
(2) build the **app-construction methodology** (the "8-fold app" — almost certainly the **Twelve-Factor
App**) *into* DynamicValue itself. They're the same theme — *the app definition is data, and config +
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
already does this — "privacy is a TRANSFORM, not a 5th codec", B-0883/B-0982; DynamicValue
`encryptValue`/`decryptValue` memory-fence). The new part is **per-branch / pointer-to-secret / hardware
& n-of-m / license-gate** semantics expressed *in the value*.

## 2. The Twelve-Factor app built INTO DynamicValue ("the 8-fold app")

> Aaron: *"we are building our way up to the 8-fold app or whatever it's called, but in our DynamicValue
> itself."*

The **"8-fold app" is almost certainly the Twelve-Factor App** (Adam Wiggins / Heroku, 2011) — the
methodology for building SaaS apps (codebase, **dependencies**, **config**, **backing services**,
build/release/run, processes, port binding, concurrency, disposability, dev/prod parity, **logs**, admin
processes). *(Name flagged — Aaron said "or whatever it's called"; confirm 12-Factor vs an 8-factor
subset vs an "eightfold" coinage.)*

The move: **represent the app's factors AS DynamicValue** — everything-is-data applied to app
construction. Config = DynamicValue (incl. the §1 secrets); dependencies = ZetaID refs (the DI-as-data /
service-discovery thread); backing services = ZetaID-resolved cells; build/release/run + processes + logs
= data over the substrate. So an *app* is just a DynamicValue arrangement (factors as fields), versioned/
forked/composed like everything else — the same closure as tenant-as-DynamicValue and cell-as-data.
**Config + secrets (§1) are two of the factors** — which is why these two requirements are one theme.

## Ties

- §1 secrets: PQ `.zc` codec (B-0883/B-0982, encryption-as-transform), DynamicValue
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
