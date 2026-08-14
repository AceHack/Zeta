---
id: 081KWPHRNFW08QG0R0031ZNXTD
type: task
state: in_progress
priority: P2
slug: frost-rfc-9591-dkg-roast-hsm-sealed-share-adapters-agent-nat
title: "FROST RFC 9591 DKG + ROAST + HSM-sealed share adapters (agent-native-key-custody Layers 1-3)"
created: 2026-07-04T12:30:59.580Z
depends_on: ["081KWPHRNE008QG0R001D8CBP9"]
composes_with: ["081KVP3GYW108QG0R003V7E6VT"]
---

# FROST RFC 9591 DKG + ROAST + HSM-sealed share adapters

## Why

Slice 1–2 use a **trusted dealer** keygen (same honesty class as Shamir split). Agent-native
key custody design wants:

1. **Layer 1** — per-guard HSM/TPM seals the share (use-without-extract)
2. **Layer 2** — FROST across guards without a dealer who ever holds the full scalar
3. **Layer 3** — attestation-gated invocation (SPIFFE / AgencySignature / ZetaId) — **rooted in a
   silicon vendor's self-signed key** (TPM manufacturer EK root / AMD ARK / Intel SGX Root CA).
   Whoever implements this: the gate is real and worth building, and it is not vendor-independent.
   Do not write "attested" in the code comments or the DoD without the root beside it, and prefer a
   **vendor-diverse** guard roster so one root's compromise costs guards rather than the quorum.
   (`081M00QP7FB087G0R00031BQ93`; detail in the L0–L6 ladder's "Vendor roots cap every attestation
   claim".)

RFC 9591 DKG removes the dealer SPOF; ROAST adds robustness under concurrent signers;
HSM adapters seal shares so host RAM never sees share bytes during partial sign.

## Done when

1. Distributed keygen (no single party holds full scalar post-ceremony) — **slice 1 landed** (`frost-dkg.ts`, `ca-cli frost-ca --dkg`)
2. ROAST (or documented subset) for concurrent/robust signing sessions — **documented subset landed** (`frost-roast.ts`; exact-threshold attempts, session isolation, duplicate/mixed partial aborts, timeout retry)
3. Share adapter interface: software file (today) | HSM/TPM seal (pluggable) — **sealed-file slice landed** (`frost-share-adapter.ts`; AES-GCM software seal via injected key/effects; HSM stub still honest)
4. Still monorepo tools-over-trunks (`tools/setup/persona-keys/` + effects injection) — **yes**
5. Real TPM/PKCS#11 **at-rest seal** adapter — **landed** (`frost-share-adapter.ts`: `hardware-pkcs11`
   + `hardware-tpm2` tiers, eager construction probe, no-silent-downgrade `requireTier`,
   an unmistakable declared fake, and a separated hardware-only test lane). Exercised
   against mocks only; **NOT yet run on a physical token or TPM** — see item 6.
6. Real TPM/PKCS#11 **use-without-extract** — **PORT CHANGE LANDED; the invariant is
   still NOT met, and now says so in the type.** `frost-partial-signer.ts` is the new
   port: `commit(x)` then `signPartial(handle, package)`, with **no method that returns
   a share scalar**. Alongside it, the storage port was split — `FrostShareAdapter` is
   store-only, `loadShare` moved to the explicitly-named `ExtractingFrostShareAdapter`
   (`extractsScalar: true`, `usesWithoutExtract: false`, both literal), and the bulk
   extractor `loadFrostKeyShares` was **deleted** (it had zero production callers).

   What is honestly achieved: `createSoftwarePartialSigner` takes an
   `ExtractingFrostShareAdapter`, so it reads the scalar and signs in-process. That
   narrows the exposure window from **the caller process** to **one function frame**;
   it is **not** use-without-extract. The distinction is typed, not documented:
   `exposureBoundary` is `"caller-process" | "signer-function" | "hardware-boundary"`,
   and `usesWithoutExtract: true` is reachable **only** in the union branch that also
   declares `"hardware-boundary"`. No factory in the repo reaches that branch (test
   FPS-14 walks every export and proves it); `createNonExtractingPartialSignerStub`
   throws.

   **Two rounds are required, CHECKED:** the binding factor rho_i hashes the full
   commitment list and the challenge covers R = SUM_j (D_j + [rho_j]E_j), neither of
   which a participant can know when it generates its own nonce. Nonces are generated
   inside `commit()`, never returned, and the handle is single-use — burned *before*
   any arithmetic so a failed `signPartial` cannot leave a reusable nonce (FPS-7).

   **PKCS#11 cannot compose a partial — CHECKED against the spec, not inherited.**
   PKCS#11 v3.1 has no mechanism returning modular scalar arithmetic on a sensitive
   key; `CKM_ECDSA`/`CKM_EDDSA` compute nonce and challenge internally over their own R
   (so they cannot bind to the group R); derive mechanisms emit non-extractable key
   objects, and `CKM_BIP32_CHILD_DERIVE` is a Thales vendor extension, secp256k1-only,
   still a key object. The absence is **structural**: a partial is an extractable affine
   function of the secret, so a generic primitive emitting one would be a key-extraction
   oracle on the second challenge against one nonce. **L2 therefore needs FROST-aware
   firmware** (programmable applet / extensible open firmware / purpose-built device such
   as Frostsnap), not an orderable general-purpose token. **No hardware was exercised.**
7. PKCS#11 integrity: the token path uses `CKM_AES_CBC_PAD`, which has no AEAD and no
   associated-data input. The header is bound by an in-plaintext binding check, which is
   **not a MAC**. Upgrade to `CKM_AES_GCM` where the token supports it — **open**.
8. Apple Secure Enclave adapter — **open, not covered, and it does not rescue item 6.**
   Apple Silicon has a Secure Enclave, not a TPM 2.0, so `hardware-tpm2` cannot work on
   such a machine at all and PKCS#11-with-a-token is the only hardware tier there. The
   Enclave needs its own Keychain-based adapter, and being P-256-only it cannot produce
   Ed25519 FROST partials either.
9. **P0 found in passing, FIXED here:** `randScalar` (`frost.ts`, `frost-dkg.ts`) and
   `randCoeff` (`shamir.ts`) defaulted to `Math.random`, and **every production call site
   reached that default** — `frost-ca-custody.ts` passes no `random` to `frostKeygen`,
   `frostDkgKeygen`, or `frostThresholdSign`. So the CA group signing scalar, the Shamir
   coefficients, and every FROST nonce came from a non-cryptographic PRNG whose state is
   recoverable from its own output; a recovered nonce yields the share directly from
   `z_i = k_i + c * lambda_i * s_i`. Defaults now draw from the OS CSPRNG (rejection
   sampling for GF(257)); the injected door is untouched so DST replay is unaffected.
   Guarded by `frost-csprng-default.test.ts`, which counts `Math.random` calls.
   **Residual (not fixed by code):** any FROST CA or Shamir split generated before this
   commit was produced with the weak default and should be rotated. Filed in
   `docs/BUGS.md`.

## Depends on

Prefer **081KWPHRNE** (OpenSSH cert encoder) first so live path is end-to-end useful before
hardening keygen.

## Anchors

RFC 9591; Komlo & Goldberg FROST; `docs/research/2026-05-31-agent-native-key-custody-design-…md`
