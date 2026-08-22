---
id: 081KVNYZXQ608QG0R002G35565
type: task
state: backlog
priority: P1
slug: crypto-agile-pq-keychain-extend-derive-ts-to-pq-key-types-ml
title: "Crypto-agile PQ keychain: extend derive.ts to PQ key types (ML-DSA-65/ML-KEM-768/X-Wing/SLH-DSA + lattice set), modern/hybrid-by-default, Adinkra experimental hybrid-only, behind KeyCustody port (Aaron 2026-06-21)"
created: 2026-06-21T20:47:12.614Z
depends_on: []
composes_with: ["081KVNXBR4S08QG0R0015DHBBN", "081KSNY2Z0008QG0R002ZAVMEK"]
---

# Crypto-agile PQ keychain: extend derive.ts to PQ key types (ML-DSA-65/ML-KEM-768/X-Wing/SLH-DSA + lattice set), modern/hybrid-by-default, Adinkra experimental hybrid-only, behind KeyCustody port (Aaron 2026-06-21)

<!-- Work-item body. ZetaId-keyed. -->

## Carved sentence

> Extend the HD keychain to **post-quantum** key types from the SAME seed (HD sub-seed →
> deterministic PQ keygen), with a **crypto-agility registry** + **modern/hybrid-by-default**
> policy, **lattice AND non-lattice** diversity, all behind the `KeyCustody`/`CertAuthority`
> ports. Reuse what we have; don't start from an insecure point. Good crypto, not secret crypto.

## Design

`docs/research/2026-06-21-crypto-agile-postquantum-keychain-one-seed-classical-plus-pq-good-crypto-not-secret.md`.

## Scope

1. **Extend `derive.ts`** with PQ paths: `pqSubSeed = HD.derive("m/44'/<pq-coin>'/0'/0'")` →
   deterministic keygen for **ML-DSA-65** (have, via better-git-crypt), **ML-KEM-768** (have),
   **X-Wing** hybrid (have), **SLH-DSA** (non-lattice, add). Assign private coin indices per scheme.
2. **Crypto-agility registry** — key-type table {path, keygen, sign/verify or encaps/decaps,
   status}; reuse `src/Core.TypeScript/crypto/better-git-crypt/` for ML-KEM/ML-DSA/X-Wing.
3. **Modern/hybrid-by-default policy** — prefer hybrid (classical ⊕ PQ); pure-PQ where supported;
   classical only for interop, and even then derive the PQ key so → PQ is a rotation, not re-key.
4. **Lattice + non-lattice diversity** — ML-DSA (lattice) + SLH-DSA (hash-based); compose the
   multi-cipher lattice set (081KSNY2Z0008QG0R002ZAVMEK: NTRU-Prime/Saber/Frodo).
5. **Experimental crypto (Adinkra)** — `status: experimental-unproven`, **hybrid-only / never
   sole protection**, clearly flagged; promotion needs real cryptanalysis. (Code-based/non-lattice
   lineage via Gates' doubly-even self-dual codes.)
6. **Rotation = key-type transition** over the Itron KeyState lifecycle (classical→hybrid→pure-PQ,
   0 downtime). Behind the hexagonal ports so algorithm swaps are adapter changes.
7. Keep the keychain DST-byte-locked (same seed → same keys, now incl. PQ).

## Status — first slice landed (2026-08-17), item still OPEN

`tools/setup/persona-keys/derive-pq.ts` + `derive-pq.test.ts`. Key type is now an explicit
parameter over a crypto-agility registry, and the registry's `status` is **computed** from
whether a `keygen` is present, so it cannot claim an implementation that is not there.

**Implemented** (deterministic keygen via `@noble/post-quantum@0.6.1`, already a pinned root
dependency — no new dependency, no hand-rolled primitive):

- `ml-dsa-65` — FIPS 204, path `m/44'/1120'/0'/0'`
- `ml-kem-768` — FIPS 203, path `m/44'/1121'/0'/0'`

**Declared but REFUSED** (asking for one throws; a classical key is never substituted):

- `x-wing` — blocked on scope item 3 (hybrid-by-default) being a maintainer decision
- `slh-dsa` — blocked on FIPS 205 parameter-set choice (twelve sets)
- `adinkra-experimental` — `neverSoleProtection`, refused even if a keygen is later attached

**Not started:** scope items 3 (hybrid policy), 4 (multi-cipher lattice set), 6 (rotation /
KeyState lifecycle), and the `KeyCustody` / `CertAuthority` port wiring. Nothing signs or
encapsulates with these keys yet — this slice produces key MATERIAL and a type registry, and
is not itself a post-quantum security property.

**Correction to the scope text above:** item 1 lists X-Wing as "have". `@noble/post-quantum`
does expose `XWing`, and `better-git-crypt` uses it for KEM — but "have the primitive" is not
"have the policy", and hybrid-by-default is the open decision, so it is declared-not-implemented
here rather than shipped.

## Composes / anchors

Composes: identity+crypto unify (081KVNXBR4S08QG0R0015DHBBN), multi-cipher PQ
(081KSNY2Z0008QG0R002ZAVMEK). Decisions: hexagonal ports, rotation (Itron KeyState), identity+crypto
synthesis (all 2026-06-21). Code: `better-git-crypt` (ML-KEM-768/ML-DSA-65/X-Wing), `derive.ts`.
Anchors: NIST FIPS 203/204/205; X-Wing (Barbosa et al. 2024); Kerckhoffs; Itron power-grid security.
