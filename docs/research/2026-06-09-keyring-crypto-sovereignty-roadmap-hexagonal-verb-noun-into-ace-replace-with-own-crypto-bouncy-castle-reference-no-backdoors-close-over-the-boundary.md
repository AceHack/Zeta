# Keyring crypto-sovereignty roadmap: hexagonal + verb-noun, lives in `ace`, replace 3rd-party crypto with our own (Bouncy Castle as reference, no backdoors) by closing over the crypto Markov boundary over time

**Register:** [grounded] architecture roadmap (Aaron) + [synthesis] + [anchor].
**Date:** 2026-06-09. **Captured by:** Otto (shadow). **Status:** roadmap — the
keyring tool exists + is byte-locked; this is the path to sovereign crypto.

## Aaron's words

> "don't forget our hexagonal interfaces and mumps and our verb-noun integration.
> this belongs in ace once we split it out. zeta will include ace or they will
> share crypto or something. but we will eventually use bouncy castle as reference
> and replace all crypto with our own so no back doors like Itron supply chain.
> closure over time markov boundary style."

## 1. Shape it right now: hexagonal + verb-noun (not a bash/TS island)

The keyring is currently a bash wrapper + TS script — fine as a bootstrap, wrong as
the durable shape. The durable shape:

- **Hexagonal (ports & adapters):** a `KeyDerivation` **port** (interface) with the
  crypto as a swappable **adapter** behind it. Callers depend on the port, never on
  `@noble`/`@scure` directly. (Repo already uses hexagonal — `docs/PROVEN-CORE-MAP.md`.)
- **verb-noun integration:** the derivation is a set of **verb-noun-dependsOn
  seams** (`derive ssh dependsOn seed`, `derive eth dependsOn seed`, …) — the
  "everything is a seam" thesis (`2026-06-07-everything-is-...-verb-noun-dependson-...md`),
  so the deps graph (for `ace`) is the derivation itself.
- **mumps / globals:** key material + the keyring tree map onto Zeta's
  global/hierarchical store (globals-as-sparse-ragged-tensors / DynamicValue —
  `2026-06-07-globals-are-sparse-ragged-tensors-...md`), not ad-hoc JSON files.

## 2. It belongs in `ace`; Zeta and ace share crypto

Once `ace` is split out, the keyring/crypto **lives in ace** (the signed DLC
package manager already does content-hash + signing + trust — crypto is its native
concern). **Zeta will either include ace, or Zeta and ace share one crypto
module** — one crypto substrate, not two. (This is the declarative-keyring-as-ace-
package target, `2026-06-09-declarative-keyring-as-an-ace-package-...md`, taken to
its conclusion: the crypto *is* ace's.)

## 3. The endgame: replace 3rd-party crypto with our own — no backdoors

Today we depend on `@noble`/`@scure`/`micro-key-producer` (audited, but **3rd-party
supply chain**). The endgame is **sovereign crypto**:

- **Bouncy Castle as the reference.** Use Bouncy Castle (Legion of the Bouncy
  Castle — the well-trodden, audited reference implementation) as the **oracle to
  diff against**, then **replace all crypto with our own implementation**.
- **Why: no backdoors / supply-chain capture.** Owning the crypto removes the
  supply-chain attack surface (the **xz/liblzma 2024 backdoor**, SolarWinds — the
  canonical lessons; Aaron's **Itron supply-chain** anchor). You cannot be
  backdoored through a dependency you do not have.
- **De-risked by the byte-lock.** This swap is *safe because the golden vectors
  already pin the answer*: our own crypto must reproduce `golden-vectors-keyring.json`
  **bit-perfect** across the 4lang×4serializer grid. Bouncy Castle + the vectors are
  the two independent oracles (BP-16 cross-check) that prove our impl correct before
  it ships. **Own crypto without the vectors would be reckless; with them it's a
  conformance exercise.**

## 4. The mechanism: close over the crypto Markov boundary, over time

We do **not** rewrite crypto in a big bang. We **close over the crypto boundary**
(the `KeyDerivation` port = a Markov blanket around the crypto adapter), then swap
the hidden implementation behind it **over time** — Markov-boundary-style closure
(compose at the boundary, replace internal state without callers seeing it):

```
callers ─▶ KeyDerivation (port, stable)
                 │   adapter swapped behind the blanket, over time:
                 ├─ now:    @noble/@scure adapter
                 ├─ next:   our-impl adapter, diffed vs Bouncy Castle + golden vectors
                 └─ later:  our-impl only (3rd-party dep removed)
```

Each swap is gated on bit-perfect conformance to the byte-lock. The boundary never
moves; only what's behind it does. (This is `close over` applied to the riskiest
dependency in the system.)

## Roadmap (ordered)

1. **Port-ify** — define `KeyDerivation` (hexagonal port) + verb-noun seams; current
   TS becomes the first adapter. (Now-ish.)
2. **Move into `ace`** — keyring/crypto becomes an ace concern; Zeta shares it.
3. **Own-impl adapter** — implement each primitive (ed25519/secp256k1/BIP-32/39/
   SLIP-0010/bech32/keccak), **diff vs Bouncy Castle + the golden vectors**, per the
   4lang×4serializer grid.
4. **Drop the 3rd-party dep** — once the own-impl adapter is bit-perfect across the
   grid, remove `@noble`/`@scure`. No supply chain left to backdoor.

## Anchors

Hexagonal / ports-&-adapters (Alistair Cockburn); MUMPS hierarchical globals;
Bouncy Castle (Legion of the Bouncy Castle); supply-chain backdoors (xz/liblzma
CVE-2024-3094, SolarWinds; Aaron's Itron supply-chain lesson); `close over` /
Markov-boundary substitution; BP-16 cross-check (two independent oracles); the
keyring byte-lock (`golden-vectors-keyring.json`) + `no-binary-in-proof-lineage`;
`ace` (081KR2E4K0008QG0R002YE3MMD); the verb-noun-seam + globals-as-tensors docs.
