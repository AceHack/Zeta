---
id: 081KWPHRNFW08QG0R0031ZNXTD
type: task
state: backlog
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

1. Distributed keygen (no single party holds full scalar post-ceremony)
2. ROAST (or documented subset) for concurrent/robust signing sessions
3. Share adapter interface: software file (today) | HSM/TPM seal (pluggable)
4. Still monorepo tools-over-trunks (`tools/setup/persona-keys/` + effects injection)

## Depends on

Prefer **081KWPHRNE** (OpenSSH cert encoder) first so live path is end-to-end useful before
hardening keygen.

## Anchors

RFC 9591; Komlo & Goldberg FROST; `docs/research/2026-05-31-agent-native-key-custody-design-…md`
