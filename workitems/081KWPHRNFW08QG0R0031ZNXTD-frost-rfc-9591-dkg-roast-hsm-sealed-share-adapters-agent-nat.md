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
3. **Layer 3** — attestation-gated invocation (SPIFFE / AgencySignature / ZetaId)

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
6. Real TPM/PKCS#11 **use-without-extract** — **STILL OPEN, and it needs a PORT CHANGE.**
   `FrostShareAdapter.loadShare` returns the share scalar, so no adapter behind this port
   can satisfy sovereignty invariant 2 whatever hardware backs it. Every adapter now
   declares `usesWithoutExtract: false`, typed as the literal `false` so the claim cannot
   be made without changing the port. Completing it needs a `signPartial`-shaped port and
   a chip that can do a FROST partial — which consumer HSMs/TPMs do not do in firmware
   (ladder L2 records this), so this is an L2/L3 item, not an L1 one.
7. PKCS#11 integrity: the token path uses `CKM_AES_CBC_PAD`, which has no AEAD and no
   associated-data input. The header is bound by an in-plaintext binding check, which is
   **not a MAC**. Upgrade to `CKM_AES_GCM` where the token supports it — **open**.
8. Apple Secure Enclave adapter — **open, not covered**. Apple Silicon has no TPM 2.0;
   the Enclave needs its own Keychain-based adapter.

## Depends on

Prefer **081KWPHRNE** (OpenSSH cert encoder) first so live path is end-to-end useful before
hardening keygen.

## Anchors

RFC 9591; Komlo & Goldberg FROST; `docs/research/2026-05-31-agent-native-key-custody-design-…md`
