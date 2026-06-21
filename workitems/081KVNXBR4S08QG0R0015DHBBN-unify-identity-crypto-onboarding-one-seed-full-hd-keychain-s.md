---
id: 081KVNXBR4S08QG0R0015DHBBN
type: task
state: backlog
priority: P1
slug: unify-identity-crypto-onboarding-one-seed-full-hd-keychain-s
title: "Unify identity+crypto onboarding: one seed → full HD keychain (SSH/PGP/Nostr/ETH/Solana) custodied per-class vault, dual-rotation from start, schema-evolvable over Z-sets, hexagonal (Aaron 2026-06-21 'mash it all together')"
created: 2026-06-21T20:18:42.969Z
depends_on: []
composes_with: ["081KVNTNTDQ08QG0R0017NBBWB", "081KVNMFYS808QG0R002D0VM64", "081KVNRSGVR08QG0R003R3RNJX"]
---

# Unify identity+crypto onboarding: one seed → full HD keychain (SSH/PGP/Nostr/ETH/Solana) custodied per-class vault, dual-rotation from start, schema-evolvable over Z-sets, hexagonal (Aaron 2026-06-21 'mash it all together')

<!-- Work-item body. ZetaId-keyed. -->

## Carved sentence

> Mash the five shipped pieces into ONE identity+crypto onboarding flow: a single human-custody
> **seed** → `derive.ts` HD keychain (SSH/PGP/Nostr/**ETH/Solana**) → custody each leaf via the
> **KeyCustody port** into its **class vault** → **dual-rotation** (overlap-window) from the
> start → the provisioning + rotations are **Z-set events** so the whole layout is
> **schema-evolvable, 0-downtime** (wrong-and-fixable) — all **hexagonal** (DB-as-PKI endgame).
> Nothing new is invented; it's wiring existing components together + making it investor-secure.

## Design

Full design: `docs/research/2026-06-21-zeta-identity-crypto-substrate-one-seed-hd-keychain-dual-rotation-schema-evolvable-over-zsets-hexagonal.md`.

## Scope (the wiring)

1. **Onboarding derives ALL keys** (not just SSH/PGP): wire `derive.ts`'s ETH/Solana/Nostr paths
   into the onboarding flow so the crypto wallets are provisioned from the same seed. Seed stays
   human-custody; agent derives/uses leaves, never holds the master or a wallet seed.
2. **Per-class vault custody** via the KeyCustody/SecretStore ports: the 4-vault split
   **CA / Lucent / Zeta / User** (User + CA + wallet seeds human-only; agent scoped to Lucent/Zeta).
3. **Dual rotation from the start** — apply the overlap-window dual-key pattern
   (`docs/DECISIONS/2026-06-15-zero-downtime-id-rotation-pattern-overlap-window-dual-key.md`) to
   every derived key + the CA; rotation = a Z-set event (new +1, old −1 after the window).
4. **Schema-evolvable layout** — the derivation-path table, vault map, and rotation policy are
   SchemaEvolution-versioned (schemas-as-rows / grammar-as-versioned-events) so they evolve with
   0 downtime over Z-sets — the layout can be wrong and updated later.
5. **Hexagonal** — all through the ports (hexagonal decision); external adapters now → our DB as
   first-class PKI eventually, no call-site change.
6. **Investor-grade security checklist** (make it demonstrable): deterministic byte-locked
   derivation (DST), no long-lived keys (dual rotation), least-privilege vaults, biometric consent
   fail-closed, event-sourced + revocable, schema-evolvable, no vendor lock-in.

## Composes / anchors

Composes: vault-separation (081KVNTNTDQ08QG0R0017NBBWB), OSS-vault-via-ArgoCD
(081KVNMFYS808QG0R002D0VM64), secret-clip cross-OS (081KVNRSGVR08QG0R003R3RNJX). Decisions:
hexagonal ports (2026-06-21), event-sourced config/secrets (2026-06-21), zero-downtime dual-key
rotation (2026-06-15). Code: `tools/setup/persona-keys/derive.ts`. Anchors: BIP-39/32/44 +
SLIP-44 coin types; DBSP/Z-sets; SchemaEvolution; Cockburn hexagonal.
