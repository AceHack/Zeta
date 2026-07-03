# Itron ISM/SKMS crypto architecture — lived prior-art reference for Zeta's crypto-sovereignty (port + per-algorithm adapters, KeyState lifecycle, HSM, key bundles, injector)

**Register:** [anchor] lived prior art (Aaron @ Itron, shared for reference) + [synthesis] (map to Zeta).
**Date:** 2026-06-09. **Captured by:** Otto (shadow).
**IP / reference-not-copy:** Aaron authored this Itron source and pointed me at it *for
reference* (`~/Downloads/Itron`, his copy). This doc captures **architecture + patterns

+ interface shapes only** — **no proprietary Itron code is copied into the Zeta repo**,

and none should be. We re-derive the *pattern* (clean-room), cite the anchor; we do not
lift the implementation. (Same discipline as ZetaId-pointer reference-not-copy.)

## What Itron's ISM/SKMS is

**ISM** (Itron Security Manager) / **SKMS** (Security Key Management System) — a
production utility-meter key-management + crypto system. Aaron built/owned it; it is
the **lived prior art** behind Zeta's crypto-sovereignty, keyring, hat-keys, HSM, and
"own the PKI down to the metal" arc. The relevant pieces:

## The pattern (and how it maps to Zeta)

| Itron (prior art) | Zeta mapping |
|---|---|
| **`ICryptoPlugin`** — a crypto **port**: `GenerateKey`, `GenerateKeyPair`, `AuthenticateEncrypt`, `DecryptValidate`, `AsymmetricEncrypt/Decrypt`, `SignData`, `VerifySignature` | the **owned crypto interface** (the `KeyDerivation`/`ICrypto` port) of the own-all-interfaces principle |
| **per-algorithm adapter plugins**: `AES128CCM`, `AES256`, `AES256CCM`, `ECC384` — **each with its own `.Tests`** | the **two-adapter / dep-as-oracle** model: algorithms are swappable adapters behind the port, **each test-backed** (the tests *are* the oracle) |
| **`KeyState` enum**: `Undefined, Active, PendingActive, PendingInactive, Inactive, Inconsistent, Consistent, Standby` | the **key-status lifecycle** — richer than our 2-state (bootstrap-test/self-custody); see "adopt" below |
| **`KeyBase`** (abstract → `DeviceKey`, `UtilitySharedKey`): symmetric+asymmetric, `KeyDefinition`/`KeyTypeDefinition`, `IsStoredOnHSM`, `HSMContainerName`, `IEncryptKey` | the **keyring key model** (typed keys, definitions, HSM-aware) |
| **HSM via PKCS#11** (`NCryptoki`/`NCryptokiMngd`, `RSABSafe`, `crypto.dll`, **`CryptoVault`**) | **hardware-backed keys** → Vault now; secure-element / SoC later (the deepest-border-is-the-metal doc) |
| **`KeyBundle` / `DeviceHandoverPackage` / `CertificateBundle`** | **provisioning/onboarding handover** — the keyring + arrival protocol bundle |
| **`KeyUtilities`** — an MVVM (Model/View/ViewModel) **key-injector** operator tool | **`keyring.sh`** (the operator key tool) — same role |
| threat docs in the dir (`AMI_Attack_Methodology.pdf`, *Eye-of-the-Meter* DEF CON) | **threat-model prior art** (route to Aminata) |

## Lessons to adopt (clean-room, into the Zeta crypto-sovereignty roadmap)

1. **Crypto port + per-algorithm adapters, each test-backed — validated at scale.**
   Itron shipped exactly the own-interface / swappable-adapter / dep-as-oracle pattern
   (`ICryptoPlugin` + `AES*`/`ECC384` plugins + `.Tests`). This **confirms** the Zeta
   design (own `ICrypto`/`KeyDerivation` port; @noble / our-own / Bouncy-Castle as
   adapters; tests as the oracle; golden-vector byte-lock). Build it that way.
2. **Adopt a richer KeyState lifecycle.** Our 2-state (bootstrap-test → self-custody)
   is too thin. Itron's `Active / PendingActive / PendingInactive / Inactive / Standby`
   gives **staged rotation with overlap windows** (PendingActive→Active→PendingInactive→
   Inactive) — exactly what safe key rotation needs (no flag-day cutover; old + new
   valid during the window). Add these states to the keyring (`KeyState`), with
   bootstrap-test/self-custody as an orthogonal *custody* axis.
3. **HSM-backed from the start.** `IsStoredOnHSM` / `CryptoVault` / PKCS#11 — keys can
   live in hardware. Zeta: **Vault now**, secure-element/SoC later; the keyring model
   should carry the "where does the private key live" axis (memory / Vault / HSM / SoC).
4. **Key bundles for handover = the onboarding/arrival package.** `DeviceHandoverPackage`
   is provisioning-with-keys; maps to the keyring + the anonymous/asylum arrival handover.
5. **Threat-model the attacks.** The AMI/meter attack research is prior art for Aminata
   (adversary modeling the device/key layer).

## Honest scope / handoff

Reference capture, not a build. Feeds: the **crypto-sovereignty roadmap**
(port+two-adapter, own-impl vs Bouncy-Castle, dep-as-oracle), the **keyring** (add the
`KeyState` lifecycle + HSM/custody axes + staged rotation), the **deepest-border / HSM /
SoC** doc, and **Aminata** (the meter-attack threat research). Routes to Kenji
(synthesis), Mateo/Nazar (crypto/HSM), Aminata (threat model). **No Itron code is to be
copied into Zeta** — patterns + this citation only.

## Anchors / ties

**Itron ISM / SKMS** (Aaron's lived prior art — owned PKI + crypto + key injection +
HSM, the same anchor as the ferry-boat throttle and "own the supply chain to the
metal"); PKCS#11 / HSM; ECC/AES per-algorithm plugins; staged key rotation
(NIST key-lifecycle states); the Zeta crypto-sovereignty roadmap + own-all-interfaces
(two-adapter/dep-as-oracle) + keyring (`tools/setup/persona-keys/`) + golden-vector
byte-lock + deepest-border-is-the-metal docs.
