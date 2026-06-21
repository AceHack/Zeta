---
id: 081KSNY2Z0008QG0R002ZAVMEK
priority: P2
status: open
title: Multi-cipher PQ substrate — NIST baseline + Saber + NTRU Prime + FrodoKEM hedge against NIST-monoculture; parameterized envelope swappable cipher
effort: M
ask: aaron 2026-05-28 (Q2 decision locked: "lattice based / post quantium crypto but not just nist")
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSNY2Z0008QG0R0030V5ZVS
  - 081KSNY2Z0008QG0R0037X4DP4
tags:
  - multi-cipher-pq-substrate
  - nist-baseline-plus-hedge
  - saber-module-lwr
  - ntru-prime-different-lattice-family
  - frodo-kem-standard-lwe-no-algebraic-structure
  - swoosh-when-ships
  - hedge-against-nist-monoculture
  - parameterized-envelope-swappable-cipher
  - operator-decision-locked-2026-05-28
---

## Operator decision 2026-05-28

> *"lattice based / post quantium crypto but not just nist"*

Locks Q2 of 081KSNY2Z0008QG0R0037X4DP4 library landscape audit. NIST-standardized primitives are baseline; hedge against NIST-monoculture risk by carrying alternates from the broader lattice family. The "but not just nist" framing means operator wants algorithm DIVERSITY, not algorithm SUBSTITUTION.

## What this row tracks

Extend 081KSNY2Z0008QG0R002JKH50A envelope to be parameterized over KEM choice + signature choice; ship multiple cipher implementations side-by-side; recipient + envelope-version negotiate which cipher to use for any given operation.

## Candidate algorithm set

| Algorithm | Family | NIST status | Library status | Why include |
|---|---|---|---|---|
| **ML-KEM-768** (Kyber) | Module-LWE | Standardized FIPS 203 | `@noble/post-quantum` ships | Baseline; production-ready; cryptographic community consensus |
| **ML-DSA-65** (Dilithium) | Module-LWE | Standardized FIPS 204 | `@noble/post-quantum` ships | Signature baseline; same family as ML-KEM |
| **Saber** | Module-**LWR** | NIST Round 3 finalist (eliminated when ML-KEM won) | Bouncy Castle (Java); no TS-native | Different mathematical hardness assumption within lattice family (LWR vs LWE); true hedge if Module-LWE has unexpected cryptanalysis breakthrough |
| **NTRU Prime** (sntrup761) | NTRU lattice | NIST Round 3 alternate | `noble-post-quantum` partial; OQS full | DIFFERENT lattice family than Module-LWE/LWR; biggest hedge against cryptanalysis of Module family |
| **FrodoKEM** | Standard LWE (no algebraic structure) | NIST Round 3 alternate | OQS (WASM); no TS-native | Standard LWE has no algebraic structure to attack; slower + larger but most-conservative cryptographic posture |
| **SLH-DSA** (SPHINCS+) | Hash-based (NOT lattice) | Standardized FIPS 205 | `@noble/post-quantum` ships | Signature alternate that doesn't depend on lattice hardness at all; total family-diversity |
| **SWOOSH** | Module-LWE NIKE | Academic 2023 (USENIX Sec 2024) | Reference impl Rust+Jasmin; no TS | Future watch-list; if standardized + TS-port lands, integrate |

**Default deployment for 081KSNY2Z0008QG0R0030V5ZVS v1:** ML-KEM-768 + ML-DSA-65 (Noble-shipped; smallest deployment surface). Other algorithms ship as ALTERNATES that can be selected per-recipient or per-envelope.

**Hedge architecture:** envelope format declares which KEM was used (`"alg": { "kem": "ML-KEM-768" }`). Decryptor checks supported list. Cipher swap = update declared alg + add cipher to decryptor's supported set. No structural envelope change.

## Acceptance criteria

- `tools/crypto/better-git-crypt/ciphers/` directory with per-cipher implementation:
  - `ciphers/ml-kem-768.ts` (Noble; baseline)
  - `ciphers/ml-dsa-65.ts` (Noble; baseline)
  - `ciphers/slh-dsa.ts` (Noble; hash-based signature alternate)
  - `ciphers/saber.ts` (deferred until TS-native impl exists OR WASM-via-OQS acceptable)
  - `ciphers/ntru-prime.ts` (deferred until TS-native impl matures)
  - `ciphers/frodo.ts` (deferred until TS-native impl exists)
- `ciphers/registry.ts` — runtime cipher dispatch by envelope alg-id
- Envelope format includes alg identifier; decryptor validates against supported list
- Tests cover: per-cipher round-trip; envelope-with-unknown-alg rejected cleanly; cipher swap doesn't break existing envelopes
- README documents the hedge philosophy + which alternates ship + which are deferred

## Composition

- **081KSNY2Z0008QG0R002JKH50A** (parent crypto substrate)
- **081KSNY2Z0008QG0R0037X4DP4** (library landscape audit — this row implements Q2's locked decision)
- **081KSNY2Z0008QG0R0030V5ZVS** (agent private encrypted state — beneficiary)
- Future B-NNNN: when SWOOSH ships TS-native or Saber gets TS-native impl, file sibling sub-rows

## Substrate-honest framing

P2 — important architectural property (hedge against NIST-monoculture) but not blocking 081KSNY2Z0008QG0R0030V5ZVS v1 (ships with ML-KEM-768 baseline; hedge alternates land as TS-native impls mature). The parameterized envelope IS the load-bearing piece for v1; alternates land later.

## Full reasoning

Operator 2026-05-28 in response to 081KSNY2Z0008QG0R0037X4DP4 open questions: *"lattice based / post quantium crypto but not just nist"* — explicit hedge directive.

Composes with 081KSNY2Z0008QG0R0037X4DP4's recommendation (Noble + XWing as v1 baseline) by adding the parameterization layer so alternates can integrate without envelope rework.
